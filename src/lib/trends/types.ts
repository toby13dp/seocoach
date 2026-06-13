// ============================================================================
// Trends — Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for trend tracking and analysis.
// All user-facing text is in Dutch.
// ============================================================================

import type { TrendSourceType } from '@prisma/client';

/**
 * Dutch labels for trend source types.
 * Describes where a trend signal originates from.
 */
export const TREND_SOURCE_LABELS: Record<TrendSourceType, string> = {
  SEARCH_QUERY: 'Zoekquery',
  INTERNAL_SEARCH: 'Intern zoekverkeer',
  COMPETITOR_CHANGE: 'Concurrentiewijziging',
  REVIEW_THEME: 'Review-thema',
  NEWS_SOURCE: 'Nieuwsbron',
  REGULATION: 'Regelgeving',
  SEASONALITY: 'Seizoensgebondenheid',
  AI_PROMPT: 'AI-prompt',
};

/**
 * Dutch labels for trend directions.
 * Describes the direction of a detected trend.
 */
export const TREND_DIRECTION_LABELS: Record<string, string> = {
  rising: 'Stijgend',
  declining: 'Dalend',
  stable: 'Stabiel',
  seasonal: 'Seizoensgebonden',
};

/**
 * Dutch descriptions for trend directions.
 */
export const TREND_DIRECTION_DESCRIPTIONS: Record<string, string> = {
  rising: 'De trend stijgt — er is toenemende interesse of activiteit.',
  declining: 'De trend daalt — interesse of activiteit neemt af.',
  stable: 'De trend is stabiel — geen significante verandering.',
  seasonal: 'De trend volgt een seizoenspatroon — verwacht herhaling.',
};

/**
 * Filters for querying trend records.
 */
export interface TrendFilters {
  sourceType?: TrendSourceType;
  trendDirection?: string;
  keyword?: string;
  topic?: string;
  observedAfter?: Date;
  observedBefore?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Result of an internal search data import.
 */
export interface InternalSearchImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Result of keyword trend analysis.
 */
export interface KeywordTrendResult {
  keyword: string;
  direction: string;
  magnitude: number;
  description: string;
  evidence: Record<string, unknown>;
}

/**
 * Result of seasonal trend detection.
 */
export interface SeasonalTrendResult {
  keyword: string;
  pattern: string;
  peakMonth: number | null;
  troughMonth: number | null;
  description: string;
  evidence: Record<string, unknown>;
}

// Re-export Prisma enum
export type { TrendSourceType };
