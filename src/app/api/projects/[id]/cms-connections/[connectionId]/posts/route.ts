import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { wpListPosts, wpCreateDraft } from '@/lib/cms/wordpress';

// GET /api/projects/[id]/cms-connections/[connectionId]/posts — List posts from CMS
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, connectionId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const connection = await db.cMSConnection.findFirst({
      where: { id: connectionId, projectId, deletedAt: null },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'CMS-verbinding niet gevonden' },
        { status: 404 }
      );
    }

    if (connection.providerType !== 'WORDPRESS') {
      return NextResponse.json(
        { error: 'Deze bewerking is alleen beschikbaar voor WordPress-verbindingen' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') ?? '20', 10)));
    const status = searchParams.get('status') ?? undefined;
    const search = searchParams.get('search') ?? undefined;

    const posts = await wpListPosts(connectionId, {
      page,
      perPage,
      status,
      search,
    });

    return NextResponse.json({ data: posts });
  } catch (error) {
    console.error('List CMS posts error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/projects/[id]/cms-connections/[connectionId]/posts — Create draft in CMS
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, connectionId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const connection = await db.cMSConnection.findFirst({
      where: { id: connectionId, projectId, deletedAt: null },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'CMS-verbinding niet gevonden' },
        { status: 404 }
      );
    }

    if (connection.providerType !== 'WORDPRESS') {
      return NextResponse.json(
        { error: 'Deze bewerking is alleen beschikbaar voor WordPress-verbindingen' },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { error: 'Titel is vereist' },
        { status: 400 }
      );
    }

    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'Inhoud is vereist' },
        { status: 400 }
      );
    }

    const result = await wpCreateDraft(connectionId, {
      title: body.title,
      content: body.content,
      slug: body.slug,
      excerpt: body.excerpt,
      categories: body.categories,
      tags: body.tags,
      featuredMedia: body.featuredMedia,
      meta: body.meta,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error('Create CMS draft error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
