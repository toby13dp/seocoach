import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/content-sources — List sources
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
    const briefId = searchParams.get('briefId') ?? undefined;
    const type = searchParams.get('type') ?? undefined;

    const where: Record<string, unknown> = { projectId, deletedAt: null };
    if (briefId) where.briefId = briefId;
    if (type) where.type = type;

    const sources = await db.contentSource.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: sources });
  } catch (error) {
    console.error('List content sources error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/content-sources — Add source
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

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Bronnaam is vereist' },
        { status: 400 }
      );
    }

    if (!body.type || typeof body.type !== 'string') {
      return NextResponse.json(
        { error: 'Brontype is vereist' },
        { status: 400 }
      );
    }

    const source = await db.contentSource.create({
      data: {
        projectId,
        briefId: body.briefId ?? null,
        name: body.name,
        type: body.type,
        url: body.url ?? null,
        content: body.content ?? null,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      },
    });

    return NextResponse.json({ data: source }, { status: 201 });
  } catch (error) {
    console.error('Add content source error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
