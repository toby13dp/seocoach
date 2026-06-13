import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getReview, deleteReview } from '@/lib/reviews';

// GET /api/projects/[id]/reviews/[reviewId] — Get review details
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

    const review = await getReview(reviewId, projectId);

    if (!review) {
      return NextResponse.json(
        { error: 'Review niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: review });
  } catch (error) {
    console.error('Get review error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen review' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/reviews/[reviewId] — Update review (limited fields)
export async function PATCH(
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

    // Verify review exists in this project
    const existing = await getReview(reviewId, projectId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Review niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Only allow updating title and content
    const updateData: { title?: string | null; content?: string | null } = {};

    if ('title' in body) {
      updateData.title = body.title ?? null;
    }
    if ('content' in body) {
      updateData.content = body.content ?? null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Geen geldige velden om bij te werken. Alleen title en content zijn toegestaan.' },
        { status: 400 }
      );
    }

    // Use prisma directly since only limited fields
    const { db } = await import('@/lib/db');
    const updated = await db.review.update({
      where: { id: reviewId },
      data: updateData,
      include: {
        location: { select: { id: true, name: true } },
        responses: { orderBy: { createdAt: 'desc' } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update review error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij bijwerken review' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/reviews/[reviewId] — Soft delete review
export async function DELETE(
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

    const deleted = await deleteReview(reviewId, projectId);

    return NextResponse.json({ data: deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: 'Review niet gevonden' }, { status: 404 });
    }
    console.error('Delete review error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij verwijderen review' },
      { status: 500 }
    );
  }
}
