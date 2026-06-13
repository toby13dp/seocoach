import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { updateRoadmapItem, deleteRoadmapItem } from '@/lib/roadmap';
import type { RoadmapItemUpdate } from '@/lib/roadmap';

// GET /api/projects/[id]/roadmap/[itemId] — Get item details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, itemId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const item = await db.roadmapItem.findFirst({
      where: { id: itemId, projectId },
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Roadmap-item niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error('Get roadmap item error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/roadmap/[itemId] — Update item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, itemId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.roadmapItem.findFirst({
      where: { id: itemId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Roadmap-item niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates: RoadmapItemUpdate = {};

    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo;
    if (body.scheduledDate !== undefined) updates.scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : null;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.effort !== undefined) updates.effort = body.effort;
    if (body.impact !== undefined) updates.impact = body.impact;
    if (body.recommendation !== undefined) updates.recommendation = body.recommendation;
    if (body.view !== undefined) updates.view = body.view;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

    const updated = await updateRoadmapItem(itemId, updates);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update roadmap item error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/roadmap/[itemId] — Remove item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, itemId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.roadmapItem.findFirst({
      where: { id: itemId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Roadmap-item niet gevonden' },
        { status: 404 }
      );
    }

    await deleteRoadmapItem(itemId);

    return NextResponse.json({ data: { id: itemId, deleted: true } });
  } catch (error) {
    console.error('Delete roadmap item error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
