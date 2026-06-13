// ============================================================================
// Product Feeds — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Re-exports all public functions and types from the product-feeds module.
// ============================================================================

// --- Types ---
export type {
  FeedItemData,
  ValidationIssue,
  ItemValidationResult,
  FeedValidationSummary,
  FeedImportResult,
  ProductMatchResult,
} from './types';

export {
  FEED_TYPE_LABELS,
  FEED_VALIDATION_STATUS_LABELS,
  FEED_ISSUE_SEVERITY_LABELS,
  FEED_REQUIRED_FIELDS,
  FEED_RECOMMENDED_FIELDS,
  FEED_FIELD_LABELS,
} from './types';

// --- Feed Manager (CRUD) ---
export {
  createFeed,
  updateFeed,
  deleteFeed,
  getFeed,
  listFeeds,
  updateFeedStats,
} from './feed-manager';

// --- Feed Parser ---
export {
  parseXMLFeed,
  parseCSVFeed,
  parseTSVFeed,
  parseFeed,
  mapCSVField,
} from './feed-parser';

// --- Feed Validator ---
export {
  validateFeedItem,
  validateFeed,
  validateFeedItems,
  saveValidationResults,
} from './feed-validator';

// --- Feed Importer ---
export {
  importFeed,
  importFeedFromURL,
  matchFeedItemsToProducts,
  getFeedValidationSummary,
} from './feed-importer';
