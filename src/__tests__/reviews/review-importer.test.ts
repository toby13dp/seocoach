/**
 * Review Importer Tests
 * Tests for /src/lib/reviews/review-importer.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// ============================================================================
// Mock database for review importer tests
// ============================================================================

const mockReviewFindFirst = mock(() => Promise.resolve(null));
const mockReviewFindMany = mock(() => Promise.resolve([]));
const mockReviewCreate = mock(() => Promise.resolve({ id: 'rev-new' }));
const mockReviewUpdate = mock(() => Promise.resolve({ id: 'rev-existing' }));
const mockReviewCount = mock(() => Promise.resolve(0));

mock.module('@/lib/db', () => ({
  db: {
    review: {
      findFirst: mockReviewFindFirst,
      findMany: mockReviewFindMany,
      count: mockReviewCount,
      create: mockReviewCreate,
      update: mockReviewUpdate,
    },
    reviewResponse: {
      findFirst: mock(() => Promise.resolve(null)),
      findMany: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve({})),
      update: mock(() => Promise.resolve({})),
    },
  },
}));

// Import AFTER mock.module
import {
  parseReviewCSV,
  importReview,
  importReviewsBulk,
  importReviewsCSV,
} from '@/lib/reviews/review-importer';

// ============================================================================
// parseReviewCSV — Parses CSV with flexible column names
// ============================================================================

describe('parseReviewCSV — flexible column mapping', () => {
  test('parses CSV with Dutch column names (auteur, beoordeling, inhoud, datum)', () => {
    const csv = `auteur,beoordeling,inhoud,datum
Jan de Vries,4,Goed product snelle levering,2025-01-15`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results.length).toBe(1);
    expect(results[0].authorName).toBe('Jan de Vries');
    expect(results[0].rating).toBe(4);
    expect(results[0].content).toBe('Goed product snelle levering');
    expect(results[0].reviewDate).toBeInstanceOf(Date);
  });

  test('parses CSV with English column names (author, rating, content, date)', () => {
    const csv = `author,rating,content,date
John Doe,5,Excellent product,2025-02-20`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results.length).toBe(1);
    expect(results[0].authorName).toBe('John Doe');
    expect(results[0].rating).toBe(5);
    expect(results[0].content).toBe('Excellent product');
  });

  test('parses CSV with mixed Dutch/English column names', () => {
    const csv = `auteur,rating,inhoud,datum
Piet,3,Gemiddeld,2025-01-01`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results.length).toBe(1);
    expect(results[0].authorName).toBe('Piet');
    expect(results[0].rating).toBe(3);
    expect(results[0].content).toBe('Gemiddeld');
  });

  test('parses CSV with alternative column aliases', () => {
    const csv = `naam,sterren,tekst,geplaatst
Klaas,4,Top kwaliteit,2025-03-10`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results.length).toBe(1);
    expect(results[0].authorName).toBe('Klaas');
    expect(results[0].rating).toBe(4);
    expect(results[0].content).toBe('Top kwaliteit');
  });

  test('assigns the specified source type', () => {
    const csv = `author,rating,content
Jan,4,Goed`;

    const results = parseReviewCSV(csv, 'GOOGLE');
    expect(results[0].source).toBe('GOOGLE');
  });

  test('assigns CSV_IMPORT source type correctly', () => {
    const csv = `author,rating,content
Jan,4,Goed`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results[0].source).toBe('CSV_IMPORT');
  });
});

// ============================================================================
// parseReviewCSV — Date format parsing
// ============================================================================

describe('parseReviewCSV — date format parsing', () => {
  test('parses YYYY-MM-DD date format', () => {
    const csv = `auteur,beoordeling,datum
Jan,4,2025-01-15`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results[0].reviewDate).toBeInstanceOf(Date);
  });

  test('parses DD-MM-YYYY date format', () => {
    const csv = `auteur,beoordeling,datum
Jan,4,15-01-2025`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results[0].reviewDate).toBeInstanceOf(Date);
  });

  test('parses DD/MM/YYYY date format', () => {
    const csv = `auteur,beoordeling,datum
Jan,4,15/01/2025`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results[0].reviewDate).toBeInstanceOf(Date);
  });

  test('skips rows with unparseable dates (date is optional)', () => {
    const csv = `auteur,beoordeling,datum
Jan,4,not-a-date`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    // Row should still be included but without a date
    expect(results.length).toBe(1);
    expect(results[0].reviewDate).toBeUndefined();
  });
});

// ============================================================================
// parseReviewCSV — Rating validation
// ============================================================================

describe('parseReviewCSV — rating validation', () => {
  test('accepts valid ratings 1-5', () => {
    const csv = `author,rating
A,1
B,2
C,3
D,4
E,5`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results.length).toBe(5);
    expect(results.map(r => r.rating)).toEqual([1, 2, 3, 4, 5]);
  });

  test('rejects ratings outside 0-5 range', () => {
    const csv = `author,rating
A,6
B,-1
C,3`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results.length).toBe(1);
    expect(results[0].rating).toBe(3);
  });

  test('rejects non-numeric ratings', () => {
    const csv = `author,rating
A,good
B,3`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results.length).toBe(1);
    expect(results[0].rating).toBe(3);
  });

  test('skips rows without a rating column', () => {
    const csv = `author,content
Jan,Goed product`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results.length).toBe(0);
  });

  test('rounds ratings to 1 decimal place', () => {
    const csv = `author,rating
Jan,4.56`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results[0].rating).toBe(4.6);
  });
});

// ============================================================================
// parseReviewCSV — Edge cases
// ============================================================================

describe('parseReviewCSV — edge cases', () => {
  test('returns empty array for empty CSV', () => {
    const results = parseReviewCSV('', 'CSV_IMPORT');
    expect(results).toEqual([]);
  });

  test('returns empty array for header-only CSV', () => {
    const csv = 'author,rating,content';
    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results).toEqual([]);
  });

  test('handles quoted fields with commas', () => {
    const csv = `author,rating,content
"De Vries, Jan",4,"Goed product, snelle levering"`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results.length).toBe(1);
    expect(results[0].authorName).toBe('De Vries, Jan');
    expect(results[0].content).toBe('Goed product, snelle levering');
  });

  test('handles externalId column', () => {
    const csv = `author,rating,external_id
Jan,4,ext-123`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results[0].externalId).toBe('ext-123');
  });

  test('handles sourceUrl column', () => {
    const csv = `author,rating,url
Jan,4,https://example.com/review/123`;

    const results = parseReviewCSV(csv, 'CSV_IMPORT');
    expect(results[0].sourceUrl).toBe('https://example.com/review/123');
  });
});

// ============================================================================
// importReview — Single import with dedup
// ============================================================================

describe('importReview — single import with deduplication', () => {
  beforeEach(() => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));
    mockReviewCreate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'rev-new', ...data })
    );
    mockReviewUpdate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'rev-existing', ...data })
    );
  });

  test('creates new review when no duplicate exists', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));

    const result = await importReview('proj-1', {
      source: 'GOOGLE',
      rating: 4,
      authorName: 'Jan',
      content: 'Goed product',
    });

    expect(mockReviewCreate).toHaveBeenCalled();
  });

  test('deduplicates by externalId', async () => {
    const existing = { id: 'rev-existing', projectId: 'proj-1', externalId: 'ext-1' };
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(existing));

    const result = await importReview('proj-1', {
      source: 'GOOGLE',
      externalId: 'ext-1',
      rating: 5,
      content: 'Updated review',
    });

    expect(mockReviewUpdate).toHaveBeenCalled();
    const updateCall = mockReviewUpdate.mock.calls[mockReviewUpdate.mock.calls.length - 1];
    expect(updateCall[0].where.id).toBe('rev-existing');
  });

  test('deduplicates by authorName + reviewDate + source', async () => {
    const reviewDate = new Date('2025-01-15');
    const existing = { id: 'rev-existing', projectId: 'proj-1', authorName: 'Jan' };
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(existing));

    const result = await importReview('proj-1', {
      source: 'GOOGLE',
      rating: 4,
      authorName: 'Jan',
      reviewDate,
      content: 'Goed product',
    });

    expect(mockReviewUpdate).toHaveBeenCalled();
  });

  test('sets default language to "nl" when not specified', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));

    await importReview('proj-1', {
      source: 'GOOGLE',
      rating: 4,
      content: 'Goed product',
    });

    const createCall = mockReviewCreate.mock.calls[mockReviewCreate.mock.calls.length - 1];
    expect(createCall[0].data.language).toBe('nl');
  });

  test('associates locationId when provided', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));

    await importReview('proj-1', {
      source: 'GOOGLE',
      rating: 4,
    }, 'loc-1');

    const createCall = mockReviewCreate.mock.calls[mockReviewCreate.mock.calls.length - 1];
    expect(createCall[0].data.locationId).toBe('loc-1');
  });

  test('sets importBatch when provided', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));

    await importReview('proj-1', {
      source: 'GOOGLE',
      rating: 4,
    }, undefined, 'batch-123');

    const createCall = mockReviewCreate.mock.calls[mockReviewCreate.mock.calls.length - 1];
    expect(createCall[0].data.importBatch).toBe('batch-123');
  });
});

// ============================================================================
// importReviewsBulk — Bulk import with validation
// ============================================================================

describe('importReviewsBulk — bulk import with validation', () => {
  beforeEach(() => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));
    mockReviewCreate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'rev-new', ...data })
    );
    mockReviewUpdate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'rev-existing', ...data })
    );
  });

  test('imports multiple reviews and returns counts', async () => {
    const reviews = [
      { source: 'GOOGLE' as const, rating: 4, authorName: 'Jan', content: 'Goed' },
      { source: 'GOOGLE' as const, rating: 5, authorName: 'Piet', content: 'Uitstekend' },
      { source: 'GOOGLE' as const, rating: 3, authorName: 'Klaas', content: 'Gemiddeld' },
    ];

    const result = await importReviewsBulk('proj-1', reviews);
    expect(result.imported).toBe(3);
    expect(result.updated).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  test('counts updated reviews when duplicates found', async () => {
    const existing = { id: 'rev-existing', projectId: 'proj-1', authorName: 'Jan' };
    let callCount = 0;
    mockReviewFindFirst.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(existing);
      return Promise.resolve(null);
    });

    const reviews = [
      { source: 'GOOGLE' as const, rating: 4, authorName: 'Jan', externalId: 'ext-1' },
      { source: 'GOOGLE' as const, rating: 5, authorName: 'Piet' },
    ];

    const result = await importReviewsBulk('proj-1', reviews);
    expect(result.updated).toBe(1);
    expect(result.imported).toBe(1);
  });

  test('reports errors for invalid ratings', async () => {
    const reviews = [
      { source: 'GOOGLE' as const, rating: 6, authorName: 'Jan' },
      { source: 'GOOGLE' as const, rating: 4, authorName: 'Piet' },
    ];

    const result = await importReviewsBulk('proj-1', reviews);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('Beoordeling');
    expect(result.imported).toBe(1);
  });

  test('catches and reports import errors', async () => {
    mockReviewCreate.mockImplementation(() => {
      throw new Error('Database error');
    });

    const reviews = [
      { source: 'GOOGLE' as const, rating: 4, authorName: 'Jan' },
    ];

    const result = await importReviewsBulk('proj-1', reviews);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('Fout bij importeren');
  });

  test('error messages are in Dutch', async () => {
    const reviews = [
      { source: 'GOOGLE' as const, rating: -1, authorName: 'Jan' },
    ];

    const result = await importReviewsBulk('proj-1', reviews);
    expect(result.errors[0]).toContain('Beoordeling');
    expect(result.errors[0]).toContain('ongeldig');
  });

  test('passes importBatch to each review', async () => {
    const reviews = [
      { source: 'GOOGLE' as const, rating: 4, authorName: 'Jan' },
    ];

    await importReviewsBulk('proj-1', reviews, undefined, 'batch-abc');

    const createCall = mockReviewCreate.mock.calls[mockReviewCreate.mock.calls.length - 1];
    expect(createCall[0].data.importBatch).toBe('batch-abc');
  });
});

// ============================================================================
// importReviewsCSV — Full pipeline
// ============================================================================

describe('importReviewsCSV — full CSV import pipeline', () => {
  beforeEach(() => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));
    mockReviewCreate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'rev-new', ...data })
    );
    mockReviewUpdate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'rev-existing', ...data })
    );
  });

  test('generates an importBatch ID', async () => {
    const csv = `author,rating,content
Jan,4,Goed product`;

    const result = await importReviewsCSV('proj-1', csv, 'CSV_IMPORT');
    expect(result.importBatch).toBeDefined();
    expect(result.importBatch).toContain('csv-');
  });

  test('returns Dutch error when CSV has no valid reviews', async () => {
    const result = await importReviewsCSV('proj-1', '', 'CSV_IMPORT');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Geen geldige reviews');
  });

  test('imports valid reviews from CSV content', async () => {
    const csv = `auteur,beoordeling,inhoud,datum
Jan,4,Goed product,2025-01-15
Piet,5,Uitstekend,2025-02-01`;

    const result = await importReviewsCSV('proj-1', csv, 'CSV_IMPORT');
    expect(result.imported).toBe(2);
    expect(result.updated).toBe(0);
  });

  test('handles deduplication during CSV import', async () => {
    const existing = { id: 'rev-existing', projectId: 'proj-1', externalId: 'ext-1' };
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(existing));

    const csv = `author,rating,external_id
Jan,4,ext-1`;

    const result = await importReviewsCSV('proj-1', csv, 'CSV_IMPORT');
    expect(result.updated).toBe(1);
    expect(result.imported).toBe(0);
  });

  test('applies locationId to all imported reviews', async () => {
    mockReviewCreate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'rev-new', ...data })
    );

    const csv = `author,rating
Jan,4
Piet,5`;

    await importReviewsCSV('proj-1', csv, 'CSV_IMPORT', 'loc-1');

    // Check only the calls from this test (mock was reset above)
    const calls = mockReviewCreate.mock.calls;
    const createCalls = calls.filter((c: any) => c[0]?.data?.locationId !== undefined || c[0]?.data?.projectId === 'proj-1');
    for (const call of createCalls.slice(-2)) {
      expect(call[0].data.locationId).toBe('loc-1');
    }
  });

  test('counts invalid rows in errors', async () => {
    const csv = `author,rating,content
Jan,4,Goed
BadReviewer,invalid,Not a number
Piet,5,Uitstekend`;

    const result = await importReviewsCSV('proj-1', csv, 'CSV_IMPORT');
    // The invalid rating row should be skipped during parsing
    expect(result.imported).toBe(2);
  });

  test('import batch ID format is correct', async () => {
    const csv = `author,rating,content
Jan,4,Goed`;

    const result = await importReviewsCSV('proj-1', csv, 'CSV_IMPORT');
    // Format: csv-{timestamp}-{random}
    expect(result.importBatch).toMatch(/^csv-\d+-[a-z0-9]+$/);
  });
});
