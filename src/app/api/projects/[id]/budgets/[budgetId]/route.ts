import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getBudget, updateBudget, deleteBudget } from '@/lib/forecasting';
import type { BudgetAllocationData } from '@/lib/forecasting';

// GET /api/projects/[id]/budgets/[budgetId] — Get budget details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; budgetId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, budgetId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const budget = await getBudget(budgetId, projectId);

    if (!budget) {
      return NextResponse.json(
        { error: 'Budget niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: budget });
  } catch (error) {
    console.error('Get budget error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/budgets/[budgetId] — Update budget allocation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; budgetId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, budgetId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, totalBudget, currency, allocations,
            allocationNotes, periodStart, periodEnd } = body as Partial<BudgetAllocationData>;

    const data: Partial<BudgetAllocationData> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (totalBudget !== undefined) data.totalBudget = totalBudget;
    if (currency !== undefined) data.currency = currency;
    if (allocations !== undefined) data.allocations = allocations;
    if (allocationNotes !== undefined) data.allocationNotes = allocationNotes;
    if (periodStart !== undefined) data.periodStart = new Date(periodStart);
    if (periodEnd !== undefined) data.periodEnd = new Date(periodEnd);

    const updated = await updateBudget(budgetId, projectId, data);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update budget error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/budgets/[budgetId] — Delete budget
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; budgetId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, budgetId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const deleted = await deleteBudget(budgetId, projectId);

    return NextResponse.json({ data: deleted });
  } catch (error) {
    console.error('Delete budget error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
