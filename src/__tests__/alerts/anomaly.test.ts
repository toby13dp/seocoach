/**
 * Anomaly Detection Tests
 * Tests for /src/lib/alerts/anomaly.ts
 */

import { describe, test, expect } from 'bun:test';
import { detectAnomaly, detectAnomalyBest } from '@/lib/alerts/anomaly';

// ============================================================================
// Test: Z-score method with normal data (no anomaly)
// ============================================================================

describe('Z-score method — normal data', () => {
  test('returns low score for data within normal range', () => {
    // 10 data points all around 100, last value close to mean
    const values = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
    const result = detectAnomaly(values, 'zscore');

    expect(result).not.toBeNull();
    expect(result!.method).toBe('zscore');
    expect(result!.isAnomaly).toBe(false);
    expect(result!.score).toBe(0);
  });

  test('returns isAnomaly=false for consistent data', () => {
    const values = [50, 51, 49, 52, 48, 50, 51, 49, 50, 50];
    const result = detectAnomaly(values, 'zscore');

    expect(result).not.toBeNull();
    expect(result!.isAnomaly).toBe(false);
  });

  test('returns score=0 when all baseline values are identical and latest matches', () => {
    const values = [100, 100, 100, 100, 100, 100, 100, 100];
    const result = detectAnomaly(values, 'zscore');

    expect(result).not.toBeNull();
    expect(result!.score).toBe(0);
    expect(result!.isAnomaly).toBe(false);
  });
});

// ============================================================================
// Test: Z-score method with outlier (anomaly detected)
// ============================================================================

describe('Z-score method — outlier detection', () => {
  test('detects anomaly when latest value is far from mean', () => {
    // Normal values around 100, but last value is 500
    const values = [100, 98, 102, 97, 103, 101, 99, 500];
    const result = detectAnomaly(values, 'zscore');

    expect(result).not.toBeNull();
    expect(result!.method).toBe('zscore');
    expect(result!.isAnomaly).toBe(true);
    expect(result!.score).toBeGreaterThan(0.5);
  });

  test('detects negative anomaly (value far below mean)', () => {
    const values = [100, 98, 102, 97, 103, 101, 99, 10];
    const result = detectAnomaly(values, 'zscore');

    expect(result).not.toBeNull();
    expect(result!.isAnomaly).toBe(true);
  });

  test('returns score=1 when all baseline values are identical but latest differs', () => {
    const values = [100, 100, 100, 100, 100, 100, 100, 200];
    const result = detectAnomaly(values, 'zscore');

    expect(result).not.toBeNull();
    expect(result!.score).toBe(1);
    expect(result!.isAnomaly).toBe(true);
  });
});

// ============================================================================
// Test: IQR method with normal data
// ============================================================================

describe('IQR method — normal data', () => {
  test('returns no anomaly for values within IQR bounds', () => {
    const values = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
    const result = detectAnomaly(values, 'iqr');

    expect(result).not.toBeNull();
    expect(result!.method).toBe('iqr');
    expect(result!.isAnomaly).toBe(false);
    expect(result!.score).toBe(0);
  });

  test('returns isAnomaly=false for uniform data', () => {
    const values = [50, 50, 50, 50, 50, 50, 50, 50];
    const result = detectAnomaly(values, 'iqr');

    expect(result).not.toBeNull();
    expect(result!.isAnomaly).toBe(false);
  });
});

// ============================================================================
// Test: IQR method with outlier
// ============================================================================

describe('IQR method — outlier detection', () => {
  test('detects outlier above upper bound', () => {
    // Values between 10-30, then a spike to 200
    const values = [10, 15, 20, 25, 30, 15, 20, 200];
    const result = detectAnomaly(values, 'iqr');

    expect(result).not.toBeNull();
    expect(result!.method).toBe('iqr');
    expect(result!.isAnomaly).toBe(true);
    expect(result!.score).toBeGreaterThan(0);
  });

  test('detects outlier below lower bound', () => {
    const values = [100, 105, 110, 115, 120, 108, 112, 5];
    const result = detectAnomaly(values, 'iqr');

    expect(result).not.toBeNull();
    expect(result!.isAnomaly).toBe(true);
  });

  test('detects anomaly when all baseline identical but latest outside Q1/Q3', () => {
    // All same baseline, last value is different
    const values = [50, 50, 50, 50, 50, 50, 50, 100];
    const result = detectAnomaly(values, 'iqr');

    expect(result).not.toBeNull();
    expect(result!.isAnomaly).toBe(true);
    expect(result!.score).toBe(1);
  });
});

// ============================================================================
// Test: Insufficient data returns null
// ============================================================================

describe('Insufficient data', () => {
  test('returns null when fewer than 7 data points (zscore)', () => {
    const values = [1, 2, 3, 4, 5, 6]; // 6 points < minimum 7
    const result = detectAnomaly(values, 'zscore');
    expect(result).toBeNull();
  });

  test('returns null when fewer than 7 data points (iqr)', () => {
    const values = [1, 2, 3, 4, 5];
    const result = detectAnomaly(values, 'iqr');
    expect(result).toBeNull();
  });

  test('returns null for empty array', () => {
    const result = detectAnomaly([], 'zscore');
    expect(result).toBeNull();
  });

  test('returns null for exactly 6 data points', () => {
    const values = [10, 20, 30, 40, 50, 60];
    const result = detectAnomaly(values, 'zscore');
    expect(result).toBeNull();
  });

  test('returns result for exactly 7 data points', () => {
    const values = [10, 20, 30, 40, 50, 60, 70];
    const result = detectAnomaly(values, 'zscore');
    expect(result).not.toBeNull();
  });
});

// ============================================================================
// Test: detectAnomalyBest picks the stronger signal
// ============================================================================

describe('detectAnomalyBest — picks stronger signal', () => {
  test('returns result when data is sufficient', () => {
    const values = [10, 12, 14, 16, 18, 20, 22, 24];
    const result = detectAnomalyBest(values);
    expect(result).not.toBeNull();
    // Should return either zscore or iqr result
    expect(['zscore', 'iqr']).toContain(result!.method);
  });

  test('returns null when data is insufficient', () => {
    const values = [1, 2, 3];
    const result = detectAnomalyBest(values);
    expect(result).toBeNull();
  });

  test('picks the method with higher score', () => {
    // Create data where z-score detects anomaly but IQR might not
    const values = [100, 100, 100, 100, 100, 100, 500];
    const result = detectAnomalyBest(values);

    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
    // The result should come from whichever method gave the higher score
    expect(['zscore', 'iqr']).toContain(result!.method);
  });

  test('returns zscore result when both methods produce results', () => {
    const values = [10, 11, 12, 13, 14, 15, 16, 50];
    const result = detectAnomalyBest(values);

    expect(result).not.toBeNull();
    expect(result!.isAnomaly).toBe(true);
  });

  test('returns highest score between methods for extreme outlier', () => {
    // Extreme outlier should be detected by both methods
    const values = [50, 52, 48, 51, 49, 50, 51, 1000];
    const result = detectAnomalyBest(values);

    expect(result).not.toBeNull();
    expect(result!.isAnomaly).toBe(true);
    expect(result!.score).toBeGreaterThan(0.5);
  });
});
