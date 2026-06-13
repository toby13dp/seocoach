/**
 * @fileoverview Data Retention Manager — Automated data lifecycle management (PRIV-001)
 *
 * Defines and enforces retention policies for various data types in the system.
 * Each policy specifies how long data should be retained before automatic
 * deletion. Data older than the retention period is permanently removed.
 *
 * Retention periods are aligned with GDPR data minimization principles while
 * ensuring sufficient historical data remains available for analytics and
 * reporting.
 */

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A retention policy definition. */
export interface RetentionPolicy {
  /** Human-readable identifier for the data type. */
  dataType: string;
  /** Number of days to retain the data. */
  retentionDays: number;
  /** Human-readable description of the policy. */
  description: string;
}

/** Result of enforcing a single retention policy. */
export interface RetentionEnforcementResult {
  /** Number of records deleted. */
  deleted: number;
  /** Any errors encountered during enforcement. */
  errors: string[];
}

// ---------------------------------------------------------------------------
// Predefined Retention Policies
// ---------------------------------------------------------------------------

const RETENTION_POLICIES: RetentionPolicy[] = [
  {
    dataType: "DailyMetrics",
    retentionDays: 730, // 2 years
    description:
      "Dagelijkse metrics (clicks, impressions, posities) worden 2 jaar bewaard voor trendanalyse.",
  },
  {
    dataType: "AICallLogs",
    retentionDays: 365,
    description:
      "AI-aanroep logs worden 1 jaar bewaard voor kostenanalyse en auditing.",
  },
  {
    dataType: "AuditLogs",
    retentionDays: 365,
    description:
      "Audit logs worden 1 jaar bewaard voor compliance en traceerbaarheid.",
  },
  {
    dataType: "CrawlData",
    retentionDays: 180,
    description:
      "Crawl data (sessies, pagina's, issues) wordt 180 dagen bewaard. Oudere data wordt verwijderd na archivering.",
  },
  {
    dataType: "PageSnapshots",
    retentionDays: 90,
    description:
      "Pagina snapshots (HTML opnames) worden 90 dagen bewaard vanwege opslagkosten.",
  },
  {
    dataType: "SessionData",
    retentionDays: 30,
    description:
      "Analytics sessie data wordt 30 dagen bewaard. Geaggregeerde metrics blijven behouden.",
  },
  {
    dataType: "JobHistory",
    retentionDays: 90,
    description:
      "Voltooide en mislukte jobs worden 90 dagen bewaard voor debug doeleinden.",
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the retention policy for a specific data type.
 *
 * @param dataType - The data type to look up.
 * @returns The retention policy, or `null` if no policy exists.
 */
export function getRetentionPolicy(
  dataType: string
): RetentionPolicy | null {
  return RETENTION_POLICIES.find((p) => p.dataType === dataType) ?? null;
}

/**
 * List all defined retention policies.
 *
 * @returns An array of all retention policies.
 */
export function listRetentionPolicies(): RetentionPolicy[] {
  return [...RETENTION_POLICIES];
}

/**
 * Enforce a retention policy for a specific data type.
 *
 * Deletes all records older than the retention period defined by the policy.
 * Returns the number of deleted records and any errors encountered.
 *
 * @param dataType - The data type to enforce retention for.
 * @returns The number of deleted records and any errors.
 */
export async function enforceRetentionPolicy(
  dataType: string
): Promise<RetentionEnforcementResult> {
  const policy = RETENTION_POLICIES.find((p) => p.dataType === dataType);
  if (!policy) {
    return {
      deleted: 0,
      errors: [`Geen retentiebeleid gevonden voor data type "${dataType}".`],
    };
  }

  const cutoffDate = new Date(
    Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000
  );

  const result: RetentionEnforcementResult = { deleted: 0, errors: [] };

  try {
    switch (policy.dataType) {
      case "DailyMetrics": {
        const deleted = await db.dailyMetric.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        });
        result.deleted = deleted.count;
        break;
      }

      case "AICallLogs": {
        const deleted = await db.aICallLog.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        });
        result.deleted = deleted.count;
        break;
      }

      case "AuditLogs": {
        const deleted = await db.auditLog.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        });
        result.deleted = deleted.count;
        break;
      }

      case "CrawlData": {
        // Delete old crawl sessions (cascade will handle pages, issues, etc.)
        const deleted = await db.crawlSession.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        });
        result.deleted = deleted.count;
        break;
      }

      case "PageSnapshots": {
        const deleted = await db.pageSnapshot.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        });
        result.deleted = deleted.count;
        break;
      }

      case "SessionData": {
        const deleted = await db.analyticsSession.deleteMany({
          where: { startedAt: { lt: cutoffDate } },
        });
        result.deleted = deleted.count;
        break;
      }

      case "JobHistory": {
        // Only delete completed, failed, or cancelled jobs — never active ones
        const deleted = await db.job.deleteMany({
          where: {
            createdAt: { lt: cutoffDate },
            status: { in: ["COMPLETED", "FAILED", "CANCELLED"] },
          },
        });
        result.deleted = deleted.count;
        break;
      }

      default: {
        result.errors.push(
          `Retentie-afdwinging niet geïmplementeerd voor data type "${dataType}".`
        );
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Onbekende fout opgetreden";
    result.errors.push(
      `Fout bij afdwingen retentiebeleid voor "${dataType}": ${message}`
    );
  }

  return result;
}

/**
 * Enforce all defined retention policies.
 *
 * Runs through every policy and deletes data older than the respective
 * retention period. Returns a map of data types to their enforcement results.
 *
 * @returns A record mapping data type names to enforcement results.
 */
export async function enforceAllRetentionPolicies(): Promise<
  Record<string, RetentionEnforcementResult>
> {
  const results: Record<string, RetentionEnforcementResult> = {};

  for (const policy of RETENTION_POLICIES) {
    results[policy.dataType] = await enforceRetentionPolicy(policy.dataType);
  }

  return results;
}
