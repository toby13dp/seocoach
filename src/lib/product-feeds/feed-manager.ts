// ============================================================================
// Product Feeds — Feed Manager (CRUD)
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Create, read, update, and delete product feeds.
// All functions verify projectId for tenant isolation.
// All user-facing text is in Dutch.
// ============================================================================

import { FeedType, FeedValidationStatus } from '@prisma/client';
import { db } from '@/lib/db';

// ============================================================================
// Create Feed
// ============================================================================

/**
 * Create a new product feed for a project.
 *
 * @param projectId - The project this feed belongs to
 * @param data - Feed configuration
 * @returns The created ProductFeed record
 * @throws Error if project not found
 */
export async function createFeed(
  projectId: string,
  data: {
    name: string;
    feedType: FeedType;
    sourceUrl?: string;
    sourceFormat?: string;
    notes?: string;
  }
) {
  // Verify project exists and belongs to tenant
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });

  if (!project) {
    throw new Error('Project niet gevonden. Kan feed niet aanmaken.');
  }

  const feed = await db.productFeed.create({
    data: {
      projectId,
      name: data.name,
      feedType: data.feedType,
      sourceUrl: data.sourceUrl,
      sourceFormat: data.sourceFormat,
      notes: data.notes,
      status: FeedValidationStatus.PENDING,
    },
  });

  return feed;
}

// ============================================================================
// Update Feed
// ============================================================================

/**
 * Update an existing product feed.
 * Verifies that the feed belongs to the given project for tenant isolation.
 *
 * @param feedId - The feed to update
 * @param projectId - The project the feed must belong to
 * @param data - Fields to update
 * @returns The updated ProductFeed record
 * @throws Error if feed not found or does not belong to project
 */
export async function updateFeed(
  feedId: string,
  projectId: string,
  data: {
    name?: string;
    sourceUrl?: string;
    sourceFormat?: string;
    notes?: string;
  }
) {
  // Verify ownership
  const existing = await db.productFeed.findFirst({
    where: { id: feedId, projectId, deletedAt: null },
  });

  if (!existing) {
    throw new Error('Feed niet gevonden of behoort niet tot dit project.');
  }

  const feed = await db.productFeed.update({
    where: { id: feedId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.sourceUrl !== undefined && { sourceUrl: data.sourceUrl }),
      ...(data.sourceFormat !== undefined && { sourceFormat: data.sourceFormat }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });

  return feed;
}

// ============================================================================
// Delete Feed (Soft Delete)
// ============================================================================

/**
 * Soft-delete a product feed.
 * Verifies that the feed belongs to the given project for tenant isolation.
 *
 * @param feedId - The feed to delete
 * @param projectId - The project the feed must belong to
 * @returns The soft-deleted ProductFeed record
 * @throws Error if feed not found or does not belong to project
 */
export async function deleteFeed(feedId: string, projectId: string) {
  // Verify ownership
  const existing = await db.productFeed.findFirst({
    where: { id: feedId, projectId, deletedAt: null },
  });

  if (!existing) {
    throw new Error('Feed niet gevonden of behoort niet tot dit project.');
  }

  const feed = await db.productFeed.update({
    where: { id: feedId },
    data: { deletedAt: new Date() },
  });

  return feed;
}

// ============================================================================
// Get Feed (with items)
// ============================================================================

/**
 * Get a single product feed with its items.
 * Verifies that the feed belongs to the given project for tenant isolation.
 *
 * @param feedId - The feed to retrieve
 * @param projectId - The project the feed must belong to
 * @returns The ProductFeed with items, or null if not found
 */
export async function getFeed(feedId: string, projectId: string) {
  const feed = await db.productFeed.findFirst({
    where: { id: feedId, projectId, deletedAt: null },
    include: {
      items: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return feed;
}

// ============================================================================
// List Feeds
// ============================================================================

/**
 * List all product feeds for a project, with optional filtering.
 *
 * @param projectId - The project whose feeds to list
 * @param filters - Optional filters for feed type and status
 * @returns Array of ProductFeed records (without items)
 */
export async function listFeeds(
  projectId: string,
  filters?: {
    feedType?: FeedType;
    status?: FeedValidationStatus;
  }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    projectId,
    deletedAt: null,
  };

  if (filters?.feedType) {
    where.feedType = filters.feedType;
  }
  if (filters?.status) {
    where.status = filters.status;
  }

  const feeds = await db.productFeed.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return feeds;
}

// ============================================================================
// Update Feed Stats
// ============================================================================

/**
 * Update the aggregated validation statistics on a feed record.
 * Called after validation completes.
 *
 * @param feedId - The feed to update
 * @param projectId - The project the feed must belong to
 * @param stats - Aggregated counts
 */
export async function updateFeedStats(
  feedId: string,
  projectId: string,
  stats: {
    totalProducts: number;
    validProducts: number;
    warningProducts: number;
    invalidProducts: number;
    status: FeedValidationStatus;
  }
) {
  // Verify ownership
  const existing = await db.productFeed.findFirst({
    where: { id: feedId, projectId, deletedAt: null },
  });

  if (!existing) {
    throw new Error('Feed niet gevonden of behoort niet tot dit project.');
  }

  await db.productFeed.update({
    where: { id: feedId },
    data: {
      totalProducts: stats.totalProducts,
      validProducts: stats.validProducts,
      warningProducts: stats.warningProducts,
      invalidProducts: stats.invalidProducts,
      status: stats.status,
      lastValidatedAt: new Date(),
    },
  });
}
