// ============================================================================
// AI Visibility — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================

// Types
export type {
  AIVisibilityTestConfig,
  AIVisibilityMetrics,
  AIVisibilityImportResult,
  AIVisibilityFilters,
  AIVisibilityMethod,
  FunnelStage,
  SearchIntent,
} from './types';

export {
  SIMULATION_DISCLAIMER,
  DEFAULT_DUTCH_PROMPTS,
  SENTIMENT_NUMERIC_MAP,
  AI_VISIBILITY_CSV_COLUMNS,
} from './types';

// Prompt Library
export {
  createPrompt,
  updatePrompt,
  deletePrompt,
  createCluster,
  getPrompt,
  getPrompts,
  getClusters,
  seedDefaultPrompts,
} from './prompt-library';

// CSV Import
export { importAIVisibilityCSV } from './csv-import';

// Test Manager
export {
  createManualTest,
  createLocalSimulation,
  calculateSummary,
  getResults,
  getSummary,
} from './test-manager';

// Aliases for API route compatibility
export { importAIVisibilityCSV as importCsvResults } from './csv-import';
export { createLocalSimulation as runLocalSimulation } from './test-manager';
export { deletePrompt as softDeletePrompt } from './prompt-library';
