import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { listReviews } from '@/lib/reviews';
import { db } from '@/lib/db';
import { ReviewSource } from '@prisma/client';

// GET /api/projects/[id]/reviews — List reviews with filters
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
    const source = searchParams.get('source') as ReviewSource | null;
    const sentiment = searchParams.get('sentiment') ?? undefined;
    const minRating = searchParams.get('minRating')
      ? parseFloat(searchParams.get('minRating')!)
      : undefined;
    const maxRating = searchParams.get('maxRating')
      ? parseFloat(searchParams.get('maxRating')!)
      : undefined;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;
    const hasResponse = searchParams.get('hasResponse')
      ? searchParams.get('hasResponse') === 'true'
      : undefined;
    const search = searchParams.get('search') ?? undefined;
    const limit = searchParams.get('limit')
      ? Math.min(100, Math.max(1, parseInt(searchParams.get('limit')!, 10)))
      : 50;
    const offset = searchParams.get('offset')
      ? Math.max(0, parseInt(searchParams.get('offset')!, 10))
      : 0;

    const { reviews, total } = await listReviews(projectId, {
      locationId,
      source: source ?? undefined,
      sentiment: sentiment as never | undefined,
      minRating,
      maxRating,
      startDate,
      endDate,
      hasResponse,
      search,
      limit,
      offset,
    });

    return NextResponse.json({
      data: reviews,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error('List reviews error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen reviews' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/reviews — Create a manual review
export async function POST(
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

    const body = await request.json();

    // Validate required fields
    if (body.rating === undefined || body.rating === null) {
      return NextResponse.json(
        { error: 'Beoordeling (rating) is verplicht' },
        { status: 400 }
      );
    }

    const rating = parseFloat(body.rating);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Beoordeling moet tussen 1 en 5 zijn' },
        { status: 400 }
      );
    }

    // Validate locationId if provided
    if (body.locationId) {
      const location = await db.location.findFirst({
        where: {
          id: body.locationId,
          projectId,
          deletedAt: null,
        },
      });
      if (!location) {
        return NextResponse.json(
          { error: 'Locatie niet gevonden in dit project' },
          { status: 400 }
        );
      }
    }

    // Validate reviewDate if provided
    let reviewDate: Date | undefined;
    if (body.reviewDate) {
      reviewDate = new Date(body.reviewDate);
      if (isNaN(reviewDate.getTime())) {
        return NextResponse.json(
          { error: 'Ongeldige reviewdatum' },
          { status: 400 }
        );
      }
    }

    const review = await db.review.create({
      data: {
        projectId,
        locationId: body.locationId ?? null,
        source: 'MANUAL',
        rating,
        title: body.title ?? null,
        content: body.content ?? null,
        authorName: body.authorName ?? null,
        reviewDate: reviewDate ?? null,
        language: 'nl',
      },
      include: {
        location: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ data: review }, { status: 201 });
  } catch (error) {
    console.error('Create review error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij aanmaken review' },
      { status: 500 }
    );
  }
}
