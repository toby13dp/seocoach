import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getBudgetRecommendations } from '@/lib/forecasting';

// GET /api/projects/[id]/budgets/recommendations — Get budget recommendations
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

    const recommendations = await getBudgetRecommendations(projectId);

    return NextResponse.json({
      data: recommendations,
      meta: { total: recommendations.length },
    });
  } catch (error) {
    console.error('Get budget recommendations error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
