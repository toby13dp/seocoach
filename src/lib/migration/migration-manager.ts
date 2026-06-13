// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Migration Manager — Phase 12
// Beheert websitemigraties met URL-mapping, controles en goedkeuring

import { db } from '@/lib/db';
import type { MigrationCheckStatus, MigrationProjectStatus } from '@prisma/client';

/**
 * Nederlandse statuslabels voor migratiecontroles
 */
export const MIGRATION_CHECK_STATUS_LABELS: Record<MigrationCheckStatus, string> = {
  NOG_TE_CONTROLEREN: 'Nog te controleren',
  KLAAR: 'Klaar',
  PROBLEEM_GEVONDEN: 'Probleem gevonden',
  BLOKKEERT_LANCERING: 'Blokkeert lancering',
  GOEDGEKEURD: 'Goedgekeurd',
};

/**
 * Nederlandse statuslabels voor migratieprojecten
 */
export const MIGRATION_PROJECT_STATUS_LABELS: Record<MigrationProjectStatus, string> = {
  PLANNING: 'Planning',
  CRAWLING_OLD: 'Oude site crawlen',
  CRAWLING_NEW: 'Nieuwe site crawlen',
  MAPPING: 'URL-mapping',
  PRE_LAUNCH: 'Pre-launch controle',
  LIVE: 'Live',
  POST_LAUNCH: 'Post-launch monitoring',
  COMPLETED: 'Voltooid',
};

// ============================================================================
// Migration Project CRUD
// ============================================================================

export async function createMigrationProject(data: {
  organizationId: string;
  projectId: string;
  name: string;
  description?: string;
  oldSiteUrl: string;
  newSiteUrl: string;
  plannedLaunchDate?: Date;
}) {
  return db.migrationProject.create({
    data: {
      organizationId: data.organizationId,
      projectId: data.projectId,
      name: data.name,
      description: data.description,
      oldSiteUrl: data.oldSiteUrl,
      newSiteUrl: data.newSiteUrl,
      plannedLaunchDate: data.plannedLaunchDate,
    },
  });
}

export async function updateMigrationProject(
  migrationId: string,
  data: {
    name?: string;
    description?: string;
    status?: MigrationProjectStatus;
    oldUrlCount?: number;
    newUrlCount?: number;
    mappedCount?: number;
    redirectCount?: number;
    issueCount?: number;
    blockerCount?: number;
    plannedLaunchDate?: Date;
    actualLaunchDate?: Date;
  }
) {
  return db.migrationProject.update({
    where: { id: migrationId },
    data,
  });
}

export async function getMigrationProjects(projectId: string) {
  return db.migrationProject.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

// ============================================================================
// URL Mapping
// ============================================================================

export async function createUrlMapping(data: {
  migrationProjectId: string;
  oldUrl: string;
  newUrl?: string;
  redirectType?: number;
}) {
  return db.migrationUrlMapping.create({ data });
}

export async function bulkCreateUrlMappings(
  migrationProjectId: string,
  mappings: { oldUrl: string; newUrl?: string; redirectType?: number }[]
) {
  const results = [];
  for (const mapping of mappings) {
    const result = await db.migrationUrlMapping.create({
      data: {
        migrationProjectId,
        ...mapping,
      },
    });
    results.push(result);
  }

  // Update counts
  const totalMappings = await db.migrationUrlMapping.count({
    where: { migrationProjectId, deletedAt: null },
  });
  const mappedMappings = await db.migrationUrlMapping.count({
    where: { migrationProjectId, newUrl: { not: null }, deletedAt: null },
  });

  await db.migrationProject.update({
    where: { id: migrationProjectId },
    data: {
      oldUrlCount: totalMappings,
      mappedCount: mappedMappings,
    },
  });

  return results;
}

export async function updateUrlMapping(
  mappingId: string,
  data: {
    newUrl?: string;
    redirectType?: number;
    metadataStatus?: MigrationCheckStatus;
    headingsStatus?: MigrationCheckStatus;
    contentStatus?: MigrationCheckStatus;
    canonicalStatus?: MigrationCheckStatus;
    robotsStatus?: MigrationCheckStatus;
    structuredDataStatus?: MigrationCheckStatus;
    internalLinksStatus?: MigrationCheckStatus;
    metadataDiff?: Record<string, unknown>;
    headingsDiff?: Record<string, unknown>;
    contentDiff?: Record<string, unknown>;
    canonicalDiff?: Record<string, unknown>;
    robotsDiff?: Record<string, unknown>;
    structuredDataDiff?: Record<string, unknown>;
    internalLinksDiff?: Record<string, unknown>;
    notes?: string;
  }
) {
  const updateData: Record<string, unknown> = { ...data };

  // Convert JSON objects to strings
  const jsonFields = ['metadataDiff', 'headingsDiff', 'contentDiff', 'canonicalDiff', 'robotsDiff', 'structuredDataDiff', 'internalLinksDiff'];
  for (const field of jsonFields) {
    if (data[field as keyof typeof data] && typeof data[field as keyof typeof data] === 'object') {
      updateData[field] = JSON.stringify(data[field as keyof typeof data]);
    }
  }

  // All redirect changes require approval — create approval item
  if (data.redirectType !== undefined || data.newUrl !== undefined) {
    const mapping = await db.migrationUrlMapping.findUnique({ where: { id: mappingId } });
    if (mapping) {
      const project = await db.migrationProject.findUnique({ where: { id: mapping.migrationProjectId } });
      if (project) {
        await db.approvalQueueItem.create({
          data: {
            organizationId: project.organizationId,
            projectId: project.projectId,
            itemType: 'redirect_change',
            itemId: mappingId,
            title: `Redirect-wijziging: ${mapping.oldUrl}`,
            description: `Wijziging van redirect voor ${mapping.oldUrl} → ${data.newUrl ?? mapping.newUrl ?? 'niet toegewezen'}`,
            riskLevel: 'medium',
            status: 'PENDING',
          },
        });
      }
    }
  }

  return db.migrationUrlMapping.update({
    where: { id: mappingId },
    data: updateData,
  });
}

// ============================================================================
// Pre-Launch Checks
// ============================================================================

export async function createPreLaunchCheck(data: {
  migrationProjectId: string;
  category: string;
  title: string;
  description?: string;
}) {
  return db.migrationPreLaunchCheck.create({ data });
}

export async function updatePreLaunchCheck(
  checkId: string,
  data: {
    status?: MigrationCheckStatus;
    details?: Record<string, unknown>;
    checkedBy?: string;
  }
) {
  return db.migrationPreLaunchCheck.update({
    where: { id: checkId },
    data: {
      ...data,
      details: data.details ? JSON.stringify(data.details) : undefined,
      checkedAt: new Date(),
    },
  });
}

// ============================================================================
// Launch Blockers
// ============================================================================

export async function createLaunchBlocker(data: {
  migrationProjectId: string;
  title: string;
  description: string;
  severity?: string;
  entityType?: string;
  entityId?: string;
}) {
  const blocker = await db.migrationLaunchBlocker.create({ data });

  // Update blocker count
  const count = await db.migrationLaunchBlocker.count({
    where: { migrationProjectId: data.migrationProjectId, isResolved: false, deletedAt: null },
  });
  await db.migrationProject.update({
    where: { id: data.migrationProjectId },
    data: { blockerCount: count },
  });

  return blocker;
}

export async function resolveLaunchBlocker(
  blockerId: string,
  resolvedBy: string,
  resolutionNotes: string
) {
  const blocker = await db.migrationLaunchBlocker.update({
    where: { id: blockerId },
    data: {
      isResolved: true,
      resolvedBy,
      resolvedAt: new Date(),
      resolutionNotes,
    },
  });

  // Update blocker count
  const count = await db.migrationLaunchBlocker.count({
    where: { migrationProjectId: blocker.migrationProjectId, isResolved: false, deletedAt: null },
  });
  await db.migrationProject.update({
    where: { id: blocker.migrationProjectId },
    data: { blockerCount: count },
  });

  return blocker;
}

/**
 * Controleert of een migratie lanceer-klaar is (geen openstaande blokkades)
 */
export async function isLaunchReady(migrationProjectId: string): Promise<{
  ready: boolean;
  openBlockers: number;
  uncheckedItems: number;
}> {
  const openBlockers = await db.migrationLaunchBlocker.count({
    where: { migrationProjectId, isResolved: false, deletedAt: null },
  });

  const uncheckedChecks = await db.migrationPreLaunchCheck.count({
    where: { migrationProjectId, status: 'NOG_TE_CONTROLEREN', deletedAt: null },
  });

  return {
    ready: openBlockers === 0 && uncheckedChecks === 0,
    openBlockers,
    uncheckedItems: uncheckedChecks,
  };
}

/**
 * Valideert een redirect — controleert of de doel-URL bereikbaar is
 */
export function validateRedirect(oldUrl: string, newUrl: string, redirectType: number): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Controleer redirect type
  if (![301, 302, 307, 308].includes(redirectType)) {
    return { isValid: false, warnings: ['Ongeldig redirect-type. Gebruik 301, 302, 307 of 308.'] };
  }

  // 302/307 voor tijdelijke redirects — waarschuw voor SEO
  if (redirectType === 302 || redirectType === 307) {
    warnings.push('Tijdelijke redirect (302/307) passeert geen linkwaarde. Overweeg 301 voor permanente migraties.');
  }

  // Controleer of URL's verschillen
  if (oldUrl === newUrl) {
    warnings.push('Bron- en doel-URL zijn identiek — geen redirect nodig.');
  }

  // Basis URL-validatie
  try {
    new URL(newUrl);
  } catch {
    return { isValid: false, warnings: ['Ongeldig doel-URL formaat.'] };
  }

  return { isValid: true, warnings };
}
