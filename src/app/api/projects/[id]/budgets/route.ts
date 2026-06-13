import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { createBudget, listBudgets } from '@/lib/forecasting';
import type { BudgetAllocationData } from '@/lib/forecasting';

// GET /api/projects/[id]/budgets — List budget allocations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const budgets = await listBudgets(projectId);

    return NextResponse.json({
      data: budgets,
      meta: { total: budgets.length },
    });
  } catch (error) {
    console.error('List budgets error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/budgets — Create budget allocation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, totalBudget, currency, allocations,
            allocationNotes, periodStart, periodEnd } = body as Partial<BudgetAllocationData>;

    if (!name) {
      return NextResponse.json(
        { error: 'name is vereist' },
        { status: 400 }
      );
    }

    if (totalBudget === undefined || totalBudget === null) {
      return NextResponse.json(
        { error: 'totalBudget is vereist' },
        { status: 400 }
      );
    }

    if (!allocations) {
      return NextResponse.json(
        { error: 'allocations is vereist' },
        { status: 400 }
      );
    }

    const allocationFields = ['technicalSeo', 'content', 'updates', 'authority',
      'digitalPR', 'cro', 'localSeo', 'geo', 'monitoring', 'reporting'] as const;

    for (const field of allocationFields) {
      if (allocations[field] === undefined || allocations[field] === null) {
        return NextResponse.json(
          { error: `allocations.${field} is vereist` },
          { status: 400 }
        );
      }
    }

    const data: BudgetAllocationData = {
      name,
      totalBudget,
      allocations,
    };

    if (description) data.description = description;
    if (currency) data.currency = currency;
    if (allocationNotes) data.allocationNotes = allocationNotes;
    if (periodStart) data.periodStart = new Date(periodStart);
    if (periodEnd) data.periodEnd = new Date(periodEnd);

    const budget = await createBudget(projectId, data);

    return NextResponse.json({ data: budget }, { status: 201 });
  } catch (error) {
    console.error('Create budget error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
