import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { validateProjectAccess } from '@/lib/tenant';
import { logAuditEvent } from '@/lib/audit';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, actionId } = await params;
    const access = await validateProjectAccess(user.id, id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const actionItem = await db.actionItem.findUnique({
      where: { id: actionId, projectId: id },
    });

    if (!actionItem) {
      return NextResponse.json(
        { error: 'Action item not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      businessImpact,
      seoImpact,
      priority,
      effort,
      owner,
      deadline,
      status,
      automationAvailable,
      approvalRequired,
    } = body;

    const updatedActionItem = await db.actionItem.update({
      where: { id: actionId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(businessImpact !== undefined && { businessImpact }),
        ...(seoImpact !== undefined && { seoImpact }),
        ...(priority !== undefined && { priority }),
        ...(effort !== undefined && { effort }),
        ...(owner !== undefined && { owner }),
        ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
        ...(status !== undefined && { status }),
        ...(automationAvailable !== undefined && { automationAvailable }),
        ...(approvalRequired !== undefined && { approvalRequired }),
      },
    });

    // Log audit event
    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId: id,
      userId: user.id,
      action: 'action_item_updated',
      entity: 'action_item',
      entityId: actionId,
      changes: { status, priority, owner },
    });

    return NextResponse.json({ actionItem: updatedActionItem });
  } catch (error) {
    console.error('Update action item error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, actionId } = await params;
    const access = await validateProjectAccess(user.id, id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const actionItem = await db.actionItem.findUnique({
      where: { id: actionId, projectId: id },
    });

    if (!actionItem) {
      return NextResponse.json(
        { error: 'Action item not found' },
        { status: 404 }
      );
    }

    await db.actionItem.delete({
      where: { id: actionId },
    });

    // Log audit event
    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId: id,
      userId: user.id,
      action: 'action_item_deleted',
      entity: 'action_item',
      entityId: actionId,
      changes: { title: actionItem.title },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete action item error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
