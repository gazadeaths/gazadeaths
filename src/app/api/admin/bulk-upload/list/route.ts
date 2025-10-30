import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-utils';

export async function GET() {
  try {
    // Check authentication and admin role
    await requireAdmin();
    
    // Fetch all bulk uploads with their change sources
    const bulkUploads = await prisma.bulkUpload.findMany({
      include: {
        changeSource: {
          include: {
            versions: {
              select: {
                id: true,
                versionNumber: true,
                changeType: true,
                isDeleted: true,
              },
            },
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });
    
    // Calculate stats for each upload
    // Note: canRollback is always true now - actual rollback eligibility is checked server-side when attempting rollback
    const uploadsWithStats = bulkUploads.map((upload) => {
      const versions = upload.changeSource.versions;
      
      // Calculate stats by counting changeType per version
      const inserts = versions.filter(v => v.changeType === 'INSERT').length;
      const updates = versions.filter(v => v.changeType === 'UPDATE').length;
      const deletes = versions.filter(v => v.changeType === 'DELETE').length;
      
      return {
        id: upload.id,
        filename: upload.filename,
        comment: upload.comment,
        dateReleased: upload.dateReleased,
        uploadedAt: upload.uploadedAt,
        fileUrl: upload.fileUrl, // Blob storage URL for downloading original CSV
        fileSize: upload.fileSize, // File size in bytes
        stats: {
          total: versions.length,
          inserts,
          updates,
          deletes,
        },
      };
    });
    
    return NextResponse.json({
      success: true,
      uploads: uploadsWithStats,
    });
  } catch (error) {
    console.error('List error:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch bulk uploads' },
      { status: 500 }
    );
  }
}
