import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { prioritizeProductsByRevenue, getTopRevenueOpportunities } from '@/lib/ecommerce';

// GET /api/projects/[id]/products/revenue-prioritization — Get products prioritized by revenue and SEO score
export async function GET(
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

    const { searchParams } = new URL(request.url);
    const topOnly = searchParams.get('topOnly') === 'true';
    const limit = searchParams.get('limit')
      ? Math.min(100, Math.max(1, parseInt(searchParams.get('limit')!, 10)))
      : undefined;

    let data;
    if (topOnly) {
      data = await getTopRevenueOpportunities(projectId, limit ?? 20);
    } else {
      data = await prioritizeProductsByRevenue(projectId);
      if (limit) {
        data = data.slice(0, limit);
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Revenue prioritization error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen omzetprioritering' },
      { status: 500 }
    );
  }
}
