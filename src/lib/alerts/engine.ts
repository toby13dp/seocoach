// ============================================================================
// SEOCoach Alert Engine — Core Engine
// ============================================================================
//
// The AlertEngine evaluates alert rules against project metrics, creates
// Alert records in the database, and provides lifecycle management
// (acknowledge, snooze, resolve, dismiss, assign).
//
// Key principles:
//   - All user-facing text is in Dutch (nl-NL)
//   - Never fabricate data — only create alerts when real data exists
//   - Deduplicate active alerts of the same type+group
//   - Respect minimum data point requirements
//   - Use anomaly detection to strengthen alert signals
//
// Follows the pattern established in /src/lib/rules/engine.ts.
// ---------------------------------------------------------------------------

import type { AlertType, AlertSeverity, AlertStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { ALERT_RULES, getAlertRule } from './rules';
import { detectAnomalyBest } from './anomaly';
import type {
  AlertEvaluation,
  AlertFilters,
  AlertSummary,
  AlertDigest,
  DigestAlertItem,
} from './types';

// ---------------------------------------------------------------------------
// Metric evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single alert type for a project.
 *
 * Compares the metric value from the recent period to the previous period,
 * calculates the percentage change, checks against the rule threshold,
 * and runs anomaly detection on the historical data.
 *
 * @param projectId - The project to evaluate
 * @param alertType - Which alert type to check
 * @param days      - Number of days for the "current" period (default 7)
 * @returns Full evaluation with evidence
 */
export async function evaluateMetricAlert(
  projectId: string,
  alertType: AlertType,
  days: number = 7
): Promise<AlertEvaluation> {
  const rule = getAlertRule(alertType);

  // Fetch current period metrics
  const currentPeriodStart = new Date();
  currentPeriodStart.setDate(currentPeriodStart.getDate() - days);

  const previousPeriodStart = new Date(currentPeriodStart);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - days);

  // Fetch metrics for both periods
  const [currentMetrics, previousMetrics] = await Promise.all([
    db.dailyMetric.findMany({
      where: {
        projectId,
        date: { gte: currentPeriodStart },
      },
      orderBy: { date: 'asc' },
    }),
    db.dailyMetric.findMany({
      where: {
        projectId,
        date: { gte: previousPeriodStart, lt: currentPeriodStart },
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  // Extract the relevant metric values
  const metricKey = rule.metricKey as keyof (typeof currentMetrics)[number];
  const currentValues = currentMetrics
    .map((m) => m[metricKey])
    .filter((v): v is number => typeof v === 'number' && !isNaN(v));
  const previousValues = previousMetrics
    .map((m) => m[metricKey])
    .filter((v): v is number => typeof v === 'number' && !isNaN(v));

  const dataPointsUsed = currentValues.length;
  const dataSufficient = dataPointsUsed >= rule.minimumDataPoints;

  // Calculate averages
  const metricValue = currentValues.length > 0
    ? currentValues.reduce((sum, v) => sum + v, 0) / currentValues.length
    : 0;
  const previousValue = previousValues.length > 0
    ? previousValues.reduce((sum, v) => sum + v, 0) / previousValues.length
    : 0;

  // Calculate percentage change
  const changePercentage = calculateChangePercentage(metricValue, previousValue);

  // Run anomaly detection on the combined historical series
  const allValues = [...previousValues, ...currentValues];
  const anomalyResult = detectAnomalyBest(allValues);

  // Determine whether the alert should fire
  const shouldAlert = shouldFireAlert(
    changePercentage,
    rule.direction,
    rule.defaultThreshold,
    dataSufficient
  );

  // Build Dutch data-note if insufficient
  const dataNote = dataSufficient
    ? null
    : `Onvoldoende gegevens: ${dataPointsUsed} datapunten gevonden, minimaal ${rule.minimumDataPoints} vereist voor betrouwbare waarschuwing.`;

  return {
    shouldAlert,
    metricValue: Math.round(metricValue * 100) / 100,
    previousValue: Math.round(previousValue * 100) / 100,
    changePercentage: Math.round(changePercentage * 100) / 100,
    dataPointsUsed,
    dataSufficient,
    dataNote,
    anomalyScore: anomalyResult?.score ?? null,
    anomalyMethod: anomalyResult?.method ?? null,
  };
}

// ---------------------------------------------------------------------------
// Run all alert checks
// ---------------------------------------------------------------------------

/**
 * Run all applicable alert evaluations for a project.
 *
 * For each alert type where shouldAlert is true and data is sufficient,
 * creates an Alert record in the database. Respects deduplication:
 * won't create a duplicate active alert of the same type+group.
 *
 * @param projectId - The project to check
 * @returns Array of newly created alert IDs
 */
export async function runAllAlertChecks(
  projectId: string
): Promise<string[]> {
  const createdAlertIds: string[] = [];

  for (const alertType of Object.keys(ALERT_RULES) as AlertType[]) {
    try {
      const evaluation = await evaluateMetricAlert(projectId, alertType);

      if (!evaluation.shouldAlert || !evaluation.dataSufficient) {
        continue;
      }

      const rule = getAlertRule(alertType);
      const alertGroup = buildAlertGroup(projectId, alertType);

      // Deduplicate: check for existing active alert of same type+group
      const existingActive = await db.alert.findFirst({
        where: {
          projectId,
          type: alertType,
          alertGroup,
          status: { in: ['ACTIVE', 'ACKNOWLEDGED', 'SNOOZED'] },
        },
      });

      if (existingActive) {
        continue; // Don't create duplicate
      }

      // Build Dutch title and message
      const title = rule.dutchLabel;
      const message = buildDutchMessage(rule, evaluation);

      // Build evidence JSON
      const evidence = JSON.stringify({
        metricKey: rule.metricKey,
        direction: rule.direction,
        threshold: rule.defaultThreshold,
        metricValue: evaluation.metricValue,
        previousValue: evaluation.previousValue,
        changePercentage: evaluation.changePercentage,
        dataPointsUsed: evaluation.dataPointsUsed,
        anomalyScore: evaluation.anomalyScore,
        anomalyMethod: evaluation.anomalyMethod,
      });

      const alert = await db.alert.create({
        data: {
          projectId,
          type: alertType,
          severity: rule.defaultSeverity as AlertSeverity,
          status: 'ACTIVE',
          title,
          message,
          evidence,
          metricValue: evaluation.metricValue,
          previousValue: evaluation.previousValue,
          changePercentage: evaluation.changePercentage,
          threshold: rule.defaultThreshold,
          dataPointsUsed: evaluation.dataPointsUsed,
          dataSufficient: evaluation.dataSufficient,
          dataNote: evaluation.dataNote,
          alertGroup,
          anomalyScore: evaluation.anomalyScore,
          anomalyMethod: evaluation.anomalyMethod,
        },
      });

      createdAlertIds.push(alert.id);
    } catch (error) {
      console.error(
        `[AlertEngine] Fout bij evalueren van waarschuwingstype ${alertType}:`,
        error
      );
    }
  }

  return createdAlertIds;
}

// ---------------------------------------------------------------------------
// Alert lifecycle management
// ---------------------------------------------------------------------------

/**
 * Acknowledge an alert — confirms the user has seen it.
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: string
): Promise<void> {
  await db.alert.update({
    where: { id: alertId },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    },
  });
}

/**
 * Snooze an alert — suppresses it until the specified date.
 */
export async function snoozeAlert(
  alertId: string,
  userId: string,
  untilDate: Date
): Promise<void> {
  await db.alert.update({
    where: { id: alertId },
    data: {
      status: 'SNOOZED',
      snoozedBy: userId,
      snoozedUntil: untilDate,
    },
  });
}

/**
 * Resolve an alert — marks it as resolved with a Dutch note.
 */
export async function resolveAlert(
  alertId: string,
  userId: string,
  resolution: string
): Promise<void> {
  await db.alert.update({
    where: { id: alertId },
    data: {
      status: 'RESOLVED',
      resolvedBy: userId,
      resolvedAt: new Date(),
      resolution,
    },
  });
}

/**
 * Dismiss an alert — user chooses to ignore it.
 */
export async function dismissAlert(
  alertId: string,
  userId: string
): Promise<void> {
  await db.alert.update({
    where: { id: alertId },
    data: {
      status: 'DISMISSED',
      dismissedBy: userId,
      dismissedAt: new Date(),
    },
  });
}

/**
 * Assign an alert to a user for follow-up.
 */
export async function assignAlert(
  alertId: string,
  userId: string
): Promise<void> {
  await db.alert.update({
    where: { id: alertId },
    data: {
      assignedTo: userId,
    },
  });
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Get active alerts for a project with optional filtering.
 *
 * Includes snoozed alerts whose snooze period has expired.
 */
export async function getActiveAlerts(
  projectId: string,
  filters?: AlertFilters
) {
  const where: Record<string, unknown> = {
    projectId,
  };

  // Include ACTIVE and ACKNOWLEDGED by default; also include SNOOZED whose
  // snooze period has expired
  if (filters?.status) {
    where.status = filters.status;
  } else {
    where.OR = [
      { status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } },
      {
        status: 'SNOOZED',
        snoozedUntil: { lte: new Date() },
      },
    ];
  }

  if (filters?.severity) {
    where.severity = filters.severity;
  }
  if (filters?.type) {
    where.type = filters.type;
  }
  if (filters?.assignedTo) {
    where.assignedTo = filters.assignedTo;
  }

  const alerts = await db.alert.findMany({
    where,
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    take: filters?.limit ?? 50,
    skip: filters?.offset ?? 0,
  });

  return alerts;
}

/**
 * Get a summary count of alerts by severity for a project.
 * Only counts non-resolved, non-dismissed alerts.
 */
export async function getAlertSummary(
  projectId: string
): Promise<AlertSummary> {
  const activeStatuses: AlertStatus[] = ['ACTIVE', 'ACKNOWLEDGED', 'SNOOZED'];

  const [critical, high, medium, low, info] = await Promise.all([
    db.alert.count({
      where: { projectId, severity: 'CRITICAL', status: { in: activeStatuses } },
    }),
    db.alert.count({
      where: { projectId, severity: 'HIGH', status: { in: activeStatuses } },
    }),
    db.alert.count({
      where: { projectId, severity: 'MEDIUM', status: { in: activeStatuses } },
    }),
    db.alert.count({
      where: { projectId, severity: 'LOW', status: { in: activeStatuses } },
    }),
    db.alert.count({
      where: { projectId, severity: 'INFO', status: { in: activeStatuses } },
    }),
  ]);

  return {
    critical,
    high,
    medium,
    low,
    info,
    total: critical + high + medium + low + info,
  };
}

// ---------------------------------------------------------------------------
// Digest generation
// ---------------------------------------------------------------------------

/**
 * Generate a daily or weekly alert digest for a project.
 *
 * Collects alerts from the relevant time window and produces a structured
 * digest with severity counts and alert items.
 */
export async function generateDigest(
  projectId: string,
  period: 'daily' | 'weekly'
): Promise<AlertDigest> {
  const since = new Date();
  if (period === 'daily') {
    since.setDate(since.getDate() - 1);
  } else {
    since.setDate(since.getDate() - 7);
  }

  const alerts = await db.alert.findMany({
    where: {
      projectId,
      createdAt: { gte: since },
    },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
  });

  const digestItems: DigestAlertItem[] = alerts.map((alert) => ({
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    changePercentage: alert.changePercentage,
  }));

  return {
    id: `digest-${projectId}-${period}-${Date.now()}`,
    projectId,
    period,
    criticalCount: alerts.filter((a) => a.severity === 'CRITICAL').length,
    highCount: alerts.filter((a) => a.severity === 'HIGH').length,
    mediumCount: alerts.filter((a) => a.severity === 'MEDIUM').length,
    lowCount: alerts.filter((a) => a.severity === 'LOW').length,
    infoCount: alerts.filter((a) => a.severity === 'INFO').length,
    alerts: digestItems,
    generatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the percentage change between two values.
 * Returns 0 if the previous value is 0 (avoids division by zero).
 */
function calculateChangePercentage(
  current: number,
  previous: number
): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Determine whether the alert should fire based on the change direction,
 * threshold, and data sufficiency.
 */
function shouldFireAlert(
  changePercentage: number,
  direction: 'drop' | 'increase' | 'any',
  threshold: number,
  dataSufficient: boolean
): boolean {
  if (!dataSufficient) {
    return false;
  }

  const absChange = Math.abs(changePercentage);

  switch (direction) {
    case 'drop':
      // Negative change means a drop
      return changePercentage < 0 && absChange >= threshold;
    case 'increase':
      // Positive change means an increase
      return changePercentage > 0 && absChange >= threshold;
    case 'any':
      // Either direction
      return absChange >= threshold;
    default:
      return false;
  }
}

/**
 * Build a deduplication group key for an alert.
 */
function buildAlertGroup(projectId: string, alertType: AlertType): string {
  return `${projectId}:${alertType}`;
}

/**
 * Build a Dutch-language message for an alert based on the rule and evaluation.
 */
function buildDutchMessage(
  rule: (typeof ALERT_RULES)[AlertType],
  evaluation: AlertEvaluation
): string {
  const directionText =
    rule.direction === 'drop'
      ? 'gedaald'
      : rule.direction === 'increase'
        ? 'gestegen'
        : 'gewijzigd';

  const changeText =
    evaluation.changePercentage < 0
      ? `${Math.abs(evaluation.changePercentage)}% ${directionText}`
      : `${evaluation.changePercentage}% ${directionText}`;

  let message = rule.dutchDescription;
  message += ` De waarde van "${rule.metricKey}" is ${changeText} (van ${evaluation.previousValue} naar ${evaluation.metricValue}).`;

  if (evaluation.anomalyScore !== null && evaluation.anomalyScore > 0.5) {
    message += ` Anomaliescore: ${evaluation.anomalyScore} (${evaluation.anomalyMethod}).`;
  }

  return message;
}
