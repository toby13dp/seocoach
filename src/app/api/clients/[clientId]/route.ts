import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = await params;
    const client = await db.client.findFirst({
      where: { id: clientId, deletedAt: null },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        projects: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true, status: true },
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Verify tenant access
    const membership = await db.organizationMembership.findFirst({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: client.organizationId,
        },
      },
    });

    if (!membership || membership.deletedAt || !membership.acceptedAt) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ client });
  } catch (error) {
    console.error('Get client error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = await params;
    const client = await db.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Verify tenant access
    const membership = await db.organizationMembership.findFirst({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: client.organizationId,
        },
      },
    });

    if (!membership || membership.deletedAt || !membership.acceptedAt) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, website, industry, notes } = body;

    const updatedClient = await db.client.update({
      where: { id: clientId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(website !== undefined && { website }),
        ...(industry !== undefined && { industry }),
        ...(notes !== undefined && { notes }),
      },
    });

    // Log audit event
    await logAuditEvent({
      organizationId: client.organizationId,
      userId: user.id,
      action: 'client_updated',
      entity: 'client',
      entityId: clientId,
      changes: { name, description, website, industry },
    });

    return NextResponse.json({ client: updatedClient });
  } catch (error) {
    console.error('Update client error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = await params;
    const client = await db.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Verify tenant access
    const membership = await db.organizationMembership.findFirst({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: client.organizationId,
        },
      },
    });

    if (!membership || membership.deletedAt || !membership.acceptedAt) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft-delete
    await db.client.update({
      where: { id: clientId },
      data: { deletedAt: new Date() },
    });

    // Log audit event
    await logAuditEvent({
      organizationId: client.organizationId,
      userId: user.id,
      action: 'client_deleted',
      entity: 'client',
      entityId: clientId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete client error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
