// ============================================================================
// Keyword Management — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Re-exports all keyword management modules from a single entry point.
// Import from '@/lib/keywords' to access the full keyword functionality.
// ============================================================================

// Types
export type {
  SearchIntent,
  FunnelStage,
  KeywordImport,
  KeywordCSVRow,
  IntentClassificationResult,
  OpportunityScoreWeights,
  KeywordWithMetrics,
  ScoreResult,
  ScoreCalculationStep,
  ScoreCalculationTrace,
  ImportResult,
} from './types';

// Import
export {
  parseCSV,
  validateKeywordImport,
  normalizeKeyword,
  importKeywords,
} from './import';

// Intent Classification
export {
  classifyIntent,
  classifyIntentWithAI,
  classifyIntentBatch,
  classifyIntentBatchWithAI,
} from './intent-classifier';

// Opportunity Scoring
export {
  getDefaultWeights,
  validateWeights,
  calculateOpportunityScore,
  calculateScoreDetails,
  calculateAndSaveOpportunityScore,
  recalculateProjectScores,
  getScoreTrace,
} from './opportunity-scorer';
