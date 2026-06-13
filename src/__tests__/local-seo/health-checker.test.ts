/**
 * Health Checker Tests
 * Tests for /src/lib/local-seo/health-checker.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockLocationFindUnique = mock(() => Promise.resolve(null));
const mockLocationUpdate = mock(() => Promise.resolve({ id: 'loc-1' }));
const mockKeywordFindMany = mock(() => Promise.resolve([]));
const mockLandingPageFindMany = mock(() => Promise.resolve([]));
const mockHealthCheckCreate = mock(() => Promise.resolve({ id: 'hc-1' }));
const mockHealthCheckFindMany = mock(() => Promise.resolve([]));

mock.module('@/lib/db', () => ({
  db: {
    location: {
      findUnique: mockLocationFindUnique,
      update: mockLocationUpdate,
    },
    localKeyword: {
      findMany: mockKeywordFindMany,
    },
    localLandingPage: {
      findMany: mockLandingPageFindMany,
    },
    locationHealthCheck: {
      create: mockHealthCheckCreate,
      findMany: mockHealthCheckFindMany,
    },
  },
}));

// Import AFTER mock.module
import {
  runLocationHealthChecks,
  saveHealthChecks,
  calculateOverallHealthScore,
  getLocationHealthChecks,
} from '@/lib/local-seo';

// ============================================================================
// Helper: Create a mock location with specified fields
// ============================================================================

function createMockLocation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loc-1',
    projectId: 'proj-1',
    name: 'Amsterdam Centraal',
    address: 'Stationsplein 1',
    city: 'Amsterdam',
    postalCode: '1012AB',
    country: 'NL',
    phone: '+31 20 1234567',
    email: 'info@example.nl',
    website: 'https://example.nl',
    latitude: 52.3791,
    longitude: 4.9003,
    openingHours: '{"mon":{"open":"09:00","close":"18:00"}}',
    gbpStatus: 'not_connected',
    businessType: 'restaurant',
    serviceArea: null,
    localStructuredData: null,
    napConsistency: 0,
    localHealthScore: 0,
    avgRating: 0,
    reviewCount: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Test: runLocationHealthChecks
// ============================================================================

describe('runLocationHealthChecks', () => {
  beforeEach(() => {
    mockLocationFindUnique.mockReset();
    mockKeywordFindMany.mockReset();
    mockLandingPageFindMany.mockReset();
  });

  test('runs all 10 health check categories', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation())
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');

    expect(results.length).toBe(10);
    const categories = results.map((r) => r.category);
    expect(categories).toContain('NAP_CONSISTENCY');
    expect(categories).toContain('OPENING_HOURS');
    expect(categories).toContain('LOCAL_STRUCTURED_DATA');
    expect(categories).toContain('LANDING_PAGES');
    expect(categories).toContain('LOCAL_KEYWORDS');
    expect(categories).toContain('REVIEWS');
    expect(categories).toContain('GOOGLE_BUSINESS_PROFILE');
    expect(categories).toContain('SERVICE_AREAS');
    expect(categories).toContain('LOCAL_LINKS');
    expect(categories).toContain('PHOTOS');
  });

  test('throws error when location not found', async () => {
    mockLocationFindUnique.mockImplementation(() => Promise.resolve(null));

    expect(runLocationHealthChecks('proj-1', 'nonexistent')).rejects.toThrow(
      'Locatie niet gevonden'
    );
  });

  test('throws error when location belongs to different project', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation({ projectId: 'other-project' }))
    );

    expect(runLocationHealthChecks('proj-1', 'loc-1')).rejects.toThrow(
      'Locatie niet gevonden'
    );
  });
});

// ============================================================================
// Test: NAP Consistency
// ============================================================================

describe('NAP Consistency health check', () => {
  beforeEach(() => {
    mockLocationFindUnique.mockReset();
    mockKeywordFindMany.mockReset();
    mockLandingPageFindMany.mockReset();
  });

  test('PASSING when full NAP (name, address, phone) is present', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(
        createMockLocation({
          name: 'Amsterdam Centraal',
          address: 'Stationsplein 1',
          phone: '+31 20 1234567',
        })
      )
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const napCheck = results.find((r) => r.category === 'NAP_CONSISTENCY')!;

    expect(napCheck.status).toBe('PASSING');
    expect(napCheck.score).toBe(100);
  });

  test('FAILING when NAP fields are missing', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(
        createMockLocation({
          name: 'Amsterdam Centraal',
          address: null,
          phone: null,
        })
      )
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const napCheck = results.find((r) => r.category === 'NAP_CONSISTENCY')!;

    expect(napCheck.status).toBe('FAILING');
    expect(napCheck.score).toBeLessThan(100);
  });

  test('FAILING with partial score when only some NAP fields present', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(
        createMockLocation({
          name: 'Amsterdam Centraal',
          address: 'Stationsplein 1',
          phone: null,
        })
      )
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const napCheck = results.find((r) => r.category === 'NAP_CONSISTENCY')!;

    expect(napCheck.status).toBe('FAILING');
    expect(napCheck.score).toBeGreaterThan(0);
    expect(napCheck.score).toBeLessThan(100);
  });
});

// ============================================================================
// Test: Opening Hours
// ============================================================================

describe('Opening Hours health check', () => {
  beforeEach(() => {
    mockLocationFindUnique.mockReset();
    mockKeywordFindMany.mockReset();
    mockLandingPageFindMany.mockReset();
  });

  test('PASSING when opening hours are set', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(
        createMockLocation({
          openingHours: '{"mon":{"open":"09:00","close":"18:00"}}',
        })
      )
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const hoursCheck = results.find((r) => r.category === 'OPENING_HOURS')!;

    expect(hoursCheck.status).toBe('PASSING');
    expect(hoursCheck.score).toBe(100);
  });

  test('FAILING when opening hours are not set', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation({ openingHours: null }))
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const hoursCheck = results.find((r) => r.category === 'OPENING_HOURS')!;

    expect(hoursCheck.status).toBe('FAILING');
    expect(hoursCheck.score).toBe(0);
  });
});

// ============================================================================
// Test: Local Structured Data
// ============================================================================

describe('Local Structured Data health check', () => {
  beforeEach(() => {
    mockLocationFindUnique.mockReset();
    mockKeywordFindMany.mockReset();
    mockLandingPageFindMany.mockReset();
  });

  test('PASSING when structured data is present', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(
        createMockLocation({
          localStructuredData: '{"@type":"Restaurant"}',
        })
      )
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const sdCheck = results.find(
      (r) => r.category === 'LOCAL_STRUCTURED_DATA'
    )!;

    expect(sdCheck.status).toBe('PASSING');
    expect(sdCheck.score).toBe(100);
  });

  test('FAILING when structured data is absent', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation({ localStructuredData: null }))
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const sdCheck = results.find(
      (r) => r.category === 'LOCAL_STRUCTURED_DATA'
    )!;

    expect(sdCheck.status).toBe('FAILING');
    expect(sdCheck.score).toBe(0);
  });
});

// ============================================================================
// Test: Landing Pages
// ============================================================================

describe('Landing Pages health check', () => {
  beforeEach(() => {
    mockLocationFindUnique.mockReset();
    mockKeywordFindMany.mockReset();
    mockLandingPageFindMany.mockReset();
  });

  test('PASSING when landing pages have good quality (avgScore >= 70)', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation())
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() =>
      Promise.resolve([
        { id: 'lp-1', qualityScore: 85 },
        { id: 'lp-2', qualityScore: 75 },
      ])
    );

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const lpCheck = results.find((r) => r.category === 'LANDING_PAGES')!;

    expect(lpCheck.status).toBe('PASSING');
    expect(lpCheck.score).toBeGreaterThanOrEqual(70);
  });

  test('FAILING when no landing pages exist', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation())
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const lpCheck = results.find((r) => r.category === 'LANDING_PAGES')!;

    expect(lpCheck.status).toBe('FAILING');
    expect(lpCheck.score).toBe(0);
  });
});

// ============================================================================
// Test: Local Keywords
// ============================================================================

describe('Local Keywords health check', () => {
  beforeEach(() => {
    mockLocationFindUnique.mockReset();
    mockKeywordFindMany.mockReset();
    mockLandingPageFindMany.mockReset();
  });

  test('PASSING when keywords have ranks', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation())
    );
    mockKeywordFindMany.mockImplementation(() =>
      Promise.resolve([
        { id: 'kw-1', keyword: 'restaurant amsterdam', currentRank: 3 },
        { id: 'kw-2', keyword: 'eten amsterdam', currentRank: 8 },
      ])
    );
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const kwCheck = results.find((r) => r.category === 'LOCAL_KEYWORDS')!;

    expect(kwCheck.status).toBe('PASSING');
    expect(kwCheck.score).toBeGreaterThan(0);
  });

  test('FAILING when no keywords exist', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation())
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const kwCheck = results.find((r) => r.category === 'LOCAL_KEYWORDS')!;

    expect(kwCheck.status).toBe('FAILING');
    expect(kwCheck.score).toBe(0);
  });
});

// ============================================================================
// Test: Reviews
// ============================================================================

describe('Reviews health check', () => {
  beforeEach(() => {
    mockLocationFindUnique.mockReset();
    mockKeywordFindMany.mockReset();
    mockLandingPageFindMany.mockReset();
  });

  test('PASSING when reviews with good rating exist', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(
        createMockLocation({ avgRating: 4.5, reviewCount: 25 })
      )
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const reviewCheck = results.find((r) => r.category === 'REVIEWS')!;

    expect(reviewCheck.status).toBe('PASSING');
    expect(reviewCheck.score).toBeGreaterThan(0);
  });

  test('FAILING when no reviews exist', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation({ avgRating: 0, reviewCount: 0 }))
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const reviewCheck = results.find((r) => r.category === 'REVIEWS')!;

    expect(reviewCheck.status).toBe('FAILING');
    expect(reviewCheck.score).toBe(0);
  });
});

// ============================================================================
// Test: GBP (Google Business Profile)
// ============================================================================

describe('GBP health check', () => {
  beforeEach(() => {
    mockLocationFindUnique.mockReset();
    mockKeywordFindMany.mockReset();
    mockLandingPageFindMany.mockReset();
  });

  test('PASSING when GBP is connected', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation({ gbpStatus: 'connected' }))
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const gbpCheck = results.find(
      (r) => r.category === 'GOOGLE_BUSINESS_PROFILE'
    )!;

    expect(gbpCheck.status).toBe('PASSING');
    expect(gbpCheck.score).toBe(100);
  });

  test('NEEDS_IMPROVEMENT when GBP is not connected', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation({ gbpStatus: 'not_connected' }))
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const gbpCheck = results.find(
      (r) => r.category === 'GOOGLE_BUSINESS_PROFILE'
    )!;

    expect(gbpCheck.status).toBe('NEEDS_IMPROVEMENT');
  });
});

// ============================================================================
// Test: Service Areas
// ============================================================================

describe('Service Areas health check', () => {
  beforeEach(() => {
    mockLocationFindUnique.mockReset();
    mockKeywordFindMany.mockReset();
    mockLandingPageFindMany.mockReset();
  });

  test('PASSING when service area is set', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(
        createMockLocation({ serviceArea: '["Amsterdam", "Utrecht"]' })
      )
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const saCheck = results.find((r) => r.category === 'SERVICE_AREAS')!;

    expect(saCheck.status).toBe('PASSING');
    expect(saCheck.score).toBe(100);
  });

  test('NEEDS_IMPROVEMENT when service area is not set', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation({ serviceArea: null }))
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const saCheck = results.find((r) => r.category === 'SERVICE_AREAS')!;

    expect(saCheck.status).toBe('NEEDS_IMPROVEMENT');
  });
});

// ============================================================================
// Test: Local Links & Photos (always NOT_CHECKED)
// ============================================================================

describe('Local Links and Photos health checks', () => {
  beforeEach(() => {
    mockLocationFindUnique.mockReset();
    mockKeywordFindMany.mockReset();
    mockLandingPageFindMany.mockReset();
  });

  test('LOCAL_LINKS is always NOT_CHECKED (placeholder)', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation())
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const linksCheck = results.find((r) => r.category === 'LOCAL_LINKS')!;

    expect(linksCheck.status).toBe('NOT_CHECKED');
    expect(linksCheck.score).toBe(0);
  });

  test('PHOTOS is always NOT_CHECKED (placeholder)', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation())
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const photosCheck = results.find((r) => r.category === 'PHOTOS')!;

    expect(photosCheck.status).toBe('NOT_CHECKED');
    expect(photosCheck.score).toBe(0);
  });
});

// ============================================================================
// Test: Dutch titles and descriptions
// ============================================================================

describe('Dutch titles and descriptions', () => {
  beforeEach(() => {
    mockLocationFindUnique.mockReset();
    mockKeywordFindMany.mockReset();
    mockLandingPageFindMany.mockReset();
  });

  test('all health checks have Dutch titles', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation())
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');

    for (const result of results) {
      expect(result.title.length).toBeGreaterThan(0);
      // Dutch-specific titles should not be just the enum key
      expect(result.title).not.toBe(result.category);
    }
  });

  test('NOT_CHECKED categories return "Niet gecontroleerd" description', async () => {
    mockLocationFindUnique.mockImplementation(() =>
      Promise.resolve(createMockLocation())
    );
    mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
    mockLandingPageFindMany.mockImplementation(() => Promise.resolve([]));

    const results = await runLocationHealthChecks('proj-1', 'loc-1');
    const notCheckedResults = results.filter(
      (r) => r.status === 'NOT_CHECKED'
    );

    for (const result of notCheckedResults) {
      expect(result.description).toContain('Niet gecontroleerd');
    }
  });
});

// ============================================================================
// Test: calculateOverallHealthScore
// ============================================================================

describe('calculateOverallHealthScore', () => {
  test('calculates weighted average of all categories', () => {
    const results = [
      { category: 'NAP_CONSISTENCY', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'OPENING_HOURS', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'LOCAL_STRUCTURED_DATA', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'LANDING_PAGES', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'LOCAL_KEYWORDS', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'REVIEWS', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'GOOGLE_BUSINESS_PROFILE', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'LOCAL_LINKS', status: 'NOT_CHECKED' as const, score: 0, title: '', description: '' },
      { category: 'PHOTOS', status: 'NOT_CHECKED' as const, score: 0, title: '', description: '' },
      { category: 'SERVICE_AREAS', status: 'PASSING' as const, score: 100, title: '', description: '' },
    ];

    const score = calculateOverallHealthScore(results);

    // Should be < 100 because LOCAL_LINKS (5%) and PHOTOS (2.5%) have score 0
    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThan(100);
  });

  test('returns 0 for empty results', () => {
    const score = calculateOverallHealthScore([]);
    expect(score).toBe(0);
  });

  test('score is in 0-100 range', () => {
    const results = [
      { category: 'NAP_CONSISTENCY', status: 'FAILING' as const, score: 33, title: '', description: '' },
      { category: 'OPENING_HOURS', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'LOCAL_STRUCTURED_DATA', status: 'FAILING' as const, score: 0, title: '', description: '' },
      { category: 'LANDING_PAGES', status: 'PASSING' as const, score: 85, title: '', description: '' },
      { category: 'LOCAL_KEYWORDS', status: 'NEEDS_IMPROVEMENT' as const, score: 50, title: '', description: '' },
      { category: 'REVIEWS', status: 'PASSING' as const, score: 90, title: '', description: '' },
      { category: 'GOOGLE_BUSINESS_PROFILE', status: 'NEEDS_IMPROVEMENT' as const, score: 20, title: '', description: '' },
      { category: 'LOCAL_LINKS', status: 'NOT_CHECKED' as const, score: 0, title: '', description: '' },
      { category: 'PHOTOS', status: 'NOT_CHECKED' as const, score: 0, title: '', description: '' },
      { category: 'SERVICE_AREAS', status: 'FAILING' as const, score: 0, title: '', description: '' },
    ];

    const score = calculateOverallHealthScore(results);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('NAP_CONSISTENCY has highest weight (20)', () => {
    // Only NAP_CONSISTENCY failing → score should drop significantly
    const allPassing = [
      { category: 'NAP_CONSISTENCY', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'OPENING_HOURS', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'LOCAL_STRUCTURED_DATA', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'LANDING_PAGES', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'LOCAL_KEYWORDS', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'REVIEWS', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'GOOGLE_BUSINESS_PROFILE', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'LOCAL_LINKS', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'PHOTOS', status: 'PASSING' as const, score: 100, title: '', description: '' },
      { category: 'SERVICE_AREAS', status: 'PASSING' as const, score: 100, title: '', description: '' },
    ];

    const napFailing = allPassing.map((r) =>
      r.category === 'NAP_CONSISTENCY' ? { ...r, score: 0 } : r
    );

    const scorePassing = calculateOverallHealthScore(allPassing);
    const scoreFailing = calculateOverallHealthScore(napFailing);

    // NAP_CONSISTENCY has weight 20, so dropping it from 100 to 0
    // should reduce the score by about 20%
    expect(scorePassing - scoreFailing).toBeGreaterThan(15);
  });
});

// ============================================================================
// Test: saveHealthChecks
// ============================================================================

describe('saveHealthChecks', () => {
  beforeEach(() => {
    mockHealthCheckCreate.mockReset();
    mockLocationUpdate.mockReset();
  });

  test('saves each health check result to the database', async () => {
    mockHealthCheckCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'hc-new', ...args.data })
    );
    mockLocationUpdate.mockImplementation(() =>
      Promise.resolve({ id: 'loc-1' })
    );

    const results = [
      {
        category: 'NAP_CONSISTENCY',
        status: 'PASSING' as const,
        score: 100,
        title: 'NAP-consistentie',
        description: 'Naam, adres en telefoonnummer zijn consistent.',
      },
      {
        category: 'OPENING_HOURS',
        status: 'FAILING' as const,
        score: 0,
        title: 'Openingstijden',
        description: 'Geen openingstijden ingesteld.',
        recommendation: 'Voeg openingstijden toe.',
      },
    ];

    await saveHealthChecks('proj-1', 'loc-1', results);

    expect(mockHealthCheckCreate).toHaveBeenCalledTimes(2);
    expect(mockHealthCheckCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          locationId: 'loc-1',
          category: 'NAP_CONSISTENCY',
          score: 100,
          title: 'NAP-consistentie',
        }),
      })
    );
  });

  test('updates location health score after saving', async () => {
    mockHealthCheckCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'hc-new', ...args.data })
    );
    mockLocationUpdate.mockImplementation(() =>
      Promise.resolve({ id: 'loc-1' })
    );

    const results = [
      {
        category: 'NAP_CONSISTENCY',
        status: 'PASSING' as const,
        score: 100,
        title: 'NAP-consistentie',
        description: 'Goed',
      },
    ];

    await saveHealthChecks('proj-1', 'loc-1', results);

    expect(mockLocationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'loc-1' },
        data: expect.objectContaining({
          localHealthScore: expect.any(Number),
        }),
      })
    );
  });
});

// ============================================================================
// Test: getLocationHealthChecks
// ============================================================================

describe('getLocationHealthChecks', () => {
  beforeEach(() => {
    mockHealthCheckFindMany.mockReset();
  });

  test('retrieves existing health checks for a location', async () => {
    const mockChecks = [
      { id: 'hc-1', locationId: 'loc-1', category: 'NAP_CONSISTENCY', score: 100 },
      { id: 'hc-2', locationId: 'loc-1', category: 'OPENING_HOURS', score: 0 },
    ];
    mockHealthCheckFindMany.mockImplementation(() => Promise.resolve(mockChecks));

    const result = await getLocationHealthChecks('loc-1');

    expect(result).toEqual(mockChecks);
    expect(mockHealthCheckFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { locationId: 'loc-1' },
        orderBy: { checkedAt: 'desc' },
      })
    );
  });

  test('returns empty array when no health checks exist', async () => {
    mockHealthCheckFindMany.mockImplementation(() => Promise.resolve([]));

    const result = await getLocationHealthChecks('loc-1');

    expect(result).toEqual([]);
  });
});
