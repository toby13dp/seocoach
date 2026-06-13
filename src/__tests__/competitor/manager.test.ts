/**
 * Competitor Manager Tests
 * Tests for /src/lib/competitor/index.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockCompetitorFindMany = mock(() => Promise.resolve([]));
const mockCompetitorFindUnique = mock(() => Promise.resolve(null));
const mockCompetitorCreate = mock(() => Promise.resolve({ id: 'comp-1' }));
const mockCompetitorUpdate = mock(() => Promise.resolve({ id: 'comp-1' }));
const mockSnapshotCreate = mock(() => Promise.resolve({ id: 'snap-1' }));
const mockSnapshotFindMany = mock(() => Promise.resolve([]));
const mockChangeCreate = mock(() => Promise.resolve({ id: 'change-1' }));
const mockChangeFindMany = mock(() => Promise.resolve([]));
const mockChangeUpdate = mock(() => Promise.resolve({ id: 'change-1' }));

mock.module('@/lib/db', () => ({
  db: {
    competitor: {
      findMany: mockCompetitorFindMany,
      findUnique: mockCompetitorFindUnique,
      create: mockCompetitorCreate,
      update: mockCompetitorUpdate,
    },
    competitorSnapshot: {
      create: mockSnapshotCreate,
      findMany: mockSnapshotFindMany,
    },
    competitorChange: {
      create: mockChangeCreate,
      findMany: mockChangeFindMany,
      update: mockChangeUpdate,
    },
  },
}));

// Mock crawler dependencies so crawlCompetitor doesn't make real HTTP requests
mock.module('@/lib/crawler/ssrf', () => ({
  validateUrl: () => ({ valid: true }),
}));
mock.module('@/lib/crawler/robots', () => ({
  fetchRobotsTxt: () => Promise.resolve(''),
  parseRobotsTxt: () => ({}),
  isAllowed: () => true,
  parseCrawlDelay: () => null,
}));
mock.module('@/lib/crawler/parser', () => ({
  parsePage: () => ({
    title: 'Test Page',
    description: 'Test description',
    headings: [],
    mainContent: '',
    internalLinks: [],
    structuredData: [],
    wordCount: 100,
  }),
  normalizeUrl: (url: string) => url,
}));

// Mock global fetch so crawlCompetitor doesn't make real HTTP requests
const originalFetch = globalThis.fetch;
(globalThis as any).fetch = () => Promise.resolve({
  ok: true,
  status: 200,
  text: () => Promise.resolve('<html><head><title>Test</title></head><body><p>Content</p></body></html>'),
  headers: new Map([['content-type', 'text/html']]),
});

import {
  getCompetitors,
  getCompetitor,
  addCompetitor,
  updateCompetitor,
  softDeleteCompetitor,
  crawlCompetitor,
  detectChanges,
  getCompetitorChanges,
  dismissChange,
} from '@/lib/competitor';

// ============================================================================
// Test: addCompetitor
// ============================================================================

describe('addCompetitor', () => {
  beforeEach(() => {
    mockCompetitorCreate.mockReset();
  });

  test('creates a new competitor with required fields', async () => {
    mockCompetitorCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'comp-1', ...args.data })
    );

    await addCompetitor('proj-1', 'Concurrent BV', 'https://www.concurrent.nl');

    expect(mockCompetitorCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          name: 'Concurrent BV',
          websiteUrl: 'https://www.concurrent.nl',
        }),
      })
    );
  });

  test('creates a competitor with optional description', async () => {
    mockCompetitorCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'comp-2', ...args.data })
    );

    await addCompetitor('proj-1', 'Test Concurrent', 'https://test.nl', 'Onze grootste concurrent');

    expect(mockCompetitorCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Onze grootste concurrent',
        }),
      })
    );
  });
});

// ============================================================================
// Test: updateCompetitor
// ============================================================================

describe('updateCompetitor', () => {
  beforeEach(() => {
    mockCompetitorUpdate.mockReset();
  });

  test('updates competitor fields', async () => {
    mockCompetitorUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'comp-1', ...args.data })
    );

    await updateCompetitor('comp-1', {
      name: 'Updated Name',
      description: 'Updated description',
    });

    expect(mockCompetitorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comp-1' },
        data: expect.objectContaining({
          name: 'Updated Name',
          description: 'Updated description',
        }),
      })
    );
  });
});

// ============================================================================
// Test: removeCompetitor (soft delete)
// ============================================================================

describe('softDeleteCompetitor', () => {
  beforeEach(() => {
    mockCompetitorUpdate.mockReset();
  });

  test('soft deletes by setting deletedAt timestamp', async () => {
    mockCompetitorUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'comp-1', deletedAt: args.data.deletedAt })
    );

    await softDeleteCompetitor('comp-1');

    expect(mockCompetitorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comp-1' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      })
    );
  });
});

// ============================================================================
// Test: crawl creates snapshots
// ============================================================================

describe('crawlCompetitor — creates snapshots', () => {
  beforeEach(() => {
    mockCompetitorFindUnique.mockReset();
    mockSnapshotCreate.mockReset();
    mockCompetitorUpdate.mockReset();
    mockSnapshotFindMany.mockReset();
  });

  test('creates a snapshot when crawling', async () => {
    mockCompetitorFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: 'comp-1',
        projectId: 'proj-1',
        name: 'Concurrent BV',
        websiteUrl: 'https://www.concurrent.nl',
        isActive: true,
      })
    );
    mockSnapshotCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'snap-1', ...args.data })
    );
    mockCompetitorUpdate.mockImplementation(() => Promise.resolve({ id: 'comp-1' }));
    mockSnapshotFindMany.mockImplementation(() => Promise.resolve([]));

    const result = await crawlCompetitor('comp-1');

    expect(mockSnapshotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          competitorId: 'comp-1',
          url: 'https://www.concurrent.nl',
        }),
      })
    );
    // crawlCompetitor returns the number of snapshots created
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  test('updates lastCrawledAt on competitor', async () => {
    mockCompetitorFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: 'comp-1',
        projectId: 'proj-1',
        name: 'Concurrent BV',
        websiteUrl: 'https://www.concurrent.nl',
        isActive: true,
      })
    );
    mockSnapshotCreate.mockImplementation(() => Promise.resolve({ id: 'snap-1' }));
    mockCompetitorUpdate.mockImplementation(() => Promise.resolve({ id: 'comp-1' }));
    mockSnapshotFindMany.mockImplementation(() => Promise.resolve([]));

    await crawlCompetitor('comp-1');

    expect(mockCompetitorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comp-1' },
        data: expect.objectContaining({
          lastCrawledAt: expect.any(Date),
        }),
      })
    );
  });

  test('throws error when competitor not found', async () => {
    mockCompetitorFindUnique.mockImplementation(() => Promise.resolve(null));

    await expect(crawlCompetitor('nonexistent')).rejects.toThrow('Concurrent niet gevonden');
  });
});

// ============================================================================
// Test: change detection creates CompetitorChange records
// ============================================================================

describe('detectChanges — creates CompetitorChange records', () => {
  beforeEach(() => {
    mockCompetitorFindUnique.mockReset();
    mockSnapshotFindMany.mockReset();
    mockChangeCreate.mockReset();
  });

  test('detects title change and creates CompetitorChange record', async () => {
    mockCompetitorFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: 'comp-1',
        projectId: 'proj-1',
      })
    );
    mockSnapshotFindMany.mockImplementation(() =>
      Promise.resolve([
        { id: 'snap-2', competitorId: 'comp-1', url: 'https://www.concurrent.nl', title: 'Nieuwe Titel', metaDescription: null, headings: null, topics: null, services: null, locations: null, structuredData: null, internalLinks: null, publicPrices: null, crawledAt: new Date() },
        { id: 'snap-1', competitorId: 'comp-1', url: 'https://www.concurrent.nl', title: 'Oude Titel', metaDescription: null, headings: null, topics: null, services: null, locations: null, structuredData: null, internalLinks: null, publicPrices: null, crawledAt: new Date() },
      ])
    );
    mockChangeCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'change-1', ...args.data })
    );

    const result = await detectChanges('comp-1');

    // detectChanges returns an array of created CompetitorChange records
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(mockChangeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changeType: 'TITLE_CHANGE',
        }),
      })
    );
  });
});

// ============================================================================
// Test: traffic/revenue are never invented
// ============================================================================

describe('competitor data — traffic/revenue never invented', () => {
  test('addCompetitor does not include traffic or revenue fields', async () => {
    mockCompetitorCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'comp-1', ...args.data })
    );

    await addCompetitor('proj-1', 'Test', 'https://test.nl');

    const data = mockCompetitorCreate.mock.calls[0][0].data;
    // Should NOT have any traffic or revenue related fields
    expect(data.traffic).toBeUndefined();
    expect(data.revenue).toBeUndefined();
    expect(data.monthlyVisitors).toBeUndefined();
    expect(data.estimatedRevenue).toBeUndefined();
  });

  test('crawl snapshot does not include traffic or revenue', async () => {
    mockCompetitorFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: 'comp-1',
        projectId: 'proj-1',
        name: 'Concurrent BV',
        websiteUrl: 'https://www.concurrent.nl',
        isActive: true,
      })
    );
    mockSnapshotCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'snap-1', ...args.data })
    );
    mockCompetitorUpdate.mockImplementation(() => Promise.resolve({ id: 'comp-1' }));
    mockSnapshotFindMany.mockImplementation(() => Promise.resolve([]));

    await crawlCompetitor('comp-1');

    const data = mockSnapshotCreate.mock.calls[0][0].data;
    // Should NOT have traffic or revenue data
    expect(data.traffic).toBeUndefined();
    expect(data.revenue).toBeUndefined();
    expect(data.monthlyVisitors).toBeUndefined();
  });
});

// ============================================================================
// Test: getCompetitorChanges
// ============================================================================

describe('getCompetitorChanges', () => {
  beforeEach(() => {
    mockChangeFindMany.mockReset();
  });

  test('returns changes for a competitor', async () => {
    const mockChanges = [
      { id: 'ch-1', competitorId: 'comp-1', changeType: 'TITLE_CHANGE', changeSummary: 'Titel gewijzigd', competitor: { id: 'comp-1', name: 'Concurrent', websiteUrl: 'https://test.nl' } },
    ];
    mockChangeFindMany.mockImplementation(() => Promise.resolve(mockChanges));

    // getCompetitorChanges is aliased from getCompetitorFeed, which takes projectId as first arg
    const result = await getCompetitorChanges('proj-1');

    // Result includes enriched changeTypeLabel
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('ch-1');
    expect(result[0].changeTypeLabel).toBeDefined();
  });

  test('filters by changeType', async () => {
    mockChangeFindMany.mockImplementation(() => Promise.resolve([]));

    await getCompetitorChanges('proj-1', { changeType: 'TITLE_CHANGE' });

    expect(mockChangeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          changeType: 'TITLE_CHANGE',
        }),
      })
    );
  });

  test('filters by showDismissed status', async () => {
    mockChangeFindMany.mockImplementation(() => Promise.resolve([]));

    await getCompetitorChanges('proj-1', { showDismissed: false });

    expect(mockChangeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dismissed: false,
        }),
      })
    );
  });
});

// ============================================================================
// Test: dismissChange
// ============================================================================

describe('dismissChange', () => {
  beforeEach(() => {
    mockChangeUpdate.mockReset();
  });

  test('sets dismissed=true with userId and timestamp', async () => {
    mockChangeUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'change-1', ...args.data })
    );

    await dismissChange('change-1', 'user-1');

    expect(mockChangeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'change-1' },
        data: expect.objectContaining({
          dismissed: true,
          dismissedBy: 'user-1',
          dismissedAt: expect.any(Date),
        }),
      })
    );
  });

  test('dismisses a change with a different user', async () => {
    mockChangeUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'change-2', ...args.data })
    );

    await dismissChange('change-2', 'user-2');

    expect(mockChangeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'change-2' },
        data: expect.objectContaining({
          dismissed: true,
          dismissedBy: 'user-2',
          dismissedAt: expect.any(Date),
        }),
      })
    );
  });
});
