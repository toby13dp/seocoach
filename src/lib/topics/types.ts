// ============================================================================
// Topic Cluster Types — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Type definitions for the Topic & Cluster management system.
// Supports topic graph visualization, cluster grouping, and
// pillar page suggestions for content strategy.
// ============================================================================

/**
 * Represents a single topic node in the topic graph.
 * Maps to the Prisma Topic model with additional computed fields
 * for graph visualization and cluster context.
 */
export interface TopicNode {
  /** Unique identifier (UUID) */
  id: string;
  /** Topic name / title */
  name: string;
  /** Optional description of the topic */
  description?: string;
  /** Whether this topic is a pillar page topic */
  isPillar: boolean;
  /** Suggested URL path for the pillar page */
  suggestedUrl?: string;
  /** Search intent classification */
  searchIntent: string;
  /** Funnel stage (awareness, consideration, decision, retention) */
  funnelStage: string;
  /** Conversion goal for this topic */
  conversionGoal?: string;
  /** Priority level (LOW, MEDIUM, HIGH, CRITICAL) */
  priority: string;
  /** Expected impact description */
  impact?: string;
  /** Effort level (MINIMAL, LOW, MEDIUM, HIGH) */
  effort: string;
  /** ID of the cluster this topic belongs to */
  clusterId?: string;
  /** Name of the cluster this topic belongs to */
  clusterName?: string;
  /** Keywords associated with this topic */
  keywords: { id: string; keyword: string }[];
}

/**
 * Represents a directed edge between two topics in the topic graph.
 * Used for visualizing topic relationships and content interlinking strategy.
 */
export interface TopicEdge {
  /** Unique identifier (UUID) */
  id: string;
  /** Source topic ID */
  fromId: string;
  /** Target topic ID */
  toId: string;
  /** Relationship type (supports, contradicts, related, etc.) */
  relationType: string;
  /** Optional label describing the relationship */
  label?: string;
}

/**
 * Complete topic graph structure for visualization.
 * Contains all topics as nodes and their relationships as edges.
 */
export interface TopicGraph {
  /** All topic nodes in the project */
  nodes: TopicNode[];
  /** All edges (relationships) between topics */
  edges: TopicEdge[];
}

/**
 * A cluster group containing related topics.
 * Each cluster may have one pillar topic (the main/authoritative topic).
 */
export interface ClusterGroup {
  /** Cluster unique identifier */
  id: string;
  /** Cluster name */
  name: string;
  /** Cluster description */
  description?: string;
  /** All topics within this cluster */
  topics: TopicNode[];
  /** The pillar (main) topic of this cluster, if one is designated */
  pillarTopic?: TopicNode;
}

/**
 * Data required to create a new topic.
 * Maps to the fields needed for the Prisma Topic model creation.
 */
export interface CreateTopicData {
  /** Topic name / title */
  name: string;
  /** Optional description */
  description?: string;
  /** Cluster to assign the topic to */
  clusterId?: string;
  /** Whether this is a pillar page topic */
  isPillar?: boolean;
  /** Suggested URL for the pillar page */
  suggestedUrl?: string;
  /** Search intent classification */
  searchIntent?: string;
  /** Funnel stage */
  funnelStage?: string;
  /** Conversion goal */
  conversionGoal?: string;
  /** Priority level */
  priority?: string;
  /** Expected impact */
  impact?: string;
  /** Effort level */
  effort?: string;
  /** Sort order within the cluster */
  sortOrder?: number;
}
