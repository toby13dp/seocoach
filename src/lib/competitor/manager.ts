// ============================================================================
// Competitor Intelligence — Manager
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages competitor records: add, update, remove (soft delete), and query.
// CRITICAL: Does NOT invent traffic or revenue data for competitors.
// ============================================================================

import { db } from '@/lib/db';
import type { CompetitorFilters } from './types';

/**
 * Add a new competitor to track.
 *
 * @param projectId - The project to add the competitor to
 * @param name - Competitor name
 * @param websiteUrl - Competitor website URL
 * @param description - Optional Dutch description
 * @returns The created Competitor record
 * @throws Error if a competitor with the same URL already exists for this project
 */
export async function addCompetitor(
  projectId: string,
  name: string,
  websiteUrl: string,
  description?: string
) {
  // Validate URL
  try {
    new URL(websiteUrl);
  } catch {
    throw new Error(`Ongeldige website-URL: "${websiteUrl}". Geef een geldige URL op.`);
  }

  return db.competitor.create({
    data: {
      projectId,
      name,
      websiteUrl,
      description: description ?? null,
      isActive: true,
    },
  });
}

/**
 * Update a competitor's information.
 *
 * @param competitorId - The competitor to update
 * @param updates - Partial update data
 * @returns The updated Competitor record
 */
export async function updateCompetitor(
  competitorId: string,
  updates: {
    name?: string;
    websiteUrl?: string;
    description?: string | null;
    isActive?: boolean;
  }
) {
  // Validate URL if provided
  if (updates.websiteUrl) {
    try {
      new URL(updates.websiteUrl);
    } catch {
      throw new Error(`Ongeldige website-URL: "${updates.websiteUrl}". Geef een geldige URL op.`);
    }
  }

  return db.competitor.update({
    where: { id: competitorId },
    data: updates,
  });
}

/**
 * Soft-delete a competitor by setting deletedAt.
 * Historical snapshots and changes are preserved.
 *
 * @param competitorId - The competitor to remove
 */
export async function removeCompetitor(competitorId: string) {
  return db.competitor.update({
    where: { id: competitorId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Get competitors for a project with optional filters.
 *
 * @param projectId - The project to get competitors for
 * @param filters - Optional filters
 * @returns Array of competitor records with snapshot counts
 */
export async function getCompetitors(
  projectId: string,
  filters?: CompetitorFilters
) {
  const where: Record<string, unknown> = {
    projectId,
    deletedAt: null,
  };

  if (filters?.isActive !== undefined) where.isActive = filters.isActive;
  else where.isActive = true;

  if (filters?.domain) {
    where.websiteUrl = { contains: filters.domain };
  }

  return db.competitor.findMany({
    where,
    include: {
      _count: {
        select: {
          snapshots: true,
          changes: { where: { dismissed: false } },
        },
      },
    },
    orderBy: { name: 'asc' },
    take: filters?.limit ?? 50,
    skip: filters?.offset ?? 0,
  });
}

/**
 * Get detailed information about a specific competitor,
 * including their latest snapshots and recent changes.
 *
 * @param competitorId - The competitor ID
 * @returns Competitor details with latest snapshots and changes
 */
export async function getCompetitorDetails(competitorId: string) {
  const competitor = await db.competitor.findUnique({
    where: { id: competitorId },
    include: {
      snapshots: {
        orderBy: { crawledAt: 'desc' },
        take: 5,
      },
      changes: {
        where: { dismissed: false },
        orderBy: { detectedAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!competitor || competitor.deletedAt) {
    throw new Error(`Concurrent niet gevonden of verwijderd.`);
  }

  return competitor;
}
