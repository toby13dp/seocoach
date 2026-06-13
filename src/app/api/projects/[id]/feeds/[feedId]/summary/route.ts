import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getFeedValidationSummary } from '@/lib/product-feeds';

// GET /api/projects/[id]/feeds/[feedId]/summary — Get feed validation summary with top issues
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feedId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, feedId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const summary = await getFeedValidationSummary(feedId, projectId);

    return NextResponse.json({ data: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Get feed summary error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen feed-samenvatting' },
      { status: 500 }
    );
  }
}
