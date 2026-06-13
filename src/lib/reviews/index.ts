// ============================================================================
// Reviews & Reputation — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Re-exports all public types, functions, and constants from the reviews module.
// ============================================================================

// Types
export type {
  ReviewImportData,
  SentimentAnalysisResult,
  ReviewSummary,
  ReviewResponseDraft,
} from './types';

export {
  REVIEW_SOURCE_LABELS,
  REVIEW_SENTIMENT_LABELS,
  REVIEW_RESPONSE_STATUS_LABELS,
  DEFAULT_REVIEW_COLUMN_MAPPINGS,
  NEGATIVE_KEYWORDS,
  POSITIVE_KEYWORDS,
  PRODUCT_THEME_KEYWORDS,
  SERVICE_THEME_KEYWORDS,
} from './types';

// Sentiment Analyzer
export {
  analyzeSentiment,
  classifySentiment,
  detectThemes,
  detectComplaints,
  detectCompliments,
  detectProductIssues,
  detectServiceIssues,
  generateFAQOpportunities,
  generateContentOpportunities,
  identifyTrustSignals,
} from './sentiment-analyzer';

// Review Importer
export {
  importReviewsCSV,
  importReview,
  importReviewsBulk,
  parseReviewCSV,
} from './review-importer';

// Review Manager
export {
  listReviews,
  getReview,
  getReviewSummary,
  analyzeAndSaveReviewSentiment,
  analyzeProjectReviews,
  deleteReview,
} from './review-manager';

// Response Drafter
export {
  generateResponseDraft,
  submitResponseForApproval,
  approveResponse,
  rejectResponse,
  updateResponseDraft,
  publishResponse,
  getReviewResponses,
} from './response-drafter';
