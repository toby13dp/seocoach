// ============================================================================
// AI Visibility — Prompt Library
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages the AI prompt library for visibility testing.
// Prompts are grouped into clusters for organized testing.
// Includes default Dutch market prompt suggestions.
// ============================================================================

import { db } from '@/lib/db';
import type { FunnelStage, SearchIntent } from '@prisma/client';
import { DEFAULT_DUTCH_PROMPTS } from './types';

/**
 * Create a new prompt in the AI prompt library.
 *
 * @param projectId - The project to add the prompt to
 * @param name - Human-readable prompt name
 * @param prompt - The actual prompt text
 * @param clusterId - Optional cluster to group this prompt under
 * @param funnelStage - Marketing funnel stage
 * @param searchIntent - Search intent classification
 * @returns The created AIPromptLibrary record
 */
export async function createPrompt(
  projectId: string,
  name: string,
  prompt: string,
  clusterId?: string,
  funnelStage?: FunnelStage,
  searchIntent?: SearchIntent
) {
  return db.aIPromptLibrary.create({
    data: {
      projectId,
      name,
      prompt,
      clusterId: clusterId ?? null,
      funnelStage: funnelStage ?? 'UNKNOWN',
      searchIntent: searchIntent ?? 'UNKNOWN',
      isActive: true,
    },
  });
}

/**
 * Update an existing prompt in the library.
 *
 * @param promptId - The prompt to update
 * @param updates - Partial update data
 * @returns The updated prompt record
 */
export async function updatePrompt(
  promptId: string,
  updates: {
    name?: string;
    prompt?: string;
    clusterId?: string | null;
    funnelStage?: FunnelStage;
    searchIntent?: SearchIntent;
    isActive?: boolean;
  }
) {
  return db.aIPromptLibrary.update({
    where: { id: promptId },
    data: updates,
  });
}

/**
 * Soft-delete a prompt from the library by deactivating it.
 * We set isActive=false rather than deleting to preserve
 * historical test results that reference this prompt.
 *
 * @param promptId - The prompt to deactivate
 */
export async function deletePrompt(promptId: string) {
  return db.aIPromptLibrary.update({
    where: { id: promptId },
    data: { isActive: false },
  });
}

/**
 * Create a new prompt cluster for organizing prompts.
 *
 * @param projectId - The project to create the cluster in
 * @param name - Cluster name
 * @param description - Optional Dutch description
 * @returns The created AIPromptCluster record
 */
export async function createCluster(
  projectId: string,
  name: string,
  description?: string
) {
  return db.aIPromptCluster.create({
    data: {
      projectId,
      name,
      description: description ?? null,
    },
  });
}

/**
 * Get a single prompt by ID.
 *
 * @param promptId - The prompt ID to retrieve
 * @returns The prompt record with cluster info, or null if not found
 */
export async function getPrompt(promptId: string) {
  return db.aIPromptLibrary.findUnique({
    where: { id: promptId },
    include: {
      cluster: true,
    },
  });
}

/**
 * Get prompts from the library with optional filters.
 *
 * @param projectId - The project to get prompts for
 * @param filters - Optional filters for the query
 * @returns Array of prompt records with cluster info
 */
export async function getPrompts(
  projectId: string,
  filters?: {
    clusterId?: string;
    funnelStage?: FunnelStage;
    searchIntent?: SearchIntent;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }
) {
  const where: Record<string, unknown> = { projectId };

  if (filters?.clusterId) where.clusterId = filters.clusterId;
  if (filters?.funnelStage) where.funnelStage = filters.funnelStage;
  if (filters?.searchIntent) where.searchIntent = filters.searchIntent;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;
  else where.isActive = true; // Default: only active prompts

  return db.aIPromptLibrary.findMany({
    where,
    include: {
      cluster: true,
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 100,
    skip: filters?.offset ?? 0,
  });
}

/**
 * Get all prompt clusters for a project.
 *
 * @param projectId - The project to get clusters for
 * @returns Array of clusters with their prompt counts
 */
export async function getClusters(projectId: string) {
  const clusters = await db.aIPromptCluster.findMany({
    where: { projectId },
    include: {
      _count: {
        select: { prompts: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return clusters.map((c) => ({
    id: c.id,
    projectId: c.projectId,
    name: c.name,
    description: c.description,
    promptCount: c._count.prompts,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

/**
 * Seed default Dutch market prompts for a project.
 * Creates a "Standaard prompts" cluster and populates it
 * with the default Dutch prompt suggestions.
 *
 * @param projectId - The project to seed prompts for
 * @returns Array of created prompt records
 */
export async function seedDefaultPrompts(projectId: string) {
  // Create a default cluster
  const cluster = await db.aIPromptCluster.create({
    data: {
      projectId,
      name: 'Standaard prompts',
      description: 'Standaard prompt-suggesties voor de Nederlandse markt.',
    },
  });

  // Create all default prompts
  const prompts = await Promise.all(
    DEFAULT_DUTCH_PROMPTS.map((dp) =>
      db.aIPromptLibrary.create({
        data: {
          projectId,
          name: dp.name,
          prompt: dp.prompt,
          clusterId: cluster.id,
          funnelStage: dp.funnelStage,
          searchIntent: dp.searchIntent,
          isActive: true,
        },
      })
    )
  );

  return { cluster, prompts };
}
