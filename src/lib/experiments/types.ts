// ============================================================================
// Experiments — Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for A/B test and experiment tracking with honest statistical
// analysis. All user-facing text is in Dutch.
// ============================================================================

import type { ExperimentStatus } from '@prisma/client';

// ============================================================================
// Dutch Labels
// ============================================================================

/**
 * Dutch labels for experiment statuses.
 */
export const EXPERIMENT_STATUS_LABELS: Record<ExperimentStatus, string> = {
  DRAFT: 'Concept',
  RUNNING: 'Actief',
  COMPLETED: 'Afgerond',
  CANCELLED: 'Geannuleerd',
};

/**
 * Dutch descriptions for experiment statuses.
 */
export const EXPERIMENT_STATUS_DESCRIPTIONS: Record<ExperimentStatus, string> = {
  DRAFT: 'Het experiment is opgezet maar nog niet gestart.',
  RUNNING: 'Het experiment is actief en verzamelt gegevens.',
  COMPLETED: 'Het experiment is afgerond en de resultaten zijn beschikbaar.',
  CANCELLED: 'Het experiment is geannuleerd voordat het werd afgerond.',
};

// ============================================================================
// Data Interfaces
// ============================================================================

/**
 * Data required to create a new experiment.
 * All user-facing text fields are in Dutch.
 */
export interface ExperimentData {
  /** Name of the experiment (Dutch) */
  name: string;
  /** Optional description (Dutch) */
  description?: string;
  /** The hypothesis being tested (Dutch) */
  hypothesis: string;
  /** Name of the test/variant group (Dutch) */
  testGroupName?: string;
  /** Name of the control group (Dutch) */
  controlGroupName?: string;
  /** Number of participants in the test group */
  testGroupSize?: number;
  /** Number of participants in the control group */
  controlGroupSize?: number;
  /** Name of the primary KPI being measured (Dutch) */
  kpiName: string;
  /** Current baseline value for the KPI */
  kpiBaseline?: number;
  /** Target value for the KPI */
  kpiTarget?: number;
  /** When the experiment starts */
  startDate?: Date;
  /** When the experiment ends */
  endDate?: Date;
}

/**
 * Result of a completed experiment.
 */
export interface ExperimentResult {
  /** Result value for the test group */
  testGroupResult: number;
  /** Result value for the control group */
  controlGroupResult: number;
  /** Percentage improvement (test vs control) */
  improvement: number;
  /** Statistical confidence level (0-1) */
  confidence: number;
  /** Whether the result is statistically significant (p < 0.05) */
  isSignificant: boolean;
}

/**
 * Result of a statistical test.
 * Includes honest assessment with Dutch explanations.
 */
export interface StatisticalTestResult {
  /** The test statistic value */
  testStatistic: number;
  /** The p-value from the test */
  pValue: number;
  /** Confidence level (1 - pValue) */
  confidence: number;
  /** Whether the result is statistically significant (p < 0.05) */
  isSignificant: boolean;
  /** Minimum sample size needed per group for reliable results */
  sampleSizeNeeded: number;
  /** Dutch explanation of the result */
  dutchExplanation: string;
}

/**
 * Filters for querying experiments.
 */
export interface ExperimentFilters {
  status?: ExperimentStatus;
  limit?: number;
  offset?: number;
}

// Re-export Prisma enum
export type { ExperimentStatus };
