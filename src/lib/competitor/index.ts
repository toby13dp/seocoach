// ============================================================================
// Competitor Intelligence — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================

// Types
export type {
  CompetitorChangeType,
  CompetitorFilters,
  CompetitorFeedFilters,
} from './types';

export {
  CHANGE_TYPE_LABELS,
  CHANGE_TYPE_DESCRIPTIONS,
} from './types';

// Manager
export {
  addCompetitor,
  updateCompetitor,
  removeCompetitor,
  getCompetitors,
  getCompetitorDetails,
} from './manager';

// Crawler
export {
  crawlCompetitor,
  detectChanges,
} from './crawler';

// Feed
export {
  getCompetitorFeed,
  dismissChange,
  getChangeDetails,
} from './feed';

// Aliases for API route compatibility
export { removeCompetitor as softDeleteCompetitor } from './manager';
export { getCompetitorDetails as getCompetitor } from './manager';
export { getCompetitorFeed as getCompetitorChanges } from './feed';
