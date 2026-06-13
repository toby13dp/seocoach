import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/organizations/[id]/deliverables — List deliverables for org
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
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const projectId = searchParams.get('projectId');
    const assignedTo = searchParams.get('assignedTo');

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (projectId) where.projectId = projectId;
    if (assignedTo) where.assignedTo = assignedTo;

    const deliverables = await db.deliverable.findMany({
      where,
      orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json({ data: deliverables });
  } catch (error) {
    console.error('List deliverables error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/organizations/[id]/deliverables — Create a new deliverable
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
    const {
      title,
      description,
      type,
      clientId,
      projectId,
      dueDate,
      assignedTo,
      hoursBudgeted,
      isClientVisible,
      clientNotes,
      internalNotes,
      status,
    } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Titel is vereist' },
        { status: 400 }
      );
    }

    if (!type || typeof type !== 'string' || type.trim().length === 0) {
      return NextResponse.json(
        { error: 'Type is vereist' },
        { status: 400 }
      );
    }

    const deliverable = await db.deliverable.create({
      data: {
        organizationId,
        title: title.trim(),
        description: description ?? null,
        type: type.trim(),
        clientId: clientId ?? null,
        projectId: projectId ?? null,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedTo: assignedTo ?? null,
        hoursBudgeted: hoursBudgeted ?? null,
        isClientVisible: isClientVisible ?? false,
        clientNotes: clientNotes ?? null,
        internalNotes: internalNotes ?? null,
        status: status ?? 'PENDING',
      },
    });

    return NextResponse.json({ data: deliverable }, { status: 201 });
  } catch (error) {
    console.error('Create deliverable error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
