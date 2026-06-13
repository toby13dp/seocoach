import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/reviews/responses/[responseId] — Get response details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, responseId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const response = await db.reviewResponse.findFirst({
      where: {
        id: responseId,
        projectId,
      },
      include: {
        review: {
          select: {
            id: true,
            rating: true,
            title: true,
            content: true,
            authorName: true,
          },
        },
      },
    });

    if (!response) {
      return NextResponse.json(
        { error: 'Reactie niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('Get response error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen reactie' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/reviews/responses/[responseId] — Update response draft content
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, responseId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Inhoud (content) is verplicht' },
        { status: 400 }
      );
    }

    // Use updateResponseDraft from lib which validates status
    const { updateResponseDraft } = await import('@/lib/reviews');
    const updated = await updateResponseDraft(responseId, projectId, body.content.trim());

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: 'Reactie niet gevonden' }, { status: 404 });
    }
    if (message.includes('Alleen concept-')) {
      return NextResponse.json(
        { error: 'Alleen concept- of afgewezen reacties kunnen worden bewerkt' },
        { status: 400 }
      );
    }
    console.error('Update response draft error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij bijwerken reactieconcept' },
      { status: 500 }
    );
  }
}
