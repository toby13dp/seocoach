import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { updateDataConnection, deleteDataConnection } from '@/lib/analytics';
import type { DataConnectionConfig } from '@/lib/analytics';

// GET /api/projects/[id]/data-connections/[connectionId] — Get connection details
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

    const connection = await db.dataConnection.findFirst({
      where: {
        id: connectionId,
        projectId,
        deletedAt: null,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Gegevensverbinding niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: connection });
  } catch (error) {
    console.error('Get data connection error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/data-connections/[connectionId] — Update connection settings
export async function PATCH(
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

    const existing = await db.dataConnection.findFirst({
      where: { id: connectionId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Gegevensverbinding niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();

    const updates: {
      name?: string;
      config?: DataConnectionConfig;
      status?: string;
      syncIntervalMinutes?: number;
    } = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.config !== undefined) updates.config = body.config;
    if (body.status !== undefined) updates.status = body.status;
    if (body.syncIntervalMinutes !== undefined) updates.syncIntervalMinutes = body.syncIntervalMinutes;

    const updated = await updateDataConnection(connectionId, updates);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update data connection error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/data-connections/[connectionId] — Soft delete connection
export async function DELETE(
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

    const existing = await db.dataConnection.findFirst({
      where: { id: connectionId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Gegevensverbinding niet gevonden' },
        { status: 404 }
      );
    }

    await deleteDataConnection(connectionId);

    return NextResponse.json({ data: { id: connectionId, deleted: true } });
  } catch (error) {
    console.error('Delete data connection error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
