import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// PUT /api/organizations/[id]/recurring-tasks/[taskId] — Update recurring task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, taskId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.recurringTask.findFirst({
      where: { id: taskId, organizationId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Terugkerende taak niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      frequency,
      dayOfWeek,
      dayOfMonth,
      assignedTo,
      projectId,
      clientId,
      isActive,
      nextRunAt,
      lastRunAt,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (frequency !== undefined) {
      const validFrequencies = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY'];
      if (!validFrequencies.includes(frequency)) {
        return NextResponse.json(
          { error: 'Ongeldige frequentie. Geldige waarden: DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY' },
          { status: 400 }
        );
      }
      updateData.frequency = frequency;
    }
    if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
    if (dayOfMonth !== undefined) updateData.dayOfMonth = dayOfMonth;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (projectId !== undefined) updateData.projectId = projectId;
    if (clientId !== undefined) updateData.clientId = clientId;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (nextRunAt !== undefined) updateData.nextRunAt = nextRunAt ? new Date(nextRunAt) : null;
    if (lastRunAt !== undefined) updateData.lastRunAt = lastRunAt ? new Date(lastRunAt) : null;

    const updated = await db.recurringTask.update({
      where: { id: taskId },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update recurring task error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// DELETE /api/organizations/[id]/recurring-tasks/[taskId] — Soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, taskId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.recurringTask.findFirst({
      where: { id: taskId, organizationId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Terugkerende taak niet gevonden' },
        { status: 404 }
      );
    }

    await db.recurringTask.update({
      where: { id: taskId },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ data: { id: taskId, deleted: true } });
  } catch (error) {
    console.error('Delete recurring task error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
