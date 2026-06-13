import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/organizations/[id]/recurring-tasks — List recurring tasks
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
    const isActive = searchParams.get('isActive');
    const projectId = searchParams.get('projectId');
    const clientId = searchParams.get('clientId');
    const frequency = searchParams.get('frequency');

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (isActive !== null) where.isActive = isActive === 'true';
    if (projectId) where.projectId = projectId;
    if (clientId) where.clientId = clientId;
    if (frequency) where.frequency = frequency;

    const tasks = await db.recurringTask.findMany({
      where,
      orderBy: { nextRunAt: 'asc' },
    });

    return NextResponse.json({ data: tasks });
  } catch (error) {
    console.error('List recurring tasks error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/organizations/[id]/recurring-tasks — Create recurring task
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
      frequency,
      dayOfWeek,
      dayOfMonth,
      assignedTo,
      projectId,
      clientId,
      isActive,
      nextRunAt,
    } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Titel is vereist' },
        { status: 400 }
      );
    }

    if (!frequency || typeof frequency !== 'string') {
      return NextResponse.json(
        { error: 'Frequentie is vereist' },
        { status: 400 }
      );
    }

    const validFrequencies = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY'];
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: 'Ongeldige frequentie. Geldige waarden: DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY' },
        { status: 400 }
      );
    }

    const task = await db.recurringTask.create({
      data: {
        organizationId,
        title: title.trim(),
        description: description ?? null,
        frequency,
        dayOfWeek: dayOfWeek ?? null,
        dayOfMonth: dayOfMonth ?? null,
        assignedTo: assignedTo ?? null,
        projectId: projectId ?? null,
        clientId: clientId ?? null,
        isActive: isActive ?? true,
        nextRunAt: nextRunAt ? new Date(nextRunAt) : null,
      },
    });

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    console.error('Create recurring task error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
