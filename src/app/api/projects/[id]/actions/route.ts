import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { validateProjectAccess } from '@/lib/tenant';
import { logAuditEvent } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const access = await validateProjectAccess(user.id, id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    const where: Record<string, unknown> = { projectId: id };

    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }

    const actionItems = await db.actionItem.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ actionItems });
  } catch (error) {
    console.error('List action items error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const access = await validateProjectAccess(user.id, id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      automationAvailable,
      approvalRequired,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const actionItem = await db.actionItem.create({
      data: {
        projectId: id,
        title,
        description: description ?? null,
        businessImpact: businessImpact ?? null,
        seoImpact: seoImpact ?? null,
        priority: priority ?? 'MEDIUM',
        effort: effort ?? 'MEDIUM',
        owner: owner ?? null,
        deadline: deadline ? new Date(deadline) : null,
        automationAvailable: automationAvailable ?? false,
        approvalRequired: approvalRequired ?? false,
      },
    });

    // Log audit event
    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId: id,
      userId: user.id,
      action: 'action_item_created',
      entity: 'action_item',
      entityId: actionItem.id,
      changes: { title, priority, effort },
    });

    return NextResponse.json({ actionItem }, { status: 201 });
  } catch (error) {
    console.error('Create action item error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
