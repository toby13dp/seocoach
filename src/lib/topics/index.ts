// ============================================================================
// Topic & Cluster Management — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Central export point for the topic & cluster management module.
// Import from '@/lib/topics' to access all topic functionality.
// ============================================================================

// Types
export type {
  TopicNode,
  TopicEdge,
  TopicGraph,
  ClusterGroup,
  CreateTopicData,
} from './types';

// Manager
export {
  createTopic,
  updateTopic,
  deleteTopic,
  createCluster,
  updateCluster,
  deleteCluster,
  addKeywordToTopic,
  removeKeywordFromTopic,
  addRelation,
  removeRelation,
  getTopicGraph,
  getClusterGroups,
  suggestPillarPage,
} from './manager';
