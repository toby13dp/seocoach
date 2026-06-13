import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/cms-connections/[connectionId] — Get connection details
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
      where: {
        id: connectionId,
        projectId,
        deletedAt: null,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'CMS-verbinding niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: connection });
  } catch (error) {
    console.error('Get CMS connection error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/cms-connections/[connectionId] — Update connection
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

    const existing = await db.cMSConnection.findFirst({
      where: { id: connectionId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'CMS-verbinding niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.baseUrl !== undefined) updateData.baseUrl = body.baseUrl;
    if (body.apiKey !== undefined) updateData.apiKey = body.apiKey;
    if (body.apiSecret !== undefined) updateData.apiSecret = body.apiSecret;
    if (body.username !== undefined) updateData.username = body.username;
    if (body.metadata !== undefined) updateData.metadata = JSON.stringify(body.metadata);

    const updated = await db.cMSConnection.update({
      where: { id: connectionId },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update CMS connection error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/cms-connections/[connectionId] — Soft delete connection
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

    const existing = await db.cMSConnection.findFirst({
      where: { id: connectionId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'CMS-verbinding niet gevonden' },
        { status: 404 }
      );
    }

    await db.cMSConnection.update({
      where: { id: connectionId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ data: { id: connectionId, deleted: true } });
  } catch (error) {
    console.error('Delete CMS connection error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
