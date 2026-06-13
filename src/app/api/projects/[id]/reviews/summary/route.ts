import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getReviewSummary } from '@/lib/reviews';

// GET /api/projects/[id]/reviews/summary — Get review summary statistics
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
    const locationId = searchParams.get('locationId') ?? undefined;

    const summary = await getReviewSummary(projectId, locationId);

    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error('Get review summary error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen reviewsamenvatting' },
      { status: 500 }
    );
  }
}
