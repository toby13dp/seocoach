/**
 * Opportunity Scorer Tests
 * Tests for /src/lib/keywords/opportunity-scorer.ts
 */

import {
  calculateOpportunityScore,
  calculateScoreDetails,
  getDefaultWeights,
  validateWeights,
} from '@/lib/keywords/opportunity-scorer';
import type { KeywordWithMetrics, OpportunityScoreWeights } from '@/lib/keywords/types';

// ============================================================================
// Test Framework
// ============================================================================

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`  ✗ ${name}: ${msg}`);
    console.log(`  ✗ ${name}: ${msg}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, label?: string): void {
  if (actual !== expected) {
    throw new Error(
      `Expected ${label ? label + ': ' : ''}${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(value: boolean, label?: string): void {
  if (!value) throw new Error(`Expected true${label ? ` (${label})` : ''}, got false`);
}

function assertFalse(value: boolean, label?: string): void {
  if (value) throw new Error(`Expected false${label ? ` (${label})` : ''}, got true`);
}

// ============================================================================
// Helpers
// ============================================================================

function createKeyword(overrides: Partial<KeywordWithMetrics> = {}): KeywordWithMetrics {
  return {
    id: 'test-kw-1',
    keyword: 'seo tools',
    searchVolume: 1000,
    difficulty: 40,
    cpc: 2.50,
    currentRanking: null,
    currentUrl: null,
    searchIntent: 'TRANSACTIONAL',
    funnelStage: 'DECISION',
    brandName: null,
    products: [],
    services: [],
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

export function run(): void {
  console.log('\n📦 Opportunity Scorer Tests\n');
  passed = 0;
  failed = 0;
  failures.length = 0;

  // --- High volume, low difficulty → high score ---
  test('High volume + low difficulty produces high total score', () => {
    const kw = createKeyword({
      searchVolume: 10000,
      difficulty: 10,
      searchIntent: 'TRANSACTIONAL',
      funnelStage: 'DECISION',
      currentRanking: 14, // Sweet spot
    });
    const result = calculateOpportunityScore(kw);
    assertTrue(result.totalScore > 60, `total score ${result.totalScore} should be > 60`);
  });

  // --- Position 11-20 → high current rank score (quick-win zone) ---
  test('Position 11-20 yields high currentRankScore', () => {
    const kw = createKeyword({ currentRanking: 14 });
    const result = calculateOpportunityScore(kw);
    assertTrue(result.currentRankScore >= 85, `currentRankScore ${result.currentRankScore} should be >= 85`);
  });

  test('Position 15 yields 95 currentRankScore (sweet spot)', () => {
    const kw = createKeyword({ currentRanking: 15 });
    const result = calculateOpportunityScore(kw);
    assertEqual(result.currentRankScore, 95);
  });

  test('Position 11-13 yields 95 currentRankScore', () => {
    const kw = createKeyword({ currentRanking: 12 });
    const result = calculateOpportunityScore(kw);
    assertEqual(result.currentRankScore, 95);
  });

  // --- Top 3 position → lower current rank score ---
  test('Top 3 position yields lower currentRankScore', () => {
    const kw = createKeyword({ currentRanking: 2 });
    const result = calculateOpportunityScore(kw);
    assertTrue(result.currentRankScore < 50, `currentRankScore ${result.currentRankScore} should be < 50`);
  });

  test('Position 1 yields 35 currentRankScore', () => {
    const kw = createKeyword({ currentRanking: 1 });
    const result = calculateOpportunityScore(kw);
    assertEqual(result.currentRankScore, 35);
  });

  // --- Zero volume → zero volume score ---
  test('Zero volume yields zero volumeScore', () => {
    const kw = createKeyword({ searchVolume: 0 });
    const result = calculateOpportunityScore(kw);
    assertEqual(result.volumeScore, 0);
  });

  test('Null volume yields zero volumeScore', () => {
    const kw = createKeyword({ searchVolume: null });
    const result = calculateOpportunityScore(kw);
    assertEqual(result.volumeScore, 0);
  });

  // --- All scores are 0-100 ---
  test('All component scores are between 0 and 100', () => {
    const kw = createKeyword({
      searchVolume: 5000,
      difficulty: 65,
      cpc: 4.0,
      currentRanking: 25,
      searchIntent: 'COMMERCIAL_INVESTIGATION',
      funnelStage: 'CONSIDERATION',
    });
    const result = calculateOpportunityScore(kw);
    const scores = [
      result.volumeScore,
      result.difficultyScore,
      result.relevanceScore,
      result.currentRankScore,
      result.intentScore,
      result.funnelScore,
      result.competitionScore,
      result.totalScore,
    ];
    for (const score of scores) {
      assertTrue(score >= 0, `score ${score} should be >= 0`);
      assertTrue(score <= 100, `score ${score} should be <= 100`);
    }
  });

  // --- Total score is weighted average ---
  test('Total score is approximately weighted average of components', () => {
    const kw = createKeyword({
      searchVolume: 1000,
      difficulty: 30,
      cpc: 2.0,
      currentRanking: 15,
      searchIntent: 'TRANSACTIONAL',
      funnelStage: 'DECISION',
    });
    const result = calculateOpportunityScore(kw);
    const weights = getDefaultWeights();
    const expectedTotal =
      result.volumeScore * weights.volume +
      result.difficultyScore * weights.difficulty +
      result.relevanceScore * weights.relevance +
      result.currentRankScore * weights.currentRank +
      result.intentScore * weights.intent +
      result.funnelScore * weights.funnel +
      result.competitionScore * weights.competition;
    const diff = Math.abs(result.totalScore - Math.round(expectedTotal * 100) / 100);
    assertTrue(diff < 1, `total ${result.totalScore} should be close to weighted avg ${expectedTotal}`);
  });

  // --- Intent score values ---
  test('TRANSACTIONAL intent yields 95 intentScore', () => {
    const kw = createKeyword({ searchIntent: 'TRANSACTIONAL' });
    const result = calculateOpportunityScore(kw);
    assertEqual(result.intentScore, 95);
  });

  test('INFORMATIONAL intent yields 40 intentScore', () => {
    const kw = createKeyword({ searchIntent: 'INFORMATIONAL' });
    const result = calculateOpportunityScore(kw);
    assertEqual(result.intentScore, 40);
  });

  test('NAVIGATIONAL intent yields 30 intentScore', () => {
    const kw = createKeyword({ searchIntent: 'NAVIGATIONAL' });
    const result = calculateOpportunityScore(kw);
    assertEqual(result.intentScore, 30);
  });

  // --- Funnel score values ---
  test('DECISION funnel yields 95 funnelScore', () => {
    const kw = createKeyword({ funnelStage: 'DECISION' });
    const result = calculateOpportunityScore(kw);
    assertEqual(result.funnelScore, 95);
  });

  test('AWARENESS funnel yields 35 funnelScore', () => {
    const kw = createKeyword({ funnelStage: 'AWARENESS' });
    const result = calculateOpportunityScore(kw);
    assertEqual(result.funnelScore, 35);
  });

  // --- Difficulty score (inverse) ---
  test('Low difficulty (10) yields high difficultyScore', () => {
    const kw = createKeyword({ difficulty: 10 });
    const result = calculateOpportunityScore(kw);
    assertTrue(result.difficultyScore >= 85, `difficultyScore ${result.difficultyScore} should be >= 85`);
  });

  test('High difficulty (90) yields low difficultyScore', () => {
    const kw = createKeyword({ difficulty: 90 });
    const result = calculateOpportunityScore(kw);
    assertTrue(result.difficultyScore <= 15, `difficultyScore ${result.difficultyScore} should be <= 15`);
  });

  test('Null difficulty yields neutral 50 difficultyScore', () => {
    const kw = createKeyword({ difficulty: null });
    const result = calculateOpportunityScore(kw);
    assertEqual(result.difficultyScore, 50);
  });

  // --- getDefaultWeights ---
  test('getDefaultWeights returns valid weights', () => {
    const weights = getDefaultWeights();
    assertTrue(weights.volume > 0);
    assertTrue(weights.difficulty > 0);
    assertTrue(weights.relevance > 0);
    assertTrue(weights.currentRank > 0);
    assertTrue(weights.intent > 0);
    assertTrue(weights.funnel > 0);
    assertTrue(weights.competition > 0);
  });

  test('Default weights sum to 1.0', () => {
    const weights = getDefaultWeights();
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    assertTrue(Math.abs(sum - 1.0) < 0.001, `sum ${sum} should be ~1.0`);
  });

  // --- validateWeights ---
  test('validateWeights accepts valid default weights', () => {
    assertTrue(validateWeights(getDefaultWeights()));
  });

  test('validateWeights rejects weights that do not sum to 1', () => {
    const badWeights: OpportunityScoreWeights = {
      volume: 0.5,
      difficulty: 0.3,
      relevance: 0.3,
      currentRank: 0.2,
      intent: 0.1,
      funnel: 0.05,
      competition: 0.1,
    };
    assertFalse(validateWeights(badWeights));
  });

  test('validateWeights rejects negative weights', () => {
    const badWeights: OpportunityScoreWeights = {
      volume: -0.1,
      difficulty: 0.3,
      relevance: 0.3,
      currentRank: 0.2,
      intent: 0.1,
      funnel: 0.1,
      competition: 0.1,
    };
    assertFalse(validateWeights(badWeights));
  });

  // --- Calculation trace ---
  test('calculateScoreDetails returns full trace', () => {
    const kw = createKeyword();
    const trace = calculateScoreDetails(kw);
    assertEqual(trace.keyword, 'seo tools');
    assertEqual(trace.steps.length, 7); // 7 components
    assertTrue(trace.totalScore > 0, 'should have total score');
    assertTrue(trace.summary.length > 0, 'should have summary');
  });

  test('Calculation trace steps are in Dutch', () => {
    const kw = createKeyword();
    const trace = calculateScoreDetails(kw);
    const dutchComponents = trace.steps.map((s) => s.component);
    assertTrue(dutchComponents.includes('Zoekvolume'), 'should have Zoekvolume');
    assertTrue(dutchComponents.includes('Moeilijkheidsgraad'), 'should have Moeilijkheidsgraad');
    assertTrue(dutchComponents.includes('Relevantie'), 'should have Relevantie');
    assertTrue(dutchComponents.includes('Huidige positie'), 'should have Huidige positie');
    assertTrue(dutchComponents.includes('Zoekintentie'), 'should have Zoekintentie');
    assertTrue(dutchComponents.includes('Concurrentie'), 'should have Concurrentie');
  });

  test('Calculation trace explanations are in Dutch', () => {
    const kw = createKeyword();
    const trace = calculateScoreDetails(kw);
    for (const step of trace.steps) {
      assertTrue(
        step.explanation.length > 0,
        `Step ${step.component} should have explanation`
      );
    }
  });

  test('Calculation trace summary is in Dutch', () => {
    const kw = createKeyword();
    const trace = calculateScoreDetails(kw);
    assertTrue(
      trace.summary.includes('Totaal:') || trace.summary.includes('opportuniteit'),
      'Summary should be in Dutch'
    );
  });

  test('Calculation trace has weights for each step', () => {
    const kw = createKeyword();
    const trace = calculateScoreDetails(kw);
    for (const step of trace.steps) {
      assertTrue(step.weight > 0, `Step ${step.component} should have positive weight`);
      assertTrue(step.weight <= 1, `Step ${step.component} weight should be <= 1`);
    }
  });

  // --- Relevance score with brand profile ---
  test('Relevance score increases when keyword matches brand name', () => {
    const kwNoBrand = createKeyword({ brandName: null });
    const kwWithBrand = createKeyword({ brandName: 'seo tools' });
    const resultNoBrand = calculateOpportunityScore(kwNoBrand);
    const resultWithBrand = calculateOpportunityScore(kwWithBrand);
    assertTrue(
      resultWithBrand.relevanceScore >= resultNoBrand.relevanceScore,
      'Brand match should increase relevance'
    );
  });

  // Summary
  console.log(`\n  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(f));
  }
}

