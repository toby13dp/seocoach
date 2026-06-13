import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { analyzeSeasonalProducts, getSeasonalRecommendations } from '@/lib/ecommerce';

// GET /api/projects/[id]/products/seasonal — Get seasonal product analysis and recommendations
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
    const mode = searchParams.get('mode');

    if (mode === 'recommendations') {
      const recommendations = await getSeasonalRecommendations(projectId);
      return NextResponse.json({ data: recommendations });
    }

    const seasonalProducts = await analyzeSeasonalProducts(projectId);
    return NextResponse.json({ data: seasonalProducts });
  } catch (error) {
    console.error('Seasonal analysis error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen seizoensanalyse' },
      { status: 500 }
    );
  }
}
