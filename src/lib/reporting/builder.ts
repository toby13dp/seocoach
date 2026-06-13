// ============================================================================
// Report Builder — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Creates, configures, and manages reports with section-based layouts.
// Each report type has a default set of sections with Dutch titles.
// Reports can be previewed, snapshot-frozen, approved, and archived.
//
// IMPORTANT: Never fabricates data. Reports only contain real data
// that exists in the project at the time of snapshot generation.
// ============================================================================

import { db } from '@/lib/db';
import type { ReportType, ReportStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import type {
  ReportSection,
  ReportCreateConfig,
} from './types';
import {
  REPORT_TYPE_LABELS,
  REPORT_TYPE_DESCRIPTIONS,
} from './types';

// ============================================================================
// Default Section Generators per Report Type
// ============================================================================

/**
 * Returns the default section layout for a given report type.
 * Each section has a Dutch title and JSON configuration.
 *
 * Sections are defined based on what data would be relevant for each type.
 * When no real data exists, the section renders an empty state rather than
 * fabricated data.
 */
export function getDefaultSections(type: ReportType): ReportSection[] {
  switch (type) {
    case 'MONTHLY':
      return [
        {
          id: uuidv4(),
          type: 'KPI_CARDS',
          title: 'Kernstatistieken',
          config: JSON.stringify({
            metrics: [
              { metric: 'clicks', dutchLabel: 'Klikken', dataSource: 'search_console' },
              { metric: 'impressions', dutchLabel: 'Vertoningen', dataSource: 'search_console' },
              { metric: 'ctr', dutchLabel: 'CTR', dataSource: 'search_console' },
              { metric: 'position', dutchLabel: 'Gemiddelde positie', dataSource: 'search_console' },
            ],
            showComparison: true,
          }),
          sortOrder: 0,
        },
        {
          id: uuidv4(),
          type: 'CHART',
          title: 'Zoekprestatietrends',
          config: JSON.stringify({
            chartType: 'line',
            dataSource: 'search_console',
            xLabel: 'Datum',
            yLabel: 'Klikken en vertoningen',
            showComparison: true,
          }),
          sortOrder: 1,
        },
        {
          id: uuidv4(),
          type: 'TABLE',
          title: 'Top zoekopdrachten',
          config: JSON.stringify({
            dataSource: 'search_console_queries',
            columns: [
              { key: 'query', dutchLabel: 'Zoekopdracht', align: 'left' },
              { key: 'clicks', dutchLabel: 'Klikken', align: 'right' },
              { key: 'impressions', dutchLabel: 'Vertoningen', align: 'right' },
              { key: 'ctr', dutchLabel: 'CTR', align: 'right' },
              { key: 'position', dutchLabel: 'Positie', align: 'right' },
            ],
            maxRows: 20,
          }),
          sortOrder: 2,
        },
        {
          id: uuidv4(),
          type: 'RECOMMENDATIONS',
          title: 'Aanbevelingen',
          config: JSON.stringify({ source: 'roadmap', maxItems: 10 }),
          sortOrder: 3,
        },
        {
          id: uuidv4(),
          type: 'ROADMAP',
          title: 'Roadmap',
          config: JSON.stringify({ view: 'THIS_MONTH' }),
          sortOrder: 4,
        },
      ];

    case 'QUARTERLY':
      return [
        {
          id: uuidv4(),
          type: 'KPI_CARDS',
          title: 'Kwartaal-KPI\'s',
          config: JSON.stringify({
            metrics: [
              { metric: 'clicks', dutchLabel: 'Klikken', dataSource: 'search_console' },
              { metric: 'impressions', dutchLabel: 'Vertoningen', dataSource: 'search_console' },
              { metric: 'ctr', dutchLabel: 'CTR', dataSource: 'search_console' },
              { metric: 'position', dutchLabel: 'Gemiddelde positie', dataSource: 'search_console' },
            ],
            showComparison: true,
          }),
          sortOrder: 0,
        },
        {
          id: uuidv4(),
          type: 'CHART',
          title: 'Prestatietrends over het kwartaal',
          config: JSON.stringify({
            chartType: 'area',
            dataSource: 'search_console',
            xLabel: 'Week',
            yLabel: 'Klikken',
            showComparison: true,
          }),
          sortOrder: 1,
        },
        {
          id: uuidv4(),
          type: 'TABLE',
          title: 'Top presterende pagina\'s',
          config: JSON.stringify({
            dataSource: 'search_console_pages',
            columns: [
              { key: 'page', dutchLabel: 'Pagina', align: 'left' },
              { key: 'clicks', dutchLabel: 'Klikken', align: 'right' },
              { key: 'impressions', dutchLabel: 'Vertoningen', align: 'right' },
              { key: 'ctr', dutchLabel: 'CTR', align: 'right' },
              { key: 'change', dutchLabel: 'Verandering', align: 'right' },
            ],
            maxRows: 15,
          }),
          sortOrder: 2,
        },
        {
          id: uuidv4(),
          type: 'RECOMMENDATIONS',
          title: 'Strategische aanbevelingen',
          config: JSON.stringify({ source: 'roadmap', maxItems: 15 }),
          sortOrder: 3,
        },
        {
          id: uuidv4(),
          type: 'ROADMAP',
          title: 'Roadmap voor komend kwartaal',
          config: JSON.stringify({ view: 'NINETY_DAYS' }),
          sortOrder: 4,
        },
      ];

    case 'TECHNICAL_AUDIT':
      return [
        {
          id: uuidv4(),
          type: 'KPI_CARDS',
          title: 'Technische gezondheid',
          config: JSON.stringify({
            metrics: [
              { metric: 'total_issues', dutchLabel: 'Totaal problemen', dataSource: 'technical_issues' },
              { metric: 'critical_issues', dutchLabel: 'Kritieke problemen', dataSource: 'technical_issues' },
              { metric: 'warnings', dutchLabel: 'Waarschuwingen', dataSource: 'technical_issues' },
              { metric: 'health_score', dutchLabel: 'Gezondheidsscore', dataSource: 'technical_issues' },
            ],
            showComparison: false,
          }),
          sortOrder: 0,
        },
        {
          id: uuidv4(),
          type: 'TABLE',
          title: 'Technische problemen',
          config: JSON.stringify({
            dataSource: 'technical_issues',
            columns: [
              { key: 'ruleName', dutchLabel: 'Probleem', align: 'left' },
              { key: 'severity', dutchLabel: 'Ernst', align: 'center' },
              { key: 'affectedUrls', dutchLabel: 'Getroffen URL\'s', align: 'right' },
              { key: 'priority', dutchLabel: 'Prioriteit', align: 'center' },
            ],
            maxRows: 30,
          }),
          sortOrder: 1,
        },
        {
          id: uuidv4(),
          type: 'RECOMMENDATIONS',
          title: 'Aanbevolen acties',
          config: JSON.stringify({ source: 'technical_issues', maxItems: 20 }),
          sortOrder: 2,
        },
      ];

    case 'CONTENT':
      return [
        {
          id: uuidv4(),
          type: 'KPI_CARDS',
          title: 'Contentstatistieken',
          config: JSON.stringify({
            metrics: [
              { metric: 'total_pages', dutchLabel: 'Totaal pagina\'s', dataSource: 'pages' },
              { metric: 'healthy_pages', dutchLabel: 'Gezonde pagina\'s', dataSource: 'pages' },
              { metric: 'decaying_pages', dutchLabel: 'Verouderde pagina\'s', dataSource: 'content_decay' },
              { metric: 'content_briefs', dutchLabel: 'Contentbriefs', dataSource: 'content_briefs' },
            ],
            showComparison: false,
          }),
          sortOrder: 0,
        },
        {
          id: uuidv4(),
          type: 'TABLE',
          title: 'Verouderde content',
          config: JSON.stringify({
            dataSource: 'content_decay',
            columns: [
              { key: 'url', dutchLabel: 'URL', align: 'left' },
              { key: 'decayPercentage', dutchLabel: 'Achteruitgang %', align: 'right' },
              { key: 'pruningAction', dutchLabel: 'Actie', align: 'center' },
              { key: 'currentClicks', dutchLabel: 'Huidige klikken', align: 'right' },
            ],
            maxRows: 20,
          }),
          sortOrder: 1,
        },
        {
          id: uuidv4(),
          type: 'RECOMMENDATIONS',
          title: 'Contentaanbevelingen',
          config: JSON.stringify({ source: 'content', maxItems: 10 }),
          sortOrder: 2,
        },
      ];

    case 'KEYWORDS':
      return [
        {
          id: uuidv4(),
          type: 'KPI_CARDS',
          title: 'Zoekwoordstatistieken',
          config: JSON.stringify({
            metrics: [
              { metric: 'total_keywords', dutchLabel: 'Totaal zoekwoorden', dataSource: 'keywords' },
              { metric: 'top10_keywords', dutchLabel: 'In top 10', dataSource: 'keywords' },
              { metric: 'opportunities', dutchLabel: 'Kansen', dataSource: 'opportunity_scores' },
              { metric: 'avg_position', dutchLabel: 'Gemiddelde positie', dataSource: 'keywords' },
            ],
            showComparison: true,
          }),
          sortOrder: 0,
        },
        {
          id: uuidv4(),
          type: 'TABLE',
          title: 'Top zoekwoorden',
          config: JSON.stringify({
            dataSource: 'keywords',
            columns: [
              { key: 'keyword', dutchLabel: 'Zoekwoord', align: 'left' },
              { key: 'searchVolume', dutchLabel: 'Zoekvolume', align: 'right' },
              { key: 'currentRanking', dutchLabel: 'Positie', align: 'right' },
              { key: 'opportunityScore', dutchLabel: 'Kansscore', align: 'right' },
              { key: 'searchIntent', dutchLabel: 'Intentie', align: 'center' },
            ],
            maxRows: 25,
          }),
          sortOrder: 1,
        },
        {
          id: uuidv4(),
          type: 'RECOMMENDATIONS',
          title: 'Zoekwoordkansen',
          config: JSON.stringify({ source: 'keywords', maxItems: 15 }),
          sortOrder: 2,
        },
      ];

    case 'EXECUTIVE':
      return [
        {
          id: uuidv4(),
          type: 'KPI_CARDS',
          title: 'Samenvatting',
          config: JSON.stringify({
            metrics: [
              { metric: 'clicks', dutchLabel: 'Klikken', dataSource: 'search_console' },
              { metric: 'impressions', dutchLabel: 'Vertoningen', dataSource: 'search_console' },
              { metric: 'ctr', dutchLabel: 'CTR', dataSource: 'search_console' },
              { metric: 'position', dutchLabel: 'Positie', dataSource: 'search_console' },
            ],
            showComparison: true,
          }),
          sortOrder: 0,
        },
        {
          id: uuidv4(),
          type: 'TEXT',
          title: 'Managementsamenvatting',
          config: JSON.stringify({ source: 'executive_summary' }),
          sortOrder: 1,
        },
        {
          id: uuidv4(),
          type: 'RECOMMENDATIONS',
          title: 'Belangrijkste actiepunten',
          config: JSON.stringify({ source: 'roadmap', maxItems: 5, onlyCritical: true }),
          sortOrder: 2,
        },
        {
          id: uuidv4(),
          type: 'PAGE_BREAK',
          title: '',
          config: JSON.stringify({}),
          sortOrder: 3,
        },
        {
          id: uuidv4(),
          type: 'ROADMAP',
          title: 'Roadmap',
          config: JSON.stringify({ view: 'THIS_MONTH' }),
          sortOrder: 4,
        },
      ];

    case 'HOLISTIC':
      return [
        {
          id: uuidv4(),
          type: 'KPI_CARDS',
          title: 'Algemeen overzicht',
          config: JSON.stringify({
            metrics: [
              { metric: 'clicks', dutchLabel: 'Klikken', dataSource: 'search_console' },
              { metric: 'impressions', dutchLabel: 'Vertoningen', dataSource: 'search_console' },
              { metric: 'technical_issues', dutchLabel: 'Technische problemen', dataSource: 'technical_issues' },
              { metric: 'decaying_pages', dutchLabel: 'Verouderde pagina\'s', dataSource: 'content_decay' },
            ],
            showComparison: true,
          }),
          sortOrder: 0,
        },
        {
          id: uuidv4(),
          type: 'CHART',
          title: 'Prestatietrends',
          config: JSON.stringify({
            chartType: 'line',
            dataSource: 'search_console',
            xLabel: 'Datum',
            yLabel: 'Klikken',
            showComparison: true,
          }),
          sortOrder: 1,
        },
        {
          id: uuidv4(),
          type: 'TABLE',
          title: 'Technische problemen',
          config: JSON.stringify({
            dataSource: 'technical_issues',
            columns: [
              { key: 'ruleName', dutchLabel: 'Probleem', align: 'left' },
              { key: 'severity', dutchLabel: 'Ernst', align: 'center' },
              { key: 'priority', dutchLabel: 'Prioriteit', align: 'center' },
            ],
            maxRows: 10,
          }),
          sortOrder: 2,
        },
        {
          id: uuidv4(),
          type: 'TABLE',
          title: 'Top zoekwoorden',
          config: JSON.stringify({
            dataSource: 'keywords',
            columns: [
              { key: 'keyword', dutchLabel: 'Zoekwoord', align: 'left' },
              { key: 'searchVolume', dutchLabel: 'Volume', align: 'right' },
              { key: 'currentRanking', dutchLabel: 'Positie', align: 'right' },
            ],
            maxRows: 10,
          }),
          sortOrder: 3,
        },
        {
          id: uuidv4(),
          type: 'RECOMMENDATIONS',
          title: 'Gecombineerde aanbevelingen',
          config: JSON.stringify({ source: 'all', maxItems: 10 }),
          sortOrder: 4,
        },
        {
          id: uuidv4(),
          type: 'ROADMAP',
          title: 'Roadmap',
          config: JSON.stringify({ view: 'NINETY_DAYS' }),
          sortOrder: 5,
        },
      ];

    // Simplified defaults for specialized report types
    case 'COMPETITORS':
    case 'LOCAL_SEO':
    case 'GEO':
    case 'WOOCOMMERCE':
    case 'CRO':
    case 'REVENUE':
      return [
        {
          id: uuidv4(),
          type: 'KPI_CARDS',
          title: REPORT_TYPE_LABELS[type],
          config: JSON.stringify({
            metrics: [],
            showComparison: true,
          }),
          sortOrder: 0,
        },
        {
          id: uuidv4(),
          type: 'RECOMMENDATIONS',
          title: 'Aanbevelingen',
          config: JSON.stringify({ source: type.toLowerCase(), maxItems: 10 }),
          sortOrder: 1,
        },
      ];

    case 'CUSTOM':
    default:
      return [
        {
          id: uuidv4(),
          type: 'TEXT',
          title: 'Inleiding',
          config: JSON.stringify({ content: '' }),
          sortOrder: 0,
        },
      ];
  }
}

// ============================================================================
// Report CRUD
// ============================================================================

/**
 * Create a new report with default sections based on its type.
 *
 * The report is created in DRAFT status with sections derived from
 * getDefaultSections(). Dates default to the current month if not provided.
 *
 * @param projectId - The project to create the report for
 * @param config - Report creation configuration
 * @returns The created Report record
 */
export async function createReport(
  projectId: string,
  type: ReportType,
  config?: ReportCreateConfig,
) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const sections = getDefaultSections(type);
  const title = config?.title || `${REPORT_TYPE_LABELS[type]} — ${formatDutchMonth(now)}`;
  const description = config?.description || REPORT_TYPE_DESCRIPTIONS[type];

  return db.report.create({
    data: {
      projectId,
      type,
      status: 'DRAFT' as ReportStatus,
      title,
      description,
      startDate: config?.startDate || startOfMonth,
      endDate: config?.endDate || endOfMonth,
      comparisonStartDate: config?.comparisonStartDate || null,
      comparisonEndDate: config?.comparisonEndDate || null,
      sections: JSON.stringify(sections),
      whiteLabelId: config?.whiteLabelId || null,
      createdById: config?.createdById || null,
      version: 1,
    },
  });
}

/**
 * Update the sections layout of a report.
 * Replaces the entire sections JSON with the provided array.
 *
 * @param reportId - The report ID
 * @param sections - The new sections array
 * @returns The updated Report record
 */
export async function updateReportSections(
  reportId: string,
  sections: ReportSection[],
) {
  return db.report.update({
    where: { id: reportId },
    data: {
      sections: JSON.stringify(sections),
    },
  });
}

/**
 * Add a new section to a report.
 * Appends the section at the end (highest sortOrder).
 *
 * @param reportId - The report ID
 * @param section - The section to add
 * @returns The updated Report record
 */
export async function addSection(
  reportId: string,
  section: ReportSection,
) {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { sections: true },
  });

  if (!report) {
    throw new Error(`Rapport niet gevonden: ${reportId}`);
  }

  const sections: ReportSection[] = JSON.parse(report.sections);
  const maxSortOrder = sections.length > 0
    ? Math.max(...sections.map((s) => s.sortOrder))
    : -1;

  const newSection: ReportSection = {
    ...section,
    sortOrder: section.sortOrder ?? maxSortOrder + 1,
  };

  sections.push(newSection);

  return db.report.update({
    where: { id: reportId },
    data: { sections: JSON.stringify(sections) },
  });
}

/**
 * Remove a section from a report by its ID.
 *
 * @param reportId - The report ID
 * @param sectionId - The section ID to remove
 * @returns The updated Report record
 */
export async function removeSection(
  reportId: string,
  sectionId: string,
) {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { sections: true },
  });

  if (!report) {
    throw new Error(`Rapport niet gevonden: ${reportId}`);
  }

  const sections: ReportSection[] = JSON.parse(report.sections);
  const filtered = sections.filter((s) => s.id !== sectionId);

  // Re-sort remaining sections
  const reindexed = filtered.map((s, i) => ({ ...s, sortOrder: i }));

  return db.report.update({
    where: { id: reportId },
    data: { sections: JSON.stringify(reindexed) },
  });
}

/**
 * Reorder sections within a report.
 * The order of sectionIds determines the new sortOrder.
 *
 * @param reportId - The report ID
 * @param sectionIds - Array of section IDs in the desired order
 * @returns The updated Report record
 */
export async function reorderSections(
  reportId: string,
  sectionIds: string[],
) {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { sections: true },
  });

  if (!report) {
    throw new Error(`Rapport niet gevonden: ${reportId}`);
  }

  const sections: ReportSection[] = JSON.parse(report.sections);
  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  const reordered: ReportSection[] = sectionIds.map((id, index) => {
    const section = sectionMap.get(id);
    if (!section) {
      throw new Error(`Sectie niet gevonden: ${id}`);
    }
    return { ...section, sortOrder: index };
  });

  return db.report.update({
    where: { id: reportId },
    data: { sections: JSON.stringify(reordered) },
  });
}

// ============================================================================
// Preview & Snapshot
// ============================================================================

/**
 * Preview a report by generating a data snapshot without freezing it.
 * This is a read-only preview — the report's snapshotData is not modified.
 *
 * @param reportId - The report ID to preview
 * @returns Preview data object with sections and current data references
 */
export async function previewReport(reportId: string) {
  const report = await db.report.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new Error(`Rapport niet gevonden: ${reportId}`);
  }

  const sections: ReportSection[] = JSON.parse(report.sections);

  return {
    id: report.id,
    title: report.title,
    description: report.description,
    type: report.type,
    status: report.status,
    startDate: report.startDate,
    endDate: report.endDate,
    sections,
    // Preview does NOT include frozen snapshotData — it uses live data references
    hasSnapshot: report.snapshotData !== null,
  };
}

/**
 * Generate and freeze a snapshot of the current data for a report.
 *
 * Once a snapshot is generated, the report will always show the data
 * as it was at the moment of snapshot generation, even if the
 * underlying data changes later.
 *
 * IMPORTANT: Only snapshots real data that exists. If a data source
 * is not yet connected or has no data, the snapshot records that
 * state explicitly (it never fabricates data).
 *
 * @param reportId - The report ID to snapshot
 * @returns The updated Report record
 */
export async function generateSnapshot(reportId: string) {
  const report = await db.report.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new Error(`Rapport niet gevonden: ${reportId}`);
  }

  const projectId = report.projectId;
  const sections: ReportSection[] = JSON.parse(report.sections);

  // Gather live data for each section's data source
  const snapshotData: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    reportId,
    projectId,
    dateRange: {
      start: report.startDate.toISOString(),
      end: report.endDate.toISOString(),
    },
  };

  // Collect unique data sources from sections
  const dataSources = new Set<string>();
  for (const section of sections) {
    try {
      const config = JSON.parse(section.config);
      if (config.dataSource) {
        dataSources.add(config.dataSource);
      }
      if (config.source) {
        dataSources.add(config.source);
      }
    } catch {
      // Skip sections with invalid config
    }
  }

  // Fetch real data for each source — never fabricate
  for (const source of dataSources) {
    snapshotData[source] = await fetchSourceData(projectId, source, report.startDate, report.endDate);
  }

  return db.report.update({
    where: { id: reportId },
    data: {
      snapshotData: JSON.stringify(snapshotData),
      snapshotGeneratedAt: new Date(),
    },
  });
}

/**
 * Approve a report for sharing/publishing.
 * Only reports with IN_REVIEW status can be approved.
 *
 * @param reportId - The report ID to approve
 * @param userId - The user ID who approves the report
 * @returns The updated Report record
 */
export async function approveReport(
  reportId: string,
  userId: string,
) {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { status: true },
  });

  if (!report) {
    throw new Error(`Rapport niet gevonden: ${reportId}`);
  }

  if (report.status !== 'IN_REVIEW') {
    throw new Error('Alleen rapporten met status "In behandeling" kunnen worden goedgekeurd');
  }

  return db.report.update({
    where: { id: reportId },
    data: {
      status: 'APPROVED' as ReportStatus,
      approvedBy: userId,
      approvedAt: new Date(),
    },
  });
}

/**
 * Archive a report.
 * Archived reports are preserved but hidden from active listings.
 *
 * @param reportId - The report ID to archive
 * @returns The updated Report record
 */
export async function archiveReport(reportId: string) {
  return db.report.update({
    where: { id: reportId },
    data: {
      status: 'ARCHIVED' as ReportStatus,
    },
  });
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Fetch real data for a given source within a date range.
 * Returns null when no data exists — never fabricates.
 */
async function fetchSourceData(
  projectId: string,
  source: string,
  _startDate: Date,
  _endDate: Date,
): Promise<unknown> {
  switch (source) {
    case 'technical_issues': {
      const issues = await db.technicalIssue.findMany({
        where: { projectId, dismissed: false },
        orderBy: { severity: 'desc' },
        take: 50,
      });
      return issues.length > 0 ? issues : null;
    }
    case 'content_decay': {
      const decay = await db.contentDecay.findMany({
        where: { projectId, dataAvailable: true },
        orderBy: { decayPercentage: 'desc' },
        take: 50,
      });
      return decay.length > 0 ? decay : null;
    }
    case 'keywords':
    case 'opportunity_scores': {
      const keywords = await db.keyword.findMany({
        where: { projectId, deletedAt: null },
        include: { opportunity: true },
        orderBy: { keyword: 'asc' },
        take: 100,
      });
      return keywords.length > 0 ? keywords : null;
    }
    case 'internal_link': {
      const links = await db.internalLink.findMany({
        where: { projectId, deletedAt: null },
        take: 50,
      });
      return links.length > 0 ? links : null;
    }
    case 'roadmap': {
      const items = await db.roadmapItem.findMany({
        where: { projectId, status: { not: 'SKIPPED' } },
        orderBy: { priority: 'desc' },
        take: 30,
      });
      return items.length > 0 ? items : null;
    }
    default:
      // Unknown or future data sources return null
      return null;
  }
}

/**
 * Format a Date as a Dutch month string (e.g. "januari 2025").
 */
function formatDutchMonth(date: Date): string {
  const months = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december',
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}
