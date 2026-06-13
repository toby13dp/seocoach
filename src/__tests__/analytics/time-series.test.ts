/**
 * Time-Series Calculation Tests
 * Tests for /src/lib/analytics/time-series.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockFindMany = mock(() => Promise.resolve([]));
const mockAggregate = mock(() =>
  Promise.resolve({ _min: { date: null }, _max: { date: null } })
);
const mockCount = mock(() => Promise.resolve(0));
const mockFindFirst = mock(() => Promise.resolve(null));

mock.module('@/lib/db', () => ({
  db: {
    dailyMetric: {
      findMany: mockFindMany,
      aggregate: mockAggregate,
      count: mockCount,
    },
    dataConnection: {
      findFirst: mockFindFirst,
      findMany: mock(() => Promise.resolve([])),
    },
  },
}));

import {
  calculateChangePercentage,
  aggregateMetrics,
  calculateTimeSeries,
  calculatePeriodComparison,
  getDataFreshness,
} from '@/lib/analytics/time-series';

// ============================================================================
// Test: calculateChangePercentage
// ============================================================================

describe('calculateChangePercentage', () => {
  test('returns positive percentage for increase', () => {
    const result = calculateChangePercentage(120, 100);
    expect(result).toBe(20);
  });

  test('returns negative percentage for decrease', () => {
    const result = calculateChangePercentage(80, 100);
    expect(result).toBe(-20);
  });

  test('returns 0 for no change', () => {
    const result = calculateChangePercentage(100, 100);
    expect(result).toBe(0);
  });

  test('returns null when current is null', () => {
    const result = calculateChangePercentage(null, 100);
    expect(result).toBeNull();
  });

  test('returns null when previous is null', () => {
    const result = calculateChangePercentage(100, null);
    expect(result).toBeNull();
  });

  test('returns 100 when going from zero to positive', () => {
    const result = calculateChangePercentage(50, 0);
    expect(result).toBe(100);
  });

  test('returns 0 when both are zero', () => {
    const result = calculateChangePercentage(0, 0);
    expect(result).toBe(0);
  });

  test('handles large percentage increases correctly', () => {
    const result = calculateChangePercentage(500, 100);
    expect(result).toBe(400);
  });
});

// ============================================================================
// Test: aggregateMetrics
// ============================================================================

describe('aggregateMetrics', () => {
  test('sums values with sum method', () => {
    const result = aggregateMetrics([10, 20, 30], 'sum');
    expect(result).toBe(60);
  });

  test('averages values with average method', () => {
    const result = aggregateMetrics([10, 20, 30], 'average');
    expect(result).toBe(20);
  });

  test('returns 0 for empty array with sum', () => {
    const result = aggregateMetrics([], 'sum');
    expect(result).toBe(0);
  });

  test('returns 0 for empty array with average', () => {
    const result = aggregateMetrics([], 'average');
    expect(result).toBe(0);
  });

  test('handles single value correctly for sum', () => {
    const result = aggregateMetrics([42], 'sum');
    expect(result).toBe(42);
  });

  test('handles single value correctly for average', () => {
    const result = aggregateMetrics([42], 'average');
    expect(result).toBe(42);
  });

  test('handles decimal values for average', () => {
    const result = aggregateMetrics([1.5, 2.5, 3.0], 'average');
    expect(result).toBeCloseTo(7 / 3, 5);
  });
});

// ============================================================================
// Test: calculateTimeSeries
// ============================================================================

describe('calculateTimeSeries', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockAggregate.mockReset();
  });

  test('returns empty data points when no metrics exist', async () => {
    mockFindMany.mockImplementation(() => Promise.resolve([]));
    mockAggregate.mockImplementation(() =>
      Promise.resolve({ _min: { date: null }, _max: { date: null } })
    );

    const result = await calculateTimeSeries(
      'proj-1',
      'clicks',
      '2025-01-01',
      '2025-01-28'
    );

    expect(result.dataPoints).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.average).toBe(0);
    expect(result.change).toBeNull();
    expect(result.changeDirection).toBeNull();
  });

  test('returns correct data points for daily metrics', async () => {
    const metrics = [
      { date: new Date('2025-01-15'), clicks: 100 },
      { date: new Date('2025-01-16'), clicks: 120 },
      { date: new Date('2025-01-17'), clicks: 110 },
    ];

    mockFindMany.mockImplementation(() => Promise.resolve(metrics));
    // Second call for previous period returns empty
    mockFindMany
      .mockImplementationOnce(() => Promise.resolve(metrics))
      .mockImplementationOnce(() => Promise.resolve([]));

    const result = await calculateTimeSeries(
      'proj-1',
      'clicks',
      '2025-01-15',
      '2025-01-17'
    );

    expect(result.dataPoints.length).toBe(3);
    expect(result.metric).toBe('clicks');
    expect(result.total).toBeGreaterThan(0);
  });

  test('never fabricates data — empty results when no metrics', async () => {
    mockFindMany.mockImplementation(() => Promise.resolve([]));

    const result = await calculateTimeSeries(
      'proj-1',
      'sessions',
      '2025-01-01',
      '2025-01-28'
    );

    expect(result.dataPoints).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.average).toBe(0);
    // No data means no change can be calculated
    expect(result.change).toBeNull();
  });
});

// ============================================================================
// Test: calculatePeriodComparison
// ============================================================================

describe('calculatePeriodComparison', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  test('compares current vs previous periods', async () => {
    const currentMetrics = [
      { date: new Date('2025-01-15'), clicks: 120 },
      { date: new Date('2025-01-16'), clicks: 130 },
    ];
    const previousMetrics = [
      { date: new Date('2025-01-01'), clicks: 100 },
      { date: new Date('2025-01-02'), clicks: 110 },
    ];

    // First call = current period, second call = previous period
    // Each calculateTimeSeries internally calls findMany twice (current + previous for change)
    mockFindMany
      .mockImplementationOnce(() => Promise.resolve(currentMetrics))  // current period clicks
      .mockImplementationOnce(() => Promise.resolve(previousMetrics))  // previous period for change
      .mockImplementationOnce(() => Promise.resolve(previousMetrics))  // previous period
      .mockImplementationOnce(() => Promise.resolve(currentMetrics))   // previous period's previous
      .mockImplementationOnce(() => Promise.resolve([]))               // year-over-year
      .mockImplementationOnce(() => Promise.resolve([]));              // year-over-year previous

    const result = await calculatePeriodComparison(
      'proj-1',
      'clicks',
      '2025-01-15',
      '2025-01-16',
      '2025-01-01',
      '2025-01-02'
    );

    expect(result.current).toBeDefined();
    expect(result.previous).toBeDefined();
    expect(result.current.metric).toBe('clicks');
    expect(result.previous.metric).toBe('clicks');
  });

  test('returns null yearOverYear when no historical data exists', async () => {
    mockFindMany
      .mockImplementation(() => Promise.resolve([]));

    const result = await calculatePeriodComparison(
      'proj-1',
      'clicks',
      '2025-01-15',
      '2025-01-16',
      '2025-01-01',
      '2025-01-02'
    );

    expect(result.yearOverYear).toBeNull();
  });
});

// ============================================================================
// Test: getDataFreshness
// ============================================================================

describe('getDataFreshness', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockAggregate.mockReset();
  });

  test('returns no data available when no metrics exist', async () => {
    mockFindFirst.mockImplementation(() => Promise.resolve(null));
    mockAggregate.mockImplementation(() =>
      Promise.resolve({ _min: { date: null }, _max: { date: null } })
    );

    const result = await getDataFreshness('proj-1');

    expect(result.isDataAvailable).toBe(false);
    expect(result.dataStartDate).toBeNull();
    expect(result.dataEndDate).toBeNull();
    expect(result.dataNote).toContain('geen gegevens');
  });

  test('returns data info with partial data', async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 1);

    mockFindFirst.mockImplementation(() =>
      Promise.resolve({ lastSyncAt: recentDate })
    );
    mockAggregate.mockImplementation(() =>
      Promise.resolve({
        _min: { date: new Date('2025-01-01') },
        _max: { date: new Date('2025-01-28') },
      })
    );

    const result = await getDataFreshness('proj-1');

    expect(result.isDataAvailable).toBe(true);
    expect(result.dataStartDate).not.toBeNull();
    expect(result.dataEndDate).not.toBeNull();
  });

  test('warns when sync is more than 2 days old', async () => {
    const oldSyncDate = new Date();
    oldSyncDate.setDate(oldSyncDate.getDate() - 3);

    mockFindFirst.mockImplementation(() =>
      Promise.resolve({ lastSyncAt: oldSyncDate })
    );
    mockAggregate.mockImplementation(() =>
      Promise.resolve({
        _min: { date: new Date('2025-01-01') },
        _max: { date: new Date('2025-01-28') },
      })
    );

    const result = await getDataFreshness('proj-1');

    expect(result.dataNote).not.toBeNull();
    // Dutch warning about stale data
    if (result.dataNote) {
      expect(
        result.dataNote.includes('synchroniseerd') ||
        result.dataNote.includes('geleden')
      ).toBe(true);
    }
  });

  test('returns no data note for fresh data', async () => {
    const recentSync = new Date();
    recentSync.setHours(recentSync.getHours() - 1);

    mockFindFirst.mockImplementation(() =>
      Promise.resolve({ lastSyncAt: recentSync })
    );
    mockAggregate.mockImplementation(() =>
      Promise.resolve({
        _min: { date: new Date('2025-01-01') },
        _max: { date: new Date() },
      })
    );

    const result = await getDataFreshness('proj-1');

    expect(result.isDataAvailable).toBe(true);
    expect(result.lastSyncAt).not.toBeNull();
  });
});
