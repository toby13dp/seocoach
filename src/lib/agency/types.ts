// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Agency Types — Phase 10

import type { ClientHealthStatus, SLAStatus, DeliverableStatus, ApprovalQueueStatus } from '@prisma/client';

/**
 * Gezondheidsstatussen voor cliënten
 */
export const CLIENT_HEALTH_LABELS: Record<ClientHealthStatus, string> = {
  EXCELLENT: 'Uitstekend',
  GOOD: 'Goed',
  NEEDS_ATTENTION: 'Heeft aandacht nodig',
  CRITICAL: 'Kritiek',
};

/**
 * SLA-statuslabels
 */
export const SLA_STATUS_LABELS: Record<SLAStatus, string> = {
  ON_TRACK: 'Op schema',
  AT_RISK: 'Risico',
  BREACHED: 'Overtreden',
};

/**
 * Statuslabels voor opleveringen
 */
export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  PENDING: 'In afwachting',
  IN_PROGRESS: 'Bezig',
  SUBMITTED: 'Ingediend',
  APPROVED: 'Goedgekeurd',
  REJECTED: 'Afgewezen',
  OVERDUE: 'Te laat',
};

/**
 * Statuslabels voor goedkeuringswachtrij
 */
export const APPROVAL_STATUS_LABELS: Record<ApprovalQueueStatus, string> = {
  PENDING: 'In afwachting',
  APPROVED: 'Goedgekeurd',
  REJECTED: 'Afgewezen',
  CANCELLED: 'Geannuleerd',
};

/**
 * Types voor het agentschapsdashboard
 */
export interface AgencyDashboardData {
  clientsNeedingAttention: AgencyClientSummary[];
  reportsDue: AgencyDeliverableSummary[];
  pendingApprovals: AgencyApprovalSummary[];
  capacityRisks: AgencyCapacityRisk[];
  missingDeliverables: AgencyDeliverableSummary[];
  criticalSeoAlerts: AgencyAlertSummary[];
  integrationFailures: AgencyIntegrationFailure[];
  growthOpportunities: AgencyGrowthOpportunity[];
}

export interface AgencyClientSummary {
  clientId: string;
  clientName: string;
  healthStatus: ClientHealthStatus;
  healthScore: number;
  slaStatus: SLAStatus;
  concernReason: string;
}

export interface AgencyDeliverableSummary {
  id: string;
  title: string;
  type: string;
  dueDate: Date | null;
  clientId?: string;
  clientName?: string;
  status: DeliverableStatus;
}

export interface AgencyApprovalSummary {
  id: string;
  title: string;
  itemType: string;
  riskLevel: string;
  submittedAt: Date | null;
  submittedBy?: string;
}

export interface AgencyCapacityRisk {
  userId: string;
  userName: string;
  totalHoursThisWeek: number;
  maxHoursPerWeek: number;
  utilizationPercent: number;
  overloadedProjects: string[];
}

export interface AgencyAlertSummary {
  id: string;
  type: string;
  severity: string;
  title: string;
  entityType?: string;
  entityId?: string;
}

export interface AgencyIntegrationFailure {
  id: string;
  provider: string;
  lastSyncAt: Date | null;
  errorMessage: string;
}

export interface AgencyGrowthOpportunity {
  clientId: string;
  clientName: string;
  opportunityType: string;
  description: string;
  estimatedRevenue: number | null;
}

/**
 * Tijdregistratie samenvatting
 */
export interface TimeTrackingSummary {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  byCategory: Record<string, number>;
  byUser: Record<string, number>;
}

/**
 * Gezondheidsberekeningsconfiguratie
 */
export const HEALTH_SCORE_WEIGHTS = {
  slaCompliance: 0.25,
  deliverableOnTime: 0.20,
  communicationResponsiveness: 0.15,
  seoProgress: 0.25,
  satisfaction: 0.15,
} as const;
