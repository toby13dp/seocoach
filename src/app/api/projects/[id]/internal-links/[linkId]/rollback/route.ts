import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { rollbackLink } from '@/lib/linking/approval-workflow';

// POST /api/projects/[id]/internal-links/[linkId]/rollback — Rollback a published link
export async function POST(
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

    const result = await rollbackLink(linkId, user.id);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Rollback internal link error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
