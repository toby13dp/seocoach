// ============================================================================
// Roadmap Module — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Central export point for the Roadmap module.
// Import from '@/lib/roadmap' to access all roadmap functionality.
// ============================================================================

// Types
export type {
  RoadmapItemType,
  RoadmapView,
  RoadmapRecommendation,
  RoadmapViewConfig,
  RoadmapFilters,
  RoadmapStats,
  RoadmapItemUpdate,
} from './types';

export {
  ROADMAP_ITEM_TYPE_LABELS,
  PRIORITY_LABELS,
  EFFORT_LABELS,
  STATUS_LABELS,
  getRoadmapViewConfigs,
  getRoadmapViewConfig,
} from './types';

// Generator
export {
  generateRoadmapRecommendations,
  categorizeByTimeline,
  saveRoadmapItems,
  refreshRoadmap,
} from './generator';

// Manager
export {
  getRoadmapItems,
  getRoadmapByView,
  updateRoadmapItem,
  deleteRoadmapItem,
  reorderRoadmapItems,
  getRoadmapStats,
  assignRoadmapItem,
  completeRoadmapItem,
} from './manager';
