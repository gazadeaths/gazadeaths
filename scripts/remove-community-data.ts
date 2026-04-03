import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { del } from '@vercel/blob';

const dryRun = process.argv.includes('--dry-run');

const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL is not set');
  process.exit(1);
}

const isAccelerate = dbUrl.startsWith('prisma://') || dbUrl.startsWith('prisma+postgres://');
const pool = isAccelerate ? null : new pg.Pool({ connectionString: dbUrl });
const adapter = pool ? new PrismaPg(pool) : undefined;

const prisma = new PrismaClient({
  ...(isAccelerate ? { accelerateUrl: dbUrl } : { adapter }),
});

async function main() {
  console.log(`\n=== Remove Community-Submitted Data ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Step 1: Collect photo blob URLs before nulling
  const personsWithPhotos = await prisma.person.findMany({
    where: {
      OR: [
        { photoUrlOriginal: { not: null } },
        { photoUrlThumb: { not: null } },
      ],
    },
    select: { photoUrlOriginal: true, photoUrlThumb: true },
  });

  const blobUrls: string[] = [];
  for (const p of personsWithPhotos) {
    if (p.photoUrlOriginal) blobUrls.push(p.photoUrlOriginal);
    if (p.photoUrlThumb) blobUrls.push(p.photoUrlThumb);
  }

  // Step 2: Pre-flight counts
  const submissionCount = await prisma.communitySubmission.count();
  const communityVersionCount = await prisma.personVersion.count({
    where: { source: { type: 'COMMUNITY_SUBMISSION' } },
  });
  const communitySourceCount = await prisma.changeSource.count({
    where: { type: 'COMMUNITY_SUBMISSION' },
  });
  const personsWithCommunityData = await prisma.person.count({
    where: {
      OR: [
        { dateOfDeath: { not: null } },
        { locationOfDeathLat: { not: null } },
        { locationOfDeathLng: { not: null } },
        { photoUrlOriginal: { not: null } },
        { photoUrlThumb: { not: null } },
      ],
    },
  });

  console.log('--- Pre-flight counts ---');
  console.log(`  CommunitySubmission records: ${submissionCount}`);
  console.log(`  PersonVersion (community):   ${communityVersionCount}`);
  console.log(`  ChangeSource (community):    ${communitySourceCount}`);
  console.log(`  Persons with community data: ${personsWithCommunityData}`);
  console.log(`  Blob URLs to delete:         ${blobUrls.length}`);
  console.log('');

  if (dryRun) {
    console.log('DRY RUN complete. No changes made.');
    return;
  }

  // Step 3: Database transaction
  console.log('Starting database transaction...');
  const results = await prisma.$transaction(async (tx) => {
    // 3a: Delete all CommunitySubmission records (FK refs to PersonVersion)
    const deletedSubmissions = await tx.communitySubmission.deleteMany({});
    console.log(`  Deleted ${deletedSubmissions.count} CommunitySubmission records`);

    // 3b: Delete community PersonVersion records
    const deletedVersions = await tx.personVersion.deleteMany({
      where: { source: { type: 'COMMUNITY_SUBMISSION' } },
    });
    console.log(`  Deleted ${deletedVersions.count} PersonVersion records`);

    // 3c: Delete community ChangeSource records
    const deletedSources = await tx.changeSource.deleteMany({
      where: { type: 'COMMUNITY_SUBMISSION' },
    });
    console.log(`  Deleted ${deletedSources.count} ChangeSource records`);

    // 3d: Null out community fields on all Person records
    const updatedPersons = await tx.person.updateMany({
      data: {
        dateOfDeath: null,
        locationOfDeathLat: null,
        locationOfDeathLng: null,
        photoUrlOriginal: null,
        photoUrlThumb: null,
      },
    });
    console.log(`  Cleaned ${updatedPersons.count} Person records`);

    // 3e: Recalculate Person.currentVersion
    await tx.$executeRaw`
      UPDATE "Person" p
      SET "currentVersion" = COALESCE(
        (SELECT MAX(pv."versionNumber")
         FROM "PersonVersion" pv
         WHERE pv."personId" = p.id),
        1
      )
    `;
    console.log('  Recalculated Person.currentVersion');

    return {
      submissions: deletedSubmissions.count,
      versions: deletedVersions.count,
      sources: deletedSources.count,
      persons: updatedPersons.count,
    };
  }, { timeout: 120000 });

  console.log('\nTransaction committed successfully.');

  // Step 4: Delete photo blobs from Vercel Blob
  if (blobUrls.length > 0) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.log('\nWARNING: BLOB_READ_WRITE_TOKEN not set. Skipping blob deletion.');
      console.log(`  ${blobUrls.length} orphaned blobs remain in Vercel Blob storage.`);
    } else {
      console.log(`\nDeleting ${blobUrls.length} blobs from Vercel Blob...`);
      try {
        for (let i = 0; i < blobUrls.length; i += 1000) {
          const batch = blobUrls.slice(i, i + 1000);
          await del(batch);
          console.log(`  Deleted batch ${Math.floor(i / 1000) + 1} (${batch.length} blobs)`);
        }
      } catch (err) {
        console.error('  WARNING: Blob deletion failed:', err);
        console.log('  Database is clean. Orphaned blobs can be cleaned later.');
      }
    }
  }

  // Step 5: Write audit log
  try {
    await prisma.auditLog.create({
      data: {
        userId: 'MIGRATION_SCRIPT',
        action: 'COMMUNITY_DATA_PURGED',
        resourceType: 'SYSTEM',
        resourceId: 'migration-remove-community-data',
        description: `Purged community data: ${results.submissions} submissions, ${results.versions} versions, ${results.sources} sources, ${blobUrls.length} blobs; ${results.persons} persons cleaned`,
        metadata: { ...results, blobs: blobUrls.length, executedAt: new Date().toISOString() },
      },
    });
    console.log('\nAudit log entry created.');
  } catch (err) {
    console.error('WARNING: Failed to create audit log:', err);
  }

  // Summary
  console.log('\n=== Migration Complete ===');
  console.log(`  Submissions deleted: ${results.submissions}`);
  console.log(`  Versions deleted:    ${results.versions}`);
  console.log(`  Sources deleted:     ${results.sources}`);
  console.log(`  Persons cleaned:     ${results.persons}`);
  console.log(`  Blobs deleted:       ${blobUrls.length}`);
}

main()
  .catch((err) => {
    console.error('\nFATAL ERROR:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (pool) await pool.end();
  });
