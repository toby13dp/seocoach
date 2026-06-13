import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

// GET /api/projects/[id]/locations/[locationId]/keywords — List local keywords for a location
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
      db.localKeyword.findMany({
        where,
        orderBy: { keyword: 'asc' },
        take: limit,
        skip: offset,
      }),
      db.localKeyword.count({ where }),
    ]);

    return NextResponse.json({
      data,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error('Fout bij ophalen lokale zoekwoorden:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen lokale zoekwoorden' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/locations/[locationId]/keywords — Add a local keyword
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
    const { keyword, intent, searchVolume, difficulty, currentRank, targetRank, url } = body;

    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return NextResponse.json(
        { error: 'Zoekwoord is verplicht' },
        { status: 400 }
      );
    }

    const localKeyword = await db.localKeyword.create({
      data: {
        projectId,
        locationId,
        keyword: keyword.trim(),
        intent: intent ?? 'LOCAL',
        searchVolume: searchVolume ?? null,
        difficulty: difficulty ?? null,
        currentRank: currentRank ?? null,
        targetRank: targetRank ?? null,
        url: url ?? null,
      },
    });

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'local_keyword_added',
      entity: 'local_keyword',
      entityId: localKeyword.id,
      changes: { keyword, intent },
    });

    return NextResponse.json({ data: localKeyword }, { status: 201 });
  } catch (error) {
    console.error('Fout bij toevoegen lokaal zoekwoord:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij toevoegen lokaal zoekwoord' },
      { status: 500 }
    );
  }
}
