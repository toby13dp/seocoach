/**
 * Rank CSV Import Tests
 * Tests for /src/lib/local-seo/rank-import.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockLocationFindUnique = mock(() => Promise.resolve(null));
const mockKeywordCreate = mock(() => Promise.resolve({ id: 'kw-1' }));
const mockRankImportCreate = mock(() => Promise.resolve({ id: 'ri-1' }));

mock.module('@/lib/db', () => ({
  db: {
    location: {
      findUnique: mockLocationFindUnique,
    },
    localKeyword: {
      create: mockKeywordCreate,
    },
    rankImport: {
      create: mockRankImportCreate,
    },
  },
}));

// Import AFTER mock.module
import { parseRankCSV, importRankCSV } from '@/lib/local-seo';

// ============================================================================
// Test: parseRankCSV — Dutch column names
// ============================================================================

describe('parseRankCSV — Dutch column names', () => {
  test('parses CSV with Dutch column names (zoekwoord, zoekvolume, etc.)', () => {
    const csv = 'zoekwoord,zoekvolume,moeilijkheid,huidige rang,doelrang,url,intentie\nrestaurant amsterdam,2400,45,3,1,https://example.nl,local';

    const { rows, errors } = parseRankCSV(csv);

    expect(errors.length).toBe(0);
    expect(rows.length).toBe(1);
    expect(rows[0].keyword).toBe('restaurant amsterdam');
    expect(rows[0].searchVolume).toBe(2400);
    expect(rows[0].difficulty).toBe(45);
    expect(rows[0].currentRank).toBe(3);
    expect(rows[0].targetRank).toBe(1);
    expect(rows[0].url).toBe('https://example.nl');
    expect(rows[0].intent).toBe('local');
  });

  test('parses CSV with alternative Dutch column names', () => {
    const csv = 'zoekterm,zoek volume,concurrentie,positie,doel positie,pagina,intentie\ntandarts utrecht,1800,60,5,1,https://tandarts.nl,local';

    const { rows, errors } = parseRankCSV(csv);

    expect(errors.length).toBe(0);
    expect(rows.length).toBe(1);
    expect(rows[0].keyword).toBe('tandarts utrecht');
    expect(rows[0].searchVolume).toBe(1800);
    expect(rows[0].currentRank).toBe(5);
  });
});

// ============================================================================
// Test: parseRankCSV — English column names
// ============================================================================

describe('parseRankCSV — English column names', () => {
  test('parses CSV with English column names', () => {
    const csv = 'keyword,volume,difficulty,current rank,target rank,url,intent\nplumber amsterdam,900,30,8,3,https://example.nl,local';

    const { rows, errors } = parseRankCSV(csv);

    expect(errors.length).toBe(0);
    expect(rows.length).toBe(1);
    expect(rows[0].keyword).toBe('plumber amsterdam');
    expect(rows[0].searchVolume).toBe(900);
    expect(rows[0].difficulty).toBe(30);
    expect(rows[0].currentRank).toBe(8);
    expect(rows[0].targetRank).toBe(3);
  });

  test('parses CSV with alternative English column names (position, search volume)', () => {
    const csv = 'keyword,search volume,kd,position,target position,page,intent\ndentist rotterdam,3200,55,12,5,https://example.nl,local';

    const { rows, errors } = parseRankCSV(csv);

    expect(errors.length).toBe(0);
    expect(rows.length).toBe(1);
    expect(rows[0].keyword).toBe('dentist rotterdam');
    expect(rows[0].searchVolume).toBe(3200);
    expect(rows[0].difficulty).toBe(55);
    expect(rows[0].currentRank).toBe(12);
  });
});

// ============================================================================
// Test: parseRankCSV — Handles missing optional columns
// ============================================================================

describe('parseRankCSV — missing optional columns', () => {
  test('handles CSV with only keyword column', () => {
    const csv = 'zoekwoord\nrestaurant amsterdam\ntandarts utrecht';

    const { rows, errors } = parseRankCSV(csv);

    expect(errors.length).toBe(0);
    expect(rows.length).toBe(2);
    expect(rows[0].keyword).toBe('restaurant amsterdam');
    expect(rows[0].searchVolume).toBeUndefined();
    expect(rows[0].currentRank).toBeUndefined();
  });

  test('handles missing volume column gracefully', () => {
    const csv = 'keyword,current rank\nrestaurant amsterdam,5';

    const { rows, errors } = parseRankCSV(csv);

    expect(errors.length).toBe(0);
    expect(rows[0].searchVolume).toBeUndefined();
    expect(rows[0].currentRank).toBe(5);
  });
});

// ============================================================================
// Test: parseRankCSV — Handles BOM
// ============================================================================

describe('parseRankCSV — BOM handling', () => {
  test('handles UTF-8 BOM at the start of CSV content', () => {
    // BOM character (0xFEFF) at start
    const bomChar = '\uFEFF';
    const csv = bomChar + 'zoekwoord,zoekvolume\nrestaurant amsterdam,2400';

    const { rows, errors } = parseRankCSV(csv);

    expect(errors.length).toBe(0);
    expect(rows.length).toBe(1);
    expect(rows[0].keyword).toBe('restaurant amsterdam');
  });
});

// ============================================================================
// Test: parseRankCSV — Handles quoted fields
// ============================================================================

describe('parseRankCSV — quoted fields', () => {
  test('handles quoted fields in CSV', () => {
    const csv = '"zoekwoord","zoekvolume","moeilijkheid"\n"restaurant amsterdam","2400","45"';

    const { rows, errors } = parseRankCSV(csv);

    expect(errors.length).toBe(0);
    expect(rows.length).toBe(1);
    expect(rows[0].keyword).toBe('restaurant amsterdam');
    expect(rows[0].searchVolume).toBe(2400);
  });

  test('handles fields with commas inside quotes', () => {
    const csv = '"zoekwoord","zoekvolume"\n"beste restaurant, amsterdam","2400"';

    const { rows, errors } = parseRankCSV(csv);

    expect(errors.length).toBe(0);
    expect(rows.length).toBe(1);
    expect(rows[0].keyword).toBe('beste restaurant, amsterdam');
  });

  test('handles escaped double quotes within fields', () => {
    const csv = '"zoekwoord","zoekvolume"\n"restaurant ""de luxe"" amsterdam","1200"';

    const { rows, errors } = parseRankCSV(csv);

    expect(errors.length).toBe(0);
    expect(rows[0].keyword).toBe('restaurant "de luxe" amsterdam');
  });
});

// ============================================================================
// Test: parseRankCSV — Invalid rows are skipped
// ============================================================================

describe('parseRankCSV — invalid rows', () => {
  test('skips rows with empty keyword', () => {
    const csv = 'zoekwoord,zoekvolume\nrestaurant amsterdam,2400\n,1800\ntandarts utrecht,900';

    const { rows, errors } = parseRankCSV(csv);

    expect(rows.length).toBe(2);
    expect(rows[0].keyword).toBe('restaurant amsterdam');
    expect(rows[1].keyword).toBe('tandarts utrecht');
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('zoekwoord ontbreekt');
  });

  test('returns error when keyword column is missing entirely', () => {
    const csv = 'zoekvolume,moeilijkheid\n2400,45';

    const { rows, errors } = parseRankCSV(csv);

    expect(rows.length).toBe(0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('zoekwoord');
  });

  test('returns error for CSV with no data rows', () => {
    const csv = 'zoekwoord,zoekvolume';

    const { rows, errors } = parseRankCSV(csv);

    expect(rows.length).toBe(0);
    expect(errors.some((e) => e.includes('geen geldige rijen'))).toBe(true);
  });
});

// ============================================================================
// Test: parseRankCSV — Semicolon delimiter
// ============================================================================

describe('parseRankCSV — delimiter detection', () => {
  test('auto-detects semicolon delimiter', () => {
    const csv = 'zoekwoord;zoekvolume;moeilijkheid\nrestaurant amsterdam;2400;45';

    const { rows, errors } = parseRankCSV(csv);

    expect(errors.length).toBe(0);
    expect(rows.length).toBe(1);
    expect(rows[0].keyword).toBe('restaurant amsterdam');
    expect(rows[0].searchVolume).toBe(2400);
  });

  test('auto-detects tab delimiter', () => {
    const csv = 'zoekwoord\tzoekvolume\tmoeilijkheid\nrestaurant amsterdam\t2400\t45';

    const { rows, errors } = parseRankCSV(csv);

    expect(errors.length).toBe(0);
    expect(rows.length).toBe(1);
    expect(rows[0].keyword).toBe('restaurant amsterdam');
  });
});

// ============================================================================
// Test: importRankCSV
// ============================================================================

describe('importRankCSV', () => {
  beforeEach(() => {
    mockKeywordCreate.mockReset();
    mockRankImportCreate.mockReset();
    mockLocationFindUnique.mockReset();
  });

  test('creates LocalKeyword records for each valid row', async () => {
    mockKeywordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'kw-new', ...args.data })
    );
    mockRankImportCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'ri-new', ...args.data })
    );

    const csv =
      'zoekwoord,zoekvolume,huidige rang\nrestaurant amsterdam,2400,3\ntandarts utrecht,1800,5';

    const result = await importRankCSV('proj-1', csv);

    expect(mockKeywordCreate).toHaveBeenCalledTimes(2);
    expect(result.successCount).toBe(2);
  });

  test('generates a unique import batch ID', async () => {
    mockKeywordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'kw-new', ...args.data })
    );
    mockRankImportCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'ri-new', ...args.data })
    );

    const csv = 'zoekwoord,zoekvolume\ntest,100';

    const result = await importRankCSV('proj-1', csv);

    expect(result.batch).toContain('rank_');
    expect(result.batch).toContain('proj-1');
  });

  test('creates RankImport record with correct counts', async () => {
    mockKeywordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'kw-new', ...args.data })
    );
    mockRankImportCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'ri-new', ...args.data })
    );

    const csv =
      'zoekwoord,zoekvolume\nrestaurant amsterdam,2400\ntandarts utrecht,1800';

    await importRankCSV('proj-1', csv);

    expect(mockRankImportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          source: 'csv_import',
          rowCount: 2,
          successCount: 2,
          errorCount: 0,
        }),
      })
    );
  });

  test('sets intent to LOCAL by default for imported keywords', async () => {
    mockKeywordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'kw-new', ...args.data })
    );
    mockRankImportCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'ri-new', ...args.data })
    );

    const csv = 'zoekwoord,zoekvolume\nrestaurant amsterdam,2400';

    await importRankCSV('proj-1', csv);

    expect(mockKeywordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          intent: 'LOCAL',
        }),
      })
    );
  });

  test('maps intent values to valid LocalKeywordIntent values', async () => {
    mockKeywordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'kw-new', ...args.data })
    );
    mockRankImportCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'ri-new', ...args.data })
    );

    const csv = 'zoekwoord,intentie\nfiets kopen,transactional\nwat is seo,informational';

    await importRankCSV('proj-1', csv);

    expect(mockKeywordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ intent: 'TRANSACTIONAL' }),
      })
    );
    expect(mockKeywordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ intent: 'INFORMATIONAL' }),
      })
    );
  });

  test('handles error during keyword creation gracefully', async () => {
    let callCount = 0;
    mockKeywordCreate.mockImplementation((args: any) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Database fout');
      }
      return Promise.resolve({ id: 'kw-new', ...args.data });
    });
    mockRankImportCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'ri-new', ...args.data })
    );

    const csv =
      'zoekwoord,zoekvolume\nfail keyword,100\nsuccess keyword,200';

    const result = await importRankCSV('proj-1', csv);

    expect(result.successCount).toBe(1);
    expect(result.errorCount).toBe(1);
    expect(result.errors.some((e) => e.includes('fout bij importeren'))).toBe(
      true
    );
  });

  test('validates locationId when provided', async () => {
    mockLocationFindUnique.mockImplementation(() => Promise.resolve(null));
    mockRankImportCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'ri-new', ...args.data })
    );

    const csv = 'zoekwoord,zoekvolume\ntest,100';

    const result = await importRankCSV('proj-1', csv, 'nonexistent-location');

    expect(result.successCount).toBe(0);
    expect(result.errors.some((e) => e.includes('Locatie niet gevonden'))).toBe(
      true
    );
  });

  test('succeeds when locationId exists', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve({ id: 'loc-1', name: 'Test' })
    );
    mockKeywordCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'kw-new', ...args.data })
    );
    mockRankImportCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'ri-new', ...args.data })
    );

    const csv = 'zoekwoord,zoekvolume\nrestaurant amsterdam,2400';

    const result = await importRankCSV('proj-1', csv, 'loc-1');

    expect(result.successCount).toBe(1);
  });

  test('clamps difficulty to 0-100 range', () => {
    const csv = 'zoekwoord,moeilijkheid\ntest,150\ntest2,-10';

    const { rows } = parseRankCSV(csv);

    expect(rows[0].difficulty).toBe(100);
    expect(rows[1].difficulty).toBe(0);
  });

  test('clamps currentRank to minimum of 1', () => {
    const csv = 'zoekwoord,huidige rang\ntest,0\ntest2,-5';

    const { rows } = parseRankCSV(csv);

    expect(rows[0].currentRank).toBe(1);
    expect(rows[1].currentRank).toBe(1);
  });
});
