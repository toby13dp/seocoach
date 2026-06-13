import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/organizations/[id]/time-entries — List time entries
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
    const userId = searchParams.get('userId');
    const projectId = searchParams.get('projectId');
    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (userId) where.userId = userId;
    if (projectId) where.projectId = projectId;
    if (clientId) where.clientId = clientId;
    if (category) where.category = category;

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.date = dateFilter;
    }

    const timeEntries = await db.timeEntry.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ data: timeEntries });
  } catch (error) {
    console.error('List time entries error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/organizations/[id]/time-entries — Create time entry
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
      userId: bodyUserId,
      date,
      hours,
      description,
      category,
      projectId,
      clientId,
      isBillable,
      hourlyRate,
    } = body;

    if (!date) {
      return NextResponse.json(
        { error: 'Datum is vereist' },
        { status: 400 }
      );
    }

    if (!hours || typeof hours !== 'number' || hours <= 0) {
      return NextResponse.json(
        { error: 'Uren moeten een positief getal zijn' },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Beschrijving is vereist' },
        { status: 400 }
      );
    }

    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return NextResponse.json(
        { error: 'Categorie is vereist' },
        { status: 400 }
      );
    }

    const timeEntry = await db.timeEntry.create({
      data: {
        organizationId,
        userId: bodyUserId ?? user.id,
        date: new Date(date),
        hours,
        description: description.trim(),
        category: category.trim(),
        projectId: projectId ?? null,
        clientId: clientId ?? null,
        isBillable: isBillable ?? true,
        hourlyRate: hourlyRate ?? null,
      },
    });

    return NextResponse.json({ data: timeEntry }, { status: 201 });
  } catch (error) {
    console.error('Create time entry error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
