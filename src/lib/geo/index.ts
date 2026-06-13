// ============================================================================
// GEO Readiness — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================

// Types
export type {
  GeoCheckCategory,
  GeoCheckStatus,
  GeoCheckResult,
  GeoReadinessConfig,
} from './types';

export {
  GEO_CHECK_CATEGORIES,
  GEO_CATEGORY_LABELS,
  DEFAULT_GEO_CONFIG,
} from './types';

// Analyzer
export {
  analyzeGeoReadiness,
  getGeoReadinessSummary,
  getGeoReadinessChecks,
} from './analyzer';

// Aliases for API route compatibility
export { analyzeGeoReadiness as getGeoReadiness } from './analyzer';
