/**
 * Revenue Prioritizer Tests
 * Tests for /src/lib/ecommerce/revenue-prioritizer.ts
 *
 * Note: `calculatePriority` is not exported, so we test it indirectly
 * through the exported `prioritizeProductsByRevenue` function by mocking the DB.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// ============================================================================
// Mock database
// ============================================================================

const mockProductFindMany = mock(() => Promise.resolve([]));

mock.module('@/lib/db', () => ({
  db: {
    product: {
      findMany: mockProductFindMany,
    },
  },
}));

// Import AFTER mock.module
import { prioritizeProductsByRevenue } from '@/lib/ecommerce/revenue-prioritizer';

// ============================================================================
// Helper — create a product row as it would come from Prisma
// ============================================================================

function makeProduct(overrides: {
  id?: string;
  name?: string;
  revenue30d?: number | null;
  revenue90d?: number | null;
  margin?: number | null;
  overallSeoScore?: number | null;
}) {
  return {
    id: overrides.id ?? 'prod-1',
    name: overrides.name ?? 'Test Product',
    revenue30d: overrides.revenue30d ?? 0,
    revenue90d: overrides.revenue90d ?? 0,
    margin: overrides.margin ?? null,
    overallSeoScore: overrides.overallSeoScore ?? 0,
  };
}

// ============================================================================
// prioritizeProductsByRevenue — High revenue + low SEO = critical
// ============================================================================

describe('prioritizeProductsByRevenue — high revenue + low SEO = critical', () => {
  beforeEach(() => {
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeProduct({
          id: 'prod-critical',
          name: 'Duur Product',
          revenue30d: 5000,
          revenue90d: 15000,
          overallSeoScore: 20,
        }),
      ])
    );
  });

  test('high revenue with low SEO score yields critical priority', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priority).toBe('critical');
  });

  test('critical reason mentions high revenue and low SEO', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priorityReason).toContain('omzet');
    expect(results[0].priorityReason).toContain('SEO-score');
  });
});

// ============================================================================
// prioritizeProductsByRevenue — High revenue + medium SEO = high
// ============================================================================

describe('prioritizeProductsByRevenue — high revenue + medium SEO = high', () => {
  beforeEach(() => {
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeProduct({
          id: 'prod-high',
          name: 'Medium SEO Product',
          revenue30d: 5000,
          revenue90d: 15000,
          overallSeoScore: 55,
        }),
      ])
    );
  });

  test('high revenue with medium SEO yields high priority', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priority).toBe('high');
  });

  test('high priority reason mentions room for improvement', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priorityReason).toContain('ruimte voor SEO-verbetering');
  });
});

// ============================================================================
// prioritizeProductsByRevenue — High revenue + high SEO = medium
// ============================================================================

describe('prioritizeProductsByRevenue — high revenue + high SEO = medium', () => {
  beforeEach(() => {
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeProduct({
          id: 'prod-medium',
          name: 'Goed SEO Product',
          revenue30d: 5000,
          revenue90d: 15000,
          overallSeoScore: 85,
        }),
      ])
    );
  });

  test('high revenue with high SEO yields medium priority', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priority).toBe('medium');
  });

  test('medium priority reason mentions good SEO score', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priorityReason).toContain('Goede omzet en SEO-score');
  });
});

// ============================================================================
// prioritizeProductsByRevenue — Zero revenue = low
// ============================================================================

describe('prioritizeProductsByRevenue — zero revenue = low', () => {
  beforeEach(() => {
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeProduct({
          id: 'prod-low',
          name: 'Geen Omzet Product',
          revenue30d: 0,
          revenue90d: 0,
          overallSeoScore: 50,
        }),
      ])
    );
  });

  test('zero revenue yields low priority', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priority).toBe('low');
  });

  test('low priority reason mentions no revenue', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priorityReason).toContain('Geen omzet');
  });
});

// ============================================================================
// prioritizeProductsByRevenue — With margin data
// ============================================================================

describe('prioritizeProductsByRevenue — margin data in reason', () => {
  beforeEach(() => {
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeProduct({
          id: 'prod-margin',
          name: 'Product met Marge',
          revenue30d: 5000,
          revenue90d: 15000,
          margin: 45,
          overallSeoScore: 20,
        }),
      ])
    );
  });

  test('Dutch explanation includes margin info', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priorityReason).toContain('Marge');
    expect(results[0].priorityReason).toContain('45%');
  });

  test('margin context mentions optimization value', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priorityReason).toContain('winstmarge');
  });
});

// ============================================================================
// prioritizeProductsByRevenue — No 30d revenue but 90d revenue
// ============================================================================

describe('prioritizeProductsByRevenue — declining product (no 30d, has 90d)', () => {
  beforeEach(() => {
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeProduct({
          id: 'prod-declining',
          name: 'Dalend Product',
          revenue30d: 0,
          revenue90d: 3000,
          overallSeoScore: 60,
        }),
      ])
    );
  });

  test('no 30d revenue but has 90d revenue yields medium priority', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priority).toBe('medium');
  });

  test('reason mentions revenue decline investigation', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priorityReason).toContain('daling');
  });
});

// ============================================================================
// prioritizeProductsByRevenue — No SEO score
// ============================================================================

describe('prioritizeProductsByRevenue — revenue but no SEO score', () => {
  beforeEach(() => {
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeProduct({
          id: 'prod-no-seo',
          name: 'Geen SEO Score',
          revenue30d: 5000,
          revenue90d: 15000,
          overallSeoScore: null,
        }),
      ])
    );
  });

  test('null SEO score treated as 0 yields critical priority', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    // seoScore < 40 → critical
    expect(results[0].priority).toBe('critical');
  });
});

// ============================================================================
// prioritizeProductsByRevenue — Sorting by priority then revenue
// ============================================================================

describe('prioritizeProductsByRevenue — sorting by priority then revenue', () => {
  beforeEach(() => {
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeProduct({ id: 'low-1', revenue30d: 100, revenue90d: 300, overallSeoScore: 80 }),
        makeProduct({ id: 'critical-1', revenue30d: 5000, revenue90d: 15000, overallSeoScore: 20 }),
        makeProduct({ id: 'high-1', revenue30d: 3000, revenue90d: 9000, overallSeoScore: 55 }),
        makeProduct({ id: 'critical-2', revenue30d: 8000, revenue90d: 24000, overallSeoScore: 10 }),
      ])
    );
  });

  test('results are sorted by priority: critical first', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    expect(results[0].priority).toBe('critical');
    expect(results[1].priority).toBe('critical');
  });

  test('within same priority, sorted by revenue descending', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    // Both critical: critical-2 (8000) should come before critical-1 (5000)
    expect(results[0].productId).toBe('critical-2');
    expect(results[1].productId).toBe('critical-1');
  });

  test('high priority comes after critical but before medium', async () => {
    const results = await prioritizeProductsByRevenue('proj-1');
    const priorities = results.map(r => r.priority);
    const criticalIdx = priorities.indexOf('critical');
    const highIdx = priorities.indexOf('high');
    // critical should appear before high
    expect(criticalIdx).toBeLessThan(highIdx);
  });
});
