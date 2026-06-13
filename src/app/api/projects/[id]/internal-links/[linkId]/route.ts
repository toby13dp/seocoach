import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { approveLink, rejectLink, generateLinkDiff } from '@/lib/linking/approval-workflow';

// GET /api/projects/[id]/internal-links/[linkId] — Get link details with diff
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, linkId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const link = await db.internalLink.findFirst({
      where: { id: linkId, projectId, deletedAt: null },
    });

    if (!link) {
      return NextResponse.json(
        { error: 'Interne link niet gevonden' },
        { status: 404 }
      );
    }

    // Generate diff for review context
    let diff: Awaited<ReturnType<typeof generateLinkDiff>> | null = null;
    try {
      diff = await generateLinkDiff(linkId);
    } catch {
      // Diff generation may fail if source page content is unavailable
    }

    return NextResponse.json({ data: { ...link, diff } });
  } catch (error) {
    console.error('Get internal link error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/internal-links/[linkId] — Approve/reject link
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, linkId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const link = await db.internalLink.findFirst({
      where: { id: linkId, projectId, deletedAt: null },
    });

    if (!link) {
      return NextResponse.json(
        { error: 'Interne link niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (body.action === 'approve') {
      const result = await approveLink(linkId, user.id);
      return NextResponse.json({ data: result });
    } else if (body.action === 'reject') {
      const result = await rejectLink(linkId, user.id, body.reason);
      return NextResponse.json({ data: result });
    } else {
      return NextResponse.json(
        { error: 'Ongeldige actie. Gebruik "approve" of "reject".' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Update internal link error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — Not allowed (immutable after creation)
export async function DELETE() {
  return NextResponse.json(
    { error: 'Interne links kunnen niet worden verwijderd. Ze zijn onveranderlijk na aanmaak.' },
    { status: 405 }
  );
}
