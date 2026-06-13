import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/organizations/[id]/internal-notes — List notes for entity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'EntityType en entityId zijn vereist' },
        { status: 400 }
      );
    }

    const notes = await db.internalNote.findMany({
      where: {
        organizationId,
        entityType,
        entityId,
        deletedAt: null,
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ data: notes });
  } catch (error) {
    console.error('List internal notes error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/organizations/[id]/internal-notes — Create internal note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { entityType, entityId, content, isPinned } = body;

    if (!entityType || typeof entityType !== 'string' || entityType.trim().length === 0) {
      return NextResponse.json(
        { error: 'EntityType is vereist' },
        { status: 400 }
      );
    }

    if (!entityId || typeof entityId !== 'string' || entityId.trim().length === 0) {
      return NextResponse.json(
        { error: 'EntityId is vereist' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Inhoud is vereist' },
        { status: 400 }
      );
    }

    const note = await db.internalNote.create({
      data: {
        organizationId,
        entityType: entityType.trim(),
        entityId: entityId.trim(),
        content: content.trim(),
        authorId: user.id,
        isPinned: isPinned ?? false,
      },
    });

    return NextResponse.json({ data: note }, { status: 201 });
  } catch (error) {
    console.error('Create internal note error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
