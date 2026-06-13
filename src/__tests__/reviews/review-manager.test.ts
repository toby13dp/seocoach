/**
 * Review Manager Tests
 * Tests for /src/lib/reviews/review-manager.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// ============================================================================
// Mock database for review manager tests
// ============================================================================

const mockReviewFindMany = mock(() => Promise.resolve([]));
const mockReviewFindFirst = mock(() => Promise.resolve(null));
const mockReviewCount = mock(() => Promise.resolve(0));
const mockReviewUpdate = mock(() => Promise.resolve({}));
const mockReviewCreate = mock(() => Promise.resolve({}));

mock.module('@/lib/db', () => ({
  db: {
    review: {
      findMany: mockReviewFindMany,
      findFirst: mockReviewFindFirst,
      count: mockReviewCount,
      update: mockReviewUpdate,
      create: mockReviewCreate,
    },
    reviewResponse: {
      create: mock(() => Promise.resolve({})),
      update: mock(() => Promise.resolve({})),
      findFirst: mock(() => Promise.resolve(null)),
      findMany: mock(() => Promise.resolve([])),
    },
  },
}));

// Import AFTER mock.module
import {
  listReviews,
  getReview,
  getReviewSummary,
  analyzeAndSaveReviewSentiment,
  deleteReview,
} from '@/lib/reviews/review-manager';

// ============================================================================
// listReviews — Paginated listing with filters
// ============================================================================

describe('listReviews — paginated listing', () => {
  beforeEach(() => {
    mockReviewFindMany.mockImplementation(() => Promise.resolve([
      { id: 'rev-1', projectId: 'proj-1', rating: 4, content: 'Goed', deletedAt: null },
      { id: 'rev-2', projectId: 'proj-1', rating: 2, content: 'Slecht', deletedAt: null },
    ]));
    mockReviewCount.mockImplementation(() => Promise.resolve(2));
  });

  test('returns reviews and total count', async () => {
    const result = await listReviews('proj-1');
    expect(result.reviews).toBeDefined();
    expect(result.total).toBe(2);
  });

  test('applies default pagination (limit=50, offset=0)', async () => {
    await listReviews('proj-1');
    const findManyCall = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const args = findManyCall[0];
    expect(args.take).toBe(50);
    expect(args.skip).toBe(0);
  });

  test('applies custom limit and offset', async () => {
    await listReviews('proj-1', { limit: 10, offset: 20 });
    const findManyCall = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const args = findManyCall[0];
    expect(args.take).toBe(10);
    expect(args.skip).toBe(20);
  });

  test('filters by source', async () => {
    await listReviews('proj-1', { source: 'GOOGLE' });
    const findManyCall = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const where = findManyCall[0].where;
    expect(where.source).toBe('GOOGLE');
  });

  test('filters by sentiment', async () => {
    await listReviews('proj-1', { sentiment: 'NEGATIVE' });
    const findManyCall = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const where = findManyCall[0].where;
    expect(where.sentiment).toBe('NEGATIVE');
  });

  test('filters by minRating and maxRating', async () => {
    await listReviews('proj-1', { minRating: 3, maxRating: 5 });
    const findManyCall = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const where = findManyCall[0].where;
    expect(where.rating.gte).toBe(3);
    expect(where.rating.lte).toBe(5);
  });

  test('filters by date range', async () => {
    const start = new Date('2025-01-01');
    const end = new Date('2025-01-31');
    await listReviews('proj-1', { startDate: start, endDate: end });
    const findManyCall = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const where = findManyCall[0].where;
    expect(where.reviewDate.gte).toBe(start);
    expect(where.reviewDate.lte).toBe(end);
  });

  test('filters by hasResponse=true', async () => {
    await listReviews('proj-1', { hasResponse: true });
    const findManyCall = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const where = findManyCall[0].where;
    expect(where.responseDraftId).toEqual({ not: null });
  });

  test('filters by hasResponse=false', async () => {
    await listReviews('proj-1', { hasResponse: false });
    const findManyCall = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const where = findManyCall[0].where;
    expect(where.responseDraftId).toBe(null);
  });

  test('filters by search term', async () => {
    await listReviews('proj-1', { search: 'levering' });
    const findManyCall = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const where = findManyCall[0].where;
    expect(where.OR).toBeDefined();
    expect(where.OR.length).toBe(3);
  });

  test('filters by locationId', async () => {
    await listReviews('proj-1', { locationId: 'loc-1' });
    const findManyCall = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const where = findManyCall[0].where;
    expect(where.locationId).toBe('loc-1');
  });
});

// ============================================================================
// listReviews — Project ID isolation
// ============================================================================

describe('listReviews — project ID isolation', () => {
  beforeEach(() => {
    mockReviewFindMany.mockImplementation(() => Promise.resolve([]));
    mockReviewCount.mockImplementation(() => Promise.resolve(0));
  });

  test('always filters by projectId', async () => {
    await listReviews('proj-42');
    const findManyCall = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const where = findManyCall[0].where;
    expect(where.projectId).toBe('proj-42');
  });

  test('excludes soft-deleted reviews (deletedAt: null)', async () => {
    await listReviews('proj-1');
    const findManyCall = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const where = findManyCall[0].where;
    expect(where.deletedAt).toBe(null);
  });
});

// ============================================================================
// getReview — Get single review with responses
// ============================================================================

describe('getReview — single review retrieval', () => {
  test('returns review with responses when found', async () => {
    const review = {
      id: 'rev-1',
      projectId: 'proj-1',
      content: 'Goed product',
      responses: [{ id: 'resp-1', content: 'Bedankt!' }],
      location: { id: 'loc-1', name: 'Amsterdam' },
    };
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(review));

    const result = await getReview('rev-1', 'proj-1');
    expect(result).toEqual(review);
  });

  test('returns null when review not found', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));

    const result = await getReview('nonexistent', 'proj-1');
    expect(result).toBeNull();
  });

  test('verifies projectId for tenant isolation', async () => {
    await getReview('rev-1', 'proj-1');
    const call = mockReviewFindFirst.mock.calls[mockReviewFindFirst.mock.calls.length - 1];
    const where = call[0].where;
    expect(where.id).toBe('rev-1');
    expect(where.projectId).toBe('proj-1');
    expect(where.deletedAt).toBe(null);
  });

  test('includes responseDraft and responses in result', async () => {
    await getReview('rev-1', 'proj-1');
    const call = mockReviewFindFirst.mock.calls[mockReviewFindFirst.mock.calls.length - 1];
    const args = call[0];
    expect(args.include.responseDraft).toBe(true);
    expect(args.include.responses).toBeDefined();
    expect(args.include.location).toBeDefined();
  });
});

// ============================================================================
// getReviewSummary — Aggregated statistics
// ============================================================================

describe('getReviewSummary — aggregated statistics', () => {
  test('returns empty summary when no reviews', async () => {
    mockReviewFindMany.mockImplementation(() => Promise.resolve([]));

    const result = await getReviewSummary('proj-1');
    expect(result.totalReviews).toBe(0);
    expect(result.avgRating).toBe(0);
    expect(result.ratingDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    expect(result.sentimentDistribution).toEqual({
      POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, MIXED: 0,
    });
    expect(result.topThemes).toEqual([]);
    expect(result.topComplaints).toEqual([]);
    expect(result.topCompliments).toEqual([]);
    expect(result.responseRate).toBe(0);
    expect(result.avgResponseTimeHours).toBeNull();
  });

  test('calculates average rating correctly', async () => {
    mockReviewFindMany.mockImplementation(() => Promise.resolve([
      { rating: 4, sentiment: 'POSITIVE', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
      { rating: 2, sentiment: 'NEGATIVE', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
      { rating: 5, sentiment: 'POSITIVE', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
    ]));

    const result = await getReviewSummary('proj-1');
    expect(result.totalReviews).toBe(3);
    expect(result.avgRating).toBe(3.67); // (4+2+5)/3 = 3.666... → rounded to 3.67
  });

  test('calculates rating distribution correctly', async () => {
    mockReviewFindMany.mockImplementation(() => Promise.resolve([
      { rating: 5, sentiment: 'POSITIVE', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
      { rating: 5, sentiment: 'POSITIVE', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
      { rating: 3, sentiment: 'NEUTRAL', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
      { rating: 1, sentiment: 'NEGATIVE', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
    ]));

    const result = await getReviewSummary('proj-1');
    expect(result.ratingDistribution[5]).toBe(2);
    expect(result.ratingDistribution[3]).toBe(1);
    expect(result.ratingDistribution[1]).toBe(1);
    expect(result.ratingDistribution[2]).toBe(0);
    expect(result.ratingDistribution[4]).toBe(0);
  });

  test('calculates sentiment distribution correctly', async () => {
    mockReviewFindMany.mockImplementation(() => Promise.resolve([
      { rating: 5, sentiment: 'POSITIVE', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
      { rating: 3, sentiment: 'NEUTRAL', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
      { rating: 1, sentiment: 'NEGATIVE', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
      { rating: 4, sentiment: 'MIXED', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
    ]));

    const result = await getReviewSummary('proj-1');
    expect(result.sentimentDistribution.POSITIVE).toBe(1);
    expect(result.sentimentDistribution.NEUTRAL).toBe(1);
    expect(result.sentimentDistribution.NEGATIVE).toBe(1);
    expect(result.sentimentDistribution.MIXED).toBe(1);
  });

  test('calculates response rate correctly', async () => {
    mockReviewFindMany.mockImplementation(() => Promise.resolve([
      { rating: 5, sentiment: 'POSITIVE', themes: null, complaints: null, compliments: null, responseDraftId: 'resp-1', reviewDate: null, createdAt: new Date(), responses: [] },
      { rating: 3, sentiment: 'NEUTRAL', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
      { rating: 1, sentiment: 'NEGATIVE', themes: null, complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [{ createdAt: new Date() }] },
    ]));

    const result = await getReviewSummary('proj-1');
    // 2 out of 3 have responses (responseDraftId + responses)
    expect(result.responseRate).toBeCloseTo(0.667, 2);
  });

  test('parses themes from JSON strings', async () => {
    mockReviewFindMany.mockImplementation(() => Promise.resolve([
      { rating: 4, sentiment: 'POSITIVE', themes: JSON.stringify(['Levering', 'Kwaliteit']), complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
      { rating: 5, sentiment: 'POSITIVE', themes: JSON.stringify(['Levering', 'Service']), complaints: null, compliments: null, responseDraftId: null, reviewDate: null, createdAt: new Date(), responses: [] },
    ]));

    const result = await getReviewSummary('proj-1');
    expect(result.topThemes.length).toBeGreaterThan(0);
    // "Levering" appears in both reviews, should be top
    expect(result.topThemes[0].theme).toBe('Levering');
    expect(result.topThemes[0].count).toBe(2);
  });

  test('filters by locationId when provided', async () => {
    mockReviewFindMany.mockImplementation(() => Promise.resolve([]));
    await getReviewSummary('proj-1', 'loc-1');
    const call = mockReviewFindMany.mock.calls[mockReviewFindMany.mock.calls.length - 1];
    const where = call[0].where;
    expect(where.locationId).toBe('loc-1');
  });
});

// ============================================================================
// analyzeAndSaveReviewSentiment — Analyze and persist
// ============================================================================

describe('analyzeAndSaveReviewSentiment — analyze and persist', () => {
  test('throws Dutch error when review not found', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));

    expect(analyzeAndSaveReviewSentiment('nonexistent', 'proj-1')).rejects.toThrow('Review niet gevonden');
  });

  test('analyzes review and saves results', async () => {
    const review = {
      id: 'rev-1',
      projectId: 'proj-1',
      rating: 4,
      content: 'Goed product, snelle levering',
      title: 'Aanrader',
    };
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(review));
    mockReviewUpdate.mockImplementation(({ data }: any) => Promise.resolve({ id: 'rev-1', ...data }));

    const result = await analyzeAndSaveReviewSentiment('rev-1', 'proj-1');
    expect(mockReviewUpdate).toHaveBeenCalled();

    const updateCall = mockReviewUpdate.mock.calls[mockReviewUpdate.mock.calls.length - 1];
    const data = updateCall[0].data;
    expect(data.sentiment).toBeDefined();
    expect(data.sentimentScore).toBeDefined();
    expect(data.themes).toBeDefined();
    expect(data.complaints).toBeDefined();
    expect(data.compliments).toBeDefined();
  });

  test('handles review with null content', async () => {
    const review = {
      id: 'rev-2',
      projectId: 'proj-1',
      rating: 3,
      content: null,
      title: null,
    };
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(review));
    mockReviewUpdate.mockImplementation(({ data }: any) => Promise.resolve({ id: 'rev-2', ...data }));

    const result = await analyzeAndSaveReviewSentiment('rev-2', 'proj-1');
    expect(mockReviewUpdate).toHaveBeenCalled();
  });
});

// ============================================================================
// deleteReview — Soft delete
// ============================================================================

describe('deleteReview — soft delete', () => {
  test('throws Dutch error when review not found', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));

    expect(deleteReview('nonexistent', 'proj-1')).rejects.toThrow('Review niet gevonden');
  });

  test('soft deletes by setting deletedAt timestamp', async () => {
    const review = { id: 'rev-1', projectId: 'proj-1', deletedAt: null };
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(review));
    mockReviewUpdate.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...review, deletedAt: data.deletedAt })
    );

    const result = await deleteReview('rev-1', 'proj-1');
    expect(mockReviewUpdate).toHaveBeenCalled();

    const updateCall = mockReviewUpdate.mock.calls[mockReviewUpdate.mock.calls.length - 1];
    const data = updateCall[0].data;
    expect(data.deletedAt).toBeDefined();
    expect(data.deletedAt).toBeInstanceOf(Date);
  });

  test('verifies projectId for tenant isolation before deleting', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));

    try {
      await deleteReview('rev-1', 'wrong-project');
    } catch {
      // Expected
    }

    const call = mockReviewFindFirst.mock.calls[mockReviewFindFirst.mock.calls.length - 1];
    const where = call[0].where;
    expect(where.projectId).toBe('wrong-project');
    expect(where.deletedAt).toBe(null);
  });
});
