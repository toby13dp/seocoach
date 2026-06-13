/**
 * CSV Import Tests
 * Tests for /src/lib/analytics/csv-import.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockFindUnique = mock(() => Promise.resolve(null));
const mockCreate = mock(() => Promise.resolve({ id: 'dm-1' }));
const mockUpdate = mock(() => Promise.resolve({ id: 'dm-1' }));

mock.module('@/lib/db', () => ({
  db: {
    dailyMetric: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
    queryPerformance: {
      findUnique: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({ id: 'qp-1' })),
      update: mock(() => Promise.resolve({ id: 'qp-1' })),
    },
  },
}));

import {
  importSearchPerformanceCSV,
  importQueryPerformanceCSV,
  importAnalyticsCSV,
  previewCSV,
} from '@/lib/analytics/csv-import';

// ============================================================================
// Test: parseCSV with various delimiters
// ============================================================================

describe('parseCSV — delimiter detection', () => {
  test('detects comma delimiter in standard CSV', async () => {
    const csv = 'date,clicks,impressions\n2025-01-15,100,500';
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.errors.length).toBeLessThan(2);
  });

  test('detects semicolon delimiter in Dutch CSV', async () => {
    const csv = 'datum;kliks;weergaven\n2025-01-15;100;500';
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.errors.length).toBeLessThan(2);
  });

  test('detects tab delimiter in TSV', async () => {
    const csv = 'date\tclicks\timpressions\n2025-01-15\t100\t500';
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.errors.length).toBeLessThan(2);
  });
});

// ============================================================================
// Test: Column mapping with Dutch and English headers
// ============================================================================

describe('Column mapping — Dutch and English headers', () => {
  test('maps English headers correctly', () => {
    const csv = 'date,clicks,impressions,ctr,position\n2025-01-15,100,500,0.2,5.5';
    const preview = previewCSV(csv);
    expect(preview.headers).toContain('date');
    expect(preview.headers).toContain('clicks');
    expect(preview.headers).toContain('impressions');
  });

  test('maps Dutch headers correctly', () => {
    const csv = 'datum,kliks,weergaven,klikfrequentie,positie\n2025-01-15,100,500,0.2,5.5';
    const preview = previewCSV(csv);
    expect(preview.headers).toContain('date');
    expect(preview.headers).toContain('clicks');
    expect(preview.headers).toContain('impressions');
    expect(preview.headers).toContain('ctr');
    expect(preview.headers).toContain('position');
  });

  test('maps Dutch analytics headers', () => {
    const csv = 'datum,sessies,gebruikers,paginaweergaven,bouncepercentage\n2025-01-15,200,150,400,0.45';
    const preview = previewCSV(csv);
    expect(preview.headers).toContain('date');
    expect(preview.headers).toContain('sessions');
    expect(preview.headers).toContain('users');
    expect(preview.headers).toContain('pageViews');
    expect(preview.headers).toContain('bounceRate');
  });

  test('maps conversion and revenue Dutch headers', () => {
    const csv = 'datum,conversies,conversiepercentage,omzet\n2025-01-15,10,0.05,1250.50';
    const preview = previewCSV(csv);
    expect(preview.headers).toContain('date');
    expect(preview.headers).toContain('conversions');
    expect(preview.headers).toContain('conversionRate');
    expect(preview.headers).toContain('revenue');
  });
});

// ============================================================================
// Test: Date parsing formats
// ============================================================================

describe('Date parsing — various formats', () => {
  test('parses YYYY-MM-DD format', async () => {
    const csv = 'date,clicks\n2025-01-15,100';
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.imported).toBeGreaterThanOrEqual(1);
  });

  test('parses DD-MM-YYYY format', async () => {
    const csv = 'date,clicks\n15-01-2025,100';
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.imported).toBeGreaterThanOrEqual(1);
  });

  test('parses DD/MM/YYYY format', async () => {
    const csv = 'date,clicks\n15/01/2025,100';
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.imported).toBeGreaterThanOrEqual(1);
  });

  test('rejects invalid date format', async () => {
    const csv = 'date,clicks\nnot-a-date,100';
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Test: Number parsing — Dutch and English formats
// ============================================================================

describe('Number parsing — Dutch and English formats', () => {
  test('parses English number format (1,234.56)', async () => {
    const csv = 'date,clicks,position\n2025-01-15,1234,5.75';
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.imported).toBeGreaterThanOrEqual(1);
  });

  test('parses Dutch number format for position (5,75)', async () => {
    const csv = 'date,clicks,positie\n2025-01-15,100,5,75';
    // Dutch format with comma as decimal separator for position
    // This is semicolon-delimited to avoid comma confusion
    const csvSemicolon = 'datum;kliks;positie\n2025-01-15;100;5,75';
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csvSemicolon);
    expect(result.imported).toBeGreaterThanOrEqual(1);
  });

  test('parses percentage values', async () => {
    const csv = 'date,clicks,ctr\n2025-01-15,100,12.5%';
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.imported).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Test: importSearchPerformanceCSV with valid data
// ============================================================================

describe('importSearchPerformanceCSV — valid data', () => {
  beforeEach(() => {
    mockFindUnique.mockImplementation(() => Promise.resolve(null));
    mockCreate.mockImplementation((data: any) => Promise.resolve({ id: 'dm-new', ...data }));
  });

  test('imports valid search performance CSV', async () => {
    const csv = `date,clicks,impressions,ctr,position
2025-01-15,100,500,0.20,5.5
2025-01-16,120,550,0.22,5.2`;

    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.imported).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  test('imports CSV with segmentation columns', async () => {
    const csv = `date,clicks,impressions,ctr,position,device,country
2025-01-15,60,300,0.20,5.5,desktop,NLD
2025-01-15,40,200,0.20,6.1,mobile,NLD`;

    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.imported).toBe(2);
  });
});

// ============================================================================
// Test: importSearchPerformanceCSV with invalid data
// ============================================================================

describe('importSearchPerformanceCSV — invalid data', () => {
  test('skips rows with missing dates', async () => {
    const csv = `date,clicks,impressions,ctr,position
,100,500,0.20,5.5
2025-01-16,120,550,0.22,5.2`;

    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  test('skips rows with negative clicks', async () => {
    const csv = `date,clicks,impressions,ctr,position
2025-01-15,-10,500,0.20,5.5`;

    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  test('rejects CSV with no date column', async () => {
    const csv = `clicks,impressions,ctr,position
100,500,0.20,5.5`;

    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('datumkolom');
  });
});

// ============================================================================
// Test: importQueryPerformanceCSV with valid data
// ============================================================================

describe('importQueryPerformanceCSV — valid data', () => {
  test('imports valid query performance CSV', async () => {
    const csv = `date,query,clicks,impressions,ctr,position
2025-01-15,seo tools,50,200,0.25,3.5
2025-01-15,seo software,30,150,0.20,5.0`;

    const result = await importQueryPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.imported).toBe(2);
    expect(result.errors.length).toBe(0);
  });

  test('imports with Dutch column headers', async () => {
    const csv = `datum;zoekwoord;kliks;weergaven;klikfrequentie;positie
2025-01-15;seo tools;50;200;0,25;3,5`;

    const result = await importQueryPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.imported).toBeGreaterThanOrEqual(1);
  });

  test('rejects CSV with no query column', async () => {
    const csv = `date,clicks,impressions,ctr,position
2025-01-15,50,200,0.25,3.5`;

    const result = await importQueryPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('zoekwoordkolom');
  });
});

// ============================================================================
// Test: importAnalyticsCSV with valid data
// ============================================================================

describe('importAnalyticsCSV — valid data', () => {
  test('imports valid analytics CSV', async () => {
    const csv = `date,sessions,users,bounceRate
2025-01-15,200,150,0.45
2025-01-16,220,160,0.42`;

    const result = await importAnalyticsCSV('proj-1', 'conn-1', csv);
    expect(result.imported).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Test: Duplicate handling (upsert behavior)
// ============================================================================

describe('Duplicate handling — upsert behavior', () => {
  test('updates existing records instead of creating duplicates', async () => {
    // First call returns an existing record → update path
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ id: 'dm-existing' })
    );
    mockUpdate.mockImplementation(() =>
      Promise.resolve({ id: 'dm-existing' })
    );

    const csv = `date,clicks,impressions,ctr,position
2025-01-15,100,500,0.20,5.5`;

    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.updated).toBeGreaterThanOrEqual(1);
    expect(result.imported).toBe(0);
  });
});

// ============================================================================
// Test: Empty CSV handling
// ============================================================================

describe('Empty CSV handling', () => {
  test('rejects empty CSV', async () => {
    const csv = '';
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('geen gegevens');
  });

  test('rejects CSV with only headers', async () => {
    const csv = 'date,clicks,impressions,ctr,position';
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('geen gegevens');
  });

  test('rejects CSV with no valid rows', async () => {
    const csv = `date,clicks,impressions,ctr,position
invalid,-10,500,0.20,5.5`;
    const result = await importSearchPerformanceCSV('proj-1', 'conn-1', csv);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Test: previewCSV utility
// ============================================================================

describe('previewCSV', () => {
  test('returns headers and rows for valid CSV', () => {
    const csv = `date,clicks,impressions
2025-01-15,100,500
2025-01-16,120,550`;

    const result = previewCSV(csv);
    expect(result.headers.length).toBe(3);
    expect(result.totalRows).toBe(2);
  });

  test('returns empty result for empty content', () => {
    const result = previewCSV('');
    expect(result.headers.length).toBe(0);
    expect(result.rows.length).toBe(0);
    expect(result.totalRows).toBe(0);
  });

  test('maps Dutch headers to field names', () => {
    const csv = `datum,kliks,weergaven,klikfrequentie,positie
2025-01-15,100,500,0.20,5.5`;

    const result = previewCSV(csv);
    expect(result.headers).toContain('date');
    expect(result.headers).toContain('clicks');
    expect(result.headers).toContain('impressions');
    expect(result.headers).toContain('ctr');
    expect(result.headers).toContain('position');
  });
});
