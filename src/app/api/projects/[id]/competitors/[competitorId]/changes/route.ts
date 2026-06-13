import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getCompetitorChanges, dismissChange } from '@/lib/competitor';

// GET /api/projects/[id]/competitors/[competitorId]/changes — List changes for a competitor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; competitorId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, competitorId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const changeType = searchParams.get('changeType') ?? undefined;
    const dismissedStr = searchParams.get('dismissed');
    const dismissed = dismissedStr !== null ? dismissedStr === 'true' : undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));

    const changes = await getCompetitorChanges(competitorId, {
      changeType,
      dismissed,
      limit,
      offset,
    });

    return NextResponse.json({
      data: changes,
      meta: { total: changes.length, limit, offset },
    });
  } catch (error) {
    console.error('List competitor changes error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
