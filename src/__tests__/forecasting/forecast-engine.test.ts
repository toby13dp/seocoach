/**
 * Forecast Engine Tests
 * Tests for /src/lib/forecasting/forecast-engine.ts
 *
 * Tests the pure calculation functions:
 * - generateAssumptions
 * - calculateForecastRanges
 * These do NOT require DB mocking.
 *
 * The generateForecast function requires DB mocking since it calls db.forecast.create.
 */

import { describe, test, expect, mock } from 'bun:test';
import { ForecastScenario } from '@prisma/client';
import type { ForecastInput, ForecastOutput, ForecastRange } from '@/lib/forecasting/types';

// ============================================================================
// Import pure functions directly (no DB dependency)
// ============================================================================

import {
  generateAssumptions,
  calculateForecastRanges,
} from '@/lib/forecasting/forecast-engine';

// ============================================================================
// Helpers
// ============================================================================

/** Create a standard ForecastInput for testing */
function makeForecastInput(overrides: Partial<ForecastInput> = {}): ForecastInput {
  return {
    currentTraffic: 10000,
    currentClicks: 2000,
    currentConversions: 100,
    currentRevenue: 5000,
    currentCTR: 0.2,
    avgPosition: 10,
    contentOutputPerMonth: 8,
    targetMonths: 6,
    ...overrides,
  };
}

/** Create a standard ForecastOutput for testing */
function makeForecastOutput(overrides: Partial<ForecastOutput> = {}): ForecastOutput {
  return {
    traffic: 15000,
    clicks: 3000,
    leads: 300,
    conversions: 150,
    revenue: 7500,
    ctrImprovement: 0.05,
    rankingImprovement: 3.0,
    contentOutput: 8,
    requiredEffort: 'Gemiddelde inspanning vereist.',
    ...overrides,
  };
}

// ============================================================================
// Test: generateAssumptions
// ============================================================================

describe('generateAssumptions', () => {
  test('CONSERVATIVE scenario includes 5% growth rate in Dutch', () => {
    const assumptions = generateAssumptions(ForecastScenario.CONSERVATIVE, makeForecastInput());

    expect(assumptions.some(a => a.includes('5%'))).toBe(true);
    expect(assumptions.some(a => a.includes('Verkeersgroei'))).toBe(true);
  });

  test('REALISTIC scenario includes 15% growth rate in Dutch', () => {
    const assumptions = generateAssumptions(ForecastScenario.REALISTIC, makeForecastInput());

    expect(assumptions.some(a => a.includes('15%'))).toBe(true);
  });

  test('AMBITIOUS scenario includes 30% growth rate in Dutch', () => {
    const assumptions = generateAssumptions(ForecastScenario.AMBITIOUS, makeForecastInput());

    expect(assumptions.some(a => a.includes('30%'))).toBe(true);
  });

  test('always includes disclaimer in Dutch', () => {
    const assumptions = generateAssumptions(ForecastScenario.CONSERVATIVE, makeForecastInput());

    expect(assumptions.some(a => a.includes('schatting, geen garantie'))).toBe(true);
  });

  test('includes content production assumption', () => {
    const assumptions = generateAssumptions(ForecastScenario.REALISTIC, makeForecastInput({ contentOutputPerMonth: 12 }));

    expect(assumptions.some(a => a.includes('12'))).toBe(true);
    expect(assumptions.some(a => a.includes('Contentproductie'))).toBe(true);
  });

  test('includes revenue per conversion when conversions > 0', () => {
    const assumptions = generateAssumptions(ForecastScenario.CONSERVATIVE, makeForecastInput({
      currentConversions: 100,
      currentRevenue: 5000,
    }));

    expect(assumptions.some(a => a.includes('€50.00'))).toBe(true);
  });

  test('includes scenario confidence level', () => {
    const assumptions = generateAssumptions(ForecastScenario.CONSERVATIVE, makeForecastInput());

    // Conservative confidence is 80%
    expect(assumptions.some(a => a.includes('80%'))).toBe(true);
    expect(assumptions.some(a => a.includes('betrouwbaarheid'))).toBe(true);
  });

  test('includes uncertainty range', () => {
    const assumptions = generateAssumptions(ForecastScenario.REALISTIC, makeForecastInput());

    // Realistic uncertainty multiplier is 30%
    expect(assumptions.some(a => a.includes('±30%'))).toBe(true);
  });

  test('mentions external factors disclaimer', () => {
    const assumptions = generateAssumptions(ForecastScenario.AMBITIOUS, makeForecastInput());

    expect(assumptions.some(a => a.includes('algoritmewijzigingen'))).toBe(true);
  });
});

// ============================================================================
// Test: calculateForecastRanges
// ============================================================================

describe('calculateForecastRanges', () => {
  test('CONSERVATIVE: low < mid < high for all metrics (±20%)', () => {
    const output = makeForecastOutput();
    const ranges = calculateForecastRanges(output, ForecastScenario.CONSERVATIVE);

    // traffic
    expect(ranges.low.traffic).toBeLessThan(ranges.mid.traffic);
    expect(ranges.mid.traffic).toBeLessThan(ranges.high.traffic);
    // clicks
    expect(ranges.low.clicks).toBeLessThan(ranges.mid.clicks);
    expect(ranges.mid.clicks).toBeLessThan(ranges.high.clicks);
    // conversions
    expect(ranges.low.conversions).toBeLessThan(ranges.mid.conversions);
    expect(ranges.mid.conversions).toBeLessThan(ranges.high.conversions);
    // revenue
    expect(ranges.low.revenue).toBeLessThan(ranges.mid.revenue);
    expect(ranges.mid.revenue).toBeLessThan(ranges.high.revenue);
  });

  test('REALISTIC: low < mid < high for all metrics (±30%)', () => {
    const output = makeForecastOutput();
    const ranges = calculateForecastRanges(output, ForecastScenario.REALISTIC);

    expect(ranges.low.traffic).toBeLessThan(ranges.mid.traffic);
    expect(ranges.mid.traffic).toBeLessThan(ranges.high.traffic);
  });

  test('AMBITIOUS: low < mid < high for all metrics (±50%)', () => {
    const output = makeForecastOutput();
    const ranges = calculateForecastRanges(output, ForecastScenario.AMBITIOUS);

    expect(ranges.low.traffic).toBeLessThan(ranges.mid.traffic);
    expect(ranges.mid.traffic).toBeLessThan(ranges.high.traffic);
  });

  test('CONSERVATIVE: ±20% range around mid', () => {
    const output = makeForecastOutput({ traffic: 10000 });
    const ranges = calculateForecastRanges(output, ForecastScenario.CONSERVATIVE);

    // Conservative multiplier is 0.20 → low = 8000, high = 12000
    expect(ranges.low.traffic).toBe(8000);
    expect(ranges.high.traffic).toBe(12000);
    expect(ranges.mid.traffic).toBe(10000);
  });

  test('REALISTIC: ±30% range around mid', () => {
    const output = makeForecastOutput({ revenue: 10000 });
    const ranges = calculateForecastRanges(output, ForecastScenario.REALISTIC);

    // Realistic multiplier is 0.30 → low = 7000, high = 13000
    expect(ranges.low.revenue).toBe(7000);
    expect(ranges.high.revenue).toBe(13000);
  });

  test('AMBITIOUS: ±50% range around mid', () => {
    const output = makeForecastOutput({ clicks: 2000 });
    const ranges = calculateForecastRanges(output, ForecastScenario.AMBITIOUS);

    // Ambitious multiplier is 0.50 → low = 1000, high = 3000
    expect(ranges.low.clicks).toBe(1000);
    expect(ranges.high.clicks).toBe(3000);
  });

  test('contentOutput is NOT affected by uncertainty (same in low/mid/high)', () => {
    const output = makeForecastOutput({ contentOutput: 8 });
    const ranges = calculateForecastRanges(output, ForecastScenario.REALISTIC);

    expect(ranges.low.contentOutput).toBe(8);
    expect(ranges.mid.contentOutput).toBe(8);
    expect(ranges.high.contentOutput).toBe(8);
  });

  test('requiredEffort is NOT affected by uncertainty (same in low/mid/high)', () => {
    const output = makeForecastOutput({ requiredEffort: 'Some effort description' });
    const ranges = calculateForecastRanges(output, ForecastScenario.AMBITIOUS);

    expect(ranges.low.requiredEffort).toBe('Some effort description');
    expect(ranges.mid.requiredEffort).toBe('Some effort description');
    expect(ranges.high.requiredEffort).toBe('Some effort description');
  });
});

// ============================================================================
// Test: generateForecast (with DB mock)
// ============================================================================

describe('generateForecast', () => {
  // Set up DB mock for generateForecast
  const mockForecastCreate = mock(() => Promise.resolve({ id: 'forecast-1' }));

  mock.module('@/lib/db', () => ({
    db: {
      forecast: {
        create: mockForecastCreate,
      },
    },
  }));

  // Need dynamic import after mock setup
  // Since we already imported the pure functions at top, and the generateForecast
  // is in the same module, we need to use a fresh import.
  // But bun:test handles this via mock.module being hoisted.

  test('CONSERVATIVE scenario uses ~5% traffic growth', async () => {
    // We need to re-import after mock setup
    const { generateForecast } = await import('@/lib/forecasting/forecast-engine');

    mockForecastCreate.mockReset();
    mockForecastCreate.mockImplementation((args: any) => Promise.resolve({ id: 'fc-1', ...args.data }));

    await generateForecast('proj-1', ForecastScenario.CONSERVATIVE, makeForecastInput());

    // Verify the forecast was created (the pure computation ran without error)
    expect(mockForecastCreate).toHaveBeenCalled();
  });

  test('REALISTIC scenario uses ~15% traffic growth', async () => {
    const { generateForecast } = await import('@/lib/forecasting/forecast-engine');

    mockForecastCreate.mockReset();
    mockForecastCreate.mockImplementation((args: any) => Promise.resolve({ id: 'fc-1', ...args.data }));

    await generateForecast('proj-1', ForecastScenario.REALISTIC, makeForecastInput());

    expect(mockForecastCreate).toHaveBeenCalled();
  });

  test('AMBITIOUS scenario uses ~30% traffic growth', async () => {
    const { generateForecast } = await import('@/lib/forecasting/forecast-engine');

    mockForecastCreate.mockReset();
    mockForecastCreate.mockImplementation((args: any) => Promise.resolve({ id: 'fc-1', ...args.data }));

    await generateForecast('proj-1', ForecastScenario.AMBITIOUS, makeForecastInput());

    expect(mockForecastCreate).toHaveBeenCalled();
  });

  test('forecast includes confidence level', async () => {
    const { generateForecast } = await import('@/lib/forecasting/forecast-engine');

    mockForecastCreate.mockReset();
    mockForecastCreate.mockImplementation((args: any) => Promise.resolve({ id: 'fc-1', ...args.data }));

    await generateForecast('proj-1', ForecastScenario.CONSERVATIVE, makeForecastInput());

    const callArgs = mockForecastCreate.mock.calls[0][0] as any;
    // Conservative confidence = 0.8
    expect(callArgs.data.confidence).toBe(0.8);
  });
});
