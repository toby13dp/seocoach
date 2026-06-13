import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { wpGetPost, wpUpdateDraft } from '@/lib/cms/wordpress';

// GET /api/projects/[id]/cms-connections/[connectionId]/posts/[postId] — Get post from CMS
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string; postId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, connectionId, postId } = await params;
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

    const post = await wpGetPost(connectionId, parseInt(postId, 10));

    return NextResponse.json({ data: post });
  } catch (error) {
    console.error('Get CMS post error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/cms-connections/[connectionId]/posts/[postId] — Update post in CMS
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string; postId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, connectionId, postId } = await params;
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

    const result = await wpUpdateDraft(connectionId, parseInt(postId, 10), {
      title: body.title,
      content: body.content,
      excerpt: body.excerpt,
      categories: body.categories,
      tags: body.tags,
      meta: body.meta,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Update CMS post error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
