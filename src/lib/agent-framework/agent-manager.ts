// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Agent Manager — Phase 11
// Beheert gespecialiseerde agents met tool-allowlists, goedkeuringspoorten en auditlogs

import { db } from '@/lib/db';
import type { AgentType, AgentRunStatus } from '@prisma/client';
import { ALL_AGENT_TYPES, AGENT_TOOL_ALLOWLISTS, DEFAULT_AGENT_CONFIGS, AGENT_TYPE_LABELS } from './types';
import type { AgentConfig, AgentExecutionResult } from './types';

// ============================================================================
// Agent Run Management
// ============================================================================

/**
 * Maakt een nieuwe agent-run aan
 */
export async function createAgentRun(data: {
  organizationId: string;
  projectId: string;
  agentType: AgentType;
  objective: string;
  model?: string;
  maxSteps?: number;
  timeoutMs?: number;
  inputs: Record<string, unknown>;
}): Promise<{ runId: string; status: AgentRunStatus }> {
  const config = DEFAULT_AGENT_CONFIGS[data.agentType];
  const model = data.model ?? config.model;
  const maxSteps = data.maxSteps ?? config.maxSteps;
  const timeoutMs = data.timeoutMs ?? config.timeoutMs;

  // Controleer of er actieve runs zijn voor dit project (beperk parallellisme)
  const activeRuns = await db.agentRun.count({
    where: {
      projectId: data.projectId,
      status: { in: ['PENDING', 'RUNNING'] },
      deletedAt: null,
    },
  });

  if (activeRuns >= 5) {
    throw new Error('Te veel actieve agent-runs voor dit project. Wacht tot een run is voltooid.');
  }

  const run = await db.agentRun.create({
    data: {
      organizationId: data.organizationId,
      projectId: data.projectId,
      agentType: data.agentType,
      objective: data.objective,
      model,
      maxSteps,
      timeoutMs,
      inputs: JSON.stringify(data.inputs),
      status: 'PENDING',
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      organizationId: data.organizationId,
      userId: 'system',
      action: 'AGENT_RUN_CREATED',
      entity: 'agent_run',
      entityId: run.id,
      changes: JSON.stringify({ agentType: data.agentType, objective: data.objective }),
    },
  });

  return { runId: run.id, status: 'PENDING' };
}

/**
 * Start een agent-run
 */
export async function startAgentRun(runId: string): Promise<void> {
  await db.agentRun.update({
    where: { id: runId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });
}

/**
 * Werkt een agent-run bij met voortgang
 */
export async function updateAgentRunProgress(
  runId: string,
  data: {
    currentStep?: number;
    retrievedSources?: Record<string, unknown>[];
    proposedActions?: Record<string, unknown>[];
    completedActions?: Record<string, unknown>[];
    inputTokens?: number;
    outputTokens?: number;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  if (data.currentStep !== undefined) updateData.currentStep = data.currentStep;
  if (data.retrievedSources !== undefined) updateData.retrievedSources = JSON.stringify(data.retrievedSources);
  if (data.proposedActions !== undefined) updateData.proposedActions = JSON.stringify(data.proposedActions);
  if (data.completedActions !== undefined) updateData.completedActions = JSON.stringify(data.completedActions);
  if (data.inputTokens !== undefined) updateData.inputTokens = data.inputTokens;
  if (data.outputTokens !== undefined) updateData.outputTokens = data.outputTokens;

  await db.agentRun.update({
    where: { id: runId },
    data: updateData,
  });
}

/**
 * Voltooit een agent-run
 */
export async function completeAgentRun(
  runId: string,
  result: {
    result?: Record<string, unknown>;
    confidence?: number;
    costEur?: number;
    inputTokens?: number;
    outputTokens?: number;
  }
): Promise<AgentExecutionResult> {
  const run = await db.agentRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error('Agent-run niet gevonden');

  const completedAt = new Date();
  const durationMs = run.startedAt ? completedAt.getTime() - run.startedAt.getTime() : 0;

  const totalInputTokens = (run.inputTokens ?? 0) + (result.inputTokens ?? 0);
  const totalOutputTokens = (run.outputTokens ?? 0) + (result.outputTokens ?? 0);
  const totalCost = (run.costEur ?? 0) + (result.costEur ?? 0);

  await db.agentRun.update({
    where: { id: runId },
    data: {
      status: 'COMPLETED',
      result: result.result ? JSON.stringify(result.result) : null,
      confidence: result.confidence,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costEur: totalCost,
      completedAt,
      durationMs,
    },
  });

  return {
    runId,
    status: 'COMPLETED',
    result: result.result,
    confidence: result.confidence,
    costEur: totalCost,
    durationMs,
  };
}

/**
 * Faalt een agent-run
 */
export async function failAgentRun(runId: string, error: string): Promise<void> {
  const run = await db.agentRun.findUnique({ where: { id: runId } });
  const completedAt = new Date();
  const durationMs = run?.startedAt ? completedAt.getTime() - run.startedAt.getTime() : 0;

  await db.agentRun.update({
    where: { id: runId },
    data: {
      status: 'FAILED',
      errors: JSON.stringify([{ message: error, timestamp: new Date().toISOString() }]),
      completedAt,
      durationMs,
    },
  });
}

/**
 * Annuleert een agent-run
 */
export async function cancelAgentRun(runId: string): Promise<void> {
  await db.agentRun.update({
    where: { id: runId },
    data: {
      cancellationRequested: true,
      status: 'CANCELLED',
      completedAt: new Date(),
    },
  });
}

// ============================================================================
// Approval Gates
// ============================================================================

/**
 * Vraagt goedkeuring aan voor voorgestelde acties
 */
export async function requestAgentApproval(
  runId: string,
  proposedActions: Record<string, unknown>[]
): Promise<void> {
  await db.agentRun.update({
    where: { id: runId },
    data: {
      status: 'AWAITING_APPROVAL',
      proposedActions: JSON.stringify(proposedActions),
    },
  });
}

/**
 * Keurt voorgestelde acties van een agent goed
 */
export async function approveAgentActions(
  runId: string,
  approvedBy: string,
  actionIndices?: number[] // null = alle acties goedkeuren
): Promise<void> {
  const run = await db.agentRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error('Agent-run niet gevonden');

  const proposedActions = run.proposedActions ? JSON.parse(run.proposedActions) : [];
  const completedActions = run.completedActions ? JSON.parse(run.completedActions) : [];

  // Filter goedgekeurde acties
  const actionsToExecute = actionIndices
    ? proposedActions.filter((_: unknown, i: number) => actionIndices.includes(i))
    : proposedActions;

  completedActions.push(...actionsToExecute);

  const approvals = run.approvals ? JSON.parse(run.approvals) : [];
  approvals.push({
    approvedBy,
    approvedAt: new Date().toISOString(),
    actionIndices: actionIndices ?? 'all',
  });

  await db.agentRun.update({
    where: { id: runId },
    data: {
      status: 'RUNNING',
      completedActions: JSON.stringify(completedActions),
      approvals: JSON.stringify(approvals),
    },
  });
}

/**
 * Wijst voorgestelde acties van een agent af
 */
export async function rejectAgentActions(
  runId: string,
  rejectedBy: string,
  reason: string
): Promise<void> {
  await db.agentRun.update({
    where: { id: runId },
    data: {
      status: 'FAILED',
      errors: JSON.stringify([{ message: `Acties afgewezen door ${rejectedBy}: ${reason}`, timestamp: new Date().toISOString() }]),
      completedAt: new Date(),
    },
  });
}

// ============================================================================
// Tool Permission Checks
// ============================================================================

/**
 * Controleert of een agent een bepaalde tool mag gebruiken
 */
export function isToolAllowedForAgent(agentType: AgentType, tool: string): boolean {
  const allowlist = AGENT_TOOL_ALLOWLISTS[agentType];
  return allowlist.includes(tool);
}

/**
 * Haalt de tool-allowlist op voor een agent
 */
export function getAgentToolAllowlist(agentType: AgentType): string[] {
  return AGENT_TOOL_ALLOWLISTS[agentType];
}

/**
 * Haalt de configuratie op voor een agent
 */
export function getAgentConfig(agentType: AgentType): AgentConfig {
  return DEFAULT_AGENT_CONFIGS[agentType];
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Haalt agent-runs op voor een project
 */
export async function getProjectAgentRuns(
  projectId: string,
  options?: { agentType?: AgentType; status?: AgentRunStatus; limit?: number }
) {
  return db.agentRun.findMany({
    where: {
      projectId,
      agentType: options?.agentType,
      status: options?.status,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 50,
  });
}

/**
 * Haalt een enkele agent-run op met details
 */
export async function getAgentRunDetails(runId: string) {
  return db.agentRun.findUnique({
    where: { id: runId },
  });
}

/**
 * Genereert een leesbaar uitvoersamenvatting
 */
export function generateExecutionSummary(run: {
  agentType: string;
  objective: string;
  status: string;
  currentStep: number;
  maxSteps: number;
  costEur: number;
  durationMs: number | null;
  result: string | null;
  errors: string | null;
}): string {
  const statusLabels: Record<string, string> = {
    PENDING: 'In afwachting',
    RUNNING: `Bezig (stap ${run.currentStep}/${run.maxSteps})`,
    COMPLETED: 'Voltooid',
    FAILED: 'Mislukt',
    CANCELLED: 'Geannuleerd',
    AWAITING_APPROVAL: 'Wacht op goedkeuring',
  };

  const lines = [
    `Agent: ${AGENT_TYPE_LABELS[run.agentType as AgentType] ?? run.agentType}`,
    `Doel: ${run.objective}`,
    `Status: ${statusLabels[run.status] ?? run.status}`,
  ];

  if (run.costEur > 0) {
    lines.push(`Kosten: €${run.costEur.toFixed(4)}`);
  }

  if (run.durationMs) {
    const seconds = Math.round(run.durationMs / 1000);
    lines.push(`Duur: ${seconds}s`);
  }

  if (run.errors) {
    lines.push(`Fouten: ${run.errors}`);
  }

  return lines.join('\n');
}
