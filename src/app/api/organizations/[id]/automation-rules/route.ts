import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { getAutomationRules, createAutomationRule } from '@/lib/automation-rules';
import { isHighRiskAction } from '@/lib/automation-rules';
import type { AutomationTriggerType, AutomationActionType, AutomationRuleStatus } from '@prisma/client';

const VALID_TRIGGER_TYPES: AutomationTriggerType[] = [
  'NEW_TECHNICAL_ISSUE', 'METRIC_DROP', 'NEW_CONTENT_OPPORTUNITY', 'CONTENT_DECAY',
  'NEW_COMPETITOR_PAGE', 'NEW_NEGATIVE_REVIEW', 'SCHEDULED_DATE',
  'NEW_AI_VISIBILITY_RESULT', 'NEW_WORDPRESS_DRAFT', 'PRODUCT_FEED_ERROR', 'DEPLOYMENT_EVENT',
];

const VALID_ACTION_TYPES: AutomationActionType[] = [
  'CREATE_TASK', 'CREATE_ALERT', 'GENERATE_BRIEF', 'GENERATE_CONTENT_DRAFT',
  'GENERATE_REPORT', 'NOTIFY_USER', 'PREPARE_CMS_UPDATE', 'RUN_CRAWL',
  'RUN_QUALITY_CHECK', 'CREATE_APPROVAL_REQUEST', 'CALL_WEBHOOK',
];

const VALID_STATUSES: AutomationRuleStatus[] = ['ACTIVE', 'PAUSED', 'DRAFT', 'DISABLED'];

// GET /api/organizations/[id]/automation-rules — List automation rules
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
    const projectId = searchParams.get('projectId') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const triggerType = searchParams.get('triggerType') ?? undefined;

    // Validate query parameters
    if (status && !VALID_STATUSES.includes(status as AutomationRuleStatus)) {
      return NextResponse.json(
        { error: `Ongeldige statusfilter: "${status}"` },
        { status: 400 }
      );
    }

    if (triggerType && !VALID_TRIGGER_TYPES.includes(triggerType as AutomationTriggerType)) {
      return NextResponse.json(
        { error: `Ongeldig triggertype: "${triggerType}"` },
        { status: 400 }
      );
    }

    const rules = await getAutomationRules(organizationId, {
      projectId,
      status: status as AutomationRuleStatus | undefined,
      triggerType: triggerType as AutomationTriggerType | undefined,
    });

    return NextResponse.json({
      data: rules,
      meta: { total: rules.length },
    });
  } catch (error) {
    console.error('List automation rules error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/organizations/[id]/automation-rules — Create automation rule
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
      return NextResponse.json({ error: 'Geen toegang tot deze organisatie' }, { status: 403 });
    }

    const body = await request.json();
    const { name, triggerType, actions, conditions, projectId, description, requiresApproval } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Naam is vereist voor een automatiseringsregel' },
        { status: 400 }
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        { error: 'Naam mag maximaal 200 tekens bevatten' },
        { status: 400 }
      );
    }

    if (!triggerType || typeof triggerType !== 'string') {
      return NextResponse.json(
        { error: 'Triggertype is vereist' },
        { status: 400 }
      );
    }

    if (!VALID_TRIGGER_TYPES.includes(triggerType as AutomationTriggerType)) {
      return NextResponse.json(
        { error: `Ongeldig triggertype: "${triggerType}"` },
        { status: 400 }
      );
    }

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json(
        { error: 'Minimaal één actie is vereist' },
        { status: 400 }
      );
    }

    // Validate each action
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

    // Validate conditions if provided
    if (conditions !== undefined) {
      if (!Array.isArray(conditions)) {
        return NextResponse.json(
          { error: 'Voorwaarden moeten een array zijn' },
          { status: 400 }
        );
      }
      for (let i = 0; i < conditions.length; i++) {
        const cond = conditions[i];
        if (!cond.field || !cond.operator || cond.value === undefined) {
          return NextResponse.json(
            { error: `Voorwaarde op index ${i} moet field, operator en value bevatten` },
            { status: 400 }
          );
        }
        const validOperators = ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_contains'];
        if (!validOperators.includes(cond.operator)) {
          return NextResponse.json(
            { error: `Ongeldige operator op index ${i}: "${cond.operator}"` },
            { status: 400 }
          );
        }
      }
    }

    // Validate optional fields
    if (description !== undefined && typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Beschrijving moet een tekenreeks zijn' },
        { status: 400 }
      );
    }

    if (requiresApproval !== undefined && typeof requiresApproval !== 'boolean') {
      return NextResponse.json(
        { error: 'RequiresApproval moet een booleaanse waarde zijn' },
        { status: 400 }
      );
    }

    // Warn about high-risk actions
    const highRiskActions = actions.filter(
      (a: { type: string }) => isHighRiskAction(a.type as AutomationActionType)
    );
    if (highRiskActions.length > 0) {
      // High-risk actions automatically require approval — this will be handled by createAutomationRule
    }

    const rule = await createAutomationRule({
      organizationId,
      projectId: projectId ?? undefined,
      name: name.trim(),
      description: description?.trim(),
      triggerType: triggerType as AutomationTriggerType,
      conditions: conditions ?? undefined,
      actions,
      requiresApproval: requiresApproval ?? undefined,
      createdBy: user.id,
    });

    return NextResponse.json(
      {
        data: rule,
        meta: {
          hasHighRiskActions: highRiskActions.length > 0,
          approvalRequired: rule.requiresApproval,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create automation rule error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
