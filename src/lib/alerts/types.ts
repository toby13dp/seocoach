// ============================================================================
// SEOCoach Alert Engine — Type Definitions
// ============================================================================
//
// All user-facing text must be in Dutch (nl-NL).
// Never fabricate data — only create alerts when real data exists.
// Follows the pattern established in /src/lib/rules/types.ts.
// ---------------------------------------------------------------------------

import type { AlertType, AlertSeverity, AlertStatus } from '@prisma/client';

/**
 * Definition of an alert rule.
 * Each rule has a Dutch label/description, threshold configuration,
 * and specifies which metric to check and in which direction.
 */
export interface AlertRule {
  type: AlertType;
  /** Dutch name for the alert type */
  dutchLabel: string;
  /** Plain Dutch description of what this alert detects */
  dutchDescription: string;
  defaultSeverity: AlertSeverity;
  /** Percentage change threshold that triggers the alert */
  defaultThreshold: number;
  /** Minimum data points needed before alerting */
  minimumDataPoints: number;
  /** Which metric field on DailyMetric to check */
  metricKey: string;
  /** What direction of change triggers the alert */
  direction: 'drop' | 'increase' | 'any';
}

/**
 * The result of evaluating a single alert type against a project's metrics.
 * Contains the full evidence trail so the caller can decide what to do.
 */
export interface AlertEvaluation {
  /** Whether the alert threshold was exceeded and data is sufficient */
  shouldAlert: boolean;
  /** The current period's metric value */
  metricValue: number;
  /** The previous period's metric value */
  previousValue: number;
  /** Percentage change between periods (negative = drop, positive = increase) */
  changePercentage: number;
  /** How many data points were available in the current period */
  dataPointsUsed: number;
  /** Whether enough data points existed to make a reliable assessment */
  dataSufficient: boolean;
  /** Dutch explanation if data was insufficient */
  dataNote: string | null;
  /** Anomaly score from statistical analysis (0-1 scale), null if not computed */
  anomalyScore: number | null;
  /** Which anomaly detection method was used */
  anomalyMethod: string | null;
}

/**
 * A digest summarising alerts for a given project and period.
 */
export interface AlertDigest {
  id: string;
  projectId: string;
  period: 'daily' | 'weekly';
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  alerts: DigestAlertItem[];
  generatedAt: Date;
}

/**
 * A single alert item within a digest.
 */
export interface DigestAlertItem {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  changePercentage: number | null;
}

/**
 * Filters for querying active alerts.
 */
export interface AlertFilters {
  severity?: AlertSeverity;
  type?: AlertType;
  status?: AlertStatus;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

/**
 * Summary counts by severity for a project's alerts.
 */
export interface AlertSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

// Re-export Prisma enums for convenience
export type { AlertType, AlertSeverity, AlertStatus };
