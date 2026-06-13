// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Deployment Manager — Phase 12
// Beheert deployment-monitoring met regressiecontroles

import { db } from '@/lib/db';
import type { DeploymentProvider, DeploymentCheckType, DeploymentCheckStatus } from '@prisma/client';

/**
 * Nederlandse labels voor deployment-providers
 */
export const DEPLOYMENT_PROVIDER_LABELS: Record<DeploymentProvider, string> = {
  GITHUB: 'GitHub',
  GITLAB: 'GitLab',
  GENERIC_CICD: 'Algemene CI/CD',
};

/**
 * Nederlandse labels voor check-types
 */
export const DEPLOYMENT_CHECK_TYPE_LABELS: Record<DeploymentCheckType, string> = {
  ROBOTS_TXT: 'robots.txt',
  CANONICALS: 'Canonicals',
  TITLES: 'Titels',
  META_ROBOTS: 'Meta robots',
  SITEMAPS: 'Sitemaps',
  STATUS_CODES: 'Statuscodes',
  STRUCTURED_DATA: 'Gestructureerde data',
  INTERNAL_LINKS: 'Interne links',
  RENDERING: 'Rendering',
  PERFORMANCE: 'Prestaties',
  CRITICAL_URLS: 'Kritieke URL\'s',
};

/**
 * Alle deployment-checktypes
 */
export const ALL_DEPLOYMENT_CHECK_TYPES: DeploymentCheckType[] = [
  'ROBOTS_TXT', 'CANONICALS', 'TITLES', 'META_ROBOTS', 'SITEMAPS',
  'STATUS_CODES', 'STRUCTURED_DATA', 'INTERNAL_LINKS', 'RENDERING',
  'PERFORMANCE', 'CRITICAL_URLS',
];

// ============================================================================
// Deployment Record CRUD
// ============================================================================

export async function createDeploymentRecord(data: {
  organizationId: string;
  projectId: string;
  provider: DeploymentProvider;
  commitSha?: string;
  branch?: string;
  environment?: string;
  deployedAt?: Date;
  deployedBy?: string;
  preDeploymentSnapshot?: Record<string, unknown>;
  blockingEnabled?: boolean;
}) {
  return db.deploymentRecord.create({
    data: {
      organizationId: data.organizationId,
      projectId: data.projectId,
      provider: data.provider,
      commitSha: data.commitSha,
      branch: data.branch,
      environment: data.environment,
      deployedAt: data.deployedAt ?? new Date(),
      deployedBy: data.deployedBy,
      preDeploymentSnapshot: data.preDeploymentSnapshot ? JSON.stringify(data.preDeploymentSnapshot) : null,
      blockingEnabled: data.blockingEnabled ?? false,
    },
  });
}

export async function getDeploymentRecords(
  projectId: string,
  options?: { provider?: DeploymentProvider; limit?: number }
) {
  return db.deploymentRecord.findMany({
    where: {
      projectId,
      provider: options?.provider,
      deletedAt: null,
    },
    orderBy: { deployedAt: 'desc' },
    take: options?.limit ?? 50,
    include: { checks: true },
  });
}

export async function getDeploymentRecordDetails(recordId: string) {
  return db.deploymentRecord.findUnique({
    where: { id: recordId },
    include: { checks: { orderBy: { checkType: 'asc' } } },
  });
}

// ============================================================================
// Deployment Checks
// ============================================================================

export async function createDeploymentCheck(data: {
  deploymentId: string;
  checkType: DeploymentCheckType;
}) {
  return db.deploymentCheck.create({ data });
}

export async function updateDeploymentCheck(
  checkId: string,
  data: {
    status?: DeploymentCheckStatus;
    beforeValue?: Record<string, unknown>;
    afterValue?: Record<string, unknown>;
    diff?: Record<string, unknown>;
    finding?: string;
    severity?: string;
  }
) {
  const updateData: Record<string, unknown> = {
    ...data,
    checkedAt: new Date(),
  };

  if (data.beforeValue) updateData.beforeValue = JSON.stringify(data.beforeValue);
  if (data.afterValue) updateData.afterValue = JSON.stringify(data.afterValue);
  if (data.diff) updateData.diff = JSON.stringify(data.diff);

  return db.deploymentCheck.update({
    where: { id: checkId },
    data: updateData,
  });
}

/**
 * Voert een volledige deployment-controle uit
 */
export async function runDeploymentChecks(
  deploymentId: string,
  checkTypes: DeploymentCheckType[]
): Promise<{ checksCreated: number; regressions: number }> {
  let checksCreated = 0;
  let regressions = 0;

  for (const checkType of checkTypes) {
    await db.deploymentCheck.create({
      data: {
        deploymentId,
        checkType,
        status: 'NOT_CHECKED',
      },
    });
    checksCreated++;
  }

  return { checksCreated, regressions };
}

/**
 * Werkt de deployment-samenvatting bij na controle
 */
export async function updateDeploymentSummary(deploymentId: string): Promise<{
  regressionFound: boolean;
  severity: string;
  suggestedRollback: boolean;
}> {
  const checks = await db.deploymentCheck.findMany({
    where: { deploymentId, deletedAt: null },
  });

  const failingChecks = checks.filter(c => c.status === 'FAILING');
  const regressionFound = failingChecks.length > 0;

  // Bepaal ernst
  let severity = 'none';
  if (failingChecks.some(c => c.severity === 'critical')) {
    severity = 'critical';
  } else if (failingChecks.some(c => c.severity === 'error')) {
    severity = 'high';
  } else if (failingChecks.some(c => c.severity === 'warning')) {
    severity = 'medium';
  } else if (regressionFound) {
    severity = 'low';
  }

  const suggestedRollback = severity === 'critical' || severity === 'high';

  // Bepaal of blocking actief is
  const deployment = await db.deploymentRecord.findUnique({ where: { id: deploymentId } });
  const isBlocking = deployment?.blockingEnabled === true && regressionFound;

  await db.deploymentRecord.update({
    where: { id: deploymentId },
    data: {
      regressionFound,
      regressionDetails: failingChecks.length > 0
        ? JSON.stringify(failingChecks.map(c => ({
            checkType: c.checkType,
            finding: c.finding,
            severity: c.severity,
          })))
        : null,
      severity,
      suggestedRollback,
      isBlocking,
    },
  });

  return { regressionFound, severity, suggestedRollback };
}

/**
 * Controleert of een deployment geblokkeerd is
 */
export async function isDeploymentBlocking(deploymentId: string): Promise<boolean> {
  const deployment = await db.deploymentRecord.findUnique({ where: { id: deploymentId } });
  return deployment?.isBlocking ?? false;
}

/**
 * Ontblokkeert een deployment (expliciete actie)
 */
export async function unblockDeployment(deploymentId: string, reason: string): Promise<void> {
  await db.deploymentRecord.update({
    where: { id: deploymentId },
    data: {
      isBlocking: false,
      rollbackReason: reason,
    },
  });
}
