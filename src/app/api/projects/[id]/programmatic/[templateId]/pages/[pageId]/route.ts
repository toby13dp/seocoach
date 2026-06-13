import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/programmatic/[templateId]/pages/[pageId] — Get page details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string; pageId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, templateId, pageId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const page = await db.programmaticPage.findFirst({
      where: {
        id: pageId,
        templateId,
        projectId,
        deletedAt: null,
      },
    });

    if (!page) {
      return NextResponse.json(
        { error: 'Pagina niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: page });
  } catch (error) {
    console.error('Get programmatic page error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/programmatic/[templateId]/pages/[pageId] — Approve/reject page
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string; pageId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, templateId, pageId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const page = await db.programmaticPage.findFirst({
      where: { id: pageId, templateId, projectId, deletedAt: null },
    });

    if (!page) {
      return NextResponse.json(
        { error: 'Pagina niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (body.action === 'approve') {
      const updated = await db.programmaticPage.update({
        where: { id: pageId },
        data: {
          status: 'APPROVED',
          approvedBy: user.id,
          approvedAt: new Date(),
        },
      });
      return NextResponse.json({ data: updated });
    } else if (body.action === 'reject') {
      const rejectionReasons = body.reasons ?? ['Handmatig afgewezen'];
      const updated = await db.programmaticPage.update({
        where: { id: pageId },
        data: {
          status: 'REJECTED',
          rejectionReasons: JSON.stringify(rejectionReasons),
          approvedBy: null,
          approvedAt: null,
        },
      });
      return NextResponse.json({ data: updated });
    } else {
      return NextResponse.json(
        { error: 'Ongeldige actie. Gebruik "approve" of "reject".' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Update programmatic page error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
