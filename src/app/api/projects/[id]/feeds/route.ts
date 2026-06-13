import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { listFeeds, createFeed } from '@/lib/product-feeds';
import { FeedType, FeedValidationStatus } from '@prisma/client';

// GET /api/projects/[id]/feeds — List feeds
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

    const filters = {
      feedType: searchParams.get('feedType') as FeedType | null ?? undefined,
      status: searchParams.get('status') as FeedValidationStatus | null ?? undefined,
    };

    const feeds = await listFeeds(projectId, filters);

    return NextResponse.json({ data: feeds });
  } catch (error) {
    console.error('List feeds error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen feeds' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/feeds — Create a new feed
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

    if (!body.name) {
      return NextResponse.json(
        { error: 'Feednaam is verplicht' },
        { status: 400 }
      );
    }

    if (!body.feedType) {
      return NextResponse.json(
        { error: 'Feedtype is verplicht' },
        { status: 400 }
      );
    }

    const feed = await createFeed(projectId, {
      name: body.name,
      feedType: body.feedType,
      sourceUrl: body.sourceUrl,
      sourceFormat: body.sourceFormat,
      notes: body.notes,
    });

    return NextResponse.json({ data: feed }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Create feed error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij aanmaken feed' },
      { status: 500 }
    );
  }
}
