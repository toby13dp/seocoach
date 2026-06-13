import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/organizations/[id]/monthly-summaries — List monthly summaries
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
    const clientId = searchParams.get('clientId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (clientId) where.clientId = clientId;
    if (year) where.year = parseInt(year, 10);
    if (month) where.month = parseInt(month, 10);

    const summaries = await db.monthlyWorkSummary.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return NextResponse.json({ data: summaries });
  } catch (error) {
    console.error('List monthly summaries error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/organizations/[id]/monthly-summaries — Create or update monthly summary (upsert)
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
      clientId,
      year,
      month,
      totalHours,
      billableHours,
      deliverablesCompleted,
      deliverablesPending,
      summary,
      highlights,
      concerns,
      status,
    } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Klant is vereist' },
        { status: 400 }
      );
    }

    if (!year || typeof year !== 'number' || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: 'Ongeldig jaar' },
        { status: 400 }
      );
    }

    if (!month || typeof month !== 'number' || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Ongeldige maand' },
        { status: 400 }
      );
    }

    // Verify client belongs to this organization
    const client = await db.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Klant niet gevonden in deze organisatie' },
        { status: 404 }
      );
    }

    // Upsert: create or update based on clientId + year + month unique constraint
    const upserted = await db.monthlyWorkSummary.upsert({
      where: {
        clientId_year_month: { clientId, year, month },
      },
      update: {
        totalHours: totalHours ?? undefined,
        billableHours: billableHours ?? undefined,
        deliverablesCompleted: deliverablesCompleted ?? undefined,
        deliverablesPending: deliverablesPending ?? undefined,
        summary: summary ?? undefined,
        highlights: highlights ?? undefined,
        concerns: concerns ?? undefined,
        status: status ?? undefined,
      },
      create: {
        organizationId,
        clientId,
        year,
        month,
        totalHours: totalHours ?? 0,
        billableHours: billableHours ?? 0,
        deliverablesCompleted: deliverablesCompleted ?? 0,
        deliverablesPending: deliverablesPending ?? 0,
        summary: summary ?? null,
        highlights: highlights ?? null,
        concerns: concerns ?? null,
        status: status ?? 'draft',
      },
    });

    return NextResponse.json({ data: upserted }, { status: 201 });
  } catch (error) {
    console.error('Upsert monthly summary error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
