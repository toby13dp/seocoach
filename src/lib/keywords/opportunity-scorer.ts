// ============================================================================
// Keyword Management — Opportunity Scorer
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Calculates opportunity scores for keywords based on multiple weighted components.
// Each component is scored 0-100 and the total is a weighted average.
// Full calculation traces in Dutch provide transparency and explainability.
// ============================================================================

import { db } from '@/lib/db';
import type {
  KeywordWithMetrics,
  OpportunityScoreWeights,
  ScoreResult,
  ScoreCalculationTrace,
  ScoreCalculationStep,
  SearchIntent,
  FunnelStage,
} from './types';

// ============================================================================
// Default Weights
// ============================================================================

/**
 * Default weights for opportunity score calculation.
 *
 * The weights reflect the SEOCoach philosophy:
 * - Current ranking position (20%) is the strongest signal — keywords already
 *   ranking on page 2 (position 11-20) have the highest quick-win potential.
 * - Search volume (25%) is important but uses diminishing returns to avoid
 *   over-valuing high-volume keywords with low relevance.
 * - Difficulty (15%) and relevance (15%) balance opportunity vs. feasibility.
 * - Intent (10%) and competition (10%) account for business value signals.
 * - Funnel stage (5%) provides a small bonus for decision-stage keywords.
 */
const DEFAULT_WEIGHTS: OpportunityScoreWeights = {
  volume: 0.25,
  difficulty: 0.15,
  relevance: 0.15,
  currentRank: 0.20,
  intent: 0.10,
  funnel: 0.05,
  competition: 0.10,
};

// ============================================================================
// Weight Validation
// ============================================================================

/**
 * Get the default opportunity score weights.
 *
 * @returns A copy of the default weights
 *
 * @example
 * ```typescript
 * const weights = getDefaultWeights();
 * // { volume: 0.25, difficulty: 0.15, relevance: 0.15, currentRank: 0.20, intent: 0.10, funnel: 0.05, competition: 0.10 }
 * ```
 */
export function getDefaultWeights(): OpportunityScoreWeights {
  return { ...DEFAULT_WEIGHTS };
}

/**
 * Validate that opportunity score weights are valid.
 *
 * Checks that:
 * - All weight values are between 0 and 1
 * - The sum of all weights equals 1.0 (with a small tolerance for floating-point)
 * - No weight is NaN
 *
 * @param weights - The weights to validate
 * @returns true if the weights are valid
 *
 * @example
 * ```typescript
 * validateWeights({ volume: 0.25, difficulty: 0.15, relevance: 0.15, currentRank: 0.20, intent: 0.10, funnel: 0.05, competition: 0.10 });
 * // true
 *
 * validateWeights({ volume: 0.5, difficulty: 0.3, relevance: 0.3, currentRank: 0.2, intent: 0.1, funnel: 0.05, competition: 0.1 });
 * // false (sum > 1.0)
 * ```
 */
export function validateWeights(weights: OpportunityScoreWeights): boolean {
  const values = [
    weights.volume,
    weights.difficulty,
    weights.relevance,
    weights.currentRank,
    weights.intent,
    weights.funnel,
    weights.competition,
  ];

  // Check all values are between 0 and 1
  for (const value of values) {
    if (isNaN(value) || value < 0 || value > 1) {
      return false;
    }
  }

  // Check sum equals 1.0 (with floating-point tolerance)
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1.0) < 0.001;
}

// ============================================================================
// Component Scoring Functions
// ============================================================================

/**
 * Calculate the search volume component score.
 *
 * Uses a logarithmic scale with diminishing returns:
 * - 0 volume → 0 points (no traffic potential)
 * - 10-100 → 20-40 points (low volume, niche)
 * - 100-1000 → 40-70 points (moderate volume, good potential)
 * - 1000-10000 → 70-90 points (high volume, strong potential)
 * - 10000+ → 90-100 points (very high volume, capped to avoid over-valuation)
 *
 * @param volume - Monthly search volume, or null if unknown
 * @returns Score between 0 and 100
 */
function calculateVolumeScore(volume: number | null): number {
  if (volume === null || volume === 0) return 0;

  // Logarithmic scale with diminishing returns
  // log10(10) = 1, log10(100) = 2, log10(1000) = 3, log10(10000) = 4
  const logVolume = Math.log10(Math.max(1, volume));

  // Map log scale to 0-100 range
  // log10(1) = 0 → score 10 (even tiny volume has some value)
  // log10(10) = 1 → score ~30
  // log10(100) = 2 → score ~50
  // log10(1000) = 3 → score ~72
  // log10(10000) = 4 → score ~90
  // log10(100000) = 5 → score ~100 (capped)
  const score = Math.min(100, Math.max(0, 10 + logVolume * 20));

  return Math.round(score * 100) / 100;
}

/**
 * Calculate the difficulty component score.
 *
 * Lower difficulty = higher score (easier to rank):
 * - 0-20 → 90-100 (very easy)
 * - 20-40 → 70-90 (easy)
 * - 40-60 → 40-70 (moderate)
 * - 60-80 → 15-40 (hard)
 * - 80-100 → 0-15 (very hard)
 *
 * @param difficulty - Keyword difficulty score (0-100), or null if unknown
 * @returns Score between 0 and 100
 */
function calculateDifficultyScore(difficulty: number | null): number {
  if (difficulty === null) return 50; // Neutral default when unknown

  // Inverse relationship: lower difficulty = higher score
  const score = Math.max(0, 100 - difficulty);

  return Math.round(score * 100) / 100;
}

/**
 * Calculate the relevance component score.
 *
 * Based on how well the keyword matches the project's brand name,
 * products, and services. Uses simple string matching and word overlap.
 *
 * @param keyword - The keyword phrase
 * @param brandName - The brand name from the brand profile
 * @param products - Array of product terms from the brand profile
 * @param services - Array of service terms from the brand profile
 * @returns Score between 0 and 100
 */
function calculateRelevanceScore(
  keyword: string,
  brandName?: string | null,
  products?: string[],
  services?: string[]
): number {
  const normalizedKeyword = keyword.toLowerCase().trim();
  const keywordWords = normalizedKeyword.split(/\s+/);

  let matchScore = 0;
  let maxPossible = 0;

  // Check brand name match
  if (brandName && brandName.trim().length > 0) {
    maxPossible += 30;
    const normalizedBrand = brandName.toLowerCase().trim();
    if (normalizedKeyword.includes(normalizedBrand)) {
      matchScore += 30; // Full brand name in keyword
    } else {
      const brandWords = normalizedBrand.split(/\s+/);
      const brandWordMatches = brandWords.filter((bw) =>
        keywordWords.some((kw) => kw.includes(bw) || bw.includes(kw))
      ).length;
      matchScore += Math.round((brandWordMatches / brandWords.length) * 30);
    }
  }

  // Check product matches
  if (products && products.length > 0) {
    maxPossible += 40;
    let productMatches = 0;
    for (const product of products) {
      const normalizedProduct = product.toLowerCase().trim();
      if (normalizedKeyword.includes(normalizedProduct)) {
        productMatches++;
      } else {
        const productWords = normalizedProduct.split(/\s+/);
        const wordMatches = productWords.filter((pw) =>
          keywordWords.some((kw) => kw === pw)
        ).length;
        if (wordMatches > 0) {
          productMatches += wordMatches / productWords.length;
        }
      }
    }
    const productRatio = Math.min(1, productMatches / Math.min(3, products.length));
    matchScore += Math.round(productRatio * 40);
  }

  // Check service matches
  if (services && services.length > 0) {
    maxPossible += 30;
    let serviceMatches = 0;
    for (const service of services) {
      const normalizedService = service.toLowerCase().trim();
      if (normalizedKeyword.includes(normalizedService)) {
        serviceMatches++;
      } else {
        const serviceWords = normalizedService.split(/\s+/);
        const wordMatches = serviceWords.filter((sw) =>
          keywordWords.some((kw) => kw === sw)
        ).length;
        if (wordMatches > 0) {
          serviceMatches += wordMatches / serviceWords.length;
        }
      }
    }
    const serviceRatio = Math.min(1, serviceMatches / Math.min(3, services.length));
    matchScore += Math.round(serviceRatio * 30);
  }

  // If no brand profile data is available, give a neutral score
  if (maxPossible === 0) return 50;

  // Normalize to 0-100 scale
  const score = Math.round((matchScore / maxPossible) * 100);
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate the current ranking position component score.
 *
 * Keywords ranking on page 2 (positions 11-20) have the highest opportunity
 * because they need the least effort to move to page 1:
 * - Position 1-3 → 30-40 (already ranking well, limited upside)
 * - Position 4-10 → 50-70 (good, but already on page 1)
 * - Position 11-20 → 80-100 (sweet spot — page 2, easy push to page 1)
 * - Position 21-50 → 50-70 (needs more effort)
 * - Position 51-100 → 20-50 (far from page 1)
 * - Not ranking → 10 (unknown potential)
 *
 * @param currentRanking - Current ranking position, or null if not ranking
 * @returns Score between 0 and 100
 */
function calculateCurrentRankScore(currentRanking: number | null): number {
  if (currentRanking === null || currentRanking === 0) return 10;

  if (currentRanking <= 3) return 35;
  if (currentRanking <= 10) return 60;
  if (currentRanking <= 15) return 95; // Sweet spot
  if (currentRanking <= 20) return 85;
  if (currentRanking <= 30) return 60;
  if (currentRanking <= 50) return 45;
  if (currentRanking <= 100) return 25;

  return 10; // Very far from page 1
}

/**
 * Calculate the search intent component score.
 *
 * Transactional and commercial investigation keywords have higher
 * business value because they indicate readiness to convert:
 * - TRANSACTIONAL → 95 (highest business value)
 * - COMMERCIAL_INVESTIGATION → 85 (high value, comparison stage)
 * - LOCAL → 75 (local intent often leads to visits/calls)
 * - BRANDED → 60 (brand-aware, moderate value)
 * - NAVIGATIONAL → 30 (low business value unless it's your brand)
 * - INFORMATIONAL → 40 (awareness, long-term value)
 * - UNKNOWN → 50 (neutral)
 *
 * @param intent - The classified search intent
 * @returns Score between 0 and 100
 */
function calculateIntentScore(intent: SearchIntent): number {
  switch (intent) {
    case 'TRANSACTIONAL':
      return 95;
    case 'COMMERCIAL_INVESTIGATION':
      return 85;
    case 'LOCAL':
      return 75;
    case 'BRANDED':
      return 60;
    case 'INFORMATIONAL':
      return 40;
    case 'NAVIGATIONAL':
      return 30;
    case 'UNKNOWN':
    default:
      return 50;
  }
}

/**
 * Calculate the funnel stage component score.
 *
 * Decision-stage keywords are most valuable because they indicate
 * imminent conversion:
 * - DECISION → 95 (ready to buy/convert)
 * - CONSIDERATION → 70 (evaluating options)
 * - AWARENESS → 35 (early research, long-term value)
 * - RETENTION → 60 (existing customer, retention value)
 * - UNKNOWN → 50 (neutral)
 *
 * @param funnelStage - The marketing funnel stage
 * @returns Score between 0 and 100
 */
function calculateFunnelScore(funnelStage: FunnelStage): number {
  switch (funnelStage) {
    case 'DECISION':
      return 95;
    case 'RETENTION':
      return 60;
    case 'CONSIDERATION':
      return 70;
    case 'AWARENESS':
      return 35;
    case 'UNKNOWN':
    default:
      return 50;
  }
}

/**
 * Calculate the competition component score.
 *
 * Based on the combination of CPC and difficulty:
 * - High CPC + low difficulty = great opportunity (high value, easy to rank)
 * - Low CPC + high difficulty = poor opportunity (low value, hard to rank)
 * - Moderate values = moderate opportunity
 *
 * @param cpc - Cost per click in EUR, or null if unknown
 * @param difficulty - Keyword difficulty (0-100), or null if unknown
 * @returns Score between 0 and 100
 */
function calculateCompetitionScore(
  cpc: number | null,
  difficulty: number | null
): number {
  // CPC score: higher CPC = higher commercial value
  let cpcScore: number;
  if (cpc === null || cpc === 0) {
    cpcScore = 40; // Neutral when unknown
  } else {
    // Scale: €0 = 20, €1 = 50, €3 = 70, €5+ = 90
    cpcScore = Math.min(100, 20 + Math.log10(Math.max(0.01, cpc)) * 35 + 15);
  }

  // Difficulty factor: lower difficulty = higher opportunity
  let diffFactor: number;
  if (difficulty === null) {
    diffFactor = 0.5; // Neutral factor when unknown
  } else {
    // 0 difficulty → 1.0 factor, 50 → 0.5, 100 → 0.1
    diffFactor = Math.max(0.1, 1 - difficulty / 110);
  }

  // Combine: high CPC score scaled by difficulty factor
  const score = Math.min(100, cpcScore * diffFactor);

  return Math.round(score * 100) / 100;
}

// ============================================================================
// Dutch Explanation Generators
// ============================================================================

/**
 * Generate a Dutch explanation for the volume score.
 *
 * @param volume - Search volume
 * @param score - Calculated score
 * @returns Dutch explanation string
 */
function explainVolumeScore(volume: number | null, score: number): string {
  if (volume === null || volume === 0) {
    return `Zoekvolume: onbekend of nul. Score: ${score}/100 (geen zoekvolume beschikbaar, onzeker potentieel).`;
  }

  let level: string;
  if (volume < 10) {
    level = 'zeer laag volume, beperkt verkeerpotentieel';
  } else if (volume < 100) {
    level = 'laag volume, niche-zoekwoord';
  } else if (volume < 1000) {
    level = 'gemiddeld volume, goed potentieel';
  } else if (volume < 10000) {
    level = 'hoog volume, goede potentie';
  } else {
    level = 'zeer hoog volume, sterk potentieel (let op: afnemend rendement)';
  }

  return `Zoekvolume: ${volume.toLocaleString('nl-NL')} zoekopdrachten per maand. Score: ${score}/100 (${level}).`;
}

/**
 * Generate a Dutch explanation for the difficulty score.
 *
 * @param difficulty - Keyword difficulty
 * @param score - Calculated score
 * @returns Dutch explanation string
 */
function explainDifficultyScore(
  difficulty: number | null,
  score: number
): string {
  if (difficulty === null) {
    return `Moeilijkheidsgraad: onbekend. Score: ${score}/100 (neutrale score bij ontbrekende data).`;
  }

  let level: string;
  if (difficulty < 20) {
    level = 'zeer makkelijk om op te ranken';
  } else if (difficulty < 40) {
    level = 'makkelijk om op te ranken';
  } else if (difficulty < 60) {
    level = 'gemiddelde moeilijkheid';
  } else if (difficulty < 80) {
    level = 'moeilijk om op te ranken';
  } else {
    level = 'zeer moeilijk om op te ranken';
  }

  return `Moeilijkheidsgraad: ${difficulty}/100. Score: ${score}/100 (${level}).`;
}

/**
 * Generate a Dutch explanation for the relevance score.
 *
 * @param keyword - The keyword
 * @param score - Calculated score
 * @param brandName - Brand name
 * @param products - Products
 * @param services - Services
 * @returns Dutch explanation string
 */
function explainRelevanceScore(
  keyword: string,
  score: number,
  brandName?: string | null,
  products?: string[],
  services?: string[]
): string {
  const matchDetails: string[] = [];

  if (brandName && keyword.toLowerCase().includes(brandName.toLowerCase())) {
    matchDetails.push('komt overeen met merknaam');
  }

  if (products && products.length > 0) {
    const matchingProducts = products.filter((p) =>
      keyword.toLowerCase().includes(p.toLowerCase())
    );
    if (matchingProducts.length > 0) {
      matchDetails.push(`komt overeen met product${matchingProducts.length > 1 ? 'en' : ''}: ${matchingProducts.join(', ')}`);
    }
  }

  if (services && services.length > 0) {
    const matchingServices = services.filter((s) =>
      keyword.toLowerCase().includes(s.toLowerCase())
    );
    if (matchingServices.length > 0) {
      matchDetails.push(`komt overeen met dienst${matchingServices.length > 1 ? 'en' : ''}: ${matchingServices.join(', ')}`);
    }
  }

  if (matchDetails.length === 0) {
    if (!brandName && (!products || products.length === 0) && (!services || services.length === 0)) {
      return `Relevantie: ${score}/100 (geen merkprofiel beschikbaar, neutrale score).`;
    }
    return `Relevantie: ${score}/100 (geen directe overeenkomst met merk, producten of diensten gevonden).`;
  }

  return `Relevantie: ${score}/100 (zoekwoord ${matchDetails.join('; ')}).`;
}

/**
 * Generate a Dutch explanation for the current rank score.
 *
 * @param currentRanking - Current ranking position
 * @param score - Calculated score
 * @returns Dutch explanation string
 */
function explainCurrentRankScore(
  currentRanking: number | null,
  score: number
): string {
  if (currentRanking === null || currentRanking === 0) {
    return `Huidige positie: niet gevonden. Score: ${score}/100 (potentieel aanwezig maar onbekend).`;
  }

  let explanation: string;
  if (currentRanking <= 3) {
    explanation = 'al top 3, beperkte extra winst mogelijk';
  } else if (currentRanking <= 10) {
    explanation = 'al op pagina 1, focus op hogere positie';
  } else if (currentRanking <= 20) {
    explanation = 'op pagina 2 — maximale opportuniteit! Klein duwtje naar pagina 1 kan veel opleveren';
  } else if (currentRanking <= 50) {
    explanation = 'verder van pagina 1, meer inspanning nodig maar haalbaar';
  } else {
    explanation = 'ver buiten top 50, aanzienlijke inspanning vereist';
  }

  return `Huidige positie: #${currentRanking}. Score: ${score}/100 (${explanation}).`;
}

/**
 * Generate a Dutch explanation for the intent score.
 *
 * @param intent - Search intent
 * @param score - Calculated score
 * @returns Dutch explanation string
 */
function explainIntentScore(intent: SearchIntent, score: number): string {
  const descriptions: Record<SearchIntent, string> = {
    TRANSACTIONAL: 'zoekintentie is transactioneel — gebruiker wil kopen, hoogste bedrijfswaarde',
    COMMERCIAL_INVESTIGATION: 'zoekintentie is vergelijkend onderzoek — gebruiker overweegt een aankoop',
    LOCAL: 'zoekintentie is lokaal — gebruiker zoekt in de buurt, hoge conversiekans',
    BRANDED: 'zoekintentie is merk-gerelateerd — gebruiker kent het merk al',
    INFORMATIONAL: 'zoekintentie is informatief — gebruiker zoekt informatie, lange-termijn waarde',
    NAVIGATIONAL: 'zoekintentie is navigatie — gebruiker zoekt een specifieke website',
    UNKNOWN: 'zoekintentie is onbekend — neutrale score toegekend',
  };

  return `Intentie: ${descriptions[intent]}. Score: ${score}/100.`;
}

/**
 * Generate a Dutch explanation for the funnel score.
 *
 * @param funnelStage - Funnel stage
 * @param score - Calculated score
 * @returns Dutch explanation string
 */
function explainFunnelScore(funnelStage: FunnelStage, score: number): string {
  const descriptions: Record<FunnelStage, string> = {
    DECISION: 'beslissingsfase — gebruiker is klaar om te converteren, hoogste waarde',
    CONSIDERATION: 'overwegingsfase — gebruiker evalueert opties, goede conversiekans',
    AWARENESS: 'bewustzijnsfase — gebruiker oriënteert zich, lange-termijn waarde',
    RETENTION: 'retentiefase — bestaande klant, herhaalaankoop-potentieel',
    UNKNOWN: 'funnelfase onbekend — neutrale score toegekend',
  };

  return `Funnel: ${descriptions[funnelStage]}. Score: ${score}/100.`;
}

/**
 * Generate a Dutch explanation for the competition score.
 *
 * @param cpc - Cost per click
 * @param difficulty - Keyword difficulty
 * @param score - Calculated score
 * @returns Dutch explanation string
 */
function explainCompetitionScore(
  cpc: number | null,
  difficulty: number | null,
  score: number
): string {
  const parts: string[] = [];

  if (cpc !== null && cpc > 0) {
    parts.push(`CPC: €${cpc.toFixed(2)}`);
  } else {
    parts.push('CPC: onbekend');
  }

  if (difficulty !== null) {
    parts.push(`moeilijkheid: ${difficulty}/100`);
  } else {
    parts.push('moeilijkheid: onbekend');
  }

  let verdict: string;
  if (score >= 70) {
    verdict = 'gunstige concurrentie-situatie, hoge commerciële waarde';
  } else if (score >= 40) {
    verdict = 'gemiddelde concurrentie, redelijke commerciële waarde';
  } else {
    verdict = 'stevige concurrentie of lage commerciële waarde';
  }

  return `Concurrentie: ${parts.join(', ')}. Score: ${score}/100 (${verdict}).`;
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Calculate the full opportunity score for a keyword.
 *
 * Each component is scored independently on a 0-100 scale, then combined
 * using the provided (or default) weights to produce the total score.
 *
 * Handles edge cases:
 * - Null/zero values: neutral default scores are applied
 * - Missing brand profile data: relevance defaults to 50 (neutral)
 * - All components are calculated independently and are fully explainable
 *
 * @param keyword - The keyword with all available metrics
 * @param customWeights - Optional custom weights (defaults are used if not provided)
 * @returns Score result with total and component scores
 *
 * @example
 * ```typescript
 * const result = calculateOpportunityScore({
 *   id: 'kw-1',
 *   keyword: 'seo tools kopen',
 *   searchVolume: 1200,
 *   difficulty: 45,
 *   cpc: 3.50,
 *   currentRanking: 14,
 *   currentUrl: 'https://example.com/seo-tools',
 *   searchIntent: 'TRANSACTIONAL',
 *   funnelStage: 'DECISION',
 *   brandName: 'SEOCoach',
 *   products: ['seo tools', 'seo software'],
 *   services: ['seo consulting'],
 * });
 * // { totalScore: 78.5, volumeScore: 72, difficultyScore: 55, ... }
 * ```
 */
export function calculateOpportunityScore(
  keyword: KeywordWithMetrics,
  customWeights?: OpportunityScoreWeights
): ScoreResult {
  const weights = customWeights ?? DEFAULT_WEIGHTS;

  const volumeScore = calculateVolumeScore(keyword.searchVolume);
  const difficultyScore = calculateDifficultyScore(keyword.difficulty);
  const relevanceScore = calculateRelevanceScore(
    keyword.keyword,
    keyword.brandName,
    keyword.products,
    keyword.services
  );
  const currentRankScore = calculateCurrentRankScore(keyword.currentRanking);
  const intentScore = calculateIntentScore(keyword.searchIntent);
  const funnelScore = calculateFunnelScore(keyword.funnelStage);
  const competitionScore = calculateCompetitionScore(
    keyword.cpc,
    keyword.difficulty
  );

  // Calculate weighted total
  const totalScore =
    volumeScore * weights.volume +
    difficultyScore * weights.difficulty +
    relevanceScore * weights.relevance +
    currentRankScore * weights.currentRank +
    intentScore * weights.intent +
    funnelScore * weights.funnel +
    competitionScore * weights.competition;

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    volumeScore: Math.round(volumeScore * 100) / 100,
    difficultyScore: Math.round(difficultyScore * 100) / 100,
    relevanceScore: Math.round(relevanceScore * 100) / 100,
    currentRankScore: Math.round(currentRankScore * 100) / 100,
    intentScore: Math.round(intentScore * 100) / 100,
    funnelScore: Math.round(funnelScore * 100) / 100,
    competitionScore: Math.round(competitionScore * 100) / 100,
  };
}

// ============================================================================
// Calculation Trace
// ============================================================================

/**
 * Calculate the opportunity score with a full calculation trace for transparency.
 *
 * The trace explains every step of the calculation in plain Dutch, making
 * the scoring system fully explainable to end users. This enables users to
 * understand why a keyword received its score and what factors contributed
 * most to the result.
 *
 * @param keyword - The keyword with all available metrics
 * @param customWeights - Optional custom weights
 * @returns Full calculation trace with Dutch explanations
 *
 * @example
 * ```typescript
 * const trace = calculateScoreDetails({
 *   id: 'kw-1',
 *   keyword: 'seo tools kopen',
 *   searchVolume: 1200,
 *   difficulty: 45,
 *   cpc: 3.50,
 *   currentRanking: 14,
 *   searchIntent: 'TRANSACTIONAL',
 *   funnelStage: 'DECISION',
 * });
 *
 * console.log(trace.summary);
 * // "Totaal: 78.5/100. Dit zoekwoord heeft een goede opportuniteit..."
 * ```
 */
export function calculateScoreDetails(
  keyword: KeywordWithMetrics,
  customWeights?: OpportunityScoreWeights
): ScoreCalculationTrace {
  const weights = customWeights ?? DEFAULT_WEIGHTS;
  const steps: ScoreCalculationStep[] = [];

  // Calculate and explain each component
  const volumeScore = calculateVolumeScore(keyword.searchVolume);
  steps.push({
    component: 'Zoekvolume',
    rawValue:
      keyword.searchVolume !== null
        ? keyword.searchVolume.toLocaleString('nl-NL')
        : 'onbekend',
    score: volumeScore,
    weight: weights.volume,
    explanation: explainVolumeScore(keyword.searchVolume, volumeScore),
  });

  const difficultyScore = calculateDifficultyScore(keyword.difficulty);
  steps.push({
    component: 'Moeilijkheidsgraad',
    rawValue:
      keyword.difficulty !== null
        ? `${keyword.difficulty}/100`
        : 'onbekend',
    score: difficultyScore,
    weight: weights.difficulty,
    explanation: explainDifficultyScore(keyword.difficulty, difficultyScore),
  });

  const relevanceScore = calculateRelevanceScore(
    keyword.keyword,
    keyword.brandName,
    keyword.products,
    keyword.services
  );
  steps.push({
    component: 'Relevantie',
    rawValue: keyword.keyword,
    score: relevanceScore,
    weight: weights.relevance,
    explanation: explainRelevanceScore(
      keyword.keyword,
      relevanceScore,
      keyword.brandName,
      keyword.products,
      keyword.services
    ),
  });

  const currentRankScore = calculateCurrentRankScore(keyword.currentRanking);
  steps.push({
    component: 'Huidige positie',
    rawValue:
      keyword.currentRanking !== null
        ? `#${keyword.currentRanking}`
        : 'niet gevonden',
    score: currentRankScore,
    weight: weights.currentRank,
    explanation: explainCurrentRankScore(keyword.currentRanking, currentRankScore),
  });

  const intentScore = calculateIntentScore(keyword.searchIntent);
  steps.push({
    component: 'Zoekintentie',
    rawValue: keyword.searchIntent,
    score: intentScore,
    weight: weights.intent,
    explanation: explainIntentScore(keyword.searchIntent, intentScore),
  });

  const funnelScore = calculateFunnelScore(keyword.funnelStage);
  steps.push({
    component: 'Funnel-fase',
    rawValue: keyword.funnelStage,
    score: funnelScore,
    weight: weights.funnel,
    explanation: explainFunnelScore(keyword.funnelStage, funnelScore),
  });

  const competitionScore = calculateCompetitionScore(
    keyword.cpc,
    keyword.difficulty
  );
  steps.push({
    component: 'Concurrentie',
    rawValue:
      keyword.cpc !== null
        ? `€${keyword.cpc.toFixed(2)} / ${keyword.difficulty ?? 'onbekend'}`
        : 'onbekend',
    score: competitionScore,
    weight: weights.competition,
    explanation: explainCompetitionScore(
      keyword.cpc,
      keyword.difficulty,
      competitionScore
    ),
  });

  // Calculate total
  const totalScore =
    volumeScore * weights.volume +
    difficultyScore * weights.difficulty +
    relevanceScore * weights.relevance +
    currentRankScore * weights.currentRank +
    intentScore * weights.intent +
    funnelScore * weights.funnel +
    competitionScore * weights.competition;

  const roundedTotal = Math.round(totalScore * 100) / 100;

  // Generate summary
  const summary = generateScoreSummary(keyword.keyword, roundedTotal, steps);

  return {
    keyword: keyword.keyword,
    weights,
    steps,
    totalScore: roundedTotal,
    summary,
  };
}

/**
 * Generate an overall Dutch summary for the opportunity score.
 *
 * @param keyword - The keyword being scored
 * @param totalScore - The final total score
 * @param steps - The individual calculation steps
 * @returns Dutch summary string
 */
function generateScoreSummary(
  keyword: string,
  totalScore: number,
  steps: ScoreCalculationStep[]
): string {
  // Find the strongest and weakest factors
  const weightedContributions = steps.map((step) => ({
    component: step.component,
    contribution: step.score * step.weight,
  }));

  weightedContributions.sort((a, b) => b.contribution - a.contribution);

  const strongest = weightedContributions[0];
  const weakest = weightedContributions[weightedContributions.length - 1];

  let verdict: string;
  if (totalScore >= 80) {
    verdict =
      'Uitstekende opportuniteit! Dit zoekwoord heeft hoge prioriteit voor optimalisatie.';
  } else if (totalScore >= 65) {
    verdict =
      'Goede opportuniteit. Dit zoekwoord verdient aandacht in uw SEO-strategie.';
  } else if (totalScore >= 50) {
    verdict =
      'Matige opportuniteit. Dit zoekwoord kan waarde bieden met gerichte inspanning.';
  } else if (totalScore >= 35) {
    verdict =
      'Beperkte opportuniteit. Alleen aanpakken als er weinig betere alternatieven zijn.';
  } else {
    verdict =
      'Lage opportuniteit. Dit zoekwoord is waarschijnlijk niet de beste inzet van uw tijd.';
  }

  return `Totaal: ${totalScore}/100 voor "${keyword}". ${verdict} Sterkste factor: ${strongest.component} (${Math.round(strongest.contribution * 100) / 100} punten bijgedragen). Zwakste factor: ${weakest.component} (${Math.round(weakest.contribution * 100) / 100} punten bijgedragen).`;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Calculate and save the opportunity score for a keyword to the database.
 *
 * Fetches brand profile data for the project, calculates the score,
 * and persists both the score and the full calculation trace.
 *
 * @param keywordId - The keyword ID to score
 * @param projectId - The project ID (for brand profile lookup)
 * @param customWeights - Optional custom weights
 * @returns The calculated score result
 */
export async function calculateAndSaveOpportunityScore(
  keywordId: string,
  projectId: string,
  customWeights?: OpportunityScoreWeights
): Promise<ScoreResult> {
  // Fetch the keyword
  const keyword = await db.keyword.findUnique({
    where: { id: keywordId },
  });

  if (!keyword) {
    throw new Error(`Keyword "${keywordId}" not found`);
  }

  // Fetch brand profile for relevance calculation
  const brandProfile = await db.brandProfile.findFirst({
    where: {
      projectId,
      deletedAt: null,
    },
  });

  // Parse brand profile data
  let products: string[] = [];
  let services: string[] = [];
  let brandName: string | null = null;

  if (brandProfile) {
    brandName = brandProfile.brandName;
    if (brandProfile.products) {
      try {
        products = JSON.parse(brandProfile.products);
      } catch {
        products = [];
      }
    }
    if (brandProfile.services) {
      try {
        services = JSON.parse(brandProfile.services);
      } catch {
        services = [];
      }
    }
  }

  // Build the keyword with metrics
  const keywordWithMetrics: KeywordWithMetrics = {
    id: keyword.id,
    keyword: keyword.keyword,
    searchVolume: keyword.searchVolume,
    difficulty: keyword.difficulty,
    cpc: keyword.cpc,
    currentRanking: keyword.currentRanking,
    currentUrl: keyword.currentUrl,
    searchIntent: keyword.searchIntent as SearchIntent,
    funnelStage: keyword.funnelStage as FunnelStage,
    brandName,
    products,
    services,
  };

  // Calculate the score
  const scoreResult = calculateOpportunityScore(keywordWithMetrics, customWeights);

  // Calculate the full trace
  const trace = calculateScoreDetails(keywordWithMetrics, customWeights);

  // Save to database (upsert)
  await db.opportunityScore.upsert({
    where: { keywordId: keyword.id },
    create: {
      keywordId: keyword.id,
      totalScore: scoreResult.totalScore,
      volumeScore: scoreResult.volumeScore,
      difficultyScore: scoreResult.difficultyScore,
      relevanceScore: scoreResult.relevanceScore,
      currentRankScore: scoreResult.currentRankScore,
      intentScore: scoreResult.intentScore,
      funnelScore: scoreResult.funnelScore,
      competitionScore: scoreResult.competitionScore,
      calculationDetails: JSON.stringify(trace),
      weightsVersion: '1.0',
    },
    update: {
      totalScore: scoreResult.totalScore,
      volumeScore: scoreResult.volumeScore,
      difficultyScore: scoreResult.difficultyScore,
      relevanceScore: scoreResult.relevanceScore,
      currentRankScore: scoreResult.currentRankScore,
      intentScore: scoreResult.intentScore,
      funnelScore: scoreResult.funnelScore,
      competitionScore: scoreResult.competitionScore,
      calculationDetails: JSON.stringify(trace),
      weightsVersion: '1.0',
      calculatedAt: new Date(),
    },
  });

  return scoreResult;
}

/**
 * Recalculate opportunity scores for all keywords in a project.
 *
 * Useful after updating brand profile data or changing weights.
 *
 * @param projectId - The project ID
 * @param customWeights - Optional custom weights
 * @returns Number of keywords scored
 */
export async function recalculateProjectScores(
  projectId: string,
  customWeights?: OpportunityScoreWeights
): Promise<number> {
  const keywords = await db.keyword.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: { id: true },
  });

  let scored = 0;

  for (const kw of keywords) {
    try {
      await calculateAndSaveOpportunityScore(kw.id, projectId, customWeights);
      scored++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[OpportunityScorer] Failed to score keyword "${kw.id}": ${msg}`
      );
    }
  }

  return scored;
}

/**
 * Get the calculation trace for a keyword's opportunity score.
 *
 * Retrieves the stored calculation details from the database and parses
 * them into a ScoreCalculationTrace object.
 *
 * @param keywordId - The keyword ID
 * @returns The calculation trace, or null if not found
 */
export async function getScoreTrace(
  keywordId: string
): Promise<ScoreCalculationTrace | null> {
  const score = await db.opportunityScore.findUnique({
    where: { keywordId },
  });

  if (!score || !score.calculationDetails) {
    return null;
  }

  try {
    return JSON.parse(score.calculationDetails) as ScoreCalculationTrace;
  } catch {
    return null;
  }
}
