// ============================================================================
// Trends — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================

// Types
export type {
  TrendSourceType,
  TrendFilters,
  InternalSearchImportResult,
  KeywordTrendResult,
  SeasonalTrendResult,
} from './types';

export {
  TREND_SOURCE_LABELS,
  TREND_DIRECTION_LABELS,
  TREND_DIRECTION_DESCRIPTIONS,
} from './types';

// Tracker
export {
  recordTrend,
  getTrends,
  detectKeywordTrends,
  detectSeasonalTrends,
  importInternalSearch,
} from './tracker';
