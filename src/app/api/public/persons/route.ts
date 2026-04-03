import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Public Persons List Endpoint
 * No authentication required
 * Returns only active, non-sensitive person records
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters for pagination, search, and filtering
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 250); // Max 250 per page
    const skip = (page - 1) * limit;
    const search = searchParams.get('search'); // Optional name search
    const filter = searchParams.get('filter'); // Optional filter
    const minAge = searchParams.get('minAge'); // Optional minimum age
    const maxAge = searchParams.get('maxAge'); // Optional maximum age

    // Build base where clause - never show deleted records publicly
    const whereClause: Prisma.PersonWhereInput = {
      isDeleted: false,
    };

    // Add search filter if provided
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameEnglish: { contains: search, mode: 'insensitive' } },
        { externalId: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Add age filter if provided (calculate based on date of birth)
    if (minAge || maxAge) {
      const now = new Date();
      const conditions: Prisma.PersonWhereInput[] = [];
      
      if (minAge) {
        // Maximum date of birth for minimum age (born this many years ago or earlier)
        const maxDob = new Date(now.getFullYear() - parseInt(minAge), now.getMonth(), now.getDate());
        conditions.push({ dateOfBirth: { lte: maxDob } });
      }
      
      if (maxAge) {
        // Minimum date of birth for maximum age (born this many years ago or later)
        const minDob = new Date(now.getFullYear() - parseInt(maxAge) - 1, now.getMonth(), now.getDate());
        conditions.push({ dateOfBirth: { gte: minDob } });
      }
      
      if (conditions.length > 0) {
        whereClause.AND = whereClause.AND ? [...(Array.isArray(whereClause.AND) ? whereClause.AND : [whereClause.AND]), ...conditions] : conditions;
      }
    }

    // Apply additional filters (public-safe only)
    switch (filter) {
      case 'with_photo':
        whereClause.photoUrlThumb = { not: null };
        break;
      
      case 'with_location':
        const locationConditions = [
          { locationOfDeathLat: { not: null } },
          { locationOfDeathLng: { not: null } }
        ];
        whereClause.AND = whereClause.AND ? [...(Array.isArray(whereClause.AND) ? whereClause.AND : [whereClause.AND]), ...locationConditions] : locationConditions;
        break;
      
      case 'recent':
        // Updated in last 30 days
        whereClause.updatedAt = {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        };
        break;
    }

    // Fetch persons with pagination
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
          photoUrlThumb: true, // Only thumbnail, not original
          isDeleted: true,
          currentVersion: true,
          createdAt: true,
          updatedAt: true,
          // Do NOT expose: photoUrlOriginal
        },
        orderBy: [
          { updatedAt: 'desc' },
          { id: 'asc' }  // Stable tiebreaker for consistent ordering
        ],
        skip,
        take: limit,
      }),
      prisma.person.count({ where: whereClause })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        persons,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        filters: {
          search: search || null,
          filter: filter || null,
        }
      }
    });

  } catch (error) {
    console.error('Error fetching public persons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch persons' },
      { status: 500 }
    );
  }
}

