// ============================================================================
// AI Visibility — Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for AI visibility testing, prompt libraries, and result tracking.
// All user-facing text is in Dutch.
// ============================================================================

import type { AIVisibilityMethod, FunnelStage, SearchIntent } from '@prisma/client';

/**
 * Mandatory disclaimer for all local simulations.
 * Must be displayed whenever simulation results are shown.
 */
export const SIMULATION_DISCLAIMER =
  'Simulatie – geen bewijs van werkelijke externe AI-zichtbaarheid.';

/**
 * Configuration for an AI visibility test run.
 */
export interface AIVisibilityTestConfig {
  /** Which AI platform to test (e.g., "chatgpt", "gemini", "perplexity") */
  platform: string;
  /** Which model to use (e.g., "gpt-4o", "gemini-pro") */
  model?: string;
  /** Country code for the test (default: "NL") */
  country?: string;
  /** Language for the test (default: "nl-NL") */
  language?: string;
  /** Whether this is a local simulation (always requires disclaimer) */
  isSimulation?: boolean;
}

/**
 * Aggregated AI visibility metrics for a project.
 * Calculated from all visibility results.
 */
export interface AIVisibilityMetrics {
  /** Share of AI Voice: percentage of tests where brand is mentioned */
  shareOfAIVoice: number;
  /** Brand mention rate across all tests */
  brandMentionRate: number;
  /** Source mention rate: how often the brand's sources are cited */
  sourceMentionRate: number;
  /** Competitor mention rate: how often competitors are mentioned */
  competitorMentionRate: number;
  /** Average accuracy of brand mentions (0-1) */
  avgAccuracy: number;
  /** Average sentiment of mentions mapped to numeric (-1 to 1) */
  avgSentiment: number;
  /** Prompt coverage: percentage of prompts that have been tested */
  promptCoverage: number;
  /** Funnel coverage: percentage of funnel stages covered by tests */
  funnelCoverage: number;
  /** Total number of tests */
  totalTests: number;
  /** Number of tests where brand was mentioned */
  mentionedTests: number;
  /** Number of simulation tests */
  simulationTests: number;
}

/**
 * Default Dutch prompt suggestions for the Dutch market.
 * These prompts can be seeded into a new project's prompt library.
 */
export const DEFAULT_DUTCH_PROMPTS: Array<{
  name: string;
  prompt: string;
  funnelStage: FunnelStage;
  searchIntent: SearchIntent;
}> = [
  {
    name: 'Beste dienst in stad',
    prompt: 'Wat is de beste [dienst] in [stad]?',
    funnelStage: 'CONSIDERATION',
    searchIntent: 'COMMERCIAL_INVESTIGATION',
  },
  {
    name: 'Dienst vergelijken',
    prompt: 'Vergelijk [dienst A] en [dienst B] in Nederland.',
    funnelStage: 'CONSIDERATION',
    searchIntent: 'COMMERCIAL_INVESTIGATION',
  },
  {
    name: 'Hoe te beginnen',
    prompt: 'Hoe begin ik met [onderwerp] in Nederland?',
    funnelStage: 'AWARENESS',
    searchIntent: 'INFORMATIONAL',
  },
  {
    name: 'Wat is definitie',
    prompt: 'Wat is [begrip]?',
    funnelStage: 'AWARENESS',
    searchIntent: 'INFORMATIONAL',
  },
  {
    name: 'Tips en advies',
    prompt: 'Geef tips voor [onderwerp] in Nederland.',
    funnelStage: 'CONSIDERATION',
    searchIntent: 'INFORMATIONAL',
  },
  {
    name: 'Kosten en prijzen',
    prompt: 'Wat kost [dienst/product] in Nederland?',
    funnelStage: 'DECISION',
    searchIntent: 'TRANSACTIONAL',
  },
  {
    name: 'Lokale aanbeveling',
    prompt: 'Welke [dienst] aanbevelen jullie in [regio]?',
    funnelStage: 'DECISION',
    searchIntent: 'LOCAL',
  },
  {
    name: 'Probleem oplossen',
    prompt: 'Hoe los ik [probleem] op?',
    funnelStage: 'AWARENESS',
    searchIntent: 'INFORMATIONAL',
  },
  {
    name: 'Alternatieven vinden',
    prompt: 'Wat zijn goede alternatieven voor [product/dienst]?',
    funnelStage: 'CONSIDERATION',
    searchIntent: 'COMMERCIAL_INVESTIGATION',
  },
  {
    name: 'Review en ervaringen',
    prompt: 'Wat zijn ervaringen met [bedrijf/dienst] in Nederland?',
    funnelStage: 'DECISION',
    searchIntent: 'COMMERCIAL_INVESTIGATION',
  },
];

/**
 * Sentiment mapping to numeric values for aggregation.
 */
export const SENTIMENT_NUMERIC_MAP: Record<string, number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
  mixed: 0.5,
};

/**
 * Column mapping for AI visibility CSV import.
 * Supports both Dutch and English column headers.
 */
export const AI_VISIBILITY_CSV_COLUMNS: Record<string, string[]> = {
  prompt: ['prompt', 'vraag', 'zoekopdracht', 'query', 'question'],
  response: ['response', 'antwoord', 'answer', 'ai_response', 'ai_antwoord'],
  platform: ['platform', 'ai_platform', 'aiPlatform'],
  model: ['model', 'ai_model', 'aiModel'],
  date: ['date', 'datum', 'test_date', 'testdatum', 'test_date'],
  mentioned: ['mentioned', 'genoemd', 'brand_mentioned', 'merk_genoemd', 'is_mentioned'],
  urls: ['urls', 'url', 'mentioned_urls', 'genoemde_urls', 'links'],
  sources: ['sources', 'bronnen', 'mentioned_sources', 'genoemde_bronnen'],
  competitors: ['competitors', 'concurrenten', 'competitor_mentions', 'concurrent_vermeldingen'],
  sentiment: ['sentiment', 'stemming', 'tone'],
  accuracy: ['accuracy', 'nauwkeurigheid', 'accuracy_score'],
  confidence: ['confidence', 'zekerheid', 'confidence_score'],
  country: ['country', 'land'],
  language: ['language', 'taal', 'lang'],
};

/**
 * Result of a CSV import operation.
 */
export interface AIVisibilityImportResult {
  /** Number of results imported */
  imported: number;
  /** Number of results skipped */
  skipped: number;
  /** List of error messages (Dutch) */
  errors: string[];
  /** The import batch ID */
  batchId: string;
}

/**
 * Filters for querying AI visibility results.
 */
export interface AIVisibilityFilters {
  method?: AIVisibilityMethod;
  platform?: string;
  isMentioned?: boolean;
  isSimulation?: boolean;
  promptId?: string;
  clusterId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

// Re-export Prisma enums
export type { AIVisibilityMethod, FunnelStage, SearchIntent };
