// ============================================================================
// Topic & Cluster Manager — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages topics, topic clusters, keywords, and relationships for
// building a topic graph and content strategy. Supports CRUD operations,
// graph visualization, cluster grouping, and pillar page suggestions.
// ============================================================================

import { db } from '@/lib/db';
import { providerManager } from '@/lib/ai/provider-manager';
import type {
  TopicNode,
  TopicEdge,
  TopicGraph,
  ClusterGroup,
  CreateTopicData,
} from './types';

// ============================================================================
// Enum Mapping Helpers
// ============================================================================

/**
 * Map a string value to the SearchIntent enum.
 * Falls back to UNKNOWN if the value is not a valid enum member.
 */
function toSearchIntent(value?: string): string {
  const valid = [
    'INFORMATIONAL',
    'NAVIGATIONAL',
    'TRANSACTIONAL',
    'COMMERCIAL_INVESTIGATION',
    'LOCAL',
    'BRANDED',
    'UNKNOWN',
  ];
  if (!value) return 'UNKNOWN';
  const upper = value.toUpperCase().replace(/\s+/g, '_');
  return valid.includes(upper) ? upper : 'UNKNOWN';
}

/**
 * Map a string value to the FunnelStage enum.
 * Falls back to UNKNOWN if the value is not a valid enum member.
 */
function toFunnelStage(value?: string): string {
  const valid = ['AWARENESS', 'CONSIDERATION', 'DECISION', 'RETENTION', 'UNKNOWN'];
  if (!value) return 'UNKNOWN';
  const upper = value.toUpperCase().replace(/\s+/g, '_');
  return valid.includes(upper) ? upper : 'UNKNOWN';
}

/**
 * Map a string value to the ActionPriority enum.
 * Falls back to MEDIUM if the value is not a valid enum member.
 */
function toActionPriority(value?: string): string {
  const valid = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!value) return 'MEDIUM';
  const upper = value.toUpperCase();
  return valid.includes(upper) ? upper : 'MEDIUM';
}

/**
 * Map a string value to the ActionEffort enum.
 * Falls back to MEDIUM if the value is not a valid enum member.
 */
function toActionEffort(value?: string): string {
  const valid = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'];
  if (!value) return 'MEDIUM';
  const upper = value.toUpperCase();
  return valid.includes(upper) ? upper : 'MEDIUM';
}

/**
 * Convert a Prisma Topic record (with relations) to a TopicNode.
 * Handles optional includes gracefully.
 */
function prismaTopicToNode(
  topic: {
    id: string;
    name: string;
    description: string | null;
    clusterId: string | null;
    isPillar: boolean;
    suggestedUrl: string | null;
    searchIntent: string;
    funnelStage: string;
    conversionGoal: string | null;
    priority: string;
    impact: string | null;
    effort: string;
    cluster?: { id: string; name: string } | null;
    topicKeywords?: { id: string; keyword: { id: string; keyword: string } }[];
  }
): TopicNode {
  return {
    id: topic.id,
    name: topic.name,
    description: topic.description ?? undefined,
    isPillar: topic.isPillar,
    suggestedUrl: topic.suggestedUrl ?? undefined,
    searchIntent: topic.searchIntent,
    funnelStage: topic.funnelStage,
    conversionGoal: topic.conversionGoal ?? undefined,
    priority: topic.priority,
    impact: topic.impact ?? undefined,
    effort: topic.effort,
    clusterId: topic.clusterId ?? undefined,
    clusterName: topic.cluster?.name ?? undefined,
    keywords:
      topic.topicKeywords?.map((tk) => ({
        id: tk.keyword.id,
        keyword: tk.keyword.keyword,
      })) ?? [],
  };
}

// ============================================================================
// Topic CRUD Operations
// ============================================================================

/**
 * Create a new topic within a project.
 *
 * Validates the project exists, maps string values to Prisma enums,
 * and creates the topic with optional cluster assignment.
 *
 * @param projectId - The project to create the topic in
 * @param data - Topic creation data
 * @returns The created Topic record
 * @throws Error if the project does not exist
 */
export async function createTopic(
  projectId: string,
  data: CreateTopicData
): Promise<TopicNode> {
  // Verify the project exists
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    throw new Error(`Project "${projectId}" niet gevonden`);
  }

  // If a cluster is specified, verify it belongs to this project
  if (data.clusterId) {
    const cluster = await db.topicCluster.findFirst({
      where: { id: data.clusterId, projectId, deletedAt: null },
    });
    if (!cluster) {
      throw new Error(
        `Cluster "${data.clusterId}" niet gevonden in dit project`
      );
    }
  }

  const topic = await db.topic.create({
    data: {
      projectId,
      name: data.name,
      description: data.description ?? null,
      clusterId: data.clusterId ?? null,
      isPillar: data.isPillar ?? false,
      suggestedUrl: data.suggestedUrl ?? null,
      searchIntent: toSearchIntent(data.searchIntent) as never,
      funnelStage: toFunnelStage(data.funnelStage) as never,
      conversionGoal: data.conversionGoal ?? null,
      priority: toActionPriority(data.priority) as never,
      impact: data.impact ?? null,
      effort: toActionEffort(data.effort) as never,
      sortOrder: data.sortOrder ?? 0,
    },
    include: {
      cluster: { select: { id: true, name: true } },
      topicKeywords: { include: { keyword: { select: { id: true, keyword: true } } } },
    },
  });

  return prismaTopicToNode(topic);
}

/**
 * Update an existing topic.
 *
 * Only the provided fields are updated. Enum values are mapped
 * automatically from strings.
 *
 * @param topicId - The topic to update
 * @param data - Partial topic data with fields to update
 * @returns The updated Topic record
 * @throws Error if the topic does not exist or is soft-deleted
 */
export async function updateTopic(
  topicId: string,
  data: Partial<CreateTopicData>
): Promise<TopicNode> {
  const existing = await db.topic.findFirst({
    where: { id: topicId, deletedAt: null },
  });

  if (!existing) {
    throw new Error(`Onderwerp "${topicId}" niet gevonden`);
  }

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.clusterId !== undefined) updateData.clusterId = data.clusterId;
  if (data.isPillar !== undefined) updateData.isPillar = data.isPillar;
  if (data.suggestedUrl !== undefined) updateData.suggestedUrl = data.suggestedUrl;
  if (data.searchIntent !== undefined)
    updateData.searchIntent = toSearchIntent(data.searchIntent);
  if (data.funnelStage !== undefined)
    updateData.funnelStage = toFunnelStage(data.funnelStage);
  if (data.conversionGoal !== undefined)
    updateData.conversionGoal = data.conversionGoal;
  if (data.priority !== undefined)
    updateData.priority = toActionPriority(data.priority);
  if (data.impact !== undefined) updateData.impact = data.impact;
  if (data.effort !== undefined) updateData.effort = toActionEffort(data.effort);
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const topic = await db.topic.update({
    where: { id: topicId },
    data: updateData,
    include: {
      cluster: { select: { id: true, name: true } },
      topicKeywords: { include: { keyword: { select: { id: true, keyword: true } } } },
    },
  });

  return prismaTopicToNode(topic);
}

/**
 * Soft-delete a topic by setting its deletedAt timestamp.
 *
 * The topic remains in the database but is excluded from queries
 * that filter on deletedAt = null.
 *
 * @param topicId - The topic to soft-delete
 * @throws Error if the topic does not exist or is already deleted
 */
export async function deleteTopic(topicId: string): Promise<void> {
  const existing = await db.topic.findFirst({
    where: { id: topicId, deletedAt: null },
  });

  if (!existing) {
    throw new Error(`Onderwerp "${topicId}" niet gevonden`);
  }

  await db.topic.update({
    where: { id: topicId },
    data: { deletedAt: new Date() },
  });
}

// ============================================================================
// Cluster CRUD Operations
// ============================================================================

/**
 * Create a new topic cluster within a project.
 *
 * A cluster groups related topics together for content strategy purposes.
 * Each cluster typically has one pillar (main) topic.
 *
 * @param projectId - The project to create the cluster in
 * @param name - Cluster name
 * @param description - Optional cluster description
 * @returns The created TopicCluster record
 * @throws Error if the project does not exist
 */
export async function createCluster(
  projectId: string,
  name: string,
  description?: string
): Promise<{ id: string; name: string; description: string | null; createdAt: Date; updatedAt: Date }> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    throw new Error(`Project "${projectId}" niet gevonden`);
  }

  return db.topicCluster.create({
    data: {
      projectId,
      name,
      description: description ?? null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Update an existing topic cluster.
 *
 * @param clusterId - The cluster to update
 * @param data - Partial cluster data (name and/or description)
 * @returns The updated TopicCluster record
 * @throws Error if the cluster does not exist or is soft-deleted
 */
export async function updateCluster(
  clusterId: string,
  data: { name?: string; description?: string }
): Promise<{ id: string; name: string; description: string | null; createdAt: Date; updatedAt: Date }> {
  const existing = await db.topicCluster.findFirst({
    where: { id: clusterId, deletedAt: null },
  });

  if (!existing) {
    throw new Error(`Cluster "${clusterId}" niet gevonden`);
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;

  return db.topicCluster.update({
    where: { id: clusterId },
    data: updateData,
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Soft-delete a topic cluster.
 *
 * Note: topics within the cluster will have their clusterId set to null
 * via the onDelete: SetNull constraint, so they become unclustered.
 *
 * @param clusterId - The cluster to soft-delete
 * @throws Error if the cluster does not exist or is already deleted
 */
export async function deleteCluster(clusterId: string): Promise<void> {
  const existing = await db.topicCluster.findFirst({
    where: { id: clusterId, deletedAt: null },
  });

  if (!existing) {
    throw new Error(`Cluster "${clusterId}" niet gevonden`);
  }

  // First, detach all topics from this cluster
  await db.topic.updateMany({
    where: { clusterId },
    data: { clusterId: null },
  });

  // Then soft-delete the cluster
  await db.topicCluster.update({
    where: { id: clusterId },
    data: { deletedAt: new Date() },
  });
}

// ============================================================================
// Topic-Keyword Association
// ============================================================================

/**
 * Associate a keyword with a topic.
 *
 * Creates a TopicKeyword link record. If the keyword is already
 * associated, the operation is a no-op (due to the unique constraint).
 *
 * @param topicId - The topic to add the keyword to
 * @param keywordId - The keyword to associate
 * @throws Error if the topic or keyword does not exist
 */
export async function addKeywordToTopic(
  topicId: string,
  keywordId: string
): Promise<void> {
  const topic = await db.topic.findFirst({
    where: { id: topicId, deletedAt: null },
  });

  if (!topic) {
    throw new Error(`Onderwerp "${topicId}" niet gevonden`);
  }

  const keyword = await db.keyword.findFirst({
    where: { id: keywordId, deletedAt: null },
  });

  if (!keyword) {
    throw new Error(`Zoekwoord "${keywordId}" niet gevonden`);
  }

  // Use upsert to avoid unique constraint violation
  await db.topicKeyword.upsert({
    where: {
      topicId_keywordId: { topicId, keywordId },
    },
    create: { topicId, keywordId },
    update: {}, // no-op if already exists
  });
}

/**
 * Remove a keyword association from a topic.
 *
 * Deletes the TopicKeyword link record.
 *
 * @param topicId - The topic to remove the keyword from
 * @param keywordId - The keyword to disassociate
 * @throws Error if the association does not exist
 */
export async function removeKeywordFromTopic(
  topicId: string,
  keywordId: string
): Promise<void> {
  const link = await db.topicKeyword.findUnique({
    where: { topicId_keywordId: { topicId, keywordId } },
  });

  if (!link) {
    throw new Error(
      `Koppeling tussen onderwerp "${topicId}" en zoekwoord "${keywordId}" niet gevonden`
    );
  }

  await db.topicKeyword.delete({
    where: { id: link.id },
  });
}

// ============================================================================
// Topic Relations
// ============================================================================

/**
 * Create a relationship between two topics.
 *
 * Relationships are directed edges in the topic graph, representing
 * how topics support, contradict, or relate to each other.
 *
 * @param fromId - The source topic ID
 * @param toId - The target topic ID
 * @param type - Relationship type (supports, contradicts, related, etc.)
 * @param label - Optional label describing the relationship
 * @returns The created TopicRelation record
 * @throws Error if either topic does not exist or the relation already exists
 */
export async function addRelation(
  fromId: string,
  toId: string,
  type: string,
  label?: string
): Promise<{ id: string; fromTopicId: string; toTopicId: string; relationType: string; label: string | null }> {
  // Validate both topics exist
  const fromTopic = await db.topic.findFirst({
    where: { id: fromId, deletedAt: null },
  });
  const toTopic = await db.topic.findFirst({
    where: { id: toId, deletedAt: null },
  });

  if (!fromTopic) {
    throw new Error(`Brononderwerp "${fromId}" niet gevonden`);
  }
  if (!toTopic) {
    throw new Error(`Doelonderwerp "${toId}" niet gevonden`);
  }

  if (fromId === toId) {
    throw new Error('Een onderwerp kan geen relatie met zichzelf hebben');
  }

  // Check for existing relation with same type
  const existing = await db.topicRelation.findUnique({
    where: {
      fromTopicId_toTopicId_relationType: {
        fromTopicId: fromId,
        toTopicId: toId,
        relationType: type,
      },
    },
  });

  if (existing) {
    throw new Error(
      `Relatie tussen "${fromTopic.name}" en "${toTopic.name}" met type "${type}" bestaat al`
    );
  }

  return db.topicRelation.create({
    data: {
      fromTopicId: fromId,
      toTopicId: toId,
      relationType: type,
      label: label ?? null,
    },
    select: {
      id: true,
      fromTopicId: true,
      toTopicId: true,
      relationType: true,
      label: true,
    },
  });
}

/**
 * Remove a topic relationship.
 *
 * @param relationId - The relation to remove
 * @throws Error if the relation does not exist
 */
export async function removeRelation(relationId: string): Promise<void> {
  const existing = await db.topicRelation.findUnique({
    where: { id: relationId },
  });

  if (!existing) {
    throw new Error(`Relatie "${relationId}" niet gevonden`);
  }

  await db.topicRelation.delete({
    where: { id: relationId },
  });
}

// ============================================================================
// Graph & Cluster Visualization
// ============================================================================

/**
 * Get the full topic graph for a project.
 *
 * Returns all non-deleted topics as nodes with their associated keywords,
 * and all relationships as edges. Useful for graph visualization.
 *
 * @param projectId - The project to get the graph for
 * @returns A TopicGraph with nodes and edges
 */
export async function getTopicGraph(projectId: string): Promise<TopicGraph> {
  const topics = await db.topic.findMany({
    where: { projectId, deletedAt: null },
    include: {
      cluster: { select: { id: true, name: true } },
      topicKeywords: {
        include: { keyword: { select: { id: true, keyword: true } } },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  // Collect all topic IDs for efficient edge querying
  const topicIds = topics.map((t) => t.id);

  const relations = topicIds.length > 0
    ? await db.topicRelation.findMany({
        where: {
          fromTopicId: { in: topicIds },
          toTopicId: { in: topicIds },
        },
      })
    : [];

  const nodes: TopicNode[] = topics.map(prismaTopicToNode);
  const edges: TopicEdge[] = relations.map((r) => ({
    id: r.id,
    fromId: r.fromTopicId,
    toId: r.toTopicId,
    relationType: r.relationType,
    label: r.label ?? undefined,
  }));

  return { nodes, edges };
}

/**
 * Get all clusters with their topics for a project.
 *
 * Each cluster includes its topics (with keywords) and identifies
 * the pillar topic if one is designated.
 *
 * @param projectId - The project to get clusters for
 * @returns Array of ClusterGroup objects
 */
export async function getClusterGroups(projectId: string): Promise<ClusterGroup[]> {
  const clusters = await db.topicCluster.findMany({
    where: { projectId, deletedAt: null },
    include: {
      topics: {
        where: { deletedAt: null },
        include: {
          cluster: { select: { id: true, name: true } },
          topicKeywords: {
            include: {
              keyword: { select: { id: true, keyword: true } },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  return clusters.map((cluster) => {
    const topicNodes = cluster.topics.map(prismaTopicToNode);
    const pillarTopic = topicNodes.find((t) => t.isPillar);

    return {
      id: cluster.id,
      name: cluster.name,
      description: cluster.description ?? undefined,
      topics: topicNodes,
      pillarTopic,
    };
  });
}

// ============================================================================
// Pillar Page Suggestion
// ============================================================================

/**
 * Suggest a URL for a topic's pillar page.
 *
 * Uses AI to generate a SEO-friendly URL suggestion when available,
 * falling back to a rule-based slug generation when AI is not accessible.
 *
 * The URL is based on the topic name, cluster context, and
 * Dutch URL conventions (lowercase, hyphens, no special characters).
 *
 * @param topicId - The topic to suggest a pillar page URL for
 * @returns A suggested URL path (e.g., "/seo-tools/nederlandse-seo-strategie")
 * @throws Error if the topic does not exist
 */
export async function suggestPillarPage(topicId: string): Promise<string> {
  const topic = await db.topic.findFirst({
    where: { id: topicId, deletedAt: null },
    include: {
      cluster: { select: { id: true, name: true } },
      topicKeywords: {
        include: { keyword: { select: { id: true, keyword: true } } },
      },
    },
  });

  if (!topic) {
    throw new Error(`Onderwerp "${topicId}" niet gevonden`);
  }

  // Try AI-based suggestion first
  try {
    const keywords = topic.topicKeywords
      .map((tk) => tk.keyword.keyword)
      .slice(0, 5)
      .join(', ');

    const aiResponse = await providerManager.fallbackGenerate(topic.projectId, {
      messages: [
        {
          role: 'system',
          content:
            'Je bent een SEO-URL-specialist voor de Nederlandse markt. Genereer korte, SEO-vriendelijke URL-pad suggesties. Geef alleen het URL-pad, zonder domeinnaam. Gebruik kleine letters, koppeltekens en geen speciale tekens. Baseer de URL op het hoofdonderwerp en cluster.',
        },
        {
          role: 'user',
          content: `Genereer één SEO-vriendelijk URL-pad voor het volgende onderwerp:\n\nOnderwerp: ${topic.name}\nCluster: ${topic.cluster?.name ?? 'Geen cluster'}\nZoekwoorden: ${keywords}\n\nGeef alleen het URL-pad (bijv. /seo-tools/strategie)`,
        },
      ],
      purpose: 'pillar-url-suggestion',
      maxTokens: 100,
      temperature: 0.3,
    });

    if (aiResponse.success && aiResponse.content.trim()) {
      const suggested = aiResponse.content.trim();
      // Validate: must start with / and contain only safe URL characters
      if (/^\/[a-z0-9\-\/]+$/.test(suggested)) {
        // Persist the suggestion
        await db.topic.update({
          where: { id: topicId },
          data: { suggestedUrl: suggested },
        });
        return suggested;
      }
    }
  } catch {
    // Fall through to rule-based suggestion
  }

  // Rule-based fallback: generate slug from topic name and cluster
  const clusterSlug = topic.cluster?.name
    ? slugify(topic.cluster.name)
    : null;

  const topicSlug = slugify(topic.name);

  const suggestedUrl = clusterSlug
    ? `/${clusterSlug}/${topicSlug}`
    : `/${topicSlug}`;

  // Persist the suggestion
  await db.topic.update({
    where: { id: topicId },
    data: { suggestedUrl },
  });

  return suggestedUrl;
}

/**
 * Convert a Dutch string to a URL-safe slug.
 *
 * Replaces common Dutch diacritics, converts to lowercase,
 * replaces spaces and special characters with hyphens,
 * and removes consecutive hyphens.
 *
 * @param text - The text to slugify
 * @returns A URL-safe slug string
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/[^a-z0-9\s\-]/g, '') // Remove non-alphanumeric chars
    .trim()
    .replace(/[\s]+/g, '-') // Replace spaces with hyphens
    .replace(/\-+/g, '-') // Replace multiple hyphens with single
    .replace(/^\-|\-$/g, ''); // Remove leading/trailing hyphens
}
