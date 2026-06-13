/**
 * Statistical Analysis Engine Tests
 * Tests for /src/lib/experiments/statistics.ts
 *
 * All functions are PURE — no DB mocking needed.
 */

import { describe, test, expect } from 'bun:test';
import {
  calculateZTest,
  calculateTTest,
  calculateRequiredSampleSize,
  calculateImprovement,
  generateDutchConclusion,
} from '@/lib/experiments/statistics';
import type { StatisticalTestResult } from '@/lib/experiments/types';

// ============================================================================
// Test: calculateZTest — Two-proportion Z-test
// ============================================================================

describe('calculateZTest', () => {
  test('clear significant difference → low p-value and isSignificant=true', () => {
    // Test rate 15%, control 5%, large sample → clearly significant
    const result = calculateZTest(0.15, 0.05, 5000, 5000);

    expect(result.pValue).toBeLessThan(0.05);
    expect(result.isSignificant).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.95);
  });

  test('no difference → high p-value and isSignificant=false', () => {
    // Same rates → cannot be significant
    const result = calculateZTest(0.10, 0.10, 1000, 1000);

    expect(result.pValue).toBeGreaterThan(0.05);
    expect(result.isSignificant).toBe(false);
  });

  test('small sample → wider confidence interval (lower confidence)', () => {
    // 10% vs 15% with only 50 per group → may not reach significance
    const result = calculateZTest(0.15, 0.10, 50, 50);

    // Small sample sizes may not be significant even with a difference
    expect(result.sampleSizeNeeded).toBeGreaterThan(50);
  });

  test('zero control rate → handles edge case gracefully', () => {
    // Control rate is 0%, test is 5%
    const result = calculateZTest(0.05, 0.0, 1000, 1000);

    // Should not crash — return a valid result
    expect(result).toBeDefined();
    expect(typeof result.pValue).toBe('number');
    expect(typeof result.isSignificant).toBe('boolean');
  });

  test('equal rates → not significant', () => {
    const result = calculateZTest(0.08, 0.08, 500, 500);

    expect(result.isSignificant).toBe(false);
    expect(result.testStatistic).toBe(0);
  });

  test('invalid input (size <= 0) → returns safe default', () => {
    const result = calculateZTest(0.1, 0.05, 0, 100);

    expect(result.testStatistic).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.isSignificant).toBe(false);
    expect(result.dutchExplanation).toContain('groter zijn dan nul');
  });

  test('dutch explanation contains key statistical terms', () => {
    const result = calculateZTest(0.15, 0.10, 500, 500);

    expect(result.dutchExplanation).toContain('statistisch significant');
    expect(result.dutchExplanation).toMatch(/p=/);
    expect(result.dutchExplanation).toMatch(/betrouwbaarheid=/);
  });

  test('small sample caution included when sample < 100', () => {
    const result = calculateZTest(0.15, 0.10, 50, 50);

    expect(result.dutchExplanation).toContain('steekproefgrootte is mogelijk te klein');
  });
});

// ============================================================================
// Test: calculateTTest — Welch's t-test
// ============================================================================

describe('calculateTTest', () => {
  test('clear difference → significant', () => {
    // Large mean difference with reasonable variance
    const result = calculateTTest(150, 100, 20, 20, 500, 500);

    expect(result.isSignificant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
  });

  test('no difference → not significant', () => {
    // Same means → cannot be significant
    const result = calculateTTest(100, 100, 15, 15, 200, 200);

    expect(result.isSignificant).toBe(false);
    expect(result.pValue).toBeGreaterThan(0.05);
  });

  test('invalid input (size <= 1) → returns safe default', () => {
    const result = calculateTTest(100, 50, 10, 10, 1, 100);

    expect(result.testStatistic).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.isSignificant).toBe(false);
    expect(result.dutchExplanation).toContain('groter zijn dan 1');
  });

  test('negative standard deviation → returns safe default', () => {
    const result = calculateTTest(100, 50, -5, 10, 100, 100);

    expect(result.isSignificant).toBe(false);
    expect(result.dutchExplanation).toContain('negatief');
  });

  test('zero standard error (identical distributions) → not significant', () => {
    // Both groups have zero std dev → SE = 0
    const result = calculateTTest(100, 100, 0, 0, 200, 200);

    expect(result.isSignificant).toBe(false);
    expect(result.dutchExplanation).toContain('identieke verdelingen');
  });
});

// ============================================================================
// Test: calculateRequiredSampleSize
// ============================================================================

describe('calculateRequiredSampleSize', () => {
  test('returns reasonable sample sizes for typical inputs', () => {
    // 10% baseline, 5% absolute improvement
    const n = calculateRequiredSampleSize(0.10, 0.05);

    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(10000); // Should be reasonable
  });

  test('smaller effect sizes require larger samples', () => {
    const smallEffect = calculateRequiredSampleSize(0.10, 0.02);
    const largeEffect = calculateRequiredSampleSize(0.10, 0.10);

    expect(smallEffect).toBeGreaterThan(largeEffect);
  });

  test('returns 0 for invalid baseline (<=0 or >=1)', () => {
    expect(calculateRequiredSampleSize(0, 0.05)).toBe(0);
    expect(calculateRequiredSampleSize(1, 0.05)).toBe(0);
    expect(calculateRequiredSampleSize(-0.1, 0.05)).toBe(0);
  });

  test('returns 0 for invalid effect size (<=0)', () => {
    expect(calculateRequiredSampleSize(0.10, 0)).toBe(0);
    expect(calculateRequiredSampleSize(0.10, -0.01)).toBe(0);
  });
});

// ============================================================================
// Test: calculateImprovement
// ============================================================================

describe('calculateImprovement', () => {
  test('positive improvement: (110-100)/100 = 10%', () => {
    const result = calculateImprovement(110, 100);
    expect(result).toBeCloseTo(10, 1);
  });

  test('negative improvement: (90-100)/100 = -10%', () => {
    const result = calculateImprovement(90, 100);
    expect(result).toBeCloseTo(-10, 1);
  });

  test('zero baseline with zero test → returns 0', () => {
    const result = calculateImprovement(0, 0);
    expect(result).toBe(0);
  });

  test('zero baseline with positive test → returns Infinity', () => {
    const result = calculateImprovement(10, 0);
    expect(result).toBe(Infinity);
  });

  test('same values → 0% improvement', () => {
    const result = calculateImprovement(100, 100);
    expect(result).toBeCloseTo(0, 1);
  });
});

// ============================================================================
// Test: generateDutchConclusion
// ============================================================================

describe('generateDutchConclusion', () => {
  test('significant result includes "significant"', () => {
    const result: StatisticalTestResult = {
      testStatistic: 3.5,
      pValue: 0.0005,
      confidence: 0.9995,
      isSignificant: true,
      sampleSizeNeeded: 200,
      dutchExplanation: 'Test',
    };

    const conclusion = generateDutchConclusion(result, {
      name: 'CTA Kleur Test',
      kpiName: 'conversieratio',
      testGroupResult: 0.12,
      controlGroupResult: 0.08,
    });

    expect(conclusion).toContain('significant');
    expect(conclusion).toContain('CTA Kleur Test');
  });

  test('non-significant result includes "onvoldoende bewijs"', () => {
    const result: StatisticalTestResult = {
      testStatistic: 0.5,
      pValue: 0.617,
      confidence: 0.383,
      isSignificant: false,
      sampleSizeNeeded: 500,
      dutchExplanation: 'Test',
    };

    const conclusion = generateDutchConclusion(result, {
      name: 'Headline Test',
      kpiName: 'klikratio',
      testGroupResult: 0.10,
      controlGroupResult: 0.09,
    });

    expect(conclusion).toContain('onvoldoende bewijs');
  });

  test('always includes p-value and confidence', () => {
    const result: StatisticalTestResult = {
      testStatistic: 2.0,
      pValue: 0.0455,
      confidence: 0.9545,
      isSignificant: true,
      sampleSizeNeeded: 200,
      dutchExplanation: 'Test',
    };

    const conclusion = generateDutchConclusion(result, {
      name: 'Test',
      kpiName: 'conversie',
    });

    expect(conclusion).toMatch(/p-waarde:/);
    expect(conclusion).toMatch(/Betrouwbaarheid:/);
  });

  test('includes improvement percentage when results are provided', () => {
    const result: StatisticalTestResult = {
      testStatistic: 3.0,
      pValue: 0.0027,
      confidence: 0.9973,
      isSignificant: true,
      sampleSizeNeeded: 200,
      dutchExplanation: 'Test',
    };

    const conclusion = generateDutchConclusion(result, {
      name: 'Test',
      kpiName: 'conversie',
      testGroupResult: 0.11,
      controlGroupResult: 0.10,
    });

    expect(conclusion).toContain('verbetering');
  });

  test('includes honesty disclaimer', () => {
    const result: StatisticalTestResult = {
      testStatistic: 2.0,
      pValue: 0.045,
      confidence: 0.955,
      isSignificant: true,
      sampleSizeNeeded: 200,
      dutchExplanation: 'Test',
    };

    const conclusion = generateDutchConclusion(result, {
      name: 'Test',
      kpiName: 'conversie',
    });

    expect(conclusion).toContain('voorzichtigheid');
    expect(conclusion).toContain('garandeert geen praktische relevantie');
  });

  test('includes recommended sample size when available', () => {
    const result: StatisticalTestResult = {
      testStatistic: 1.5,
      pValue: 0.134,
      confidence: 0.866,
      isSignificant: false,
      sampleSizeNeeded: 500,
      dutchExplanation: 'Test',
    };

    const conclusion = generateDutchConclusion(result, {
      name: 'Test',
      kpiName: 'conversie',
    });

    expect(conclusion).toContain('500');
    expect(conclusion).toContain('steekproefgrootte');
  });
});
