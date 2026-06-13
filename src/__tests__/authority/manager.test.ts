/**
 * Authority Manager Tests
 * Tests for /src/lib/authority/index.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockRecordFindMany = mock(() => Promise.resolve([]));
const mockRecordFindUnique = mock(() => Promise.resolve(null));
const mockRecordCreate = mock(() => Promise.resolve({ id: 'rec-1' }));
const mockRecordUpdate = mock(() => Promise.resolve({ id: 'rec-1' }));
const mockRecordCount = mock(() => Promise.resolve(0));
const mockCampaignFindMany = mock(() => Promise.resolve([]));
const mockCampaignCreate = mock(() => Promise.resolve({ id: 'camp-1' }));

mock.module('@/lib/db', () => ({
  db: {
    authorityRecord: {
      findMany: mockRecordFindMany,
      findUnique: mockRecordFindUnique,
      create: mockRecordCreate,
      update: mockRecordUpdate,
      count: mockRecordCount,
    },
    outreachCampaign: {
      findMany: mockCampaignFindMany,
      create: mockCampaignCreate,
    },
  },
}));

import {
  getAuthorityRecords,
  getAuthorityRecord,
  addAuthorityRecord,
  updateAuthorityRecord,
  markAsLost,
  importCsvBacklinks,
  calculateAuthoritySummary,
  getOutreachCampaigns,
  createOutreachCampaign,
} from '@/lib/authority';

// ============================================================================
// Test: addAuthorityRecord
// ============================================================================

describe('addAuthorityRecord', () => {
  beforeEach(() => {
    mockRecordCreate.mockReset();
  });

  test('creates a backlink record with required fields', async () => {
    mockRecordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'rec-1', ...args.data })
    );

    const result = await addAuthorityRecord('proj-1', {
      type: 'BACKLINK',
      sourceUrl: 'https://example.com/page',
      targetUrl: 'https://myproject.nl/article',
      anchorText: 'SEO tips',
      domain: 'example.com',
    });

    expect(mockRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          type: 'BACKLINK',
          sourceUrl: 'https://example.com/page',
          targetUrl: 'https://myproject.nl/article',
          anchorText: 'SEO tips',
          domain: 'example.com',
        }),
      })
    );
  });

  test('creates record with quality metrics', async () => {
    mockRecordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'rec-2', ...args.data })
    );

    await addAuthorityRecord('proj-1', {
      type: 'BACKLINK',
      domain: 'high-da.com',
      domainAuthority: 75,
      pageAuthority: 60,
      isNofollow: false,
    });

    expect(mockRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          domainAuthority: 75,
          pageAuthority: 60,
          isNofollow: false,
        }),
      })
    );
  });

  test('defaults status to active and isNofollow to false', async () => {
    mockRecordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'rec-3', ...args.data })
    );

    await addAuthorityRecord('proj-1', {
      type: 'BACKLINK',
    });

    expect(mockRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'active',
          isNofollow: false,
        }),
      })
    );
  });
});

// ============================================================================
// Test: getAuthorityRecords
// ============================================================================

describe('getAuthorityRecords', () => {
  beforeEach(() => {
    mockRecordFindMany.mockReset();
    mockRecordCount.mockReset();
  });

  test('returns records as an array', async () => {
    mockRecordFindMany.mockImplementation(() => Promise.resolve([]));
    mockRecordCount.mockImplementation(() => Promise.resolve(0));

    const result = await getAuthorityRecords('proj-1');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  test('filters by type', async () => {
    mockRecordFindMany.mockImplementation(() => Promise.resolve([]));
    mockRecordCount.mockImplementation(() => Promise.resolve(0));

    await getAuthorityRecords('proj-1', { type: 'BACKLINK' });

    expect(mockRecordFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'BACKLINK',
        }),
      })
    );
  });

  test('filters by status', async () => {
    mockRecordFindMany.mockImplementation(() => Promise.resolve([]));
    mockRecordCount.mockImplementation(() => Promise.resolve(0));

    await getAuthorityRecords('proj-1', { status: 'active' });

    expect(mockRecordFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'active',
        }),
      })
    );
  });

  test('filters by domain (contains)', async () => {
    mockRecordFindMany.mockImplementation(() => Promise.resolve([]));
    mockRecordCount.mockImplementation(() => Promise.resolve(0));

    await getAuthorityRecords('proj-1', { domain: 'example' });

    expect(mockRecordFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          domain: { contains: 'example' },
        }),
      })
    );
  });
});

// ============================================================================
// Test: CSV Import for backlink data
// ============================================================================

describe('importCsvBacklinks', () => {
  beforeEach(() => {
    mockRecordCreate.mockReset();
  });

  test('imports multiple backlink records from CSV', async () => {
    const csvContent = 'source url,target url,anchor text,domain,domain authority,nofollow\nhttps://a.com,https://me.nl/p1,link 1,a.com,50,false\nhttps://b.com,https://me.nl/p2,link 2,b.com,70,true';

    mockRecordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: `rec-${Date.now()}`, ...args.data })
    );

    const result = await importCsvBacklinks('proj-1', csvContent);

    expect(mockRecordCreate).toHaveBeenCalledTimes(2);
    expect(result.imported).toBe(2);
    expect(result.batchId).toContain('auth_');
  });

  test('sets type to BACKLINK for all imported records', async () => {
    mockRecordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'rec-csv', ...args.data })
    );

    await importCsvBacklinks('proj-1', 'source url,domain\nhttps://a.com,a.com');

    expect(mockRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'BACKLINK',
        }),
      })
    );
  });

  test('sets providerSource to csv_import by default', async () => {
    mockRecordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'rec-csv', ...args.data })
    );

    await importCsvBacklinks('proj-1', 'source url,domain\nhttps://a.com,a.com');

    expect(mockRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerSource: 'csv_import',
        }),
      })
    );
  });

  test('always sets providerSource to csv_import for CSV imports', async () => {
    mockRecordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'rec-csv', ...args.data })
    );

    await importCsvBacklinks('proj-1', 'source url,domain\nhttps://a.com,a.com');

    expect(mockRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerSource: 'csv_import',
        }),
      })
    );
  });

  test('sets importBatch to a consistent batch ID', async () => {
    mockRecordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'rec-csv', ...args.data })
    );

    await importCsvBacklinks('proj-1', 'source url,domain\nhttps://a.com,a.com\nhttps://b.com,b.com');

    const batchIds = mockRecordCreate.mock.calls.map(
      (call: any) => call[0].data.importBatch
    );
    expect(new Set(batchIds).size).toBe(1);
  });
});

// ============================================================================
// Test: markAsLost
// ============================================================================

describe('markAsLost', () => {
  beforeEach(() => {
    mockRecordUpdate.mockReset();
  });

  test('sets status to lost and records lostAt timestamp', async () => {
    mockRecordUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'rec-1', ...args.data })
    );

    await markAsLost('rec-1');

    expect(mockRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rec-1' },
        data: expect.objectContaining({
          status: 'lost',
          lostAt: expect.any(Date),
        }),
      })
    );
  });
});

// ============================================================================
// Test: updateAuthorityRecord
// ============================================================================

describe('updateAuthorityRecord', () => {
  beforeEach(() => {
    mockRecordUpdate.mockReset();
  });

  test('updates notes', async () => {
    mockRecordUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'rec-1', ...args.data })
    );

    await updateAuthorityRecord('rec-1', { notes: 'Nieuwe notitie over deze backlink' });

    expect(mockRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rec-1' },
        data: expect.objectContaining({
          notes: 'Nieuwe notitie over deze backlink',
        }),
      })
    );
  });

  test('updates status', async () => {
    mockRecordUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'rec-1', ...args.data })
    );

    await updateAuthorityRecord('rec-1', { status: 'outreached' });

    expect(mockRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'outreached',
        }),
      })
    );
  });
});

// ============================================================================
// Test: Summary Calculations
// ============================================================================

describe('calculateAuthoritySummary', () => {
  beforeEach(() => {
    mockRecordFindMany.mockReset();
  });

  test('calculates correct totals and breakdowns', async () => {
    const records = [
      { type: 'BACKLINK', status: 'active', domain: 'a.com' },
      { type: 'BACKLINK', status: 'active', domain: 'b.com' },
      { type: 'BACKLINK', status: 'lost', domain: 'c.com' },
      { type: 'BRAND_MENTION', status: 'active', domain: null },
    ];
    mockRecordFindMany.mockImplementation(() => Promise.resolve(records));

    const summary = await calculateAuthoritySummary('proj-1');

    expect(summary.total).toBe(4);
    expect(summary.byStatus['active']).toBe(3); // 3 active
    expect(summary.byStatus['lost']).toBe(1); // 1 lost
    expect(summary.byType['BACKLINK']).toBe(3);
    expect(summary.byType['BRAND_MENTION']).toBe(1);
  });

  test('calculates topDomains correctly', async () => {
    const records = [
      { type: 'BACKLINK', status: 'active', domain: 'a.com' },
      { type: 'BACKLINK', status: 'active', domain: 'a.com' },
      { type: 'BACKLINK', status: 'active', domain: 'b.com' },
    ];
    mockRecordFindMany.mockImplementation(() => Promise.resolve(records));

    const summary = await calculateAuthoritySummary('proj-1');

    // a.com appears 2 times, b.com appears 1 time
    expect(summary.topDomains[0]).toEqual({ domain: 'a.com', count: 2 });
    expect(summary.topDomains[1]).toEqual({ domain: 'b.com', count: 1 });
  });

  test('calculates byType breakdown', async () => {
    const records = [
      { type: 'BACKLINK', status: 'active', domain: null },
      { type: 'BACKLINK', status: 'active', domain: null },
      { type: 'BRAND_MENTION', status: 'active', domain: null },
    ];
    mockRecordFindMany.mockImplementation(() => Promise.resolve(records));

    const summary = await calculateAuthoritySummary('proj-1');

    expect(summary.byType['BACKLINK']).toBe(2);
    expect(summary.byType['BRAND_MENTION']).toBe(1);
  });

  test('calculates byStatus breakdown', async () => {
    const records = [
      { type: 'BACKLINK', status: 'active', domain: null },
      { type: 'BACKLINK', status: 'active', domain: null },
      { type: 'BACKLINK', status: 'lost', domain: null },
      { type: 'BACKLINK', status: 'outreached', domain: null },
    ];
    mockRecordFindMany.mockImplementation(() => Promise.resolve(records));

    const summary = await calculateAuthoritySummary('proj-1');

    expect(summary.byStatus['active']).toBe(2);
    expect(summary.byStatus['lost']).toBe(1);
    expect(summary.byStatus['outreached']).toBe(1);
  });

  test('returns zeros for empty project', async () => {
    mockRecordFindMany.mockImplementation(() => Promise.resolve([]));

    const summary = await calculateAuthoritySummary('proj-1');

    expect(summary.total).toBe(0);
    expect(summary.byType).toEqual({});
    expect(summary.byStatus).toEqual({});
    expect(summary.topDomains).toEqual([]);
    expect(summary.newLinks30Days).toBe(0);
    expect(summary.lostLinks30Days).toBe(0);
  });
});

// ============================================================================
// Test: Outreach Campaigns
// ============================================================================

describe('Outreach campaigns', () => {
  beforeEach(() => {
    mockCampaignCreate.mockReset();
    mockCampaignFindMany.mockReset();
  });

  test('creates an outreach campaign', async () => {
    mockCampaignCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'camp-1', ...args.data })
    );

    const result = await createOutreachCampaign('proj-1', 'Linkbuilding Q1', 'Koude outreach voor backlinks');

    expect(mockCampaignCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          name: 'Linkbuilding Q1',
          description: 'Koude outreach voor backlinks',
        }),
      })
    );
  });

  test('lists outreach campaigns for a project', async () => {
    const mockCampaigns = [
      { id: 'camp-1', projectId: 'proj-1', name: 'Campaign 1' },
    ];
    mockCampaignFindMany.mockImplementation(() => Promise.resolve(mockCampaigns));

    const result = await getOutreachCampaigns('proj-1');

    expect(result).toEqual(mockCampaigns);
  });
});
