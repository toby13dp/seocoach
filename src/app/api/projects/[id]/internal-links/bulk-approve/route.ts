import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { bulkApproveLinks } from '@/lib/linking/approval-workflow';

// POST /api/projects/[id]/internal-links/bulk-approve — Bulk approve links
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.linkIds || !Array.isArray(body.linkIds) || body.linkIds.length === 0) {
      return NextResponse.json(
        { error: 'Een niet-lege array van link-ID\'s is vereist' },
        { status: 400 }
      );
    }

    const result = await bulkApproveLinks(body.linkIds, user.id);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Bulk approve links error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
