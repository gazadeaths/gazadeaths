import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireModerator } from '@/lib/auth-utils';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated and has moderator or admin role
    await requireModerator();

    // Get query parameters for pagination and filtering
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;
    const filter = searchParams.get('filter'); // Filter type
    const search = searchParams.get('search'); // Search query

    // Build search condition
    const searchCondition: Prisma.PersonWhereInput['OR'] = search && search.trim() ? [
      { name: { contains: search.trim(), mode: 'insensitive' } },
      { nameEnglish: { contains: search.trim(), mode: 'insensitive' } },
      { externalId: { contains: search.trim(), mode: 'insensitive' } },
    ] : undefined;

    // Build where clause based on filter
    let whereClause: Prisma.PersonWhereInput = {};

    switch (filter) {
      case 'deleted_by_moh':
        // Records marked as deleted
        whereClause = {
          isDeleted: true,
          ...(searchCondition ? { OR: searchCondition } : {})
        };
        break;

      case 'updated_by_community': {
        // Need to find persons with UPDATE versions from COMMUNITY_SUBMISSION
        const personIds = await prisma.personVersion.findMany({
          where: {
            changeType: 'UPDATE',
            source: {
              type: 'COMMUNITY_SUBMISSION'
            }
          },
          select: {
            personId: true
          },
          distinct: ['personId']
        }).then((versions) => versions.map((v) => v.personId));

        whereClause = {
          id: { in: personIds.length > 0 ? personIds : ['no-match'] },
          ...(searchCondition ? { OR: searchCondition } : {})
        };
        break;
      }

      case 'updated_by_moh': {
        // Need to find persons with UPDATE versions from BULK_UPLOAD
        const personIds = await prisma.personVersion.findMany({
          where: {
            changeType: 'UPDATE',
            source: {
              type: 'BULK_UPLOAD'
            }
          },
          select: {
            personId: true
          },
          distinct: ['personId']
        }).then((versions) => versions.map((v) => v.personId));

        whereClause = {
          id: { in: personIds.length > 0 ? personIds : ['no-match'] },
          ...(searchCondition ? { OR: searchCondition } : {})
        };
        break;
      }

      default:
        // No filter - return all non-deleted persons
        whereClause = {
          isDeleted: false,
          ...(searchCondition ? { OR: searchCondition } : {})
        };
    }

    // Fetch persons with pagination and filtering
    const [persons, total] = await Promise.all([
      prisma.person.findMany({
        where: whereClause,
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
          photoUrlThumb: true,
          isDeleted: true,
          createdAt: true,
          updatedAt: true,
          versions: {
            orderBy: {
              versionNumber: 'desc'
            },
            take: 1,
            select: {
              versionNumber: true,
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.person.count({ where: whereClause })
    ]);
    
    // Transform to include version number directly
    const personsWithVersion = persons.map((person: typeof persons[number]) => ({
      ...person,
      currentVersion: person.versions[0]?.versionNumber || 0,
      versions: undefined, // Remove the versions array from response
    }));

    return NextResponse.json({
      success: true,
      data: {
        persons: personsWithVersion,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        filter: filter || 'all'
      }
    });

  } catch (error) {
    console.error('Error fetching persons:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch persons' },
      { status: 500 }
    );
  }
}
