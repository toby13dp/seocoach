import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { getExecutionHistory } from '@/lib/automation-rules';
import { db } from '@/lib/db';

// GET /api/organizations/[id]/automation-executions — List automation execution history
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
      return NextResponse.json({ error: 'Geen toegang tot deze organisatie' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId') ?? undefined;
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));

    // Validate ruleId belongs to this organization if provided
    if (ruleId) {
      const rule = await db.automationRule.findFirst({
        where: {
          id: ruleId,
          organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!rule) {
        return NextResponse.json(
          { error: 'Opgegeven regel niet gevonden in deze organisatie' },
          { status: 400 }
        );
      }
    }

    const executions = await getExecutionHistory(organizationId, {
      ruleId,
      limit,
    });

    return NextResponse.json({
      data: executions,
      meta: {
        total: executions.length,
        limit,
        ruleId: ruleId ?? null,
      },
    });
  } catch (error) {
    console.error('List automation executions error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
