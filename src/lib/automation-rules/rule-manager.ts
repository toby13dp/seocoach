// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Automation Rules Manager — Phase 11
// Beheert automatiseringsregels met triggers, voorwaarden en acties

import { db } from '@/lib/db';
import type { AutomationTriggerType, AutomationActionType, AutomationRuleStatus } from '@prisma/client';
import { isHighRiskAction, HIGH_RISK_ACTIONS } from './types';
import type { AutomationCondition, AutomationAction } from './types';

// ============================================================================
// Rule CRUD
// ============================================================================

/**
 * Maakt een nieuwe automatiseringsregel aan
 */
export async function createAutomationRule(data: {
  organizationId: string;
  projectId?: string;
  name: string;
  description?: string;
  triggerType: AutomationTriggerType;
  triggerConfig?: Record<string, unknown>;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  requiresApproval?: boolean;
  approvalConfig?: Record<string, unknown>;
  createdBy?: string;
}) {
  // Controleer of hoogrisico-acties goedkeuring vereisen
  let requiresApproval = data.requiresApproval ?? false;
  let isHighRisk = false;

  for (const action of data.actions) {
    if (isHighRiskAction(action.type)) {
      isHighRisk = true;
      requiresApproval = true; // Hoogrisico-acties vereisen altijd goedkeuring
    }
  }

  const rule = await db.automationRule.create({
    data: {
      organizationId: data.organizationId,
      projectId: data.projectId,
      name: data.name,
      description: data.description,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
      conditions: data.conditions ? JSON.stringify(data.conditions) : null,
      actions: JSON.stringify(data.actions),
      requiresApproval,
      approvalConfig: data.approvalConfig ? JSON.stringify(data.approvalConfig) : null,
      isHighRisk,
      status: 'DRAFT',
      createdBy: data.createdBy,
    },
  });

  return rule;
}

/**
 * Werkt een automatiseringsregel bij
 */
export async function updateAutomationRule(
  ruleId: string,
  data: {
    name?: string;
    description?: string;
    triggerType?: AutomationTriggerType;
    triggerConfig?: Record<string, unknown>;
    conditions?: AutomationCondition[];
    actions?: AutomationAction[];
    requiresApproval?: boolean;
    approvalConfig?: Record<string, unknown>;
    status?: AutomationRuleStatus;
  }
) {
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.triggerType !== undefined) updateData.triggerType = data.triggerType;
  if (data.triggerConfig !== undefined) updateData.triggerConfig = JSON.stringify(data.triggerConfig);
  if (data.conditions !== undefined) updateData.conditions = JSON.stringify(data.conditions);
  if (data.status !== undefined) updateData.status = data.status;
  if (data.approvalConfig !== undefined) updateData.approvalConfig = JSON.stringify(data.approvalConfig);

  if (data.actions !== undefined) {
    updateData.actions = JSON.stringify(data.actions);
    // Hercontroleer hoogrisico-acties
    let isHighRisk = false;
    let requiresApproval = data.requiresApproval ?? false;
    for (const action of data.actions) {
      if (isHighRiskAction(action.type)) {
        isHighRisk = true;
        requiresApproval = true;
      }
    }
    updateData.isHighRisk = isHighRisk;
    updateData.requiresApproval = requiresApproval;
  } else if (data.requiresApproval !== undefined) {
    updateData.requiresApproval = data.requiresApproval;
  }

  return db.automationRule.update({
    where: { id: ruleId },
    data: updateData,
  });
}

/**
 * Haalt automatiseringsregels op
 */
export async function getAutomationRules(
  organizationId: string,
  options?: { projectId?: string; status?: AutomationRuleStatus; triggerType?: AutomationTriggerType }
) {
  return db.automationRule.findMany({
    where: {
      organizationId,
      projectId: options?.projectId,
      status: options?.status,
      triggerType: options?.triggerType,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Verwijdert een automatiseringsregel (soft delete)
 */
export async function deleteAutomationRule(ruleId: string) {
  return db.automationRule.update({
    where: { id: ruleId },
    data: { deletedAt: new Date() },
  });
}

// ============================================================================
// Rule Evaluation
// ============================================================================

/**
 * Evalueert of voorwaarden overeenkomen
 */
export function evaluateConditions(
  conditions: AutomationCondition[],
  data: Record<string, unknown>
): boolean {
  return conditions.every(condition => {
    const fieldValue = data[condition.field];
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'greater_than':
        return typeof fieldValue === 'number' && fieldValue > (condition.value as number);
      case 'less_than':
        return typeof fieldValue === 'number' && fieldValue < (condition.value as number);
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'not_contains':
        return !String(fieldValue).includes(String(condition.value));
      default:
        return false;
    }
  });
}

/**
 * Triggert een automatiseringsregel
 */
export async function triggerRule(
  ruleId: string,
  triggerData: Record<string, unknown>
): Promise<{ executionId: string; status: string }> {
  const rule = await db.automationRule.findUnique({
    where: { id: ruleId },
  });

  if (!rule || rule.status !== 'ACTIVE') {
    throw new Error('Regel niet gevonden of niet actief');
  }

  // Evalueer voorwaarden
  let conditionsMet = true;
  if (rule.conditions) {
    try {
      const conditions = JSON.parse(rule.conditions) as AutomationCondition[];
      conditionsMet = evaluateConditions(conditions, triggerData);
    } catch {
      // Ongeldige JSON — ga door zonder voorwaarden
    }
  }

  if (!conditionsMet) {
    return { executionId: '', status: 'conditions_not_met' };
  }

  // Maak uitvoering aan
  const status = rule.requiresApproval ? 'awaiting_approval' : 'running';

  const execution = await db.automationExecution.create({
    data: {
      ruleId,
      organizationId: rule.organizationId,
      triggerType: rule.triggerType,
      triggerData: JSON.stringify(triggerData),
      status,
    },
  });

  // Update regel-tracking
  await db.automationRule.update({
    where: { id: ruleId },
    data: {
      lastTriggeredAt: new Date(),
      triggerCount: { increment: 1 },
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      organizationId: rule.organizationId,
      userId: 'system',
      action: 'AUTOMATION_RULE_TRIGGERED',
      entity: 'automation_rule',
      entityId: ruleId,
      changes: JSON.stringify({ ruleName: rule.name, triggerType: rule.triggerType, executionId: execution.id }),
    },
  });

  return { executionId: execution.id, status };
}

/**
 * Voltooit een automatiseringsuitvoering
 */
export async function completeExecution(
  executionId: string,
  actionsExecuted: { type: string; result: unknown; error?: string }[]
): Promise<void> {
  const completedAt = new Date();

  await db.automationExecution.update({
    where: { id: executionId },
    data: {
      status: 'completed',
      actionsExecuted: JSON.stringify(actionsExecuted),
      completedAt,
    },
  });
}

/**
 * Faalt een automatiseringsuitvoering
 */
export async function failExecution(executionId: string, error: string): Promise<void> {
  await db.automationExecution.update({
    where: { id: executionId },
    data: {
      status: 'failed',
      error,
      completedAt: new Date(),
    },
  });
}

/**
 * Haalt uitvoeringsgeschiedenis op
 */
export async function getExecutionHistory(
  organizationId: string,
  options?: { ruleId?: string; limit?: number }
) {
  return db.automationExecution.findMany({
    where: {
      organizationId,
      ruleId: options?.ruleId,
      deletedAt: null,
    },
    orderBy: { startedAt: 'desc' },
    take: options?.limit ?? 50,
  });
}
