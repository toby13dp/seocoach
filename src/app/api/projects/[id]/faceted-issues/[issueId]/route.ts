import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { resolveFacetedIssue } from '@/lib/ecommerce';

// PATCH /api/projects/[id]/faceted-issues/[issueId] — Resolve a faceted navigation issue
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, issueId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const resolved = await resolveFacetedIssue(issueId, projectId);

    return NextResponse.json({ data: resolved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Resolve faceted issue error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij oplossen facet-navigatie probleem' },
      { status: 500 }
    );
  }
}
