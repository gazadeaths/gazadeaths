import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireModerator } from '@/lib/auth-utils';

export async function GET() {
  try {
    await requireModerator();

    // Fetch all pending submissions
    const submissions = await prisma.communitySubmission.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        person: true,
        baseVersion: true,
      },
      orderBy: {
        createdAt: 'asc', // Oldest first (FIFO)
      },
    });

    return NextResponse.json({
      submissions: submissions.map((s: typeof submissions[number]) => ({
        id: s.id,
        type: s.type,
        status: s.status,
        proposedPayload: s.proposedPayload,
        reason: s.reason,
        submittedBy: s.submittedBy,
        createdAt: s.createdAt,
        person: s.person ? {
          id: s.person.id,
          externalId: s.person.externalId,
          name: s.person.name,
          gender: s.person.gender,
          dateOfBirth: s.person.dateOfBirth,
          dateOfDeath: s.person.dateOfDeath,
          locationOfDeathLat: s.person.locationOfDeathLat,
          locationOfDeathLng: s.person.locationOfDeathLng,
        } : null,
        baseVersion: s.baseVersion ? {
          versionNumber: s.baseVersion.versionNumber,
          dateOfDeath: s.baseVersion.dateOfDeath,
          locationOfDeathLat: s.baseVersion.locationOfDeathLat,
          locationOfDeathLng: s.baseVersion.locationOfDeathLng,
        } : null,
      })),
    });
  } catch (error) {
    console.error('Fetch moderation list error:', error);
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

