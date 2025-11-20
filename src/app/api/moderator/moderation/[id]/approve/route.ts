import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireModerator } from '@/lib/auth-utils';
import { currentUser } from '@clerk/nextjs/server';
import { createAuditLogWithUser } from '@/lib/audit-log';

type ProposedEditPayload = Partial<{
  dateOfDeath: string;
  locationOfDeathLat: number;
  locationOfDeathLng: number;
  photoUrlThumb: string;
  photoUrlOriginal: string;
}>;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireModerator();
    const { id } = await context.params;

    const body = await request.json();
    const { note } = body;

    // Fetch the submission
    const submission = await prisma.communitySubmission.findUnique({
      where: { id },
      include: {
        person: {
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
            },
          },
        },
        baseVersion: true,
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (submission.status !== 'PENDING') {
      return NextResponse.json({ error: 'Submission is not pending' }, { status: 400 });
    }

    const clerkUser = await currentUser();

    // Only EDIT type is supported now
    if (submission.type !== 'EDIT') {
      return NextResponse.json({ error: 'Invalid submission type' }, { status: 400 });
    }

    if (!submission.person) {
      return NextResponse.json({ error: 'Person not found for edit submission' }, { status: 404 });
    }

    const person = submission.person;
    const payload = submission.proposedPayload as ProposedEditPayload;
    const latestVersion = person.versions[0];

    if (!latestVersion) {
      return NextResponse.json({ error: 'No version history found' }, { status: 500 });
    }

    // Check if base version is stale - auto-mark as SUPERSEDED
    if (submission.baseVersion && submission.baseVersion.versionNumber < latestVersion.versionNumber) {
      await prisma.communitySubmission.update({
        where: { id: submission.id },
        data: {
          status: 'SUPERSEDED',
          approvedBy: user.userId,
          approvedAt: new Date(),
          decisionNote: note || 'Record was updated after this submission was made. This edit is now outdated.',
        },
      });

      // Create audit log
      await createAuditLogWithUser(
        clerkUser!.id,
        clerkUser!.emailAddresses[0]?.emailAddress || null,
        {
          action: 'COMMUNITY_SUBMISSION_SUPERSEDED',
          resourceType: 'COMMUNITY_SUBMISSION',
          resourceId: submission.id,
          description: `Marked EDIT submission as SUPERSEDED for ${person.name} (base version ${submission.baseVersion.versionNumber} < current ${latestVersion.versionNumber})`,
          metadata: {
            submissionId: submission.id,
            personId: person.id,
            externalId: person.externalId,
            submittedBy: submission.submittedBy,
            baseVersion: submission.baseVersion.versionNumber,
            currentVersion: latestVersion.versionNumber,
            note: note || null,
          },
        }
      );

      return NextResponse.json({ 
        success: true, 
        message: 'Submission marked as superseded (record was updated after submission)' 
      });
    }

    await prisma.$transaction(async (tx: any) => {
      // Create change source
      const changeSource = await tx.changeSource.create({
        data: {
          type: 'COMMUNITY_SUBMISSION',
          description: `Community-submitted edit to ${person.name} (${person.externalId})`,
        },
      });

      // Update person record
      const updateData: Record<string, string | Date | number | null> = {};
      if ('dateOfDeath' in payload) updateData.dateOfDeath = payload.dateOfDeath ? new Date(payload.dateOfDeath) : null;
      if ('locationOfDeathLat' in payload) updateData.locationOfDeathLat = typeof payload.locationOfDeathLat === 'number' ? payload.locationOfDeathLat : null;
      if ('locationOfDeathLng' in payload) updateData.locationOfDeathLng = typeof payload.locationOfDeathLng === 'number' ? payload.locationOfDeathLng : null;
      if ('photoUrlThumb' in payload) updateData.photoUrlThumb = payload.photoUrlThumb || null;
      if ('photoUrlOriginal' in payload) updateData.photoUrlOriginal = payload.photoUrlOriginal || null;
      updateData.currentVersion = latestVersion.versionNumber + 1;

      const updatedPerson = await tx.person.update({
        where: { id: person.id },
        data: updateData,
      });

      // Create new version
      const version = await tx.personVersion.create({
        data: {
          personId: person.id,
          externalId: person.externalId,
          name: person.name,
          nameEnglish: person.nameEnglish,
          gender: person.gender,
          dateOfBirth: person.dateOfBirth,
          dateOfDeath: updatedPerson.dateOfDeath,
          locationOfDeathLat: updatedPerson.locationOfDeathLat,
          locationOfDeathLng: updatedPerson.locationOfDeathLng,
          photoUrlThumb: updatedPerson.photoUrlThumb,
          photoUrlOriginal: updatedPerson.photoUrlOriginal,
          versionNumber: latestVersion.versionNumber + 1,
          sourceId: changeSource.id,
          changeType: 'UPDATE',
          isDeleted: false,
        },
      });

      // Update submission
      await tx.communitySubmission.update({
        where: { id: submission.id },
        data: {
          status: 'APPROVED',
          approvedBy: user.userId,
          approvedAt: new Date(),
          decisionNote: note || null,
          approvedChangeSourceId: changeSource.id,
          appliedVersionId: version.id,
        },
      });

      // Create audit log
      await createAuditLogWithUser(
        clerkUser!.id,
        clerkUser!.emailAddresses[0]?.emailAddress || null,
        {
          action: 'COMMUNITY_SUBMISSION_APPROVED',
          resourceType: 'COMMUNITY_SUBMISSION',
          resourceId: submission.id,
          description: `Approved EDIT submission for ${person.name}`,
          metadata: {
            submissionId: submission.id,
            personId: person.id,
            externalId: person.externalId,
            changedFields: Object.keys(payload),
            submittedBy: submission.submittedBy,
            note: note || null,
          },
        }
      );
    });

    return NextResponse.json({ success: true, message: 'Edit approved and applied' });

  } catch (error) {
    console.error('Approve submission error:', error);
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
