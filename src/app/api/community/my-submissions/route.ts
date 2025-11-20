import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // All authenticated users can access their submissions (admin, moderator, community)
    // No role restriction needed

    // Fetch user's submissions
    const submissions = await prisma.communitySubmission.findMany({
      where: {
        submittedBy: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        type: true,
        status: true,
        proposedPayload: true,
        reason: true,
        createdAt: true,
        approvedAt: true,
        decisionNote: true,
        personId: true,
        baseVersionId: true,
      },
    });

    return NextResponse.json({
      submissions: submissions.map((s: typeof submissions[number]) => ({
        id: s.id,
        type: s.type,
        status: s.status,
        proposedPayload: s.proposedPayload,
        reason: s.reason,
        createdAt: s.createdAt,
        approvedAt: s.approvedAt,
        decisionNote: s.decisionNote,
        personId: s.personId,
      })),
    });

  } catch (error) {
    console.error('Fetch submissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

