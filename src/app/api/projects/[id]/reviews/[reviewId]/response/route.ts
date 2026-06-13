import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { generateResponseDraft, getReviewResponses } from '@/lib/reviews';

// POST /api/projects/[id]/reviews/[reviewId]/response — Generate response draft
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

    const response = await generateResponseDraft(reviewId, projectId);

    return NextResponse.json({ data: response }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: 'Review niet gevonden' }, { status: 404 });
    }
    console.error('Generate response draft error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij genereren reactieconcept' },
      { status: 500 }
    );
  }
}

// GET /api/projects/[id]/reviews/[reviewId]/response — Get all responses for a review
export async function GET(
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

    const responses = await getReviewResponses(reviewId, projectId);

    return NextResponse.json({ data: responses });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: 'Review niet gevonden' }, { status: 404 });
    }
    console.error('Get review responses error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen reacties' },
      { status: 500 }
    );
  }
}
