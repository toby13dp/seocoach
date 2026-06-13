import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/organizations/[id]/deliverables/[deliverableId] — Get single deliverable
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, deliverableId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const deliverable = await db.deliverable.findFirst({
      where: {
        id: deliverableId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!deliverable) {
      return NextResponse.json(
        { error: 'Oplevering niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: deliverable });
  } catch (error) {
    console.error('Get deliverable error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PUT /api/organizations/[id]/deliverables/[deliverableId] — Update deliverable
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, deliverableId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.deliverable.findFirst({
      where: { id: deliverableId, organizationId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Oplevering niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      type,
      clientId,
      projectId,
      dueDate,
      assignedTo,
      status,
      hoursSpent,
      hoursBudgeted,
      completedDate,
      isClientVisible,
      clientNotes,
      internalNotes,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (clientId !== undefined) updateData.clientId = clientId;
    if (projectId !== undefined) updateData.projectId = projectId;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (status !== undefined) updateData.status = status;
    if (hoursSpent !== undefined) updateData.hoursSpent = hoursSpent;
    if (hoursBudgeted !== undefined) updateData.hoursBudgeted = hoursBudgeted;
    if (completedDate !== undefined) updateData.completedDate = completedDate ? new Date(completedDate) : null;
    if (isClientVisible !== undefined) updateData.isClientVisible = isClientVisible;
    if (clientNotes !== undefined) updateData.clientNotes = clientNotes;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;

    const updated = await db.deliverable.update({
      where: { id: deliverableId },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update deliverable error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// DELETE /api/organizations/[id]/deliverables/[deliverableId] — Soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, deliverableId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.deliverable.findFirst({
      where: { id: deliverableId, organizationId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Oplevering niet gevonden' },
        { status: 404 }
      );
    }

    await db.deliverable.update({
      where: { id: deliverableId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ data: { id: deliverableId, deleted: true } });
  } catch (error) {
    console.error('Delete deliverable error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
