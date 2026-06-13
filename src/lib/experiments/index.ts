// ============================================================================
// Experiments — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================

// Types
export type {
  ExperimentData,
  ExperimentResult,
  StatisticalTestResult,
  ExperimentFilters,
  ExperimentStatus,
} from './types';

export {
  EXPERIMENT_STATUS_LABELS,
  EXPERIMENT_STATUS_DESCRIPTIONS,
} from './types';

// Experiment Manager
export {
  createExperiment,
  updateExperiment,
  getExperiment,
  listExperiments,
  startExperiment,
  completeExperiment,
  cancelExperiment,
  deleteExperiment,
} from './experiment-manager';

// Statistics
export {
  calculateZTest,
  calculateTTest,
  calculateRequiredSampleSize,
  calculateImprovement,
  generateDutchConclusion,
} from './statistics';

// Experiment Analyzer
export {
  recordExperimentResult,
  getExperimentRecommendations,
} from './experiment-analyzer';
