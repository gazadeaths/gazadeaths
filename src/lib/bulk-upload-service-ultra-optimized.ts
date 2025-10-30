import { prisma } from './prisma';
import { BulkUploadRow, parseCSV } from './csv-utils';
import { downloadFromBlob } from './blob-storage';
import { ChangeType, Gender } from '@prisma/client';

/**
 * ==================================================================================
 * CONFIGURATION - Batch Sizes for Large Dataset Operations
 * ==================================================================================
 * 
 * These constants control how large CSV uploads are processed in batches to avoid
 * hitting PostgreSQL and Prisma limits.
 * 
 * IMPORTANT LIMITS:
 * - PostgreSQL: Max 32,767 bind variables per query (e.g., WHERE id IN (...))
 * - Prisma: Recommended max ~10,000 records per createMany/updateMany operation
 * - Next.js: API route timeout (see next.config.js maxDuration settings)
 * 
 * Adjust these values based on your database performance and record complexity.
 */

/**
 * SELECT Query Batch Size
 * Used for: Fetching existing persons by external IDs
 * Limit reason: PostgreSQL bind variable limit (32,767) and Prisma Accelerate query duration (60s)
 */
const MAX_BATCH_SIZE = 10000;

/**
 * INSERT Operation Batch Size
 * Used for: createMany() and createManyAndReturn() operations
 * Limit reason: Balance between performance and Prisma Accelerate response size limit (20 MiB)
 */
const INSERT_BATCH_SIZE = 5000;

/**
 * UPDATE Operation Batch Size
 * Used for: Updating existing person records in transactions
 * Limit reason: Prisma Accelerate transaction duration limit (90s)
 * Note: Each batch runs individual updates in parallel within a single transaction.
 * Set to 500 to stay well under the 90s transaction timeout with safety margin.
 */
const UPDATE_BATCH_SIZE = 500;

/**
 * DELETE Operation Batch Size
 * Used for: Soft-deleting persons (isDeleted = true) in transactions
 * Limit reason: Smaller batches to avoid transaction timeouts
 * Note: Currently not used as we now mark records as unconfirmed instead of deleting
 */
// const DELETE_BATCH_SIZE = 100;

/**
 * Helper function to batch large arrays and query in chunks
 * This prevents hitting PostgreSQL's 32767 bind variable limit
 */
async function fetchPersonsInBatches(externalIds: string[]) {
  if (externalIds.length <= MAX_BATCH_SIZE) {
    // No batching needed - fetch ALL records (including deleted ones)
    return await prisma.person.findMany({
      where: { 
        externalId: { in: externalIds }
        // Don't filter by isDeleted - we need to know about ALL existing records
      },
      select: { externalId: true, name: true, nameEnglish: true, gender: true, dateOfBirth: true, isDeleted: true },
    });
  }

  // Batch the query
  const results = [];
  for (let i = 0; i < externalIds.length; i += MAX_BATCH_SIZE) {
    const batch = externalIds.slice(i, i + MAX_BATCH_SIZE);
    const batchResults = await prisma.person.findMany({
      where: { 
        externalId: { in: batch }
        // Don't filter by isDeleted - we need to know about ALL existing records
      },
      select: { externalId: true, name: true, nameEnglish: true, gender: true, dateOfBirth: true, isDeleted: true },
    });
    results.push(...batchResults);
    console.log(`  Fetched batch ${Math.floor(i / MAX_BATCH_SIZE) + 1} (${batchResults.length} records)`);
  }
  return results;
}

/**
 * Helper function to batch large arrays and query in chunks (for full person data)
 */
async function fetchFullPersonsInBatches(externalIds: string[]) {
  if (externalIds.length <= MAX_BATCH_SIZE) {
    // No batching needed - fetch ALL records (including deleted ones)
    return await prisma.person.findMany({
      where: { 
        externalId: { in: externalIds }
        // Don't filter by isDeleted - we need to know about ALL existing records
      },
      select: {
        id: true,
        externalId: true,
        name: true,
        nameEnglish: true,
        gender: true,
        dateOfBirth: true,
        dateOfDeath: true,
        locationOfDeathLat: true,
        locationOfDeathLng: true,
        isDeleted: true, // Include this so we can check if it's deleted
      },
    });
  }

  // Batch the query
  const results = [];
  for (let i = 0; i < externalIds.length; i += MAX_BATCH_SIZE) {
    const batch = externalIds.slice(i, i + MAX_BATCH_SIZE);
    const batchResults = await prisma.person.findMany({
      where: { 
        externalId: { in: batch }
        // Don't filter by isDeleted - we need to know about ALL existing records
      },
      select: {
        id: true,
        externalId: true,
        name: true,
        nameEnglish: true,
        gender: true,
        dateOfBirth: true,
        dateOfDeath: true,
        locationOfDeathLat: true,
        locationOfDeathLng: true,
        isDeleted: true, // Include this so we can check if it's deleted
      },
    });
    results.push(...batchResults);
    console.log(`  Fetched batch ${Math.floor(i / MAX_BATCH_SIZE) + 1} (${batchResults.length} records)`);
  }
  return results;
}

// Type for existing Person records fetched from database
interface ExistingPerson {
  id: string;
  externalId: string;
  name: string;
  nameEnglish: string | null;
  gender: Gender;
  dateOfBirth: Date | null;
  dateOfDeath: Date | null;
  locationOfDeathLat: number | null;
  locationOfDeathLng: number | null;
  isDeleted: boolean;
}

// Same interfaces as before...
export interface DiffItem {
  externalId: string;
  changeType: ChangeType;
  current?: {
    name: string;
    nameEnglish: string | null;
    gender: Gender;
    dateOfBirth: Date | null;
  };
  incoming: {
    name: string;
    nameEnglish: string | null;
    gender: Gender;
    dateOfBirth: Date | null;
  };
}

export interface SimulationResult {
  summary: {
    totalIncoming: number;
    inserts: number;
    updates: number;
    deletes: number;
  };
  // Only samples for preview (not full data)
  samples: {
    inserts: DiffItem[];   // First 10 inserts
    updates: DiffItem[];   // First 10 updates
    deletions: DiffItem[]; // First 10 deletions
  };
}

// Internal full diff result (not exposed to client)
interface FullDiffResult {
  inserts: DiffItem[];
  updates: DiffItem[];
  deletes: DiffItem[];
}

export async function simulateBulkUpload(rows: BulkUploadRow[]): Promise<SimulationResult> {
  const incomingIds = rows.map(r => r.external_id);
  const incomingIdsSet = new Set(incomingIds);
  
  console.log(`  Simulating bulk upload with ${rows.length} rows...`);
  
  // SMART FETCHING: First get just IDs (lightweight), then fetch full data only for what we need
  // IMPORTANT: Include deleted records to avoid unique constraint violations
  console.log('  📊 Fetching existing IDs from database...');
  const allExistingIds = await prisma.person.findMany({
    select: { externalId: true, isDeleted: true },
  });
  const existingIdsSet = new Set(allExistingIds.map(p => p.externalId));
  
  // Only fetch full records for IDs that exist in the CSV (potential updates)
  const idsToFetch = rows.filter(r => existingIdsSet.has(r.external_id)).map(r => r.external_id);
  console.log(`  📦 Fetching ${idsToFetch.length} full records for comparison (only potential updates)`);
  
  const matchingPersons = idsToFetch.length > 0 ? await fetchPersonsInBatches(idsToFetch) : [];
  const existingMap = new Map(matchingPersons.map(p => [p.externalId, p]));
  
  const insertDiffs: DiffItem[] = [];
  const updateDiffs: DiffItem[] = [];
  const deleteDiffs: DiffItem[] = []; // Actually "unconfirmed" - records marked as no longer MoH-confirmed
  
  for (const row of rows) {
    const existing = existingMap.get(row.external_id);
    const incomingDate = row.date_of_birth ? new Date(row.date_of_birth) : null;
    
    if (!existing) {
      // Truly new record - no existing record with this externalId
      insertDiffs.push({
        externalId: row.external_id,
        changeType: ChangeType.INSERT,
        incoming: {
          name: row.name,
          nameEnglish: row.name_english,
          gender: row.gender,
          dateOfBirth: incomingDate,
        },
      });
    } else {
      // Record exists (either active or deleted)
      const existingDate = existing.dateOfBirth ? new Date(existing.dateOfBirth) : null;
      const isDifferent = 
        existing.name !== row.name ||
        existing.nameEnglish !== row.name_english ||
        existing.gender !== row.gender ||
        (existingDate?.getTime() !== incomingDate?.getTime()) ||
        existing.isDeleted; // If deleted, we need to un-delete it
      
      if (isDifferent) {
        updateDiffs.push({
          externalId: row.external_id,
          changeType: ChangeType.UPDATE,
          current: {
            name: existing.name,
            nameEnglish: existing.nameEnglish,
            gender: existing.gender,
            dateOfBirth: existing.dateOfBirth,
          },
          incoming: {
            name: row.name,
            nameEnglish: row.name_english,
            gender: row.gender,
            dateOfBirth: incomingDate,
          },
        });
      }
    }
  }
  
  // Mark removed records as deleted
  // Records not in the new MoH upload should be marked isDeleted = true
  // Only consider active records (not already deleted) for deletion
  const idsToDelete = allExistingIds
    .filter(e => !e.isDeleted && !incomingIdsSet.has(e.externalId))
    .map(e => e.externalId);
  
  if (idsToDelete.length > 0) {
    console.log(`  📦 Fetching ${idsToDelete.length} records for deletion`);
    const personsToDelete = await fetchPersonsInBatches(idsToDelete);
    
    for (const existing of personsToDelete) {
      if (!existing.isDeleted) {
        deleteDiffs.push({
          externalId: existing.externalId,
          changeType: ChangeType.DELETE,
          current: {
            name: existing.name,
            nameEnglish: existing.nameEnglish,
            gender: existing.gender,
            dateOfBirth: existing.dateOfBirth,
          },
          incoming: {
            name: existing.name,
            nameEnglish: existing.nameEnglish,
            gender: existing.gender,
            dateOfBirth: existing.dateOfBirth,
          },
        });
      }
    }
  }
  
  return {
    summary: {
      totalIncoming: rows.length,
      inserts: insertDiffs.length,
      updates: updateDiffs.length,
      deletes: deleteDiffs.length,
    },
    samples: {
      inserts: insertDiffs.slice(0, 10),   // First 10 for preview
      updates: updateDiffs.slice(0, 10),   // First 10 for preview
      deletions: deleteDiffs.slice(0, 10), // First 10 for preview
    },
  };
}

/**
 * Internal function: Compute full diff (not just samples)
 * Used by apply endpoint to get complete list of changes
 * This duplicates logic from simulateBulkUpload but returns full arrays
 */
async function computeFullDiff(rows: BulkUploadRow[]): Promise<FullDiffResult> {
  const incomingIds = rows.map(r => r.external_id);
  const incomingIdsSet = new Set(incomingIds);
  
  // Fetch existing IDs (including deleted)
  const allExistingIds = await prisma.person.findMany({
    select: { externalId: true, isDeleted: true },
  });
  const existingIdsSet = new Set(allExistingIds.map(p => p.externalId));
  
  // Fetch full records for potential updates
  const idsToFetch = rows.filter(r => existingIdsSet.has(r.external_id)).map(r => r.external_id);
  const matchingPersons = idsToFetch.length > 0 ? await fetchPersonsInBatches(idsToFetch) : [];
  const existingMap = new Map(matchingPersons.map(p => [p.externalId, p]));
  
  const insertDiffs: DiffItem[] = [];
  const updateDiffs: DiffItem[] = [];
  const deleteDiffs: DiffItem[] = [];
  
  // Compute inserts and updates
  for (const row of rows) {
    const existing = existingMap.get(row.external_id);
    const incomingDate = row.date_of_birth ? new Date(row.date_of_birth) : null;
    
    if (!existing) {
      insertDiffs.push({
        externalId: row.external_id,
        changeType: ChangeType.INSERT,
        incoming: {
          name: row.name,
          nameEnglish: row.name_english,
          gender: row.gender,
          dateOfBirth: incomingDate,
        },
      });
    } else {
      const existingDate = existing.dateOfBirth ? new Date(existing.dateOfBirth) : null;
      const isDifferent = 
        existing.name !== row.name ||
        existing.nameEnglish !== row.name_english ||
        existing.gender !== row.gender ||
        (existingDate?.getTime() !== incomingDate?.getTime()) ||
        existing.isDeleted;
      
      if (isDifferent) {
        updateDiffs.push({
          externalId: row.external_id,
          changeType: ChangeType.UPDATE,
          current: {
            name: existing.name,
            nameEnglish: existing.nameEnglish,
            gender: existing.gender,
            dateOfBirth: existing.dateOfBirth,
          },
          incoming: {
            name: row.name,
            nameEnglish: row.name_english,
            gender: row.gender,
            dateOfBirth: incomingDate,
          },
        });
      }
    }
  }
  
  // Compute deletes (records not in new upload)
  const idsToDelete = allExistingIds
    .filter(e => !e.isDeleted && !incomingIdsSet.has(e.externalId))
    .map(e => e.externalId);
  
  if (idsToDelete.length > 0) {
    const personsToDelete = await fetchPersonsInBatches(idsToDelete);
    for (const existing of personsToDelete) {
      if (!existing.isDeleted) {
        deleteDiffs.push({
          externalId: existing.externalId,
          changeType: ChangeType.DELETE,
          current: {
            name: existing.name,
            nameEnglish: existing.nameEnglish,
            gender: existing.gender,
            dateOfBirth: existing.dateOfBirth,
          },
          incoming: {
            name: existing.name,
            nameEnglish: existing.nameEnglish,
            gender: existing.gender,
            dateOfBirth: existing.dateOfBirth,
          },
        });
      }
    }
  }
  
  return {
    inserts: insertDiffs,
    updates: updateDiffs,
    deletes: deleteDiffs,
  };
}

/**
 * SIMPLIFIED VERSION: Always re-parse CSV from blob
 * No cached simulation data, minimal payload size, maximum reliability
 * 
 * Trade-off: +60s due to re-parsing, but eliminates payload size issues entirely
 */
export async function applyBulkUpload(
  blobUrl: string,
  filename: string,
  blobMetadata: { size: number; sha256: string; contentType: string; previewLines?: string | null },
  comment: string | null,
  dateReleased: Date
): Promise<{ 
  uploadId: string; 
  changeSourceId: string;
  summary: {
    inserts: number;
    updates: number;
    deletes: number;
  };
}> {
  
  console.log(`  ⬇️ Downloading CSV from blob for apply...`);
  const csvBuffer = await downloadFromBlob(blobUrl);
  const csvContent = csvBuffer.toString('utf-8');
  
  console.log(`  📄 Parsing CSV...`);
  const rows = parseCSV(csvContent);
  
  console.log(`  🔄 Computing full diff for apply...`);
  const fullDiff = await computeFullDiff(rows);
  console.log(`  ✅ Diff complete: ${fullDiff.inserts.length} inserts, ${fullDiff.updates.length} updates, ${fullDiff.deletes.length} deletes`);
  
  const hasChanges = fullDiff.inserts.length > 0 || 
                     fullDiff.updates.length > 0 || 
                     fullDiff.deletes.length > 0;
  
  if (!hasChanges) {
    console.log('  ⚡ No changes to apply');
  }
  
  // Extract changes from full diff
  const insertsToApply = fullDiff.inserts;
  const updatesToApply = fullDiff.updates;
  const deletesToApply = fullDiff.deletes;
  
  console.log(`  📊 Changes to apply:`, {
    inserts: insertsToApply.length,
    updates: updatesToApply.length,
    deletes: deletesToApply.length,
  });
  
  // Fetch only the records we need to apply changes to (updates and deletes)
  let existingRecordsMap = new Map<string, ExistingPerson>();
  
  if (hasChanges && (updatesToApply.length > 0 || deletesToApply.length > 0)) {
    const idsToFetch = [
      ...updatesToApply.map(u => u.externalId),
      ...deletesToApply.map(d => d.externalId),
    ];
    
    console.log(`  📦 Fetching ${idsToFetch.length} records for updates/deletes`);
    const existingRecords = await fetchFullPersonsInBatches(idsToFetch);
    existingRecordsMap = new Map(existingRecords.map(p => [p.externalId, p]));
    console.log(`  ✅ Fetched ${existingRecords.length} existing records`);
  }
  
  // Create metadata (blob already uploaded during simulation)
  const changeSource = await prisma.changeSource.create({
    data: {
      type: 'BULK_UPLOAD',
      description: `Bulk upload: ${filename}`,
    },
  });
  
  const bulkUpload = await prisma.bulkUpload.create({
    data: {
      changeSourceId: changeSource.id,
      filename,
      comment,
      dateReleased,
      // Use existing blob URL from simulation
      fileUrl: blobUrl,
      fileSize: blobMetadata.size,
      fileSha256: blobMetadata.sha256,
      contentType: blobMetadata.contentType,
      previewLines: blobMetadata.previewLines,
    },
  });
  
  console.log(`  ✅ Changes determined: ${insertsToApply.length} inserts, ${updatesToApply.length} updates, ${deletesToApply.length} deletes`);
  
  // BULK INSERT - Batched to handle large datasets
  if (insertsToApply.length > 0) {
    const allInsertedPersons = [];
    
    for (let i = 0; i < insertsToApply.length; i += INSERT_BATCH_SIZE) {
      const batch = insertsToApply.slice(i, Math.min(i + INSERT_BATCH_SIZE, insertsToApply.length));
      
      // Insert persons in bulk (batch) - using DiffItem.incoming data
      const insertedPersons = await prisma.person.createManyAndReturn({
        data: batch.map(item => ({
          externalId: item.externalId,
          name: item.incoming.name,
          nameEnglish: item.incoming.nameEnglish,
          gender: item.incoming.gender,
          dateOfBirth: item.incoming.dateOfBirth,
        })),
      });
      
      allInsertedPersons.push(...insertedPersons);
      
      // Create versions in bulk (batch)
      await prisma.personVersion.createMany({
        data: insertedPersons.map(person => ({
          personId: person.id,
          externalId: person.externalId,
          name: person.name,
          nameEnglish: person.nameEnglish,
          gender: person.gender,
          dateOfBirth: person.dateOfBirth,
          versionNumber: 1,
          sourceId: changeSource.id,
          changeType: ChangeType.INSERT,
        })),
      });
      
      console.log(`  ✓ Inserted batch ${Math.floor(i / INSERT_BATCH_SIZE) + 1}: ${insertedPersons.length} persons (total: ${allInsertedPersons.length}/${insertsToApply.length})`);
    }
    
    console.log(`  ✓ Bulk inserted ${insertsToApply.length} persons in ${Math.ceil(insertsToApply.length / INSERT_BATCH_SIZE)} batches`);
  }
  
  // OPTIMIZED BATCH UPDATES - Using simulation results
  if (updatesToApply.length > 0) {
    // Step 1: Get all latest version numbers - batched to avoid bind variable limit
    const personIds = Array.from(existingRecordsMap.values()).map(p => p.id);
    const versionMap = new Map<string, number>();
    
    // Fetch version numbers in batches
    for (let i = 0; i < personIds.length; i += MAX_BATCH_SIZE) {
      const batch = personIds.slice(i, i + MAX_BATCH_SIZE);
      const latestVersions = await prisma.personVersion.groupBy({
        by: ['personId'],
        where: { personId: { in: batch } },
        _max: { versionNumber: true },
      });
      
      latestVersions.forEach(v => {
        versionMap.set(v.personId, v._max.versionNumber || 0);
      });
    }
    
    console.log(`  Fetched latest versions for ${updatesToApply.length} persons`);
    
    // Step 2: Process updates in batches
    for (let i = 0; i < updatesToApply.length; i += UPDATE_BATCH_SIZE) {
      const batch = updatesToApply.slice(i, Math.min(i + UPDATE_BATCH_SIZE, updatesToApply.length));
      
      await prisma.$transaction(async (tx) => {
        const personUpdates = [];
        const versionCreates = [];
        
        for (const updateItem of batch) {
          const existing = existingRecordsMap.get(updateItem.externalId);
          if (!existing) {
            console.warn(`  ⚠️ Warning: Cannot find existing record for ${updateItem.externalId}, skipping`);
            continue;
          }
          
          const currentVersion = versionMap.get(existing.id) || 0;
          const nextVersionNumber = currentVersion + 1;
          
          // Prepare batch updates - using DiffItem.incoming data
          personUpdates.push(
            tx.person.update({
              where: { id: existing.id },
              data: {
                name: updateItem.incoming.name,
                nameEnglish: updateItem.incoming.nameEnglish,
                gender: updateItem.incoming.gender,
                dateOfBirth: updateItem.incoming.dateOfBirth,
                isDeleted: false, // Restore record if it was deleted
                currentVersion: nextVersionNumber,
              },
            })
          );
          
          // Prepare version records
          versionCreates.push({
            personId: existing.id,
            externalId: updateItem.externalId,
            name: updateItem.incoming.name,
            nameEnglish: updateItem.incoming.nameEnglish,
            gender: updateItem.incoming.gender,
            dateOfBirth: updateItem.incoming.dateOfBirth,
            dateOfDeath: existing.dateOfDeath,
            locationOfDeathLat: existing.locationOfDeathLat,
            locationOfDeathLng: existing.locationOfDeathLng,
            isDeleted: false, // Mark as not deleted in version history
            versionNumber: nextVersionNumber,
            sourceId: changeSource.id,
            changeType: ChangeType.UPDATE,
          });
          
          // Update our version map for next batch
          versionMap.set(existing.id, nextVersionNumber);
        }
        
        // Execute all updates in parallel
        await Promise.all(personUpdates);
        
        // Create all version records in one query
        await tx.personVersion.createMany({
          data: versionCreates,
        });
      }, {
        maxWait: 90000,
        timeout: 90000,
      });
      
      console.log(`  Progress: ${Math.min(i + UPDATE_BATCH_SIZE, updatesToApply.length)}/${updatesToApply.length} updates`);
    }
  }
  
  // MARK AS DELETED - Using simulation results
  // Records not in the new MoH upload should be marked as deleted
  if (deletesToApply.length > 0) {
    // Step 1: Get all latest version numbers - batched to avoid bind variable limit
    const deleteIds = deletesToApply.map(d => {
      const existing = existingRecordsMap.get(d.externalId);
      return existing?.id;
    }).filter(id => id !== undefined) as string[];
    
    const deleteVersionMap = new Map<string, number>();
    
    // Fetch version numbers in batches
    for (let i = 0; i < deleteIds.length; i += MAX_BATCH_SIZE) {
      const batch = deleteIds.slice(i, i + MAX_BATCH_SIZE);
      const latestDeleteVersions = await prisma.personVersion.groupBy({
        by: ['personId'],
        where: { personId: { in: batch } },
        _max: { versionNumber: true },
      });
      
      latestDeleteVersions.forEach(v => {
        deleteVersionMap.set(v.personId, v._max.versionNumber || 0);
      });
    }
    
    console.log(`  Fetched latest versions for ${deletesToApply.length} persons to mark as deleted`);
    
    // Step 2: Process delete operations in batches
    for (let i = 0; i < deletesToApply.length; i += UPDATE_BATCH_SIZE) {
      const batch = deletesToApply.slice(i, Math.min(i + UPDATE_BATCH_SIZE, deletesToApply.length));
      
      await prisma.$transaction(async (tx) => {
        const personUpdates = [];
        const versionCreates = [];
        
        for (const deleteItem of batch) {
          const existing = existingRecordsMap.get(deleteItem.externalId);
          if (!existing) {
            console.warn(`  ⚠️ Warning: Cannot find existing record for ${deleteItem.externalId}, skipping`);
            continue;
          }
          
          const currentVersion = deleteVersionMap.get(existing.id) || 0;
          const nextVersionNumber = currentVersion + 1;
          
          // Prepare batch updates: Mark as deleted
          personUpdates.push(
            tx.person.update({
              where: { id: existing.id },
              data: { 
                isDeleted: true,
                currentVersion: nextVersionNumber,
              },
            })
          );
          
          // Prepare version records (using current data from DiffItem.current)
          versionCreates.push({
            personId: existing.id,
            externalId: existing.externalId,
            name: existing.name,
            nameEnglish: existing.nameEnglish,
            gender: existing.gender,
            dateOfBirth: existing.dateOfBirth,
            dateOfDeath: existing.dateOfDeath,
            locationOfDeathLat: existing.locationOfDeathLat,
            locationOfDeathLng: existing.locationOfDeathLng,
            versionNumber: nextVersionNumber,
            sourceId: changeSource.id,
            changeType: ChangeType.UPDATE,
            isDeleted: true,
          });
        }
        
        // Execute all updates in parallel
        await Promise.all(personUpdates);
        
        // Create all version records in one query
        await tx.personVersion.createMany({
          data: versionCreates,
        });
      }, {
        maxWait: 90000,
        timeout: 90000,
      });
      
      console.log(`  Progress: ${Math.min(i + UPDATE_BATCH_SIZE, deletesToApply.length)}/${deletesToApply.length} records marked as deleted`);
    }
  }
  
  return {
    uploadId: bulkUpload.id,
    changeSourceId: changeSource.id,
    summary: {
      inserts: insertsToApply.length,
      updates: updatesToApply.length,
      deletes: deletesToApply.length,
    },
  };
}
