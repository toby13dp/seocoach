// ============================================================================
// First-party Analytics — Session Manager
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages analytics sessions: creation, retrieval, summarisation, and closure.
// All functions verify projectId for tenant isolation. Error messages in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import type { SessionSummary } from './types';

// ============================================================================
// Project Verification
// ============================================================================

/**
 * Verify that a project exists and is not soft-deleted.
 * Throws an error in Dutch if the project is not found.
 */
async function verifyProject(projectId: string): Promise<void> {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });

  if (!project) {
    throw new Error(`Project met ID "${projectId}" niet gevonden of verwijderd.`);
  }
}

// ============================================================================
// Create or Update Session
// ============================================================================

/**
 * Create a new analytics session or update an existing one.
 * Sessions are uniquely identified by projectId + sessionId.
 *
 * @param projectId - The project ID for tenant isolation
 * @param sessionId - The session identifier
 * @param data - Partial session data to update or set
 * @returns The created or updated AnalyticsSession record
 */
export async function createOrUpdateSession(
  projectId: string,
  sessionId: string,
  data: {
    entryPage?: string;
    exitPage?: string;
    pageViews?: number;
    events?: number;
    conversions?: number;
    revenue?: number;
    source?: string;
    medium?: string;
    campaign?: string;
    deviceType?: string;
    browser?: string;
    os?: string;
    country?: string;
    consentState?: 'GRANTED' | 'DENIED' | 'UNKNOWN';
    isCookieless?: boolean;
    durationSeconds?: number;
  }
) {
  await verifyProject(projectId);

  const existing = await db.analyticsSession.findFirst({
    where: {
      projectId_sessionId: { projectId, sessionId },
    },
  });

  if (existing) {
    return db.analyticsSession.update({
      where: { id: existing.id },
      data: {
        ...data,
        lastActivityAt: new Date(),
      },
    });
  }

  return db.analyticsSession.create({
    data: {
      projectId,
      sessionId,
      entryPage: data.entryPage ?? null,
      exitPage: data.exitPage ?? null,
      pageViews: data.pageViews ?? 0,
      events: data.events ?? 0,
      conversions: data.conversions ?? 0,
      revenue: data.revenue ?? 0,
      source: data.source ?? null,
      medium: data.medium ?? null,
      campaign: data.campaign ?? null,
      deviceType: data.deviceType ?? null,
      browser: data.browser ?? null,
      os: data.os ?? null,
      country: data.country ?? null,
      consentState: data.consentState ?? 'UNKNOWN',
      isCookieless: data.isCookieless ?? false,
      durationSeconds: data.durationSeconds ?? null,
    },
  });
}

// ============================================================================
// Get Session
// ============================================================================

/**
 * Retrieve a single analytics session by its sessionId.
 *
 * @param projectId - The project ID for tenant isolation
 * @param sessionId - The session identifier
 * @returns The AnalyticsSession record or null if not found
 */
export async function getSession(
  projectId: string,
  sessionId: string
) {
  await verifyProject(projectId);

  return db.analyticsSession.findFirst({
    where: {
      projectId_sessionId: { projectId, sessionId },
    },
  });
}

// ============================================================================
// Session Summary
// ============================================================================

/**
 * Calculate aggregated session summary statistics for a project.
 * Supports optional date range, device type, and source filters.
 *
 * @param projectId - The project ID for tenant isolation
 * @param filters - Optional filters for the summary calculation
 * @returns Aggregated session summary data
 */
export async function getSessionSummary(
  projectId: string,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    deviceType?: string;
    source?: string;
  }
): Promise<SessionSummary> {
  await verifyProject(projectId);

  // Build where clause
  const where: Record<string, unknown> = {
    projectId,
  };

  if (filters?.startDate || filters?.endDate) {
    const startedAt: Record<string, Date> = {};
    if (filters.startDate) startedAt.gte = filters.startDate;
    if (filters.endDate) startedAt.lte = filters.endDate;
    where.startedAt = startedAt;
  }

  if (filters?.deviceType) {
    where.deviceType = filters.deviceType;
  }

  if (filters?.source) {
    where.source = filters.source;
  }

  // Fetch all matching sessions
  const sessions = await db.analyticsSession.findMany({
    where,
    select: {
      pageViews: true,
      conversions: true,
      revenue: true,
      durationSeconds: true,
      exitPage: true,
      entryPage: true,
      source: true,
      deviceType: true,
    },
  });

  const totalSessions = sessions.length;

  if (totalSessions === 0) {
    return {
      totalSessions: 0,
      avgDuration: 0,
      avgPageViews: 0,
      bounceRate: 0,
      conversionRate: 0,
      totalRevenue: 0,
      topSources: [],
      topPages: [],
      deviceBreakdown: [],
    };
  }

  // Calculate averages
  const sessionsWithDuration = sessions.filter(
    (s) => s.durationSeconds != null
  );
  const avgDuration =
    sessionsWithDuration.length > 0
      ? sessionsWithDuration.reduce(
          (sum, s) => sum + (s.durationSeconds ?? 0),
          0
        ) / sessionsWithDuration.length
      : 0;

  const avgPageViews =
    sessions.reduce((sum, s) => sum + s.pageViews, 0) / totalSessions;

  // Bounce rate: sessions with only 1 page view
  const bounceSessions = sessions.filter((s) => s.pageViews <= 1).length;
  const bounceRate = bounceSessions / totalSessions;

  // Conversion rate
  const conversionSessions = sessions.filter((s) => s.conversions > 0).length;
  const conversionRate = conversionSessions / totalSessions;

  // Total revenue
  const totalRevenue = sessions.reduce(
    (sum, s) => sum + (s.revenue ?? 0),
    0
  );

  // Top sources
  const sourceCounts: Record<string, number> = {};
  for (const s of sessions) {
    const src = s.source ?? '(direct)';
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
  }
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([source, count]) => ({ source, count }));

  // Top pages (by entry page)
  const pageCounts: Record<string, number> = {};
  for (const s of sessions) {
    if (s.entryPage) {
      pageCounts[s.entryPage] = (pageCounts[s.entryPage] ?? 0) + 1;
    }
    if (s.exitPage) {
      pageCounts[s.exitPage] = (pageCounts[s.exitPage] ?? 0) + 1;
    }
  }
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([page, count]) => ({ page, count }));

  // Device breakdown
  const deviceCounts: Record<string, number> = {};
  const DEVICE_LABELS: Record<string, string> = {
    desktop: 'Desktop',
    mobile: 'Mobiel',
    tablet: 'Tablet',
  };
  for (const s of sessions) {
    const device = s.deviceType ?? 'onbekend';
    deviceCounts[device] = (deviceCounts[device] ?? 0) + 1;
  }
  const deviceBreakdown = Object.entries(deviceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([device, count]) => ({
      device,
      count,
      label: DEVICE_LABELS[device] ?? device,
    }));

  return {
    totalSessions,
    avgDuration: Math.round(avgDuration),
    avgPageViews: Math.round(avgPageViews * 100) / 100,
    bounceRate: Math.round(bounceRate * 10000) / 10000,
    conversionRate: Math.round(conversionRate * 10000) / 10000,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    topSources,
    topPages,
    deviceBreakdown,
  };
}

// ============================================================================
// End Session
// ============================================================================

/**
 * End an analytics session by calculating its duration.
 * Duration is computed as the difference between lastActivityAt and startedAt.
 *
 * @param projectId - The project ID for tenant isolation
 * @param sessionId - The session identifier to end
 */
export async function endSession(
  projectId: string,
  sessionId: string
): Promise<void> {
  await verifyProject(projectId);

  const session = await db.analyticsSession.findFirst({
    where: {
      projectId_sessionId: { projectId, sessionId },
    },
  });

  if (!session) {
    throw new Error(
      `Sessie "${sessionId}" niet gevonden voor project "${projectId}".`
    );
  }

  // Calculate duration in seconds
  const startedAt = new Date(session.startedAt).getTime();
  const lastActivityAt = new Date(session.lastActivityAt).getTime();
  const durationSeconds = Math.round((lastActivityAt - startedAt) / 1000);

  await db.analyticsSession.update({
    where: { id: session.id },
    data: {
      durationSeconds: Math.max(0, durationSeconds),
    },
  });
}
