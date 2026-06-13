import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// PATCH /api/projects/[id]/issues/[issueId] — Update issue (dismiss/undismiss)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, issueId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const issue = await db.technicalIssue.findFirst({
      where: { id: issueId, projectId },
    });

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    const body = await request.json();
    const { dismissed } = body;

    if (typeof dismissed !== 'boolean') {
      return NextResponse.json(
        { error: 'dismissed (boolean) is required' },
        { status: 400 }
      );
    }

    const updated = await db.technicalIssue.update({
      where: { id: issueId },
      data: {
        dismissed,
        dismissedBy: dismissed ? user.id : null,
        dismissedAt: dismissed ? new Date() : null,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update issue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE is not allowed — issues are immutable
export async function DELETE() {
  return NextResponse.json(
    { error: 'Issues cannot be deleted — they are immutable. Use PATCH to dismiss.' },
    { status: 405 }
  );
}
