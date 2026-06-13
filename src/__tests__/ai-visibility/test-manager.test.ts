/**
 * AI Visibility Test Manager Tests
 * Tests for /src/lib/ai-visibility/index.ts (test-related functions)
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockResultFindMany = mock(() => Promise.resolve([]));
const mockResultCreate = mock(() => Promise.resolve({ id: 'result-1' }));
const mockResultCount = mock(() => Promise.resolve(0));
const mockSummaryUpsert = mock(() => Promise.resolve({ id: 'summary-1' }));
const mockPromptFindMany = mock(() => Promise.resolve([]));
const mockPromptFindUnique = mock(() => Promise.resolve(null));
const mockClusterFindMany = mock(() => Promise.resolve([]));

mock.module('@/lib/db', () => ({
  db: {
    aIPromptLibrary: {
      findMany: mockPromptFindMany,
      findUnique: mockPromptFindUnique,
      create: mock(() => Promise.resolve({ id: 'p1' })),
      update: mock(() => Promise.resolve({ id: 'p1' })),
      count: mock(() => Promise.resolve(0)),
    },
    aIPromptCluster: {
      findMany: mockClusterFindMany,
      create: mock(() => Promise.resolve({ id: 'c1' })),
    },
    aIVisibilityResult: {
      findMany: mockResultFindMany,
      create: mockResultCreate,
      count: mockResultCount,
    },
    aIVisibilitySummary: {
      upsert: mockSummaryUpsert,
    },
    project: {
      findUnique: mock(() => Promise.resolve({
        websiteUrl: 'https://testproject.nl',
        brandProfile: { brandName: 'TestProject' },
      })),
    },
  },
}));

mock.module('@/lib/ai/provider-manager', () => ({
  providerManager: {
    getDefaultProvider: mock(() => Promise.resolve({
      generate: mock(() => Promise.resolve({
        content: 'TestProject is a great SEO tool.',
        model: 'local-simulation',
        providerName: '',
      })),
    })),
    getProvider: mock(() => Promise.resolve({
      generate: mock(() => Promise.resolve({
        content: 'TestProject is a great SEO tool.',
        model: 'local-simulation',
        providerName: '',
      })),
    })),
  },
}));

import {
  createManualTest,
  runLocalSimulation,
  getResults,
  importCsvResults,
  calculateSummary,
} from '@/lib/ai-visibility';

// ============================================================================
// Test: createManualTest
// ============================================================================

describe('createManualTest', () => {
  beforeEach(() => {
    mockResultCreate.mockReset();
  });

  test('creates a manual test result with required fields', async () => {
    mockResultCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'result-1', ...args.data, prompt: null })
    );

    const result = await createManualTest('proj-1', {
      promptText: 'Wat zijn de beste SEO-tools?',
      isMentioned: true,
    });

    expect(mockResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          method: 'MANUAL_TEST',
          promptText: 'Wat zijn de beste SEO-tools?',
          isMentioned: true,
          isSimulation: false,
        }),
      })
    );
  });

  test('creates a manual test with full metadata', async () => {
    mockResultCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'result-2', ...args.data, prompt: null })
    );

    await createManualTest('proj-1', {
      promptId: 'prompt-1',
      platform: 'chatgpt',
      model: 'gpt-4o',
      promptText: 'Test prompt',
      response: 'AI response text',
      isMentioned: true,
      mentionedUrls: ['https://example.com'],
      mentionedSources: ['Example'],
      competitorMentions: ['Competitor A'],
      sentiment: 'positive',
      accuracy: 0.9,
      confidence: 0.8,
      country: 'NL',
      language: 'nl-NL',
    });

    expect(mockResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: 'chatgpt',
          model: 'gpt-4o',
          sentiment: 'positive',
          accuracy: 0.9,
          confidence: 0.8,
        }),
      })
    );
  });
});

// ============================================================================
// Test: local simulation sets isSimulation=true and includes disclaimer
// ============================================================================

describe('runLocalSimulation', () => {
  beforeEach(() => {
    mockResultCreate.mockReset();
  });

  test('creates result with isSimulation=true', async () => {
    mockResultCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'result-sim', ...args.data, prompt: null })
    );

    const result = await runLocalSimulation('proj-1', 'Simulate this prompt');

    expect(mockResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          method: 'LOCAL_SIMULATION',
          isSimulation: true,
        }),
      })
    );
  });

  test('includes Dutch disclaimer as simulationNote', async () => {
    mockResultCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'result-sim', ...args.data, prompt: null })
    );

    await runLocalSimulation('proj-1', 'Test prompt');

    expect(mockResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          simulationNote: 'Simulatie – geen bewijs van werkelijke externe AI-zichtbaarheid.',
        }),
      })
    );
  });

  test('sets platform and model from input or defaults', async () => {
    mockResultCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'result-sim', ...args.data, prompt: null })
    );

    await runLocalSimulation('proj-1', 'Test', { model: 'local-simulation' });

    expect(mockResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: 'local',
          model: 'local-simulation',
        }),
      })
    );
  });
});

// ============================================================================
// Test: calculateSummary metrics
// ============================================================================

describe('calculateSummary', () => {
  beforeEach(() => {
    mockResultFindMany.mockReset();
    mockSummaryUpsert.mockReset();
  });

  test('calculates correct brandMentionRate', async () => {
    const results = [
      { isMentioned: true, isSimulation: false, accuracy: null, sentiment: null, competitorMentions: null },
      { isMentioned: true, isSimulation: false, accuracy: null, sentiment: null, competitorMentions: null },
      { isMentioned: false, isSimulation: false, accuracy: null, sentiment: null, competitorMentions: null },
      { isMentioned: false, isSimulation: true, accuracy: null, sentiment: null, competitorMentions: null },
    ];
    mockResultFindMany.mockImplementation(() => Promise.resolve(results));
    mockSummaryUpsert.mockImplementation((args: any) =>
      Promise.resolve({ id: 'summary-1', ...args.create })
    );

    const summary = await calculateSummary('proj-1');

    expect(summary.totalTests).toBe(4);
    expect(summary.mentionedTests).toBe(2);
    expect(summary.brandMentionRate).toBe(0.5); // 2/4
    expect(summary.simulationTests).toBe(1);
  });

  test('calculates shareOfAIVoice from non-simulation tests', async () => {
    const results = [
      { isMentioned: true, isSimulation: false, accuracy: null, sentiment: null, competitorMentions: null, mentionedSources: null, promptId: null },
      { isMentioned: false, isSimulation: false, accuracy: null, sentiment: null, competitorMentions: null, mentionedSources: null, promptId: null },
      { isMentioned: true, isSimulation: true, accuracy: null, sentiment: null, competitorMentions: null, mentionedSources: null, promptId: null },
    ];
    mockResultFindMany.mockImplementation(() => Promise.resolve(results));
    mockSummaryUpsert.mockImplementation((args: any) =>
      Promise.resolve({ id: 'summary-1', ...args.create })
    );

    const summary = await calculateSummary('proj-1');

    // shareOfAIVoice = brandMentionRate = mentioned/total = 2/3
    expect(summary.shareOfAIVoice).toBeCloseTo(2/3, 5);
  });

  test('calculates avgAccuracy from results with accuracy', async () => {
    const results = [
      { isMentioned: true, isSimulation: false, accuracy: 0.9, sentiment: null, competitorMentions: null, mentionedSources: null, promptId: null },
      { isMentioned: true, isSimulation: false, accuracy: 0.7, sentiment: null, competitorMentions: null, mentionedSources: null, promptId: null },
      { isMentioned: false, isSimulation: false, accuracy: 0.5, sentiment: null, competitorMentions: null, mentionedSources: null, promptId: null },
    ];
    mockResultFindMany.mockImplementation(() => Promise.resolve(results));
    mockSummaryUpsert.mockImplementation((args: any) =>
      Promise.resolve({ id: 'summary-1', ...args.create })
    );

    const summary = await calculateSummary('proj-1');

    // avgAccuracy = (0.9 + 0.7 + 0.5) / 3 = 0.7 (all results with accuracy)
    expect(summary.avgAccuracy).toBeCloseTo(0.7, 5);
  });

  test('returns zeros for empty project', async () => {
    mockResultFindMany.mockImplementation(() => Promise.resolve([]));
    mockSummaryUpsert.mockImplementation((args: any) =>
      Promise.resolve({ id: 'summary-1', ...args.create })
    );

    const summary = await calculateSummary('proj-1');

    expect(summary.totalTests).toBe(0);
    expect(summary.mentionedTests).toBe(0);
    expect(summary.brandMentionRate).toBe(0);
    expect(summary.shareOfAIVoice).toBe(0);
  });
});

// ============================================================================
// Test: CSV Import
// ============================================================================

describe('importCsvResults', () => {
  beforeEach(() => {
    mockResultCreate.mockReset();
  });

  test('imports multiple CSV records', async () => {
    const csvContent = 'prompt,platform,mentioned\nQuery 1,chatgpt,yes\nQuery 2,gemini,no\nQuery 3,perplexity,yes';

    mockResultCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: `result-${Date.now()}`, ...args.data })
    );

    const result = await importCsvResults('proj-1', csvContent);

    expect(mockResultCreate).toHaveBeenCalledTimes(3);
    expect(result.imported).toBe(3);
    expect(result.batchId).toContain('csv_');
  });

  test('sets method to CSV_IMPORT for imported records', async () => {
    mockResultCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'result-csv', ...args.data })
    );

    await importCsvResults('proj-1', 'prompt,mentioned\nQuery 1,no');

    expect(mockResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          method: 'CSV_IMPORT',
        }),
      })
    );
  });

  test('sets isSimulation to false for CSV imports', async () => {
    mockResultCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'result-csv', ...args.data })
    );

    await importCsvResults('proj-1', 'prompt,mentioned\nQuery 1,yes');

    expect(mockResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isSimulation: false,
        }),
      })
    );
  });

  test('sets importBatch to a consistent batch ID', async () => {
    mockResultCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'result-csv', ...args.data })
    );

    await importCsvResults('proj-1', 'prompt,mentioned\nQuery 1,yes\nQuery 2,no');

    // All records should share the same batchId
    const batchIds = mockResultCreate.mock.calls.map(
      (call: any) => call[0].data.importBatch
    );
    expect(new Set(batchIds).size).toBe(1);
  });
});

// ============================================================================
// Test: getResults with filters
// ============================================================================

describe('getResults with filters', () => {
  beforeEach(() => {
    mockResultFindMany.mockReset();
    mockResultCount.mockReset();
  });

  test('filters by method', async () => {
    mockResultFindMany.mockImplementation(() => Promise.resolve([]));
    mockResultCount.mockImplementation(() => Promise.resolve(0));

    await getResults('proj-1', { method: 'MANUAL_TEST' });

    expect(mockResultFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          method: 'MANUAL_TEST',
        }),
      })
    );
  });

  test('filters by platform', async () => {
    mockResultFindMany.mockImplementation(() => Promise.resolve([]));
    mockResultCount.mockImplementation(() => Promise.resolve(0));

    await getResults('proj-1', { platform: 'chatgpt' });

    expect(mockResultFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: 'chatgpt',
        }),
      })
    );
  });

  test('filters by isMentioned', async () => {
    mockResultFindMany.mockImplementation(() => Promise.resolve([]));
    mockResultCount.mockImplementation(() => Promise.resolve(0));

    await getResults('proj-1', { isMentioned: true });

    expect(mockResultFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isMentioned: true,
        }),
      })
    );
  });

  test('applies date range filter', async () => {
    mockResultFindMany.mockImplementation(() => Promise.resolve([]));
    mockResultCount.mockImplementation(() => Promise.resolve(0));

    await getResults('proj-1', {
      dateFrom: new Date('2025-01-01'),
      dateTo: new Date('2025-12-31'),
    });

    expect(mockResultFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          testDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });
});
