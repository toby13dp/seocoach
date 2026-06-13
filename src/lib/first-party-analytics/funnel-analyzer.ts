// ============================================================================
// First-party Analytics — Funnel Analyzer
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Analyzes conversion funnels by querying page view events for each step URL.
// Computes step counts, dropoff rates, and overall conversion rates.
// All functions verify projectId for tenant isolation. Error messages in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import { AnalyticsEventType } from '@prisma/client';
import type { FunnelAnalysis, FunnelStep } from './types';

// ============================================================================
// Project Verification
// ============================================================================

/**
 * Verify that a project exists and is not soft-deleted.
 * Throws an error in Dutch if the project is not found.
 */
async function verifyProject(projectId: string): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });

  if (!project) {
    throw new Error(`Project met ID "${projectId}" niet gevonden of verwijderd.`);
  }
}

// ============================================================================
// Funnel Analysis
// ============================================================================

/**
 * Analyze a conversion funnel defined by ordered step URLs.
 * Queries page view events for each step URL and computes:
 * - Count of unique sessions reaching each step
 * - Dropoff rate between consecutive steps
 * - Overall conversion rate from first to last step
 *
 * Steps must be provided in the logical order of the funnel.
 * Step names should be in Dutch for user-facing display.
 *
 * @param projectId - The project ID for tenant isolation
 * @param steps - Ordered array of funnel steps with name (Dutch) and URL
 * @returns Complete funnel analysis with metrics
 */
export async function analyzeFunnel(
  projectId: string,
  steps: { name: string; url: string }[]
): Promise<FunnelAnalysis> {
  await verifyProject(projectId);

  if (steps.length === 0) {
    return {
      steps: [],
      overallConversionRate: 0,
    };
  }

  if (steps.length === 1) {
    // Single step funnel — just count sessions
    const count = await countSessionsForPageUrl(projectId, steps[0].url);
    return {
      steps: [
        {
          name: steps[0].name,
          count,
          dropoffRate: 0,
        },
      ],
      overallConversionRate: 1, // 100% for a single-step funnel
    };
  }

  const funnelSteps: FunnelStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const count = await countSessionsForPageUrl(projectId, step.url);

    let dropoffRate = 0;
    if (i > 0 && funnelSteps[i - 1].count > 0) {
      dropoffRate =
        (funnelSteps[i - 1].count - count) / funnelSteps[i - 1].count;
      // Clamp to 0-1 range (count can theoretically exceed previous step
      // if users skip steps or data is incomplete)
      dropoffRate = Math.max(0, Math.min(1, dropoffRate));
    }

    funnelSteps.push({
      name: step.name,
      count,
      dropoffRate: Math.round(dropoffRate * 10000) / 10000,
    });
  }

  // Overall conversion rate: last step / first step
  const firstStepCount = funnelSteps[0].count;
  const lastStepCount = funnelSteps[funnelSteps.length - 1].count;
  const overallConversionRate =
    firstStepCount > 0 ? lastStepCount / firstStepCount : 0;

  return {
    steps: funnelSteps,
    overallConversionRate: Math.round(overallConversionRate * 10000) / 10000,
  };
}

// ============================================================================
// Top Funnel Dropoffs
// ============================================================================

/**
 * Identify common dropoff patterns across a project's funnels.
 * Queries all page view events to find pages with high exit rates
 * (pages where many sessions end after viewing only that page).
 *
 * Returns a list of FunnelAnalysis objects for each significant dropoff
 * pattern found. Each analysis represents a two-step "mini-funnel"
 * showing the entry page and the dropoff point.
 *
 * @param projectId - The project ID for tenant isolation
 * @returns Array of funnel analyses highlighting dropoff patterns
 */
export async function getTopFunnelDropoffs(
  projectId: string
): Promise<FunnelAnalysis[]> {
  await verifyProject(projectId);

  // Get all sessions with entry and exit page data
  const sessions = await db.analyticsSession.findMany({
    where: {
      projectId,
      entryPage: { not: null },
      exitPage: { not: null },
    },
    select: {
      entryPage: true,
      exitPage: true,
      pageViews: true,
    },
  });

  if (sessions.length === 0) {
    return [];
  }

  // Group by entry page and count exit patterns
  const entryPageStats: Record<
    string,
    { totalSessions: number; bouncedSessions: number; exitPages: Record<string, number> }
  > = {};

  for (const session of sessions) {
    const entry = session.entryPage!;
    const exit = session.exitPage!;

    if (!entryPageStats[entry]) {
      entryPageStats[entry] = {
        totalSessions: 0,
        bouncedSessions: 0,
        exitPages: {},
      };
    }

    entryPageStats[entry].totalSessions++;
    entryPageStats[entry].exitPages[exit] =
      (entryPageStats[entry].exitPages[exit] ?? 0) + 1;

    // Bounced = left on the entry page with 1 or fewer page views
    if (entry === exit && session.pageViews <= 1) {
      entryPageStats[entry].bouncedSessions++;
    }
  }

  // Build funnel analyses for pages with significant bounce rates
  const analyses: FunnelAnalysis[] = [];

  // Sort by bounce count descending to find top dropoff pages
  const sortedEntries = Object.entries(entryPageStats).sort(
    (a, b) => b[1].bouncedSessions - a[1].bouncedSessions
  );

  for (const [entryPage, stats] of sortedEntries.slice(0, 10)) {
    if (stats.bouncedSessions < 2) continue; // Skip insignificant data

    const bounceRate = stats.bouncedSessions / stats.totalSessions;

    // Find the most common exit page (other than the entry page)
    const exitPages = Object.entries(stats.exitPages)
      .filter(([page]) => page !== entryPage)
      .sort((a, b) => b[1] - a[1]);

    const topExitPage = exitPages[0];

    // Extract a short label from the URL
    const entryLabel = extractPageLabel(entryPage);

    const steps: FunnelStep[] = [
      {
        name: entryLabel,
        count: stats.totalSessions,
        dropoffRate: 0,
      },
    ];

    if (topExitPage) {
      steps.push({
        name: extractPageLabel(topExitPage[0]),
        count: stats.totalSessions - stats.bouncedSessions,
        dropoffRate: Math.round(bounceRate * 10000) / 10000,
      });
    } else {
      // All sessions bounced
      steps.push({
        name: 'Verlaten',
        count: 0,
        dropoffRate: 1,
      });
    }

    analyses.push({
      steps,
      overallConversionRate:
        Math.round((1 - bounceRate) * 10000) / 10000,
    });
  }

  return analyses;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Count the number of unique sessions that viewed a specific page URL.
 *
 * @param projectId - The project ID
 * @param pageUrl - The page URL to count sessions for
 * @returns Number of unique sessions
 */
async function countSessionsForPageUrl(
  projectId: string,
  pageUrl: string
): Promise<number> {
  // Use groupBy to count distinct sessionIds for the given page URL
  const events = await db.analyticsEvent.findMany({
    where: {
      projectId,
      eventType: AnalyticsEventType.PAGE_VIEW,
      pageUrl,
      sessionId: { not: null },
    },
    select: {
      sessionId: true,
    },
    distinct: ['sessionId'],
  });

  return events.length;
}

/**
 * Extract a short human-readable label from a URL.
 * Takes the last path segment and removes common extensions.
 *
 * @param url - The full URL
 * @returns A short Dutch-friendly label
 */
function extractPageLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, ''); // Remove trailing slash
    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? '/';

    // Remove file extensions
    const cleanName = lastSegment.replace(/\.(html|php|aspx?)$/, '');

    // Replace hyphens and underscores with spaces, capitalize
    const label = cleanName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return label || parsed.hostname;
  } catch {
    return url;
  }
}
