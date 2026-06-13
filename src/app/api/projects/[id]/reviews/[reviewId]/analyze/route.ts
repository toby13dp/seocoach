import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { analyzeAndSaveReviewSentiment } from '@/lib/reviews';

// POST /api/projects/[id]/reviews/[reviewId]/analyze — Run sentiment analysis
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, reviewId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const updated = await analyzeAndSaveReviewSentiment(reviewId, projectId);

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: 'Review niet gevonden' }, { status: 404 });
    }
    console.error('Analyze review error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij analyseren review' },
      { status: 500 }
    );
  }
}
