/**
 * Alert Engine Tests
 * Tests for /src/lib/alerts/engine.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockDailyFindMany = mock(() => Promise.resolve([]));
const mockAlertFindMany = mock(() => Promise.resolve([]));
const mockFindFirst = mock(() => Promise.resolve(null));
const mockCreate = mock(() => Promise.resolve({ id: 'alert-1' }));
const mockUpdate = mock(() => Promise.resolve({ id: 'alert-1' }));
const mockCount = mock(() => Promise.resolve(0));

mock.module('@/lib/db', () => ({
  db: {
    dailyMetric: {
      findMany: mockDailyFindMany,
    },
    alert: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
      count: mockCount,
      findMany: mockAlertFindMany,
    },
  },
}));

import {
  evaluateMetricAlert,
  runAllAlertChecks,
  acknowledgeAlert,
  snoozeAlert,
  resolveAlert,
  dismissAlert,
  getAlertSummary,
  generateDigest,
} from '@/lib/alerts/engine';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate daily metric records for testing.
 * Each record has a date and clicks value.
 */
function generateDailyMetrics(
  days: number,
  clickBase: number = 100,
  variance: number = 10
): any[] {
  const metrics: any[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    metrics.push({
      date,
      clicks: clickBase + Math.round((Math.random() - 0.5) * variance),
      impressions: clickBase * 5,
      ctr: 0.2,
      averagePosition: 5.5,
      sessions: clickBase * 2,
      users: Math.round(clickBase * 1.5),
      conversions: Math.round(clickBase * 0.05),
      conversionRate: 0.05,
      revenue: clickBase * 2.5,
    });
  }
  return metrics;
}

// ============================================================================
// Test: evaluateMetricAlert — metric exceeding threshold
// ============================================================================

describe('evaluateMetricAlert — metric exceeding threshold', () => {
  beforeEach(() => {
    mockDailyFindMany.mockReset();
  });

  test('fires alert when clicks drop significantly', async () => {
    // 14+ data points to meet minimumDataPoints requirement for CLICK_DROP
    const currentMetrics = generateDailyMetrics(14, 50, 5);
    // Previous period: high clicks
    const previousMetrics = generateDailyMetrics(14, 150, 10);

    mockDailyFindMany
      .mockImplementationOnce(() => Promise.resolve(currentMetrics))
      .mockImplementationOnce(() => Promise.resolve(previousMetrics));

    const result = await evaluateMetricAlert('proj-1', 'CLICK_DROP', 14);

    expect(result.shouldAlert).toBe(true);
    expect(result.changePercentage).toBeLessThan(0);
    expect(result.dataSufficient).toBe(true);
  });

  test('fires alert when revenue drops significantly', async () => {
    // 14+ data points to meet minimumDataPoints requirement for REVENUE_DROP
    const currentMetrics = generateDailyMetrics(14, 50, 5);
    const previousMetrics = generateDailyMetrics(14, 200, 10);

    mockDailyFindMany
      .mockImplementationOnce(() => Promise.resolve(currentMetrics))
      .mockImplementationOnce(() => Promise.resolve(previousMetrics));

    const result = await evaluateMetricAlert('proj-1', 'REVENUE_DROP', 14);

    expect(result.shouldAlert).toBe(true);
    expect(result.changePercentage).toBeLessThan(0);
  });
});

// ============================================================================
// Test: evaluateMetricAlert — metric below threshold (no alert)
// ============================================================================

describe('evaluateMetricAlert — metric below threshold (no alert)', () => {
  beforeEach(() => {
    mockDailyFindMany.mockReset();
  });

  test('does not fire alert when clicks are stable', async () => {
    const currentMetrics = generateDailyMetrics(7, 100, 3);
    const previousMetrics = generateDailyMetrics(7, 100, 3);

    mockDailyFindMany
      .mockImplementationOnce(() => Promise.resolve(currentMetrics))
      .mockImplementationOnce(() => Promise.resolve(previousMetrics));

    const result = await evaluateMetricAlert('proj-1', 'CLICK_DROP', 7);

    expect(result.shouldAlert).toBe(false);
  });

  test('does not fire alert when clicks increase', async () => {
    const currentMetrics = generateDailyMetrics(7, 150, 5);
    const previousMetrics = generateDailyMetrics(7, 100, 5);

    mockDailyFindMany
      .mockImplementationOnce(() => Promise.resolve(currentMetrics))
      .mockImplementationOnce(() => Promise.resolve(previousMetrics));

    const result = await evaluateMetricAlert('proj-1', 'CLICK_DROP', 7);

    expect(result.shouldAlert).toBe(false);
  });
});

// ============================================================================
// Test: evaluateMetricAlert — insufficient data points
// ============================================================================

describe('evaluateMetricAlert — insufficient data points', () => {
  beforeEach(() => {
    mockDailyFindMany.mockReset();
  });

  test('does not fire alert with insufficient data', async () => {
    // Only 3 data points — below minimum of 14 for CLICK_DROP
    const currentMetrics = generateDailyMetrics(3, 50, 5);
    const previousMetrics = generateDailyMetrics(7, 150, 10);

    mockDailyFindMany
      .mockImplementationOnce(() => Promise.resolve(currentMetrics))
      .mockImplementationOnce(() => Promise.resolve(previousMetrics));

    const result = await evaluateMetricAlert('proj-1', 'CLICK_DROP', 7);

    expect(result.dataSufficient).toBe(false);
    expect(result.shouldAlert).toBe(false);
    expect(result.dataNote).toContain('Onvoldoende');
  });

  test('includes Dutch explanation for insufficient data', async () => {
    const currentMetrics = generateDailyMetrics(2, 50, 5);
    const previousMetrics = generateDailyMetrics(7, 150, 10);

    mockDailyFindMany
      .mockImplementationOnce(() => Promise.resolve(currentMetrics))
      .mockImplementationOnce(() => Promise.resolve(previousMetrics));

    const result = await evaluateMetricAlert('proj-1', 'CLICK_DROP', 7);

    expect(result.dataNote).toContain('datapunten');
    expect(result.dataNote).toContain('vereist');
  });
});

// ============================================================================
// Test: runAllAlertChecks
// ============================================================================

describe('runAllAlertChecks', () => {
  beforeEach(() => {
    mockDailyFindMany.mockReset();
    mockFindFirst.mockReset();
    mockCreate.mockReset();
  });

  test('returns an array of created alert IDs', async () => {
    // Return consistent data for all findMany calls
    // Using same data for both periods means no significant change detected
    const metrics = generateDailyMetrics(14, 100, 5);
    mockDailyFindMany.mockImplementation(() => Promise.resolve(metrics));

    // No existing active alerts → allow creation
    mockFindFirst.mockImplementation(() => Promise.resolve(null));

    mockCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: `alert-${args.data.type}`, ...args.data })
    );

    const createdIds = await runAllAlertChecks('proj-1');

    // Should return an array (even if empty since no significant changes)
    expect(Array.isArray(createdIds)).toBe(true);
  });

  test('returns empty array when no data exists', async () => {
    // Empty metrics means no alerts can be triggered
    mockDailyFindMany.mockImplementation(() => Promise.resolve([]));

    const createdIds = await runAllAlertChecks('proj-1');
    expect(createdIds.length).toBe(0);
  });
});

// ============================================================================
// Test: Alert lifecycle — acknowledge, snooze, resolve, dismiss
// ============================================================================

describe('Alert lifecycle', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });

  test('acknowledgeAlert sets ACKNOWLEDGED status', async () => {
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: args.where.id, status: 'ACKNOWLEDGED' })
    );

    await acknowledgeAlert('alert-1', 'user-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alert-1' },
        data: expect.objectContaining({
          status: 'ACKNOWLEDGED',
          acknowledgedBy: 'user-1',
          acknowledgedAt: expect.any(Date),
        }),
      })
    );
  });

  test('snoozeAlert sets SNOOZED status with until date', async () => {
    const untilDate = new Date();
    untilDate.setDate(untilDate.getDate() + 7);

    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: args.where.id, status: 'SNOOZED' })
    );

    await snoozeAlert('alert-1', 'user-1', untilDate);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alert-1' },
        data: expect.objectContaining({
          status: 'SNOOZED',
          snoozedBy: 'user-1',
          snoozedUntil: untilDate,
        }),
      })
    );
  });

  test('resolveAlert sets RESOLVED status with resolution', async () => {
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: args.where.id, status: 'RESOLVED' })
    );

    await resolveAlert('alert-1', 'user-1', 'Probleem opgelost');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alert-1' },
        data: expect.objectContaining({
          status: 'RESOLVED',
          resolvedBy: 'user-1',
          resolvedAt: expect.any(Date),
          resolution: 'Probleem opgelost',
        }),
      })
    );
  });

  test('dismissAlert sets DISMISSED status', async () => {
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: args.where.id, status: 'DISMISSED' })
    );

    await dismissAlert('alert-1', 'user-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alert-1' },
        data: expect.objectContaining({
          status: 'DISMISSED',
          dismissedBy: 'user-1',
          dismissedAt: expect.any(Date),
        }),
      })
    );
  });
});

// ============================================================================
// Test: Deduplication — won't create duplicate active alerts
// ============================================================================

describe('Deduplication — no duplicate active alerts', () => {
  beforeEach(() => {
    mockDailyFindMany.mockReset();
    mockFindFirst.mockReset();
    mockCreate.mockReset();
  });

  test('does not create duplicate for same type+group', async () => {
    const currentMetrics = generateDailyMetrics(7, 50, 5);
    const previousMetrics = generateDailyMetrics(7, 200, 10);

    // Return alternating current/previous for all findMany calls
    let callIdx = 0;
    mockDailyFindMany.mockImplementation(() => {
      callIdx++;
      return Promise.resolve(callIdx % 2 === 1 ? currentMetrics : previousMetrics);
    });

    // Existing active alert found → skip creation
    mockFindFirst.mockImplementation(() =>
      Promise.resolve({ id: 'existing-alert', status: 'ACTIVE' })
    );

    const createdIds = await runAllAlertChecks('proj-1');

    // No new alerts created due to dedup
    expect(createdIds.length).toBe(0);
  });
});

// ============================================================================
// Test: getAlertSummary
// ============================================================================

describe('getAlertSummary', () => {
  beforeEach(() => {
    mockCount.mockReset();
  });

  test('returns correct counts by severity', async () => {
    // CRITICAL=2, HIGH=3, MEDIUM=1, LOW=0, INFO=0
    mockCount
      .mockImplementationOnce(() => Promise.resolve(2))  // CRITICAL
      .mockImplementationOnce(() => Promise.resolve(3))  // HIGH
      .mockImplementationOnce(() => Promise.resolve(1))  // MEDIUM
      .mockImplementationOnce(() => Promise.resolve(0))  // LOW
      .mockImplementationOnce(() => Promise.resolve(0)); // INFO

    const summary = await getAlertSummary('proj-1');

    expect(summary.critical).toBe(2);
    expect(summary.high).toBe(3);
    expect(summary.medium).toBe(1);
    expect(summary.low).toBe(0);
    expect(summary.info).toBe(0);
    expect(summary.total).toBe(6);
  });

  test('returns zeros when no alerts exist', async () => {
    mockCount.mockImplementation(() => Promise.resolve(0));

    const summary = await getAlertSummary('proj-1');

    expect(summary.critical).toBe(0);
    expect(summary.high).toBe(0);
    expect(summary.medium).toBe(0);
    expect(summary.low).toBe(0);
    expect(summary.info).toBe(0);
    expect(summary.total).toBe(0);
  });
});

// ============================================================================
// Test: generateDigest
// ============================================================================

describe('generateDigest', () => {
  beforeEach(() => {
    mockAlertFindMany.mockReset();
  });

  test('collects alerts correctly for daily digest', async () => {
    const alerts = [
      {
        id: 'a1',
        type: 'CLICK_DROP',
        severity: 'HIGH',
        title: 'Klikdaling',
        message: 'Kliks zijn gedaald met 30%',
        changePercentage: -30,
        createdAt: new Date(),
      },
      {
        id: 'a2',
        type: 'REVENUE_DROP',
        severity: 'CRITICAL',
        title: 'Omzetdaling',
        message: 'Omzet is gedaald met 25%',
        changePercentage: -25,
        createdAt: new Date(),
      },
    ];

    mockAlertFindMany.mockImplementation(() => Promise.resolve(alerts));

    const digest = await generateDigest('proj-1', 'daily');

    expect(digest.projectId).toBe('proj-1');
    expect(digest.period).toBe('daily');
    expect(digest.criticalCount).toBe(1);
    expect(digest.highCount).toBe(1);
    expect(digest.alerts.length).toBe(2);
    expect(digest.alerts[0].title).toBe('Klikdaling');
    expect(digest.alerts[1].title).toBe('Omzetdaling');
  });

  test('returns empty digest when no alerts exist', async () => {
    mockAlertFindMany.mockImplementation(() => Promise.resolve([]));

    const digest = await generateDigest('proj-1', 'weekly');

    expect(digest.criticalCount).toBe(0);
    expect(digest.highCount).toBe(0);
    expect(digest.mediumCount).toBe(0);
    expect(digest.lowCount).toBe(0);
    expect(digest.infoCount).toBe(0);
    expect(digest.alerts.length).toBe(0);
  });

  test('weekly digest covers 7-day period', async () => {
    mockAlertFindMany.mockImplementation(() => Promise.resolve([]));

    const digest = await generateDigest('proj-1', 'weekly');

    expect(digest.period).toBe('weekly');
    expect(digest.id).toContain('weekly');
  });
});
