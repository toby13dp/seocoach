/**
 * Budget Manager Tests
 * Tests for /src/lib/forecasting/budget-manager.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// ============================================================================
// DB Mock Setup — must come BEFORE importing the module under test
// ============================================================================

const mockBudgetCreate = mock(() => Promise.resolve({ id: 'budget-1' }));
const mockBudgetFindFirst = mock(() => Promise.resolve(null));
const mockBudgetFindMany = mock(() => Promise.resolve([]));
const mockBudgetUpdate = mock(() => Promise.resolve({ id: 'budget-1' }));
const mockAuthorityCount = mock(() => Promise.resolve(100));
const mockLocationCount = mock(() => Promise.resolve(0));
const mockExperimentCount = mock(() => Promise.resolve(0));
const mockCROFindingCount = mock(() => Promise.resolve(0));
const mockPageCount = mock(() => Promise.resolve(0));
const mockContentDecayCount = mock(() => Promise.resolve(0));

mock.module('@/lib/db', () => ({
  db: {
    budgetAllocation: {
      create: mockBudgetCreate,
      findFirst: mockBudgetFindFirst,
      findMany: mockBudgetFindMany,
      update: mockBudgetUpdate,
    },
    authorityRecord: {
      count: mockAuthorityCount,
    },
    location: {
      count: mockLocationCount,
    },
    experiment: {
      count: mockExperimentCount,
    },
    cROFinding: {
      count: mockCROFindingCount,
    },
    page: {
      count: mockPageCount,
    },
    contentDecay: {
      count: mockContentDecayCount,
    },
  },
}));

import {
  createBudget,
  updateBudget,
  getBudget,
  listBudgets,
  deleteBudget,
  getBudgetRecommendations,
} from '@/lib/forecasting/budget-manager';
import type { BudgetAllocationData } from '@/lib/forecasting/types';

// ============================================================================
// Helpers
// ============================================================================

/** Create a valid budget allocation data object (sums to 100%) */
function makeBudgetData(overrides: Partial<BudgetAllocationData['allocations']> = {}): BudgetAllocationData {
  const defaultAllocations: BudgetAllocationData['allocations'] = {
    technicalSeo: 15,
    content: 20,
    updates: 5,
    authority: 15,
    digitalPR: 5,
    cro: 10,
    localSeo: 5,
    geo: 5,
    monitoring: 10,
    reporting: 10,
  };

  return {
    name: 'Test Budget',
    totalBudget: 10000,
    allocations: { ...defaultAllocations, ...overrides },
  };
}

/** Reset all mocks before each test */
function resetMocks() {
  mockBudgetCreate.mockReset();
  mockBudgetFindFirst.mockReset();
  mockBudgetFindMany.mockReset();
  mockBudgetUpdate.mockReset();
  mockAuthorityCount.mockReset();
  mockLocationCount.mockReset();
  mockExperimentCount.mockReset();
  mockCROFindingCount.mockReset();
  mockPageCount.mockReset();
  mockContentDecayCount.mockReset();

  // Defaults
  mockBudgetCreate.mockImplementation((args: any) => Promise.resolve({ id: 'budget-1', ...args.data }));
  mockBudgetFindFirst.mockImplementation(() => Promise.resolve(null));
  mockBudgetFindMany.mockImplementation(() => Promise.resolve([]));
  mockBudgetUpdate.mockImplementation((args: any) => Promise.resolve({ id: 'budget-1', ...args.data }));
  mockAuthorityCount.mockImplementation(() => Promise.resolve(100));
  mockLocationCount.mockImplementation(() => Promise.resolve(0));
  mockExperimentCount.mockImplementation(() => Promise.resolve(0));
  mockCROFindingCount.mockImplementation(() => Promise.resolve(0));
  mockPageCount.mockImplementation(() => Promise.resolve(0));
  mockContentDecayCount.mockImplementation(() => Promise.resolve(0));
}

// ============================================================================
// Test: Budget Validation — percentages must sum to 100
// ============================================================================

describe('Budget validation — percentages must sum to 100', () => {
  beforeEach(resetMocks);

  test('exactly 100% → valid (no error)', async () => {
    const data = makeBudgetData();
    // Verify the allocations sum to 100
    const total = Object.values(data.allocations).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(100);

    // Should not throw
    await expect(createBudget('proj-1', data)).resolves.toBeDefined();
  });

  test('99% → Dutch error', async () => {
    const data = makeBudgetData({ reporting: 9 }); // 99%

    await expect(createBudget('proj-1', data)).rejects.toThrow(
      'De totale toewijzing moet 100% bedragen'
    );
  });

  test('101% → Dutch error', async () => {
    const data = makeBudgetData({ reporting: 11 }); // 101%

    await expect(createBudget('proj-1', data)).rejects.toThrow(
      'De totale toewijzing moet 100% bedragen'
    );
  });

  test('100.005% → valid (within tolerance)', async () => {
    const data = makeBudgetData({ reporting: 10.005 }); // 100.005%

    // Within ±0.01 tolerance → should not throw
    await expect(createBudget('proj-1', data)).resolves.toBeDefined();
  });

  test('negative allocation → Dutch error', async () => {
    // Set technicalSeo to -5 but compensate with +20 on content so total stays 100
    // Original: technicalSeo=15, content=20 → change: -5-15=-20 lost, +40-20=+20 gained
    const data = makeBudgetData({ technicalSeo: -5, content: 40 }); // total = 100 but -5 is invalid

    await expect(createBudget('proj-1', data)).rejects.toThrow(
      'mag niet negatief zijn'
    );
  });
});

// ============================================================================
// Test: Budget Recommendations
// ============================================================================

describe('getBudgetRecommendations — rule-based Dutch recommendations', () => {
  beforeEach(resetMocks);

  test('returns recommendations for all budget categories', async () => {
    const recommendations = await getBudgetRecommendations('proj-1');

    // Should have recommendations for all 10 categories
    expect(recommendations.length).toBe(10);

    const categories = recommendations.map(r => r.category);
    expect(categories).toContain('TECHNICAL_SEO');
    expect(categories).toContain('CONTENT');
    expect(categories).toContain('UPDATES');
    expect(categories).toContain('AUTHORITY');
    expect(categories).toContain('DIGITAL_PR');
    expect(categories).toContain('CRO');
    expect(categories).toContain('LOCAL_SEO');
    expect(categories).toContain('GEO');
    expect(categories).toContain('MONITORING');
    expect(categories).toContain('REPORTING');
  });

  test('recommendations contain Dutch reasons', async () => {
    const recommendations = await getBudgetRecommendations('proj-1');

    for (const rec of recommendations) {
      expect(rec.reason.length).toBeGreaterThan(10);
      // All reasons should be in Dutch (contain common Dutch words/patterns)
    }

    // Spot-check some Dutch content
    const techRec = recommendations.find(r => r.category === 'TECHNICAL_SEO');
    expect(techRec?.reason).toContain('Technische SEO');
  });

  test('few authority records → higher authority recommendation', async () => {
    mockAuthorityCount.mockImplementation(() => Promise.resolve(10));
    mockCROFindingCount.mockImplementation(() => Promise.resolve(0));
    mockPageCount.mockImplementation(() => Promise.resolve(0));
    mockContentDecayCount.mockImplementation(() => Promise.resolve(0));

    const recommendations = await getBudgetRecommendations('proj-1');
    const authRec = recommendations.find(r => r.category === 'AUTHORITY');

    expect(authRec?.recommendedPercentage).toBeGreaterThanOrEqual(15);
    expect(authRec?.reason).toContain('prioriteit');
  });

  test('many technical issues → higher technical SEO recommendation', async () => {
    mockCROFindingCount.mockImplementation(() => Promise.resolve(15));
    mockPageCount.mockImplementation(() => Promise.resolve(10));
    mockAuthorityCount.mockImplementation(() => Promise.resolve(100));
    mockContentDecayCount.mockImplementation(() => Promise.resolve(0));

    const recommendations = await getBudgetRecommendations('proj-1');
    const techRec = recommendations.find(r => r.category === 'TECHNICAL_SEO');

    // 25 issues total → high recommendation
    expect(techRec?.recommendedPercentage).toBeGreaterThanOrEqual(20);
  });
});

// ============================================================================
// Test: CRUD Operations (mock DB)
// ============================================================================

describe('CRUD operations', () => {
  beforeEach(resetMocks);

  test('createBudget passes all fields to DB', async () => {
    const data = makeBudgetData();
    await createBudget('proj-1', data);

    expect(mockBudgetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          name: 'Test Budget',
          totalBudget: 10000,
        }),
      })
    );
  });

  test('getBudget calls findFirst with correct filters', async () => {
    mockBudgetFindFirst.mockImplementation(() =>
      Promise.resolve({ id: 'budget-1', projectId: 'proj-1' })
    );

    const result = await getBudget('budget-1', 'proj-1');

    expect(mockBudgetFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'budget-1',
          projectId: 'proj-1',
          deletedAt: null,
        }),
      })
    );
  });

  test('listBudgets returns all budgets for project', async () => {
    const mockBudgets = [
      { id: 'b-1', name: 'Budget 1' },
      { id: 'b-2', name: 'Budget 2' },
    ];
    mockBudgetFindMany.mockImplementation(() => Promise.resolve(mockBudgets));

    const result = await listBudgets('proj-1');

    expect(result.length).toBe(2);
    expect(mockBudgetFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'proj-1',
          deletedAt: null,
        }),
      })
    );
  });

  test('deleteBudget soft-deletes by setting deletedAt', async () => {
    mockBudgetFindFirst.mockImplementation(() =>
      Promise.resolve({ id: 'budget-1', projectId: 'proj-1', deletedAt: null })
    );

    await deleteBudget('budget-1', 'proj-1');

    expect(mockBudgetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'budget-1' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          isActive: false,
        }),
      })
    );
  });

  test('deleteBudget throws Dutch error when not found', async () => {
    mockBudgetFindFirst.mockImplementation(() => Promise.resolve(null));

    await expect(deleteBudget('budget-999', 'proj-1')).rejects.toThrow(
      'Budget met ID "budget-999" niet gevonden'
    );
  });

  test('updateBudget throws Dutch error when not found', async () => {
    mockBudgetFindFirst.mockImplementation(() => Promise.resolve(null));

    await expect(
      updateBudget('budget-999', 'proj-1', { name: 'New Name' })
    ).rejects.toThrow('Budget met ID "budget-999" niet gevonden');
  });
});
