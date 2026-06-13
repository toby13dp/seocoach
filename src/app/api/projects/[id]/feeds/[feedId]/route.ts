import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getFeed, updateFeed, deleteFeed } from '@/lib/product-feeds';

// GET /api/projects/[id]/feeds/[feedId] — Get feed with items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feedId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, feedId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const feed = await getFeed(feedId, projectId);
    if (!feed) {
      return NextResponse.json(
        { error: 'Feed niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: feed });
  } catch (error) {
    console.error('Get feed error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen feed' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/feeds/[feedId] — Update feed settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feedId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, feedId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();

    const feed = await updateFeed(feedId, projectId, {
      name: body.name,
      sourceUrl: body.sourceUrl,
      sourceFormat: body.sourceFormat,
      notes: body.notes,
    });

    return NextResponse.json({ data: feed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Update feed error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij bijwerken feed' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/feeds/[feedId] — Soft delete feed
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feedId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, feedId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    await deleteFeed(feedId, projectId);

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Delete feed error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij verwijderen feed' },
      { status: 500 }
    );
  }
}
