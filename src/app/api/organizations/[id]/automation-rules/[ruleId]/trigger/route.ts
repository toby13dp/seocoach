import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { triggerRule } from '@/lib/automation-rules';
import { db } from '@/lib/db';

// POST /api/organizations/[id]/automation-rules/[ruleId]/trigger — Manually trigger a rule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, ruleId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang tot deze organisatie' }, { status: 403 });
    }

    // Verify rule exists and belongs to this organization
    const rule = await db.automationRule.findFirst({
      where: {
        id: ruleId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!rule) {
      return NextResponse.json(
        { error: 'Automatiseringsregel niet gevonden' },
        { status: 404 }
      );
    }

    if (rule.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Alleen actieve regels kunnen handmatig worden getriggerd' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { triggerData } = body;

    // Validate triggerData if provided
    if (triggerData !== undefined && (typeof triggerData !== 'object' || Array.isArray(triggerData))) {
      return NextResponse.json(
        { error: 'TriggerData moet een object zijn' },
        { status: 400 }
      );
    }

    const result = await triggerRule(ruleId, triggerData ?? {});

    if (result.status === 'conditions_not_met') {
      return NextResponse.json({
        data: {
          executionId: null,
          status: 'conditions_not_met',
        },
        message: 'De voorwaarden van de regel zijn niet vervuld',
      });
    }

    return NextResponse.json({
      data: result,
      message: result.status === 'awaiting_approval'
        ? 'Regel getriggerd — goedkeuring vereist'
        : 'Regel succesvol getriggerd',
    });
  } catch (error) {
    // Handle known business errors
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    if (message.includes('niet gevonden') || message.includes('niet actief')) {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    console.error('Trigger automation rule error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
