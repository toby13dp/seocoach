// ============================================================================
// Competitor Intelligence — Change Feed
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Provides a feed of recent competitor changes across all tracked competitors.
// Supports filtering, dismissal, and detailed change inspection.
// ============================================================================

import { db } from '@/lib/db';
import type { CompetitorFeedFilters } from './types';
import { CHANGE_TYPE_LABELS, CHANGE_TYPE_DESCRIPTIONS } from './types';

/**
 * Get a feed of recent competitor changes for a project.
 * Aggregates changes across all competitors in the project.
 *
 * @param projectId - The project to get the feed for
 * @param filters - Optional filters for the feed
 * @returns Array of competitor changes with competitor info
 */
export async function getCompetitorFeed(
  projectId: string,
  filters?: CompetitorFeedFilters
) {
  const where: Record<string, unknown> = { projectId };

  if (filters?.competitorId) where.competitorId = filters.competitorId;
  if (filters?.changeType) where.changeType = filters.changeType;

  if (filters?.showDismissed !== true) {
    where.dismissed = false;
  }

  if (filters?.since) {
    where.detectedAt = { gte: filters.since };
  }

  const changes = await db.competitorChange.findMany({
    where,
    include: {
      competitor: {
        select: {
          id: true,
          name: true,
          websiteUrl: true,
        },
      },
    },
    orderBy: { detectedAt: 'desc' },
    take: filters?.limit ?? 50,
    skip: filters?.offset ?? 0,
  });

  // Enrich with Dutch labels and descriptions
  return changes.map((change) => ({
    ...change,
    changeTypeLabel: CHANGE_TYPE_LABELS[change.changeType as keyof typeof CHANGE_TYPE_LABELS] ?? change.changeType,
    changeTypeDescription: CHANGE_TYPE_DESCRIPTIONS[change.changeType as keyof typeof CHANGE_TYPE_DESCRIPTIONS] ?? '',
  }));
}

/**
 * Dismiss a competitor change so it no longer appears in the active feed.
 *
 * @param changeId - The change to dismiss
 * @param userId - The user dismissing the change
 * @returns The updated change record
 */
export async function dismissChange(changeId: string, userId: string) {
  return db.competitorChange.update({
    where: { id: changeId },
    data: {
      dismissed: true,
      dismissedBy: userId,
      dismissedAt: new Date(),
    },
  });
}

/**
 * Get detailed information about a specific competitor change,
 * including the evidence and comparison data.
 *
 * @param changeId - The change ID to get details for
 * @returns Change details with competitor info and evidence
 */
export async function getChangeDetails(changeId: string) {
  const change = await db.competitorChange.findUnique({
    where: { id: changeId },
    include: {
      competitor: {
        select: {
          id: true,
          name: true,
          websiteUrl: true,
          snapshots: {
            orderBy: { crawledAt: 'desc' },
            take: 2,
          },
        },
      },
    },
  });

  if (!change) {
    throw new Error('Wijziging niet gevonden.');
  }

  // Parse previous/new values if they are JSON
  let previousParsed: unknown = change.previousValue;
  let newParsed: unknown = change.newValue;

  try {
    if (change.previousValue) previousParsed = JSON.parse(change.previousValue);
  } catch {
    // Not JSON, use as-is
  }

  try {
    if (change.newValue) newParsed = JSON.parse(change.newValue);
  } catch {
    // Not JSON, use as-is
  }

  return {
    ...change,
    changeTypeLabel: CHANGE_TYPE_LABELS[change.changeType as keyof typeof CHANGE_TYPE_LABELS] ?? change.changeType,
    changeTypeDescription: CHANGE_TYPE_DESCRIPTIONS[change.changeType as keyof typeof CHANGE_TYPE_DESCRIPTIONS] ?? '',
    previousValueParsed: previousParsed,
    newValueParsed: newParsed,
  };
}
