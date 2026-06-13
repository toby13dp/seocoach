// ============================================================================
// Roadmap Manager — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// CRUD operations, filtering, and view management for the Roadmap module.
// Provides the primary API for reading, updating, reordering, and
// completing roadmap items. All user-facing strings are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import type { ActionPriority, ActionItemStatus } from '@prisma/client';
import type {
  RoadmapFilters,
  RoadmapStats,
  RoadmapItemUpdate,
  RoadmapView,
  RoadmapItemType,
} from './types';

// ============================================================================
// Query / Filtering
// ============================================================================

/**
 * Get roadmap items for a project with optional filters.
 *
 * Returns items ordered by sortOrder, then by priority (CRITICAL first),
 * then by creation date (newest first).
 *
 * @param projectId - The project to get items for
 * @param filters - Optional filters for type, view, status, priority, assignedTo
 * @returns Array of RoadmapItem records
 */
export async function getRoadmapItems(
  projectId: string,
  filters?: RoadmapFilters,
) {
  const where: Record<string, unknown> = { projectId };

  if (filters?.type) {
    where.type = filters.type;
  }
  if (filters?.view) {
    where.view = filters.view;
  }
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.priority) {
    where.priority = filters.priority;
  }
  if (filters?.assignedTo) {
    where.assignedTo = filters.assignedTo;
  }

  return db.roadmapItem.findMany({
    where,
    orderBy: [
      { sortOrder: 'asc' },
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}

/**
 * Get roadmap items for a specific timeline view.
 *
 * @param projectId - The project to get items for
 * @param view - The timeline view to filter by
 * @returns Array of RoadmapItem records for the specified view
 */
export async function getRoadmapByView(
  projectId: string,
  view: RoadmapView,
) {
  return db.roadmapItem.findMany({
    where: {
      projectId,
      view,
    },
    orderBy: [
      { sortOrder: 'asc' },
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Update a roadmap item's properties.
 *
 * Supports updating priority, status, assignment, dates, and other fields.
 * When an item is marked as COMPLETED, also sets completedAt to now.
 *
 * @param itemId - The roadmap item ID to update
 * @param updates - The fields to update
 * @returns The updated RoadmapItem
 */
export async function updateRoadmapItem(
  itemId: string,
  updates: RoadmapItemUpdate,
) {
  const data: Record<string, unknown> = {};

  if (updates.title !== undefined) data.title = updates.title;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.priority !== undefined) data.priority = updates.priority;
  if (updates.effort !== undefined) data.effort = updates.effort;
  if (updates.impact !== undefined) data.impact = updates.impact;
  if (updates.status !== undefined) {
    data.status = updates.status;
    // Set completedAt when status changes to COMPLETED
    if (updates.status === 'COMPLETED') {
      data.completedAt = new Date();
    }
  }
  if (updates.assignedTo !== undefined) data.assignedTo = updates.assignedTo;
  if (updates.scheduledDate !== undefined) data.scheduledDate = updates.scheduledDate;
  if (updates.dueDate !== undefined) data.dueDate = updates.dueDate;
  if (updates.view !== undefined) data.view = updates.view;
  if (updates.sortOrder !== undefined) data.sortOrder = updates.sortOrder;
  if (updates.recommendation !== undefined) data.recommendation = updates.recommendation;

  return db.roadmapItem.update({
    where: { id: itemId },
    data,
  });
}

/**
 * Soft-delete a roadmap item by setting its status to SKIPPED.
 * We use SKIPPED instead of actual deletion to preserve the audit trail.
 *
 * @param itemId - The roadmap item ID to delete
 * @returns The updated RoadmapItem
 */
export async function deleteRoadmapItem(itemId: string) {
  return db.roadmapItem.update({
    where: { id: itemId },
    data: {
      status: 'SKIPPED' as ActionItemStatus,
    },
  });
}

/**
 * Reorder roadmap items by updating their sortOrder values.
 * Used for drag-and-drop reordering in the UI.
 *
 * @param itemIds - Array of item IDs in the desired order
 * @returns The number of items updated
 */
export async function reorderRoadmapItems(itemIds: string[]): Promise<number> {
  if (itemIds.length === 0) return 0;

  const updates = itemIds.map((id, index) =>
    db.roadmapItem.update({
      where: { id },
      data: { sortOrder: index },
    }),
  );

  await db.$transaction(updates);
  return itemIds.length;
}

/**
 * Assign a roadmap item to a user.
 *
 * @param itemId - The roadmap item ID
 * @param userId - The user ID to assign the item to
 * @returns The updated RoadmapItem
 */
export async function assignRoadmapItem(
  itemId: string,
  userId: string,
) {
  return db.roadmapItem.update({
    where: { id: itemId },
    data: {
      assignedTo: userId,
      status: 'IN_PROGRESS' as ActionItemStatus,
    },
  });
}

/**
 * Mark a roadmap item as completed.
 * Sets the status to COMPLETED and records the completion timestamp.
 *
 * @param itemId - The roadmap item ID to complete
 * @returns The updated RoadmapItem
 */
export async function completeRoadmapItem(itemId: string) {
  return db.roadmapItem.update({
    where: { id: itemId },
    data: {
      status: 'COMPLETED' as ActionItemStatus,
      completedAt: new Date(),
    },
  });
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get summary statistics for a project's roadmap.
 * Returns counts broken down by type, priority, status, and view.
 *
 * @param projectId - The project to get stats for
 * @returns RoadmapStats object with breakdowns
 */
export async function getRoadmapStats(
  projectId: string,
): Promise<RoadmapStats> {
  const items = await db.roadmapItem.findMany({
    where: { projectId },
    select: {
      type: true,
      priority: true,
      status: true,
      view: true,
    },
  });

  const byType: Partial<Record<RoadmapItemType, number>> = {};
  const byPriority: Partial<Record<ActionPriority, number>> = {};
  const byStatus: Partial<Record<ActionItemStatus, number>> = {};
  const byView: Partial<Record<RoadmapView, number>> = {};

  for (const item of items) {
    byType[item.type as RoadmapItemType] = (byType[item.type as RoadmapItemType] ?? 0) + 1;
    byPriority[item.priority] = (byPriority[item.priority] ?? 0) + 1;
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    byView[item.view as RoadmapView] = (byView[item.view as RoadmapView] ?? 0) + 1;
  }

  return {
    total: items.length,
    byType,
    byPriority,
    byStatus,
    byView,
  };
}
