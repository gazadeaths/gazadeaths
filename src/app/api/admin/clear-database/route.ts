import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit-log';
import { del } from '@vercel/blob';

export async function POST() {
  try {
    // Check authentication and admin role
    await requireAdmin();

    // Step 0: Collect all blob URLs before deleting database records
    const blobUrls: string[] = [];
    
    // Get all bulk upload file URLs
    const bulkUploads = await prisma.bulkUpload.findMany({
      select: { fileUrl: true }
    });
    bulkUploads.forEach((upload: typeof bulkUploads[number]) => {
      if (upload.fileUrl) blobUrls.push(upload.fileUrl);
    });
    
    // Get all person photo URLs (both thumbnails and originals)
    const persons = await prisma.person.findMany({
      select: { photoUrlThumb: true, photoUrlOriginal: true }
    });
    persons.forEach((person: typeof persons[number]) => {
      if (person.photoUrlThumb) blobUrls.push(person.photoUrlThumb);
      if (person.photoUrlOriginal) blobUrls.push(person.photoUrlOriginal);
    });
    
    console.log(`[Clear Database] Found ${blobUrls.length} blobs to delete`);
    
    // Delete all blobs from Vercel Blob storage
    let blobsDeleted = 0;
    if (blobUrls.length > 0) {
      try {
        await del(blobUrls);
        blobsDeleted = blobUrls.length;
        console.log(`[Clear Database] Deleted ${blobsDeleted} blobs`);
      } catch (blobError) {
        console.error('[Clear Database] Error deleting blobs:', blobError);
        // Continue with database deletion even if blob deletion fails
      }
    }

    // Clear all data in the correct order (respecting foreign keys)
    // MUST delete children before parents to avoid FK constraint violations
    
    // Step 1: Delete records that reference Person
    const communitySubmissions = await prisma.communitySubmission.deleteMany();
    const personVersions = await prisma.personVersion.deleteMany();
    
    // Step 2: Delete Person records (now that children are gone)
    const personsDeleted = await prisma.person.deleteMany();
    
    // Step 3: Delete independent tables (no FK dependencies)
    const [bulkUploadsDeleted, changeSources] = await Promise.all([
      prisma.bulkUpload.deleteMany(),
      prisma.changeSource.deleteMany(),
    ]);

    // Create audit log for this action
    await createAuditLog({
      action: AuditAction.DATABASE_CLEARED,
      resourceType: ResourceType.SYSTEM,
      resourceId: 'database-clear',
      description: `Database cleared: ${personsDeleted.count} persons, ${personVersions.count} versions, ${bulkUploadsDeleted.count} uploads, ${changeSources.count} sources, ${communitySubmissions.count} submissions, ${blobsDeleted} blobs`,
      metadata: {
        persons: personsDeleted.count,
        versions: personVersions.count,
        uploads: bulkUploadsDeleted.count,
        sources: changeSources.count,
        submissions: communitySubmissions.count,
        blobs: blobsDeleted,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Database and blobs cleared successfully',
      stats: {
        persons: personsDeleted.count,
        versions: personVersions.count,
        uploads: bulkUploadsDeleted.count,
        sources: changeSources.count,
        submissions: communitySubmissions.count,
        blobs: blobsDeleted,
      },
    });
  } catch (error) {
    console.error('Clear database error:', error);

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to clear database' },
      { status: 500 }
    );
  }
}

