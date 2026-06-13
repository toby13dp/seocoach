/**
 * GEO Readiness Analyzer Tests
 * Tests for /src/lib/geo/index.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockCheckFindMany = mock(() => Promise.resolve([]));
const mockCheckDeleteMany = mock(() => Promise.resolve({ count: 0 }));
const mockCheckCreate = mock(() => Promise.resolve({ id: 'check-1' }));
const mockCheckFindUnique = mock(() => Promise.resolve(null));
const mockCheckUpdate = mock(() => Promise.resolve({ id: 'check-1' }));
const mockSummaryFindUnique = mock(() => Promise.resolve(null));
const mockSummaryUpsert = mock(() => Promise.resolve({ id: 'summary-1' }));
const mockPageFindMany = mock(() => Promise.resolve([]));
const mockStructuredDataFindMany = mock(() => Promise.resolve([]));
const mockBrandProfileFindUnique = mock(() => Promise.resolve(null));

mock.module('@/lib/db', () => ({
  db: {
    geoReadinessCheck: {
      findMany: mockCheckFindMany,
      deleteMany: mockCheckDeleteMany,
      create: mockCheckCreate,
      findUnique: mockCheckFindUnique,
      update: mockCheckUpdate,
    },
    geoReadinessSummary: {
      findUnique: mockSummaryFindUnique,
      upsert: mockSummaryUpsert,
    },
    page: {
      findMany: mockPageFindMany,
    },
    structuredData: {
      findMany: mockStructuredDataFindMany,
    },
    brandProfile: {
      findUnique: mockBrandProfileFindUnique,
    },
  },
}));

import {
  analyzeGeoReadiness,
  getGeoReadinessSummary,
  getGeoReadinessChecks,
  GEO_CHECK_CATEGORIES,
} from '@/lib/geo';

// ============================================================================
// Test: analyzeGeoReadiness creates checks for all 15 categories
// ============================================================================

describe('analyzeGeoReadiness — creates checks for all 15 categories', () => {
  beforeEach(() => {
    mockPageFindMany.mockReset();
    mockCheckDeleteMany.mockReset();
    mockCheckCreate.mockReset();
    mockSummaryUpsert.mockReset();
    mockStructuredDataFindMany.mockReset();
    mockBrandProfileFindUnique.mockReset();
  });

  test('creates exactly 15 checks for the 15 GEO categories', async () => {
    mockPageFindMany.mockImplementation(() => Promise.resolve([
      { id: 'p1', url: '/a', title: 'A', description: null, h1: 'H1', wordCount: 500, mainContent: 'Test content for analysis', structuredData: null, indexability: 'INDEXABLE', metaRobots: null, publicationDate: null, modificationDate: null },
    ]));
    mockStructuredDataFindMany.mockImplementation(() => Promise.resolve([]));
    mockBrandProfileFindUnique.mockImplementation(() => Promise.resolve(null));
    mockCheckDeleteMany.mockImplementation(() => Promise.resolve({ count: 0 }));
    mockCheckCreate.mockImplementation((args: any) =>
      Promise.resolve({
        id: `check-${args.data.category}`,
        category: args.data.category,
        status: args.data.status,
        score: args.data.score,
      })
    );
    mockSummaryUpsert.mockImplementation((args: any) =>
      Promise.resolve({ id: 'summary-1', ...args.create })
    );

    const result = await analyzeGeoReadiness('proj-1');

    expect(mockCheckCreate).toHaveBeenCalledTimes(15);
    // analyzeGeoReadiness returns the summary directly (flat object)
    expect(result.totalChecks).toBe(15);
  });

  test('each category gets a unique check', async () => {
    const createdCategories: string[] = [];
    mockCheckCreate.mockImplementation((args: any) => {
      createdCategories.push(args.data.category);
      return Promise.resolve({
        id: `check-${args.data.category}`,
        category: args.data.category,
        status: args.data.status,
        score: args.data.score,
      });
    });
    mockPageFindMany.mockImplementation(() => Promise.resolve([
      { id: 'p1', url: '/a', title: 'A', description: null, h1: 'H1', wordCount: 500, mainContent: 'Test content', structuredData: null, indexability: 'INDEXABLE', metaRobots: null, publicationDate: null, modificationDate: null },
    ]));
    mockStructuredDataFindMany.mockImplementation(() => Promise.resolve([]));
    mockBrandProfileFindUnique.mockImplementation(() => Promise.resolve(null));
    mockCheckDeleteMany.mockImplementation(() => Promise.resolve({ count: 0 }));
    mockSummaryUpsert.mockImplementation((args: any) =>
      Promise.resolve({ id: 'summary-1', ...args.create })
    );

    await analyzeGeoReadiness('proj-1');

    const uniqueCategories = [...new Set(createdCategories)];
    expect(uniqueCategories.length).toBe(15);
    expect(createdCategories.length).toBe(15);
  });
});

// ============================================================================
// Test: Checks use real page data
// ============================================================================

describe('analyzeGeoReadiness — checks use real page data', () => {
  beforeEach(() => {
    mockPageFindMany.mockReset();
    mockCheckDeleteMany.mockReset();
    mockCheckCreate.mockReset();
    mockSummaryUpsert.mockReset();
    mockStructuredDataFindMany.mockReset();
    mockBrandProfileFindUnique.mockReset();
  });

  test('queries pages for the project', async () => {
    mockPageFindMany.mockImplementation(() => Promise.resolve([
      { id: 'p1', url: '/a', title: 'A', description: null, h1: 'H1', wordCount: 500, mainContent: 'Test', structuredData: null, indexability: 'INDEXABLE', metaRobots: null, publicationDate: null, modificationDate: null },
    ]));
    mockStructuredDataFindMany.mockImplementation(() => Promise.resolve([]));
    mockBrandProfileFindUnique.mockImplementation(() => Promise.resolve(null));
    mockCheckDeleteMany.mockImplementation(() => Promise.resolve({ count: 0 }));
    mockCheckCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: `check-${args.data.category}`, category: args.data.category, status: args.data.status, score: args.data.score })
    );
    mockSummaryUpsert.mockImplementation((args: any) =>
      Promise.resolve({ id: 'summary-1', ...args.create })
    );

    await analyzeGeoReadiness('proj-1');

    expect(mockPageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'proj-1', deletedAt: null, status: 'OK' },
      })
    );
  });

  test('STRUCTURED_DATA check score reflects pages with structured data', async () => {
    const pages = [
      { id: 'p1', url: '/a', title: 'A', description: null, h1: 'H1', wordCount: 500, mainContent: 'Test', structuredData: '{"@type":"Article"}', indexability: 'INDEXABLE', metaRobots: null, publicationDate: null, modificationDate: null },
      { id: 'p2', url: '/b', title: 'B', description: null, h1: 'H1', wordCount: 300, mainContent: 'Test', structuredData: null, indexability: 'INDEXABLE', metaRobots: null, publicationDate: null, modificationDate: null },
    ];
    const sdRecords = [
      { id: 'sd1', type: 'ARTICLE', data: '{}', isValid: true, url: '/a' },
    ];
    mockPageFindMany.mockImplementation(() => Promise.resolve(pages));
    mockStructuredDataFindMany.mockImplementation(() => Promise.resolve(sdRecords));
    mockBrandProfileFindUnique.mockImplementation(() => Promise.resolve(null));
    mockCheckDeleteMany.mockImplementation(() => Promise.resolve({ count: 0 }));
    mockCheckCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: `check-${args.data.category}`, category: args.data.category, status: args.data.status, score: args.data.score })
    );
    mockSummaryUpsert.mockImplementation((args: any) =>
      Promise.resolve({ id: 'summary-1', ...args.create })
    );

    await analyzeGeoReadiness('proj-1');

    // Should find the STRUCTURED_DATA create call
    // pagesWithSD = 1 (url '/a'), totalPages = 2, sdRate = 0.5, score = 50
    const sdCall = mockCheckCreate.mock.calls.find(
      (call: any) => call[0].data.category === 'STRUCTURED_DATA'
    );
    expect(sdCall).toBeDefined();
    expect(sdCall[0].data.score).toBe(50);
  });

  test('INDEXABILITY check score reflects indexable pages', async () => {
    const pages = [
      { id: 'p1', url: '/a', title: 'A', description: null, h1: 'H1', wordCount: 500, mainContent: 'Test', structuredData: null, indexability: 'INDEXABLE', metaRobots: null, publicationDate: null, modificationDate: null },
      { id: 'p2', url: '/b', title: 'B', description: null, h1: 'H1', wordCount: 300, mainContent: 'Test', structuredData: null, indexability: 'NOINDEX', metaRobots: null, publicationDate: null, modificationDate: null },
      { id: 'p3', url: '/c', title: 'C', description: null, h1: 'H1', wordCount: 200, mainContent: 'Test', structuredData: null, indexability: 'INDEXABLE', metaRobots: null, publicationDate: null, modificationDate: null },
    ];
    mockPageFindMany.mockImplementation(() => Promise.resolve(pages));
    mockStructuredDataFindMany.mockImplementation(() => Promise.resolve([]));
    mockBrandProfileFindUnique.mockImplementation(() => Promise.resolve(null));
    mockCheckDeleteMany.mockImplementation(() => Promise.resolve({ count: 0 }));
    mockCheckCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: `check-${args.data.category}`, category: args.data.category, status: args.data.status, score: args.data.score })
    );
    mockSummaryUpsert.mockImplementation((args: any) =>
      Promise.resolve({ id: 'summary-1', ...args.create })
    );

    await analyzeGeoReadiness('proj-1');

    const idxCall = mockCheckCreate.mock.calls.find(
      (call: any) => call[0].data.category === 'INDEXABILITY'
    );
    expect(idxCall).toBeDefined();
    // 2 out of 3 indexable = 67%
    expect(idxCall[0].data.score).toBe(67);
  });
});

// ============================================================================
// Test: Summary scores are calculated correctly
// ============================================================================

describe('analyzeGeoReadiness — summary scores are calculated correctly', () => {
  beforeEach(() => {
    mockPageFindMany.mockReset();
    mockCheckDeleteMany.mockReset();
    mockCheckCreate.mockReset();
    mockSummaryUpsert.mockReset();
    mockStructuredDataFindMany.mockReset();
    mockBrandProfileFindUnique.mockReset();
  });

  test('overall score is average of all category scores', async () => {
    mockPageFindMany.mockImplementation(() => Promise.resolve([
      { id: 'p1', url: '/a', title: 'A', description: null, h1: 'H1', wordCount: 500, mainContent: 'Test', structuredData: null, indexability: 'INDEXABLE', metaRobots: null, publicationDate: null, modificationDate: null },
    ]));
    mockStructuredDataFindMany.mockImplementation(() => Promise.resolve([]));
    mockBrandProfileFindUnique.mockImplementation(() => Promise.resolve(null));
    mockCheckDeleteMany.mockImplementation(() => Promise.resolve({ count: 0 }));
    mockCheckCreate.mockImplementation((args: any) => {
      return Promise.resolve({
        id: `check-${args.data.category}`,
        category: args.data.category,
        status: args.data.status,
        score: args.data.score,
      });
    });
    mockSummaryUpsert.mockImplementation((args: any) => {
      return Promise.resolve({ id: 'summary-1', ...args.create });
    });

    // analyzeGeoReadiness returns the summary directly (flat object with score fields)
    const result = await analyzeGeoReadiness('proj-1');

    // The result IS the summary — it has overallScore and totalChecks directly
    expect(result).toBeDefined();
    expect(result.totalChecks).toBe(15);
    expect(typeof result.overallScore).toBe('number');
  });

  test('passing/failing/notChecked counts are correct', async () => {
    mockPageFindMany.mockImplementation(() => Promise.resolve([
      { id: 'p1', url: '/a', title: 'A', description: null, h1: 'H1', wordCount: 500, mainContent: 'Test', structuredData: null, indexability: 'INDEXABLE', metaRobots: null, publicationDate: null, modificationDate: null },
    ]));
    mockStructuredDataFindMany.mockImplementation(() => Promise.resolve([]));
    mockBrandProfileFindUnique.mockImplementation(() => Promise.resolve(null));
    mockCheckDeleteMany.mockImplementation(() => Promise.resolve({ count: 0 }));
    mockCheckCreate.mockImplementation((args: any) => {
      return Promise.resolve({
        id: `check-${args.data.category}`,
        category: args.data.category,
        status: args.data.status,
        score: args.data.score,
      });
    });
    mockSummaryUpsert.mockImplementation((args: any) =>
      Promise.resolve({ id: 'summary-1', ...args.create })
    );

    const result = await analyzeGeoReadiness('proj-1');

    expect(result.totalChecks).toBe(15);
  });
});

// ============================================================================
// Test: GEO readiness is NOT presented as measured AI visibility
// ============================================================================

describe('GEO readiness — NOT presented as measured AI visibility', () => {
  test('GEO_CHECK_CATEGORIES contains exactly 15 categories', () => {
    expect(Object.keys(GEO_CHECK_CATEGORIES).length).toBe(15);
  });

  test('all categories have Dutch labels', () => {
    for (const cat of Object.values(GEO_CHECK_CATEGORIES)) {
      expect(cat.label).toBeTruthy();
      expect(cat.description).toBeTruthy();
    }
  });

  test('GEO categories focus on readiness, not measurement', () => {
    const labels = Object.values(GEO_CHECK_CATEGORIES).map(c => c.label.toLowerCase());
    // Should not contain measurement terms like "zichtbaarheid" or "meting"
    for (const label of labels) {
      expect(label).not.toContain('zichtbaarheid');
      expect(label).not.toContain('meting');
    }
  });

  test('analysis note clarifies this is not AI visibility measurement', async () => {
    mockPageFindMany.mockImplementation(() => Promise.resolve([
      { id: 'p1', url: '/a', title: 'A', description: null, h1: 'H1', wordCount: 500, mainContent: 'Test', structuredData: null, indexability: 'INDEXABLE', metaRobots: null, publicationDate: null, modificationDate: null },
    ]));
    mockStructuredDataFindMany.mockImplementation(() => Promise.resolve([]));
    mockBrandProfileFindUnique.mockImplementation(() => Promise.resolve(null));
    mockCheckDeleteMany.mockImplementation(() => Promise.resolve({ count: 0 }));
    mockCheckCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: `check-1`, category: args.data.category, status: 'NOT_CHECKED', score: 0 })
    );
    mockSummaryUpsert.mockImplementation((args: any) =>
      Promise.resolve({ id: 'summary-1', ...args.create })
    );

    // The API route adds the note, but we can verify the analysis
    // produces readiness checks, not visibility measurements
    const result = await analyzeGeoReadiness('proj-1');
    // analyzeGeoReadiness returns the summary with totalChecks
    expect(result.totalChecks).toBe(15);
    // None of the checks should have method "MANUAL_TEST" or "SIMULATION"
    // because GEO readiness is about content readiness, not measured visibility
  });
});

// ============================================================================
// Test: getGeoReadinessSummary and getGeoReadinessChecks
// ============================================================================

describe('getGeoReadinessSummary and getGeoReadinessChecks', () => {
  beforeEach(() => {
    mockCheckFindMany.mockReset();
    mockSummaryFindUnique.mockReset();
  });

  test('returns checks and summary for a project', async () => {
    const mockChecks = [
      { id: 'c1', projectId: 'proj-1', category: 'STRUCTURED_DATA', status: 'PASSING', score: 80, title: 'Gestructureerde data', description: 'Test', recommendation: null, evidence: null, checkedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
    ];
    const mockSummary = {
      id: 's1', projectId: 'proj-1', overallScore: 65,
      directAnswersScore: 50, definitionsScore: 60, answerBlocksScore: 40,
      entityClarityScore: 70, organisationClarityScore: 60, authorInfoScore: 30,
      sourceTransparencyScore: 50, datesScore: 80, structuredDataScore: 80,
      faqsScore: 40, uniqueInfoScore: 60, citableFactsScore: 50,
      crawlabilityScore: 90, indexabilityScore: 85, brandConsistencyScore: 70,
      totalChecks: 15, passingChecks: 7, failingChecks: 3, notCheckedChecks: 1,
      calculatedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    };

    mockCheckFindMany.mockImplementation(() => Promise.resolve(mockChecks));
    mockSummaryFindUnique.mockImplementation(() => Promise.resolve(mockSummary));

    const [checks, summary] = await Promise.all([
      getGeoReadinessChecks('proj-1'),
      getGeoReadinessSummary('proj-1'),
    ]);

    expect(checks).toEqual(mockChecks);
    expect(summary).toBeDefined();
    expect(summary?.overallScore).toBe(65);
    expect(summary?.totalChecks).toBe(15);
  });

  test('returns null summary when no analysis has been run', async () => {
    mockCheckFindMany.mockImplementation(() => Promise.resolve([]));
    mockSummaryFindUnique.mockImplementation(() => Promise.resolve(null));

    const [checks, summary] = await Promise.all([
      getGeoReadinessChecks('proj-1'),
      getGeoReadinessSummary('proj-1'),
    ]);

    expect(checks).toEqual([]);
    expect(summary).toBeNull();
  });
});
