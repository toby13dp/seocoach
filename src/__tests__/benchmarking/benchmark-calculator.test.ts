/**
 * Benchmark Calculator Tests
 * Tests for /src/lib/benchmarking/benchmark-calculator.ts
 */

import { describe, test, expect } from 'bun:test';
import {
  calculateBenchmarkScore,
} from '@/lib/benchmarking/benchmark-calculator';
import { BENCHMARK_CATEGORY_LABELS, ALL_BENCHMARK_CATEGORIES, MIN_PEERS_FOR_ANONYMISATION } from '@/lib/benchmarking/types';

// ============================================================================
// CTR Score
// ============================================================================

describe('calculateBenchmarkScore — CTR', () => {
  test('CTR 7%+ yields 100', () => {
    expect(calculateBenchmarkScore('CTR', { ctr: 7 })).toBe(100);
    expect(calculateBenchmarkScore('CTR', { ctr: 10 })).toBe(100);
  });

  test('CTR 5% yields 80', () => {
    expect(calculateBenchmarkScore('CTR', { ctr: 5 })).toBe(80);
  });

  test('CTR 3% yields 50', () => {
    expect(calculateBenchmarkScore('CTR', { ctr: 3 })).toBe(50);
  });

  test('CTR 1% yields 20', () => {
    expect(calculateBenchmarkScore('CTR', { ctr: 1 })).toBe(20);
  });

  test('CTR 0% yields 0', () => {
    expect(calculateBenchmarkScore('CTR', { ctr: 0 })).toBe(0);
  });

  test('CTR uses clickThroughRate as alternative key', () => {
    expect(calculateBenchmarkScore('CTR', { clickThroughRate: 5 })).toBe(80);
  });
});

// ============================================================================
// Technical Health Score
// ============================================================================

describe('calculateBenchmarkScore — TECHNICAL_HEALTH', () => {
  test('100% health yields 100', () => {
    expect(calculateBenchmarkScore('TECHNICAL_HEALTH', { healthPercent: 100 })).toBe(100);
  });

  test('50% health yields 50', () => {
    expect(calculateBenchmarkScore('TECHNICAL_HEALTH', { healthPercent: 50 })).toBe(50);
  });

  test('0% health yields 0', () => {
    expect(calculateBenchmarkScore('TECHNICAL_HEALTH', { healthPercent: 0 })).toBe(0);
  });

  test('over 100 is capped at 100', () => {
    expect(calculateBenchmarkScore('TECHNICAL_HEALTH', { healthPercent: 150 })).toBe(100);
  });

  test('uses technicalHealth as alternative key', () => {
    expect(calculateBenchmarkScore('TECHNICAL_HEALTH', { technicalHealth: 75 })).toBe(75);
  });
});

// ============================================================================
// Publishing Frequency Score
// ============================================================================

describe('calculateBenchmarkScore — PUBLISHING_FREQUENCY', () => {
  test('12+ articles/month yields 100', () => {
    expect(calculateBenchmarkScore('PUBLISHING_FREQUENCY', { articlesPerMonth: 12 })).toBe(100);
    expect(calculateBenchmarkScore('PUBLISHING_FREQUENCY', { articlesPerMonth: 20 })).toBe(100);
  });

  test('8 articles/month yields 80', () => {
    expect(calculateBenchmarkScore('PUBLISHING_FREQUENCY', { articlesPerMonth: 8 })).toBe(80);
  });

  test('4 articles/month yields 50', () => {
    expect(calculateBenchmarkScore('PUBLISHING_FREQUENCY', { articlesPerMonth: 4 })).toBe(50);
  });

  test('1 article/month yields 20', () => {
    expect(calculateBenchmarkScore('PUBLISHING_FREQUENCY', { articlesPerMonth: 1 })).toBe(20);
  });

  test('0 articles/month yields 0', () => {
    expect(calculateBenchmarkScore('PUBLISHING_FREQUENCY', { articlesPerMonth: 0 })).toBe(0);
  });
});

// ============================================================================
// Content Growth Score
// ============================================================================

describe('calculateBenchmarkScore — CONTENT_GROWTH', () => {
  test('50%+ growth yields 100', () => {
    expect(calculateBenchmarkScore('CONTENT_GROWTH', { growthPercent: 50 })).toBe(100);
  });

  test('20% growth yields 70', () => {
    expect(calculateBenchmarkScore('CONTENT_GROWTH', { growthPercent: 20 })).toBe(70);
  });

  test('0% growth yields 0', () => {
    expect(calculateBenchmarkScore('CONTENT_GROWTH', { growthPercent: 0 })).toBe(0);
  });

  test('negative growth yields 0', () => {
    expect(calculateBenchmarkScore('CONTENT_GROWTH', { growthPercent: -10 })).toBe(0);
  });
});

// ============================================================================
// Conversion Rate Score
// ============================================================================

describe('calculateBenchmarkScore — CONVERSION_RATE', () => {
  test('5%+ conversion yields 100', () => {
    expect(calculateBenchmarkScore('CONVERSION_RATE', { conversionRate: 5 })).toBe(100);
  });

  test('3% conversion yields 70', () => {
    expect(calculateBenchmarkScore('CONVERSION_RATE', { conversionRate: 3 })).toBe(70);
  });

  test('0% conversion yields 0', () => {
    expect(calculateBenchmarkScore('CONVERSION_RATE', { conversionRate: 0 })).toBe(0);
  });
});

// ============================================================================
// Issue Resolution Speed Score
// ============================================================================

describe('calculateBenchmarkScore — ISSUE_RESOLUTION_SPEED', () => {
  test('100% resolution + 1 day yields high score', () => {
    const score = calculateBenchmarkScore('ISSUE_RESOLUTION_SPEED', {
      resolutionRate: 100,
      avgResolutionDays: 1,
    });
    expect(score).toBe(100);
  });

  test('50% resolution + 14 days yields moderate score', () => {
    const score = calculateBenchmarkScore('ISSUE_RESOLUTION_SPEED', {
      resolutionRate: 50,
      avgResolutionDays: 14,
    });
    expect(score).toBeGreaterThanOrEqual(30);
    expect(score).toBeLessThanOrEqual(60);
  });

  test('0% resolution yields low score', () => {
    const score = calculateBenchmarkScore('ISSUE_RESOLUTION_SPEED', {
      resolutionRate: 0,
      avgResolutionDays: 30,
    });
    expect(score).toBeLessThanOrEqual(15);
  });
});

// ============================================================================
// GEO Readiness Score
// ============================================================================

describe('calculateBenchmarkScore — GEO_READINESS', () => {
  test('100% GEO readiness yields 100', () => {
    expect(calculateBenchmarkScore('GEO_READINESS', { geoReadiness: 100 })).toBe(100);
  });

  test('0% GEO readiness yields 0', () => {
    expect(calculateBenchmarkScore('GEO_READINESS', { geoReadiness: 0 })).toBe(0);
  });

  test('uses geoScore as alternative key', () => {
    expect(calculateBenchmarkScore('GEO_READINESS', { geoScore: 60 })).toBe(60);
  });
});

// ============================================================================
// AI Visibility Score
// ============================================================================

describe('calculateBenchmarkScore — AI_VISIBILITY', () => {
  test('80%+ visibility yields 100', () => {
    expect(calculateBenchmarkScore('AI_VISIBILITY', { aiVisibility: 80 })).toBe(100);
  });

  test('0% visibility yields 0', () => {
    expect(calculateBenchmarkScore('AI_VISIBILITY', { aiVisibility: 0 })).toBe(0);
  });

  test('50% visibility yields ~60', () => {
    expect(calculateBenchmarkScore('AI_VISIBILITY', { aiVisibility: 50 })).toBe(60);
  });
});

// ============================================================================
// Organic Growth Score
// ============================================================================

describe('calculateBenchmarkScore — ORGANIC_GROWTH', () => {
  test('30%+ growth yields 100', () => {
    expect(calculateBenchmarkScore('ORGANIC_GROWTH', { organicGrowth: 30 })).toBe(100);
  });

  test('0% growth yields 0', () => {
    expect(calculateBenchmarkScore('ORGANIC_GROWTH', { organicGrowth: 0 })).toBe(0);
  });

  test('negative growth yields 0', () => {
    expect(calculateBenchmarkScore('ORGANIC_GROWTH', { organicGrowth: -5 })).toBe(0);
  });
});

// ============================================================================
// Publication Speed Score
// ============================================================================

describe('calculateBenchmarkScore — PUBLICATION_SPEED', () => {
  test('1 day yields 100', () => {
    expect(calculateBenchmarkScore('PUBLICATION_SPEED', { avgDaysToPublish: 1 })).toBe(100);
  });

  test('7 days yields 70', () => {
    expect(calculateBenchmarkScore('PUBLICATION_SPEED', { avgDaysToPublish: 7 })).toBe(70);
  });

  test('30+ days yields 0', () => {
    expect(calculateBenchmarkScore('PUBLICATION_SPEED', { avgDaysToPublish: 30 })).toBeLessThanOrEqual(10);
    expect(calculateBenchmarkScore('PUBLICATION_SPEED', { avgDaysToPublish: 60 })).toBe(0);
  });
});

// ============================================================================
// Constants
// ============================================================================

describe('Benchmark constants', () => {
  test('ALL_BENCHMARK_CATEGORIES has 10 categories', () => {
    expect(ALL_BENCHMARK_CATEGORIES.length).toBe(10);
  });

  test('MIN_PEERS_FOR_ANONYMISATION is at least 5', () => {
    expect(MIN_PEERS_FOR_ANONYMISATION).toBeGreaterThanOrEqual(5);
  });

  test('all categories have Dutch labels', () => {
    for (const cat of ALL_BENCHMARK_CATEGORIES) {
      expect(BENCHMARK_CATEGORY_LABELS[cat]).toBeDefined();
      expect(typeof BENCHMARK_CATEGORY_LABELS[cat]).toBe('string');
      expect(BENCHMARK_CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    }
  });
});
