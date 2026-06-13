import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// PUT /api/organizations/[id]/time-entries/[entryId] — Update time entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, entryId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.timeEntry.findFirst({
      where: { id: entryId, organizationId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Tijdsregistratie niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      date,
      hours,
      description,
      category,
      projectId,
      clientId,
      isBillable,
      hourlyRate,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (date !== undefined) updateData.date = new Date(date);
    if (hours !== undefined) updateData.hours = hours;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (projectId !== undefined) updateData.projectId = projectId;
    if (clientId !== undefined) updateData.clientId = clientId;
    if (isBillable !== undefined) updateData.isBillable = isBillable;
    if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate;

    const updated = await db.timeEntry.update({
      where: { id: entryId },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update time entry error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// DELETE /api/organizations/[id]/time-entries/[entryId] — Soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, entryId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.timeEntry.findFirst({
      where: { id: entryId, organizationId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Tijdsregistratie niet gevonden' },
        { status: 404 }
      );
    }

    await db.timeEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ data: { id: entryId, deleted: true } });
  } catch (error) {
    console.error('Delete time entry error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
