/**
 * @fileoverview Data Export Module — GDPR Right to Data Portability (PRIV-001)
 *
 * Exports all personal data belonging to a user in a structured, machine-readable
 * JSON format. Covers user profile, settings, organisation memberships, and
 * all project-related data the user has access to through their organisations.
 *
 * All dates are formatted in ISO 8601.
 */

import { db } from "@/lib/db";
import { writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Format version of the export payload */
const EXPORT_FORMAT_VERSION = "1.0.0";

/** Top-level export structure */
export interface UserDataExport {
  metadata: {
    exportDate: string;
    userId: string;
    formatVersion: string;
    dataRange: {
      from: string | null;
      to: string;
    };
  };
  profile: {
    user: Record<string, unknown>;
    settings: Record<string, unknown> | null;
  };
  organisations: Array<{
    organisationId: string;
    organisationName: string;
    role: string;
    joinedAt: string | null;
  }>;
  projects: Array<{
    projectId: string;
    projectName: string;
    organisationId: string;
    keywords: unknown[];
    pages: unknown[];
    crawlSessions: unknown[];
    dailyMetrics: unknown[];
    contentBriefs: unknown[];
    actionItems: unknown[];
    aiProviders: unknown[];
    jobs: unknown[];
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Date | null | undefined value to an ISO 8601 string or null.
 */
function toISO(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString();
}

// ---------------------------------------------------------------------------
// Core export logic
// ---------------------------------------------------------------------------

/**
 * Export all data belonging to a given user.
 *
 * Collects data from: User, UserSettings, OrganisationMembership, and every
 * project the user can access through their organisations. For each project
 * the export includes keywords, pages, crawl sessions, daily metrics, content
 * briefs, action items, AI providers, and jobs.
 *
 * @param userId - The ID of the user whose data should be exported.
 * @returns A structured {@link UserDataExport} object.
 */
export async function exportUserData(userId: string): Promise<UserDataExport> {
  // --- Profile ---------------------------------------------------------------
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { settings: true },
  });

  if (!user) {
    throw new Error("Gebruiker niet gevonden");
  }

  const profileUser: Record<string, unknown> = {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    timezone: user.timezone,
    emailVerified: toISO(user.emailVerified),
    createdAt: toISO(user.createdAt),
    updatedAt: toISO(user.updatedAt),
  };

  const profileSettings: Record<string, unknown> | null = user.settings
    ? {
        locale: user.settings.locale,
        timezone: user.settings.timezone,
        automationLevel: user.settings.automationLevel,
        theme: user.settings.theme,
        createdAt: toISO(user.settings.createdAt),
        updatedAt: toISO(user.settings.updatedAt),
      }
    : null;

  // --- Organisations ---------------------------------------------------------
  const memberships = await db.organizationMembership.findMany({
    where: { userId, deletedAt: null },
    include: { organization: true },
  });

  const organisations = memberships.map((m) => ({
    organisationId: m.organizationId,
    organisationName: m.organization.name,
    role: m.role,
    joinedAt: toISO(m.acceptedAt ?? m.invitedAt),
  }));

  // --- Projects --------------------------------------------------------------
  const orgIds = memberships.map((m) => m.organizationId);

  const projects = await db.project.findMany({
    where: {
      organizationId: { in: orgIds },
      deletedAt: null,
    },
  });

  const projectExports: UserDataExport["projects"] = [];

  for (const project of projects) {
    // Keywords
    const keywords = await db.keyword.findMany({
      where: { projectId: project.id, deletedAt: null },
      include: { opportunity: true },
    });

    // Pages (most recent 500 per project for performance)
    const pages = await db.page.findMany({
      where: { projectId: project.id, deletedAt: null },
      take: 500,
      orderBy: { createdAt: "desc" },
    });

    // Crawl sessions
    const crawlSessions = await db.crawlSession.findMany({
      where: { projectId: project.id },
      take: 100,
      orderBy: { createdAt: "desc" },
    });

    // Daily metrics
    const dailyMetrics = await db.dailyMetric.findMany({
      where: { projectId: project.id },
      take: 1000,
      orderBy: { date: "desc" },
    });

    // Content briefs
    const contentBriefs = await db.contentBrief.findMany({
      where: { projectId: project.id },
      include: { versions: { take: 10, orderBy: { version: "desc" } } },
      take: 100,
      orderBy: { createdAt: "desc" },
    });

    // Action items
    const actionItems = await db.actionItem.findMany({
      where: { projectId: project.id },
      take: 200,
      orderBy: { createdAt: "desc" },
    });

    // AI providers (excluding API keys for security)
    const aiProviders = await db.aIProvider.findMany({
      where: { projectId: project.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        baseUrl: true,
        defaultModel: true,
        isActive: true,
        isDefault: true,
        maxTokens: true,
        temperature: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Jobs
    const jobs = await db.job.findMany({
      where: { projectId: project.id },
      take: 200,
      orderBy: { createdAt: "desc" },
    });

    projectExports.push({
      projectId: project.id,
      projectName: project.name,
      organisationId: project.organizationId,
      keywords: keywords.map((k) => ({
        id: k.id,
        keyword: k.keyword,
        searchIntent: k.searchIntent,
        funnelStage: k.funnelStage,
        searchVolume: k.searchVolume,
        difficulty: k.difficulty,
        currentRanking: k.currentRanking,
        source: k.source,
        createdAt: toISO(k.createdAt),
        updatedAt: toISO(k.updatedAt),
        opportunity: k.opportunity
          ? {
              totalScore: k.opportunity.totalScore,
              calculatedAt: toISO(k.opportunity.calculatedAt),
            }
          : null,
      })),
      pages: pages.map((p) => ({
        id: p.id,
        url: p.url,
        title: p.title,
        statusCode: p.statusCode,
        status: p.status,
        wordCount: p.wordCount,
        indexability: p.indexability,
        crawlDepth: p.crawlDepth,
        createdAt: toISO(p.createdAt),
        updatedAt: toISO(p.updatedAt),
      })),
      crawlSessions: crawlSessions.map((c) => ({
        id: c.id,
        status: c.status,
        startUrl: c.startUrl,
        pagesCrawled: c.pagesCrawled,
        pagesFound: c.pagesFound,
        startedAt: toISO(c.startedAt),
        completedAt: toISO(c.completedAt),
        createdAt: toISO(c.createdAt),
      })),
      dailyMetrics: dailyMetrics.map((m) => ({
        id: m.id,
        date: toISO(m.date),
        clicks: m.clicks,
        impressions: m.impressions,
        ctr: m.ctr,
        averagePosition: m.averagePosition,
        sessions: m.sessions,
        users: m.users,
        conversions: m.conversions,
        createdAt: toISO(m.createdAt),
      })),
      contentBriefs: contentBriefs.map((b) => ({
        id: b.id,
        title: b.title,
        targetKeyword: b.targetKeyword,
        searchIntent: b.searchIntent,
        approvalStatus: b.approvalStatus,
        versionsCount: b.versions.length,
        createdAt: toISO(b.createdAt),
        updatedAt: toISO(b.updatedAt),
      })),
      actionItems: actionItems.map((a) => ({
        id: a.id,
        title: a.title,
        priority: a.priority,
        effort: a.effort,
        status: a.status,
        createdAt: toISO(a.createdAt),
        updatedAt: toISO(a.updatedAt),
      })),
      aiProviders: aiProviders.map((p) => ({
        ...p,
        createdAt: toISO(p.createdAt as Date | undefined),
        updatedAt: toISO(p.updatedAt as Date | undefined),
      })),
      jobs: jobs.map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        progress: j.progress,
        startedAt: toISO(j.startedAt),
        completedAt: toISO(j.completedAt),
        createdAt: toISO(j.createdAt),
      })),
    });
  }

  // --- Determine date range --------------------------------------------------
  const earliestRecord = await db.auditLog.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const dataRangeFrom = earliestRecord ? toISO(earliestRecord.createdAt) : null;

  // --- Assemble export -------------------------------------------------------
  const exportData: UserDataExport = {
    metadata: {
      exportDate: new Date().toISOString(),
      userId,
      formatVersion: EXPORT_FORMAT_VERSION,
      dataRange: {
        from: dataRangeFrom,
        to: new Date().toISOString(),
      },
    },
    profile: {
      user: profileUser,
      settings: profileSettings,
    },
    organisations,
    projects: projectExports,
  };

  return exportData;
}

// ---------------------------------------------------------------------------
// File generation
// ---------------------------------------------------------------------------

/**
 * Generate a data export file and write it to /tmp.
 *
 * @param userId - The ID of the user whose data should be exported.
 * @returns An object with the file path and file name of the generated export.
 */
export async function generateExportFile(
  userId: string
): Promise<{ filePath: string; fileName: string }> {
  const data = await exportUserData(userId);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `seocoach-data-export-${userId.substring(0, 8)}-${timestamp}.json`;
  const filePath = join("/tmp", fileName);

  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");

  return { filePath, fileName };
}
