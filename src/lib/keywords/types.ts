// ============================================================================
// Keyword Management — Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for keyword import, intent classification, and opportunity scoring.
// All user-facing explanations are in Dutch.
// ============================================================================

/** Search intent categories matching the Prisma SearchIntent enum */
export type SearchIntent =
  | 'INFORMATIONAL'
  | 'NAVIGATIONAL'
  | 'TRANSACTIONAL'
  | 'COMMERCIAL_INVESTIGATION'
  | 'LOCAL'
  | 'BRANDED'
  | 'UNKNOWN';

/** Funnel stage categories matching the Prisma FunnelStage enum */
export type FunnelStage =
  | 'AWARENESS'
  | 'CONSIDERATION'
  | 'DECISION'
  | 'RETENTION'
  | 'UNKNOWN';

/**
 * Represents a keyword entry to be imported into the system.
 * All fields except `keyword` are optional and will be populated
 * by classification or scoring if not provided.
 */
export interface KeywordImport {
  /** The keyword phrase (e.g. "seo tools nederland") */
  keyword: string;
  /** Monthly search volume */
  searchVolume?: number;
  /** Keyword difficulty score (0-100) */
  difficulty?: number;
  /** Cost per click in EUR */
  cpc?: number;
  /** Current ranking position (1-100+) */
  currentRanking?: number;
  /** URL currently ranking for this keyword */
  currentUrl?: string;
  /** Search intent classification */
  searchIntent?: SearchIntent;
  /** Marketing funnel stage */
  funnelStage?: FunnelStage;
  /** Group ID for keyword clustering */
  groupId?: string;
  /** User-defined tags */
  tags?: string[];
}

/**
 * Raw CSV row with flexible column names.
 * Column names are mapped from common variations during parsing.
 */
export interface KeywordCSVRow {
  keyword: string;
  search_volume?: string;
  difficulty?: string;
  cpc?: string;
  current_ranking?: string;
  current_url?: string;
  group?: string;
  tags?: string;
}

/**
 * Result of intent classification for a keyword.
 * Includes the classified intent, confidence level, and Dutch-language reasoning.
 */
export interface IntentClassificationResult {
  /** The classified search intent */
  intent: SearchIntent;
  /** Confidence score between 0 and 1 */
  confidence: number;
  /** Human-readable explanation in Dutch */
  reasoning: string;
  /** The marketing funnel stage associated with this intent */
  funnelStage: FunnelStage;
}

/**
 * Weights for the opportunity score calculation.
 * Each weight should be between 0 and 1, and all weights should sum to 1.0.
 */
export interface OpportunityScoreWeights {
  /** Weight for search volume component (default 0.25) */
  volume: number;
  /** Weight for keyword difficulty component (default 0.15) */
  difficulty: number;
  /** Weight for brand/service relevance component (default 0.15) */
  relevance: number;
  /** Weight for current ranking position component (default 0.20) */
  currentRank: number;
  /** Weight for search intent component (default 0.10) */
  intent: number;
  /** Weight for funnel stage component (default 0.05) */
  funnel: number;
  /** Weight for competition (CPC + difficulty) component (default 0.10) */
  competition: number;
}

/**
 * A keyword with all metrics needed for opportunity scoring.
 * Combines data from the Keyword, BrandProfile, and OpportunityScore models.
 */
export interface KeywordWithMetrics {
  /** Keyword ID */
  id: string;
  /** The keyword phrase */
  keyword: string;
  /** Monthly search volume */
  searchVolume: number | null;
  /** Keyword difficulty (0-100) */
  difficulty: number | null;
  /** Cost per click in EUR */
  cpc: number | null;
  /** Current ranking position */
  currentRanking: number | null;
  /** Current ranking URL */
  currentUrl: string | null;
  /** Search intent classification */
  searchIntent: SearchIntent;
  /** Marketing funnel stage */
  funnelStage: FunnelStage;
  /** Brand name from the project's brand profile */
  brandName?: string | null;
  /** Products from the project's brand profile (parsed from JSON) */
  products?: string[];
  /** Services from the project's brand profile (parsed from JSON) */
  services?: string[];
}

/**
 * Result of the opportunity score calculation.
 * Each component score is on a 0-100 scale.
 */
export interface ScoreResult {
  /** Total weighted opportunity score (0-100) */
  totalScore: number;
  /** Search volume component score (0-100) */
  volumeScore: number;
  /** Keyword difficulty component score (0-100) */
  difficultyScore: number;
  /** Brand/service relevance component score (0-100) */
  relevanceScore: number;
  /** Current ranking position component score (0-100) */
  currentRankScore: number;
  /** Search intent component score (0-100) */
  intentScore: number;
  /** Funnel stage component score (0-100) */
  funnelScore: number;
  /** Competition (CPC + difficulty) component score (0-100) */
  competitionScore: number;
}

/**
 * A single step in the calculation trace, explaining one component score.
 * Written in Dutch for end-user transparency.
 */
export interface ScoreCalculationStep {
  /** Name of the component (Dutch) */
  component: string;
  /** The raw value used */
  rawValue: string;
  /** The calculated score (0-100) */
  score: number;
  /** The weight applied */
  weight: number;
  /** Human-readable explanation in Dutch */
  explanation: string;
}

/**
 * Full calculation trace for an opportunity score.
 * Provides complete transparency into how each component was calculated,
 * enabling users to understand and trust the scoring system.
 */
export interface ScoreCalculationTrace {
  /** The keyword being scored */
  keyword: string;
  /** The weights used for calculation */
  weights: OpportunityScoreWeights;
  /** Individual calculation steps in order */
  steps: ScoreCalculationStep[];
  /** The final weighted total score */
  totalScore: number;
  /** Overall summary in Dutch */
  summary: string;
}

/**
 * Result of a keyword import operation.
 * Counts the keywords that were created, updated, or skipped.
 */
export interface ImportResult {
  /** Number of new keywords created */
  imported: number;
  /** Number of existing keywords updated */
  updated: number;
  /** Number of keywords skipped (duplicates with no changes) */
  skipped: number;
  /** List of validation errors encountered */
  errors: Array<{ keyword: string; errors: string[] }>;
}
