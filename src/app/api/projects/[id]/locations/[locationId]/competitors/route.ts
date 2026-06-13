import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

// GET /api/projects/[id]/locations/[locationId]/competitors — List local competitors for a location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, locationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const where = {
      locationId,
      deletedAt: null,
    };

    const [data, total] = await Promise.all([
      db.localCompetitor.findMany({
        where,
        orderBy: { distance: 'asc' },
        take: limit,
        skip: offset,
      }),
      db.localCompetitor.count({ where }),
    ]);

    return NextResponse.json({
      data,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error('Fout bij ophalen lokale concurrenten:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen lokale concurrenten' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/locations/[locationId]/competitors — Add a local competitor
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, locationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { name, address, city, postalCode, website, avgRating, reviewCount, distance, strengths, weaknesses, notes } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Concurrentnaam is verplicht' },
        { status: 400 }
      );
    }

    const competitor = await db.localCompetitor.create({
      data: {
        projectId,
        locationId,
        name: name.trim(),
        address: address ?? null,
        city: city ?? null,
        postalCode: postalCode ?? null,
        website: website ?? null,
        avgRating: avgRating ?? null,
        reviewCount: reviewCount ?? 0,
        distance: distance ?? null,
        strengths: strengths ?? null,
        weaknesses: weaknesses ?? null,
        notes: notes ?? null,
      },
    });

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'local_competitor_added',
      entity: 'local_competitor',
      entityId: competitor.id,
      changes: { name, city, distance },
    });

    return NextResponse.json({ data: competitor }, { status: 201 });
  } catch (error) {
    console.error('Fout bij toevoegen lokale concurrent:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij toevoegen lokale concurrent' },
      { status: 500 }
    );
  }
}
