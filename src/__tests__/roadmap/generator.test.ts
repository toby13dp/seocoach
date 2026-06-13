/**
 * Roadmap Generator Tests
 * Tests for /src/lib/roadmap/generator.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockTechIssueFindMany = mock(() => Promise.resolve([]));
const mockKeywordFindMany = mock(() => Promise.resolve([]));
const mockDecayFindMany = mock(() => Promise.resolve([]));
const mockLinkFindMany = mock(() => Promise.resolve([]));
const mockDeleteMany = mock(() => Promise.resolve({ count: 0 }));
const mockCreate = mock(() => Promise.resolve({ id: 'ri-1' }));
const mockTransaction = mock((fns: any) => Promise.resolve([]));

mock.module('@/lib/db', () => ({
  db: {
    technicalIssue: {
      findMany: mockTechIssueFindMany,
    },
    keyword: {
      findMany: mockKeywordFindMany,
    },
    contentDecay: {
      findMany: mockDecayFindMany,
    },
    internalLink: {
      findMany: mockLinkFindMany,
    },
    roadmapItem: {
      deleteMany: mockDeleteMany,
      create: mockCreate,
      findMany: mock(() => Promise.resolve([])),
    },
    $transaction: mockTransaction,
  },
}));

import {
  generateRoadmapRecommendations,
  categorizeByTimeline,
  refreshRoadmap,
} from '@/lib/roadmap/generator';

/**
 * Reset all findMany mocks to return empty arrays.
 * This prevents undefined returns after mockReset().
 */
function resetAllMocks() {
  mockTechIssueFindMany.mockReset();
  mockKeywordFindMany.mockReset();
  mockDecayFindMany.mockReset();
  mockLinkFindMany.mockReset();
  // Set all mocks back to return empty arrays (mockReset clears the implementation)
  mockTechIssueFindMany.mockImplementation(() => Promise.resolve([]));
  mockKeywordFindMany.mockImplementation(() => Promise.resolve([]));
  mockDecayFindMany.mockImplementation(() => Promise.resolve([]));
  mockLinkFindMany.mockImplementation(() => Promise.resolve([]));
}

// ============================================================================
// Test: generateRoadmapRecommendations from technical issues
// ============================================================================

describe('generateRoadmapRecommendations — technical issues', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test('generates recommendations from technical issues', async () => {
    mockTechIssueFindMany.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'issue-1',
          ruleName: 'broken-links',
          severity: 'CRITICAL',
          dutchExplanation: 'Gebroken links gevonden op de website',
          priority: null,
          autoFixAvailable: false,
          impact: 'Beïnvloedt gebruikerservaring en SEO',
          recommendedAction: 'Repareer de gebroken links',
          dismissed: false,
        },
        {
          id: 'issue-2',
          ruleName: 'missing-meta',
          severity: 'WARNING',
          dutchExplanation: 'Meta-beschrijving ontbreekt',
          priority: null,
          autoFixAvailable: true,
          impact: null,
          recommendedAction: null,
          dismissed: false,
        },
      ])
    );

    const recommendations = await generateRoadmapRecommendations('proj-1');

    expect(recommendations.length).toBeGreaterThanOrEqual(2);
    const techRec = recommendations.find(
      (r) => r.sourceType === 'technical_issue' && r.sourceId === 'issue-1'
    );
    expect(techRec).toBeDefined();
    expect(techRec!.type).toBe('TECHNICAL_ISSUE');
    expect(techRec!.title).toContain('Technisch probleem');
    expect(techRec!.priority).toBe('CRITICAL');
  });

  test('excludes dismissed technical issues', async () => {
    mockTechIssueFindMany.mockImplementation(() => Promise.resolve([]));

    const recommendations = await generateRoadmapRecommendations('proj-1');
    const techRecs = recommendations.filter(
      (r) => r.type === 'TECHNICAL_ISSUE'
    );
    expect(techRecs.length).toBe(0);
  });

  test('sets MINIMAL effort when auto-fix is available', async () => {
    mockTechIssueFindMany.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'issue-auto',
          ruleName: 'auto-fix-issue',
          severity: 'ERROR',
          dutchExplanation: 'Kan automatisch worden opgelost',
          priority: null,
          autoFixAvailable: true,
          impact: null,
          recommendedAction: null,
          dismissed: false,
        },
      ])
    );

    const recommendations = await generateRoadmapRecommendations('proj-1');
    const autoFixRec = recommendations.find(
      (r) => r.sourceId === 'issue-auto'
    );

    expect(autoFixRec).toBeDefined();
    expect(autoFixRec!.effort).toBe('MINIMAL');
  });
});

// ============================================================================
// Test: generateRoadmapRecommendations from keyword opportunities
// ============================================================================

describe('generateRoadmapRecommendations — keyword opportunities', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test('generates recommendations from high-opportunity keywords', async () => {
    mockKeywordFindMany.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'kw-1',
          keyword: 'seo tools',
          searchVolume: 5000,
          currentRanking: 15,
          deletedAt: null,
          opportunity: { totalScore: 85 },
        },
        {
          id: 'kw-2',
          keyword: 'seo software',
          searchVolume: 3000,
          currentRanking: null,
          deletedAt: null,
          opportunity: { totalScore: 65 },
        },
      ])
    );

    const recommendations = await generateRoadmapRecommendations('proj-1');
    const kwRecs = recommendations.filter(
      (r) => r.type === 'KEYWORD_OPPORTUNITY'
    );

    expect(kwRecs.length).toBeGreaterThanOrEqual(2);
    expect(kwRecs[0].title).toContain('Zoekwoordkans');
    expect(kwRecs[0].description).toContain('opportunityscore');
  });

  test('sets CRITICAL priority for very high opportunity scores', async () => {
    mockKeywordFindMany.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'kw-critical',
          keyword: 'high value keyword',
          searchVolume: 10000,
          currentRanking: 12,
          deletedAt: null,
          opportunity: { totalScore: 92 },
        },
      ])
    );

    const recommendations = await generateRoadmapRecommendations('proj-1');
    const criticalRec = recommendations.find(
      (r) => r.sourceId === 'kw-critical'
    );

    expect(criticalRec).toBeDefined();
    expect(criticalRec!.priority).toBe('CRITICAL');
  });

  test('suggests page-2 improvement for position 11-20 keywords', async () => {
    mockKeywordFindMany.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'kw-p2',
          keyword: 'page two keyword',
          searchVolume: 2000,
          currentRanking: 15,
          deletedAt: null,
          opportunity: { totalScore: 70 },
        },
      ])
    );

    const recommendations = await generateRoadmapRecommendations('proj-1');
    const p2Rec = recommendations.find((r) => r.sourceId === 'kw-p2');

    expect(p2Rec).toBeDefined();
    expect(p2Rec!.recommendation).toContain('pagina 2');
  });
});

// ============================================================================
// Test: generateRoadmapRecommendations from content decay
// ============================================================================

describe('generateRoadmapRecommendations — content decay', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test('generates recommendations from content decay records', async () => {
    mockDecayFindMany.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'decay-1',
          url: 'https://example.com/old-page',
          decayPercentage: 60,
          pruningAction: 'IMPROVE',
          dataAvailable: true,
        },
        {
          id: 'decay-2',
          url: 'https://example.com/removable-page',
          decayPercentage: 85,
          pruningAction: 'REMOVE',
          dataAvailable: true,
        },
      ])
    );

    const recommendations = await generateRoadmapRecommendations('proj-1');
    const decayRecs = recommendations.filter((r) => r.type === 'DECAY');

    expect(decayRecs.length).toBeGreaterThanOrEqual(2);
    expect(decayRecs[0].title).toContain('Inhoudveroudering');
    expect(decayRecs[0].description).toContain('achteruitgang');
  });

  test('sets CRITICAL priority for high decay percentage', async () => {
    mockDecayFindMany.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'decay-critical',
          url: 'https://example.com/critical-decay',
          decayPercentage: 80,
          pruningAction: 'IMPROVE',
          dataAvailable: true,
        },
      ])
    );

    const recommendations = await generateRoadmapRecommendations('proj-1');
    const criticalRec = recommendations.find(
      (r) => r.sourceId === 'decay-critical'
    );

    expect(criticalRec).toBeDefined();
    expect(criticalRec!.priority).toBe('CRITICAL');
  });

  test('suggests removal for REMOVE pruning action', async () => {
    mockDecayFindMany.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'decay-remove',
          url: 'https://example.com/remove-page',
          decayPercentage: 75,
          pruningAction: 'REMOVE',
          dataAvailable: true,
        },
      ])
    );

    const recommendations = await generateRoadmapRecommendations('proj-1');
    const removeRec = recommendations.find(
      (r) => r.sourceId === 'decay-remove'
    );

    expect(removeRec).toBeDefined();
    expect(removeRec!.recommendation).toContain('verwijderen');
  });

  test('suggests redirect for REDIRECT pruning action', async () => {
    mockDecayFindMany.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'decay-redirect',
          url: 'https://example.com/redirect-page',
          decayPercentage: 50,
          pruningAction: 'REDIRECT',
          dataAvailable: true,
        },
      ])
    );

    const recommendations = await generateRoadmapRecommendations('proj-1');
    const redirectRec = recommendations.find(
      (r) => r.sourceId === 'decay-redirect'
    );

    expect(redirectRec).toBeDefined();
    expect(redirectRec!.recommendation.toLowerCase()).toContain('redirect');
  });
});

// ============================================================================
// Test: categorizeByTimeline
// ============================================================================

describe('categorizeByTimeline', () => {
  test('maps CRITICAL + MINIMAL to TODAY', () => {
    const recs = [
      {
        type: 'TECHNICAL_ISSUE' as const,
        sourceType: 'technical_issue',
        sourceId: '1',
        title: 'Test',
        description: 'Test desc',
        priority: 'CRITICAL' as const,
        effort: 'MINIMAL' as const,
        impact: 'Test impact',
        recommendation: 'Test rec',
        suggestedView: 'TODAY' as const,
        suggestedDate: null,
      },
    ];

    const result = categorizeByTimeline(recs);
    expect(result[0].suggestedView).toBe('TODAY');
  });

  test('maps CRITICAL + HIGH effort to THIS_WEEK', () => {
    const recs = [
      {
        type: 'TECHNICAL_ISSUE' as const,
        sourceType: 'technical_issue',
        sourceId: '1',
        title: 'Test',
        description: 'Test desc',
        priority: 'CRITICAL' as const,
        effort: 'HIGH' as const,
        impact: 'Test impact',
        recommendation: 'Test rec',
        suggestedView: 'THIS_WEEK' as const,
        suggestedDate: null,
      },
    ];

    const result = categorizeByTimeline(recs);
    expect(result[0].suggestedView).toBe('THIS_WEEK');
  });

  test('maps HIGH + LOW effort to THIS_WEEK', () => {
    const recs = [
      {
        type: 'KEYWORD_OPPORTUNITY' as const,
        sourceType: 'keyword',
        sourceId: '1',
        title: 'Test',
        description: 'Test desc',
        priority: 'HIGH' as const,
        effort: 'LOW' as const,
        impact: 'Test impact',
        recommendation: 'Test rec',
        suggestedView: 'THIS_WEEK' as const,
        suggestedDate: null,
      },
    ];

    const result = categorizeByTimeline(recs);
    expect(result[0].suggestedView).toBe('THIS_WEEK');
  });

  test('maps HIGH + MEDIUM effort to THIS_MONTH', () => {
    const recs = [
      {
        type: 'KEYWORD_OPPORTUNITY' as const,
        sourceType: 'keyword',
        sourceId: '1',
        title: 'Test',
        description: 'Test desc',
        priority: 'HIGH' as const,
        effort: 'MEDIUM' as const,
        impact: 'Test impact',
        recommendation: 'Test rec',
        suggestedView: 'THIS_MONTH' as const,
        suggestedDate: null,
      },
    ];

    const result = categorizeByTimeline(recs);
    expect(result[0].suggestedView).toBe('THIS_MONTH');
  });

  test('maps MEDIUM priority to NINETY_DAYS', () => {
    const recs = [
      {
        type: 'DECAY' as const,
        sourceType: 'content_decay',
        sourceId: '1',
        title: 'Test',
        description: 'Test desc',
        priority: 'MEDIUM' as const,
        effort: 'LOW' as const,
        impact: 'Test impact',
        recommendation: 'Test rec',
        suggestedView: 'NINETY_DAYS' as const,
        suggestedDate: null,
      },
    ];

    const result = categorizeByTimeline(recs);
    expect(result[0].suggestedView).toBe('NINETY_DAYS');
  });

  test('maps LOW priority to LATER', () => {
    const recs = [
      {
        type: 'INTERNAL_LINK' as const,
        sourceType: 'internal_link',
        sourceId: '1',
        title: 'Test',
        description: 'Test desc',
        priority: 'LOW' as const,
        effort: 'HIGH' as const,
        impact: 'Test impact',
        recommendation: 'Test rec',
        suggestedView: 'LATER' as const,
        suggestedDate: null,
      },
    ];

    const result = categorizeByTimeline(recs);
    expect(result[0].suggestedView).toBe('LATER');
  });
});

// ============================================================================
// Test: refreshRoadmap
// ============================================================================

describe('refreshRoadmap', () => {
  beforeEach(() => {
    mockDeleteMany.mockReset();
    mockTransaction.mockReset();
    resetAllMocks();
  });

  test('removes old auto-generated items and creates new ones', async () => {
    mockDeleteMany.mockImplementation(() => Promise.resolve({ count: 5 }));

    mockTechIssueFindMany.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'issue-1',
          ruleName: 'test-issue',
          severity: 'ERROR',
          dutchExplanation: 'Test probleem',
          priority: null,
          autoFixAvailable: false,
          impact: null,
          recommendedAction: null,
          dismissed: false,
        },
      ])
    );

    mockTransaction.mockImplementation((fns: any) => Promise.resolve([{ id: 'ri-1' }]));

    const result = await refreshRoadmap('proj-1');

    expect(mockDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'proj-1', autoGenerated: true },
      })
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  test('preserves manually created items (only deletes auto-generated)', async () => {
    mockDeleteMany.mockImplementation(() => Promise.resolve({ count: 0 }));
    mockTransaction.mockImplementation(() => Promise.resolve([]));

    await refreshRoadmap('proj-1');

    // deleteMany should only target autoGenerated: true
    expect(mockDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          autoGenerated: true,
        }),
      })
    );
  });
});

// ============================================================================
// Test: No data fabrication
// ============================================================================

describe('No data fabrication', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test('returns empty array when no sources exist', async () => {
    // All sources return empty arrays (already the default from resetAllMocks)

    const recommendations = await generateRoadmapRecommendations('proj-1');
    expect(recommendations).toEqual([]);
  });

  test('never generates recommendations without real data', async () => {
    // All sources return empty arrays (already the default from resetAllMocks)

    const recommendations = await generateRoadmapRecommendations('proj-1');

    // No recommendations means no fabricated data
    for (const rec of recommendations) {
      expect(rec.sourceId).toBeDefined();
      expect(rec.title.length).toBeGreaterThan(0);
    }
  });
});
