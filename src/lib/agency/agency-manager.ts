// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Agency Manager — Phase 10
// Beheert agentschapsoperaties: cliëntgezondheid, SLA's, opleveringen, tijdregistratie

import { db } from '@/lib/db';
import type { ClientHealthStatus, SLAStatus } from '@prisma/client';
import { HEALTH_SCORE_WEIGHTS } from './types';
import type {
  AgencyDashboardData,
  AgencyClientSummary,
  AgencyDeliverableSummary,
  AgencyApprovalSummary,
  AgencyCapacityRisk,
  AgencyAlertSummary,
  AgencyIntegrationFailure,
  AgencyGrowthOpportunity,
  TimeTrackingSummary,
} from './types';

// ============================================================================
// Client Extension & Health
// ============================================================================

/**
 * Haalt of maakt de cliëntextensie op
 */
export async function getOrCreateClientExtension(clientId: string) {
  return db.clientExtension.upsert({
    where: { clientId },
    create: { clientId },
    update: {},
  });
}

/**
 * Werkt de cliëntextensie bij
 */
export async function updateClientExtension(
  clientId: string,
  data: {
    contractStart?: Date;
    contractEnd?: Date;
    contractType?: string;
    monthlyHours?: number;
    maxProjects?: number;
    maxKeywords?: number;
    maxPages?: number;
    monthlyFee?: number;
    costRate?: number;
    billingNotes?: string;
    slaResponseHours?: number;
    slaDeliveryHours?: number;
  }
) {
  // Bereken winstgevendheid automatisch
  const updateData: Record<string, unknown> = { ...data };
  if (data.monthlyFee !== undefined || data.costRate !== undefined) {
    const ext = await db.clientExtension.findUnique({ where: { clientId } });
    if (ext) {
      const fee = data.monthlyFee ?? ext.monthlyFee ?? 0;
      const cost = data.costRate ?? ext.costRate ?? 0;
      if (fee > 0) {
        updateData.profitability = (fee - cost) / fee;
      }
    }
  }

  return db.clientExtension.upsert({
    where: { clientId },
    create: { clientId, ...updateData },
    update: updateData,
  });
}

/**
 * Berekent de gezondheidsscore voor een cliënt
 */
export function calculateHealthScore(params: {
  slaCompliance: number; // 0-100
  deliverableOnTime: number; // 0-100
  communicationResponsiveness: number; // 0-100
  seoProgress: number; // 0-100
  satisfaction: number; // 0-100
}): number {
  const { slaCompliance, deliverableOnTime, communicationResponsiveness, seoProgress, satisfaction } = params;
  return Math.round(
    slaCompliance * HEALTH_SCORE_WEIGHTS.slaCompliance +
    deliverableOnTime * HEALTH_SCORE_WEIGHTS.deliverableOnTime +
    communicationResponsiveness * HEALTH_SCORE_WEIGHTS.communicationResponsiveness +
    seoProgress * HEALTH_SCORE_WEIGHTS.seoProgress +
    satisfaction * HEALTH_SCORE_WEIGHTS.satisfaction
  );
}

/**
 * Bepaalt gezondheidsstatus op basis van score
 */
export function determineHealthStatus(score: number): ClientHealthStatus {
  if (score >= 85) return 'EXCELLENT';
  if (score >= 65) return 'GOOD';
  if (score >= 40) return 'NEEDS_ATTENTION';
  return 'CRITICAL';
}

/**
 * Werkt de cliëntgezondheid bij
 */
export async function updateClientHealth(
  clientId: string,
  healthParams: {
    slaCompliance: number;
    deliverableOnTime: number;
    communicationResponsiveness: number;
    seoProgress: number;
    satisfaction: number;
  },
  notes?: string
): Promise<{ healthStatus: ClientHealthStatus; healthScore: number }> {
  const healthScore = calculateHealthScore(healthParams);
  const healthStatus = determineHealthStatus(healthScore);

  // Bepaal SLA-status
  let slaStatus: SLAStatus = 'ON_TRACK';
  if (healthParams.slaCompliance < 50) {
    slaStatus = 'BREACHED';
  } else if (healthParams.slaCompliance < 80) {
    slaStatus = 'AT_RISK';
  }

  await db.clientExtension.upsert({
    where: { clientId },
    create: {
      clientId,
      healthStatus,
      healthScore,
      slaStatus,
      healthNotes: notes ? JSON.stringify({ notes, updatedAt: new Date().toISOString() }) : null,
      lastHealthCheck: new Date(),
    },
    update: {
      healthStatus,
      healthScore,
      slaStatus,
      healthNotes: notes ? JSON.stringify({ notes, updatedAt: new Date().toISOString() }) : null,
      lastHealthCheck: new Date(),
    },
  });

  return { healthStatus, healthScore };
}

// ============================================================================
// Deliverables
// ============================================================================

/**
 * Maakt een nieuwe oplevering aan
 */
export async function createDeliverable(data: {
  organizationId: string;
  clientId?: string;
  projectId?: string;
  title: string;
  description?: string;
  type: string;
  dueDate?: Date;
  assignedTo?: string;
  hoursBudgeted?: number;
  isClientVisible?: boolean;
  internalNotes?: string;
}) {
  return db.deliverable.create({ data });
}

/**
 * Werkt een oplevering bij
 */
export async function updateDeliverable(
  deliverableId: string,
  data: {
    title?: string;
    description?: string;
    dueDate?: Date;
    assignedTo?: string;
    status?: string;
    hoursSpent?: number;
    completedDate?: Date;
    clientNotes?: string;
    internalNotes?: string;
    isClientVisible?: boolean;
  }
) {
  return db.deliverable.update({
    where: { id: deliverableId },
    data: data as Record<string, unknown>,
  });
}

/**
 * Controleert op te late opleveringen en markeert ze
 */
export async function markOverdueDeliverables(organizationId: string): Promise<number> {
  const now = new Date();
  const overdue = await db.deliverable.findMany({
    where: {
      organizationId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      dueDate: { lt: now },
      deletedAt: null,
    },
  });

  let count = 0;
  for (const d of overdue) {
    await db.deliverable.update({
      where: { id: d.id },
      data: { status: 'OVERDUE' },
    });
    count++;
  }

  return count;
}

// ============================================================================
// Time Tracking
// ============================================================================

/**
 * Maakt een tijdregistratie aan
 */
export async function createTimeEntry(data: {
  organizationId: string;
  projectId?: string;
  clientId?: string;
  userId: string;
  date: Date;
  hours: number;
  description: string;
  category: string;
  isBillable?: boolean;
  hourlyRate?: number;
}) {
  return db.timeEntry.create({ data });
}

/**
 * Haalt een tijdregistratiesamenvatting op
 */
export async function getTimeTrackingSummary(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<TimeTrackingSummary> {
  const entries = await db.timeEntry.findMany({
    where: {
      organizationId,
      date: { gte: startDate, lte: endDate },
      deletedAt: null,
    },
  });

  let totalHours = 0;
  let billableHours = 0;
  const byCategory: Record<string, number> = {};
  const byUser: Record<string, number> = {};

  for (const entry of entries) {
    totalHours += entry.hours;
    if (entry.isBillable) billableHours += entry.hours;

    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + entry.hours;
    byUser[entry.userId] = (byUser[entry.userId] ?? 0) + entry.hours;
  }

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    billableHours: Math.round(billableHours * 100) / 100,
    nonBillableHours: Math.round((totalHours - billableHours) * 100) / 100,
    byCategory,
    byUser,
  };
}

// ============================================================================
// Monthly Work Summary
// ============================================================================

/**
 * Maakt of werkt een maandelijkse werksamenvatting bij
 */
export async function upsertMonthlyWorkSummary(
  organizationId: string,
  clientId: string,
  year: number,
  month: number,
  data: {
    totalHours?: number;
    billableHours?: number;
    deliverablesCompleted?: number;
    deliverablesPending?: number;
    summary?: string;
    highlights?: string;
    concerns?: string;
    status?: string;
  }
) {
  return db.monthlyWorkSummary.upsert({
    where: { clientId_year_month: { clientId, year, month } },
    create: { organizationId, clientId, year, month, ...data },
    update: data,
  });
}

// ============================================================================
// Recurring Tasks
// ============================================================================

/**
 * Maakt een terugkerende taak aan
 */
export async function createRecurringTask(data: {
  organizationId: string;
  projectId?: string;
  clientId?: string;
  title: string;
  description?: string;
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  assignedTo?: string;
}) {
  // Bereken volgende uitvoering
  const nextRunAt = calculateNextRun(
    data.frequency as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY',
    data.dayOfWeek,
    data.dayOfMonth
  );

  return db.recurringTask.create({
    data: {
      ...data,
      nextRunAt,
    } as Record<string, unknown>,
  });
}

/**
 * Berekent de volgende uitvoeringsdatum
 */
export function calculateNextRun(
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY',
  dayOfWeek?: number,
  dayOfMonth?: number
): Date {
  const now = new Date();
  const next = new Date(now);

  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      break;
    case 'WEEKLY': {
      const targetDay = dayOfWeek ?? 1; // Maandag standaard
      const currentDay = next.getDay();
      const daysUntil = ((targetDay - currentDay + 7) % 7) || 7;
      next.setDate(next.getDate() + daysUntil);
      next.setHours(9, 0, 0, 0);
      break;
    }
    case 'BIWEEKLY': {
      const targetDay = dayOfWeek ?? 1;
      const currentDay = next.getDay();
      const daysUntil = ((targetDay - currentDay + 7) % 7) || 7;
      next.setDate(next.getDate() + daysUntil + 7);
      next.setHours(9, 0, 0, 0);
      break;
    }
    case 'MONTHLY': {
      const targetDate = dayOfMonth ?? 1;
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(targetDate, 28)); // Veilig voor februari
      next.setHours(9, 0, 0, 0);
      break;
    }
    case 'QUARTERLY': {
      next.setMonth(next.getMonth() + 3);
      next.setDate(dayOfMonth ?? 1);
      next.setHours(9, 0, 0, 0);
      break;
    }
  }

  return next;
}

// ============================================================================
// Approval Queue
// ============================================================================

/**
 * Voegt een item toe aan de goedkeuringswachtrij
 */
export async function submitForApproval(data: {
  organizationId: string;
  projectId?: string;
  clientId?: string;
  itemType: string;
  itemId?: string;
  title: string;
  description?: string;
  evidence?: string;
  submittedBy: string;
  riskLevel?: string;
  isClientVisible?: boolean;
}) {
  return db.approvalQueueItem.create({
    data: {
      ...data,
      submittedAt: new Date(),
      status: 'PENDING',
      riskLevel: data.riskLevel ?? 'low',
    },
  });
}

/**
 * Keurt een item goed
 */
export async function approveQueueItem(
  itemId: string,
  reviewedBy: string,
  notes?: string
) {
  return db.approvalQueueItem.update({
    where: { id: itemId },
    data: {
      status: 'APPROVED',
      reviewedBy,
      reviewedAt: new Date(),
      reviewNotes: notes ?? null,
    },
  });
}

/**
 * Wijst een item af
 */
export async function rejectQueueItem(
  itemId: string,
  reviewedBy: string,
  notes: string
) {
  return db.approvalQueueItem.update({
    where: { id: itemId },
    data: {
      status: 'REJECTED',
      reviewedBy,
      reviewedAt: new Date(),
      reviewNotes: notes,
    },
  });
}

// ============================================================================
// Internal Notes
// ============================================================================

/**
 * Maakt een interne notitie aan
 */
export async function createInternalNote(data: {
  organizationId: string;
  entityType: string;
  entityId: string;
  content: string;
  authorId: string;
  isPinned?: boolean;
}) {
  return db.internalNote.create({ data });
}

/**
 * Haalt interne notities op voor een entiteit
 */
export async function getInternalNotes(
  organizationId: string,
  entityType: string,
  entityId: string
) {
  return db.internalNote.findMany({
    where: {
      organizationId,
      entityType,
      entityId,
      deletedAt: null,
    },
    orderBy: [
      { isPinned: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}

// ============================================================================
// Agency Dashboard
// ============================================================================

/**
 * Bouwt het volledige agentschapsdashboard op
 */
export async function buildAgencyDashboard(organizationId: string): Promise<AgencyDashboardData> {
  const [
    clientsNeedingAttention,
    reportsDue,
    pendingApprovals,
    capacityRisks,
    missingDeliverables,
    criticalSeoAlerts,
    integrationFailures,
    growthOpportunities,
  ] = await Promise.all([
    getClientsNeedingAttention(organizationId),
    getReportsDue(organizationId),
    getPendingApprovals(organizationId),
    getCapacityRisks(organizationId),
    getMissingDeliverables(organizationId),
    getCriticalSeoAlerts(organizationId),
    getIntegrationFailures(organizationId),
    getGrowthOpportunities(organizationId),
  ]);

  return {
    clientsNeedingAttention,
    reportsDue,
    pendingApprovals,
    capacityRisks,
    missingDeliverables,
    criticalSeoAlerts,
    integrationFailures,
    growthOpportunities,
  };
}

async function getClientsNeedingAttention(organizationId: string): Promise<AgencyClientSummary[]> {
  const extensions = await db.clientExtension.findMany({
    where: {
      healthStatus: { in: ['NEEDS_ATTENTION', 'CRITICAL'] },
      deletedAt: null,
      client: { organizationId, deletedAt: null },
    },
    include: { client: true },
  });

  return extensions.map(ext => ({
    clientId: ext.clientId,
    clientName: ext.client.name,
    healthStatus: ext.healthStatus,
    healthScore: ext.healthScore,
    slaStatus: ext.slaStatus,
    concernReason: ext.healthNotes
      ? (() => {
          try {
            const parsed = JSON.parse(ext.healthNotes);
            return parsed.notes ?? 'Geen specifieke reden opgegeven';
          } catch {
            return 'Geen specifieke reden opgegeven';
          }
        })()
      : 'Geen specifieke reden opgegeven',
  }));
}

async function getReportsDue(organizationId: string): Promise<AgencyDeliverableSummary[]> {
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const deliverables = await db.deliverable.findMany({
    where: {
      organizationId,
      type: 'report',
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      dueDate: { gte: now, lte: nextWeek },
      deletedAt: null,
    },
    include: { client: true },
  });

  return deliverables.map(d => ({
    id: d.id,
    title: d.title,
    type: d.type,
    dueDate: d.dueDate,
    clientId: d.clientId ?? undefined,
    clientName: d.client?.name,
    status: d.status,
  }));
}

async function getPendingApprovals(organizationId: string): Promise<AgencyApprovalSummary[]> {
  const items = await db.approvalQueueItem.findMany({
    where: {
      organizationId,
      status: 'PENDING',
      deletedAt: null,
    },
    orderBy: [
      { riskLevel: 'desc' },
      { submittedAt: 'asc' },
    ],
    take: 20,
  });

  return items.map(item => ({
    id: item.id,
    title: item.title,
    itemType: item.itemType,
    riskLevel: item.riskLevel,
    submittedAt: item.submittedAt,
    submittedBy: item.submittedBy ?? undefined,
  }));
}

async function getCapacityRisks(organizationId: string): Promise<AgencyCapacityRisk[]> {
  // Bereken huidige week uren per gebruiker
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Maandag
  weekStart.setHours(0, 0, 0, 0);

  const entries = await db.timeEntry.findMany({
    where: {
      organizationId,
      date: { gte: weekStart },
      deletedAt: null,
    },
  });

  const userHours: Record<string, number> = {};
  const userProjects: Record<string, Set<string>> = {};

  for (const entry of entries) {
    userHours[entry.userId] = (userHours[entry.userId] ?? 0) + entry.hours;
    if (entry.projectId) {
      if (!userProjects[entry.userId]) userProjects[entry.userId] = new Set();
      userProjects[entry.userId].add(entry.projectId);
    }
  }

  const maxHoursPerWeek = 40;
  const risks: AgencyCapacityRisk[] = [];

  for (const [userId, hours] of Object.entries(userHours)) {
    if (hours > maxHoursPerWeek * 0.8) { // >80% belasting
      risks.push({
        userId,
        userName: userId, // Vereist user lookup voor naam
        totalHoursThisWeek: Math.round(hours * 100) / 100,
        maxHoursPerWeek,
        utilizationPercent: Math.round((hours / maxHoursPerWeek) * 100),
        overloadedProjects: userProjects[userId] ? Array.from(userProjects[userId]) : [],
      });
    }
  }

  return risks.sort((a, b) => b.utilizationPercent - a.utilizationPercent);
}

async function getMissingDeliverables(organizationId: string): Promise<AgencyDeliverableSummary[]> {
  const overdueDeliverables = await db.deliverable.findMany({
    where: {
      organizationId,
      status: 'OVERDUE',
      deletedAt: null,
    },
    include: { client: true },
    take: 20,
  });

  return overdueDeliverables.map(d => ({
    id: d.id,
    title: d.title,
    type: d.type,
    dueDate: d.dueDate,
    clientId: d.clientId ?? undefined,
    clientName: d.client?.name,
    status: d.status,
  }));
}

async function getCriticalSeoAlerts(organizationId: string): Promise<AgencyAlertSummary[]> {
  const alerts = await db.agencyAlert.findMany({
    where: {
      organizationId,
      type: 'seo_alert',
      severity: { in: ['high', 'critical'] },
      isResolved: false,
      deletedAt: null,
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  return alerts.map(a => ({
    id: a.id,
    type: a.type,
    severity: a.severity,
    title: a.title,
    entityType: a.entityType ?? undefined,
    entityId: a.entityId ?? undefined,
  }));
}

async function getIntegrationFailures(organizationId: string): Promise<AgencyIntegrationFailure[]> {
  const integrations = await db.pMIntegration.findMany({
    where: {
      organizationId,
      status: 'ERROR',
      deletedAt: null,
    },
  });

  return integrations.map(i => ({
    id: i.id,
    provider: i.provider,
    lastSyncAt: i.lastSyncAt,
    errorMessage: i.syncErrors
      ? (() => {
          try {
            const errors = JSON.parse(i.syncErrors);
            return Array.isArray(errors) ? errors[0] ?? 'Onbekende fout' : 'Onbekende fout';
          } catch {
            return i.syncErrors ?? 'Onbekende fout';
          }
        })()
      : 'Onbekende fout',
  }));
}

async function getGrowthOpportunities(organizationId: string): Promise<AgencyGrowthOpportunity[]> {
  // Cliënten met uitstekende gezondheid die mogelijk in aanmerking komen voor uitbreiding
  const excellentClients = await db.clientExtension.findMany({
    where: {
      healthStatus: 'EXCELLENT',
      deletedAt: null,
      client: { organizationId, deletedAt: null },
    },
    include: { client: true },
  });

  return excellentClients.map(ext => ({
    clientId: ext.clientId,
    clientName: ext.client.name,
    opportunityType: 'uitbreiding',
    description: `Cliënt presteert uitstekend (score: ${ext.healthScore}). Mogelijkheid voor uitbreiding van diensten.`,
    estimatedRevenue: ext.monthlyFee ? ext.monthlyFee * 0.3 : null,
  }));
}
