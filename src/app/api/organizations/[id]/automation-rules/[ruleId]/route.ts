import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { updateAutomationRule, deleteAutomationRule } from '@/lib/automation-rules';
import { db } from '@/lib/db';
import type { AutomationTriggerType, AutomationRuleStatus, AutomationActionType } from '@prisma/client';
import { isHighRiskAction } from '@/lib/automation-rules';

const VALID_TRIGGER_TYPES: AutomationTriggerType[] = [
  'NEW_TECHNICAL_ISSUE', 'METRIC_DROP', 'NEW_CONTENT_OPPORTUNITY', 'CONTENT_DECAY',
  'NEW_COMPETITOR_PAGE', 'NEW_NEGATIVE_REVIEW', 'SCHEDULED_DATE',
  'NEW_AI_VISIBILITY_RESULT', 'NEW_WORDPRESS_DRAFT', 'PRODUCT_FEED_ERROR', 'DEPLOYMENT_EVENT',
];

const VALID_STATUSES: AutomationRuleStatus[] = ['ACTIVE', 'PAUSED', 'DRAFT', 'DISABLED'];

const VALID_ACTION_TYPES: AutomationActionType[] = [
  'CREATE_TASK', 'CREATE_ALERT', 'GENERATE_BRIEF', 'GENERATE_CONTENT_DRAFT',
  'GENERATE_REPORT', 'NOTIFY_USER', 'PREPARE_CMS_UPDATE', 'RUN_CRAWL',
  'RUN_QUALITY_CHECK', 'CREATE_APPROVAL_REQUEST', 'CALL_WEBHOOK',
];

// GET /api/organizations/[id]/automation-rules/[ruleId] — Get single rule
export async function GET(
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

    return NextResponse.json({ data: rule });
  } catch (error) {
    console.error('Get automation rule error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PUT /api/organizations/[id]/automation-rules/[ruleId] — Update rule
export async function PUT(
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
    const existingRule = await db.automationRule.findFirst({
      where: {
        id: ruleId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Automatiseringsregel niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, triggerType, conditions, actions, requiresApproval, status } = body;

    // Validate fields if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Naam mag niet leeg zijn' },
          { status: 400 }
        );
      }
      if (name.length > 200) {
        return NextResponse.json(
          { error: 'Naam mag maximaal 200 tekens bevatten' },
          { status: 400 }
        );
      }
    }

    if (triggerType !== undefined) {
      if (!VALID_TRIGGER_TYPES.includes(triggerType as AutomationTriggerType)) {
        return NextResponse.json(
          { error: `Ongeldig triggertype: "${triggerType}"` },
          { status: 400 }
        );
      }
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status as AutomationRuleStatus)) {
        return NextResponse.json(
          { error: `Ongeldige status: "${status}"` },
          { status: 400 }
        );
      }
    }

    // Validate actions if provided
    if (actions !== undefined) {
      if (!Array.isArray(actions) || actions.length === 0) {
        return NextResponse.json(
          { error: 'Minimaal één actie is vereist' },
          { status: 400 }
        );
      }
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        if (!action.type || !VALID_ACTION_TYPES.includes(action.type as AutomationActionType)) {
          return NextResponse.json(
            { error: `Ongeldig actietype op index ${i}: "${action.type}"` },
            { status: 400 }
          );
        }
        if (!action.config || typeof action.config !== 'object') {
          return NextResponse.json(
            { error: `Actie op index ${i} moet een config-object bevatten` },
            { status: 400 }
          );
        }
      }
    }

    // Validate conditions if provided
    if (conditions !== undefined) {
      if (!Array.isArray(conditions)) {
        return NextResponse.json(
          { error: 'Voorwaarden moeten een array zijn' },
          { status: 400 }
        );
      }
      const validOperators = ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_contains'];
      for (let i = 0; i < conditions.length; i++) {
        const cond = conditions[i];
        if (!cond.field || !cond.operator || cond.value === undefined) {
          return NextResponse.json(
            { error: `Voorwaarde op index ${i} moet field, operator en value bevatten` },
            { status: 400 }
          );
        }
        if (!validOperators.includes(cond.operator)) {
          return NextResponse.json(
            { error: `Ongeldige operator op index ${i}: "${cond.operator}"` },
            { status: 400 }
          );
        }
      }
    }

    if (requiresApproval !== undefined && typeof requiresApproval !== 'boolean') {
      return NextResponse.json(
        { error: 'RequiresApproval moet een booleaanse waarde zijn' },
        { status: 400 }
      );
    }

    if (description !== undefined && typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Beschrijving moet een tekenreeks zijn' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (triggerType !== undefined) updateData.triggerType = triggerType;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (actions !== undefined) updateData.actions = actions;
    if (requiresApproval !== undefined) updateData.requiresApproval = requiresApproval;
    if (status !== undefined) updateData.status = status;

    const updatedRule = await updateAutomationRule(ruleId, updateData as Parameters<typeof updateAutomationRule>[1]);

    // Check for high-risk actions in the updated rule
    const hasHighRisk = actions
      ? actions.some((a: { type: string }) => isHighRiskAction(a.type as AutomationActionType))
      : existingRule.isHighRisk;

    return NextResponse.json({
      data: updatedRule,
      meta: {
        hasHighRiskActions: hasHighRisk,
        approvalRequired: updatedRule.requiresApproval,
      },
    });
  } catch (error) {
    console.error('Update automation rule error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// DELETE /api/organizations/[id]/automation-rules/[ruleId] — Soft delete rule
export async function DELETE(
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
    const existingRule = await db.automationRule.findFirst({
      where: {
        id: ruleId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Automatiseringsregel niet gevonden' },
        { status: 404 }
      );
    }

    await deleteAutomationRule(ruleId);

    return NextResponse.json({
      data: { ruleId, deleted: true },
      message: 'Automatiseringsregel verwijderd',
    });
  } catch (error) {
    console.error('Delete automation rule error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
