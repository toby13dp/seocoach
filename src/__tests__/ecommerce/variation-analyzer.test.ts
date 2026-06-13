/**
 * Variation Analyzer Tests
 * Tests for /src/lib/ecommerce/variation-analyzer.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// ============================================================================
// Mock database
// ============================================================================

const mockProductFindFirst = mock(() => Promise.resolve(null));
const mockProductFindMany = mock(() => Promise.resolve([]));

mock.module('@/lib/db', () => ({
  db: {
    product: {
      findFirst: mockProductFindFirst,
      findMany: mockProductFindMany,
    },
  },
}));

// Import AFTER mock.module
import { analyzeProductVariations } from '@/lib/ecommerce/variation-analyzer';

// ============================================================================
// Helper — parent product
// ============================================================================

function makeParent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'parent-1',
    projectId: 'proj-1',
    name: 'T-Shirt Basis',
    description: 'Een comfortabel basis t-shirt gemaakt van 100% katoen. Beschikbaar in diverse kleuren en maten.',
    deletedAt: null,
    ...overrides,
  };
}

// ============================================================================
// Helper — variation product
// ============================================================================

function makeVariation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'var-1',
    name: 'T-Shirt Basis - Rood - M',
    description: 'Een comfortabel basis t-shirt gemaakt van 100% katoen in de kleur rood, maat M.',
    shortDescription: 'Rood t-shirt maat M',
    imageUrl: 'https://example.com/tshirt-rood-m.jpg',
    variationAttributes: '{"kleur":"rood","maat":"M"}',
    stockStatus: 'ACTIVE',
    stockQuantity: 10,
    ...overrides,
  };
}

// ============================================================================
// analyzeProductVariations — Variations with unique descriptions
// ============================================================================

describe('analyzeProductVariations — unique descriptions = good score', () => {
  beforeEach(() => {
    mockProductFindFirst.mockImplementation(() => Promise.resolve(makeParent()));
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeVariation({
          id: 'var-1',
          name: 'T-Shirt Rood M',
          description: 'Rood katoenen t-shirt in maat M, perfect voor casual gelegenheden.',
        }),
        makeVariation({
          id: 'var-2',
          name: 'T-Shirt Blauw L',
          description: 'Blauw katoenen t-shirt in maat L, ideaal voor dagelijks gebruik.',
          imageUrl: 'https://example.com/tshirt-blauw-l.jpg',
        }),
      ])
    );
  });

  test('variations with unique descriptions are counted correctly', async () => {
    const result = await analyzeProductVariations('parent-1', 'proj-1');
    expect(result.totalVariations).toBe(2);
    expect(result.variationsWithUniqueDescriptions).toBe(2);
  });

  test('all variations having unique descriptions means no duplicate issue', async () => {
    const result = await analyzeProductVariations('parent-1', 'proj-1');
    expect(result.duplicateContentGroups).toBe(0);
  });
});

// ============================================================================
// analyzeProductVariations — Duplicate descriptions across variations
// ============================================================================

describe('analyzeProductVariations — duplicate descriptions produce Dutch issue', () => {
  beforeEach(() => {
    const sharedDesc = 'Een comfortabel basis t-shirt gemaakt van 100% katoen. Beschikbaar in diverse kleuren en maten.';
    mockProductFindFirst.mockImplementation(() => Promise.resolve(makeParent({ description: 'Parent description that is different' })));
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeVariation({
          id: 'var-1',
          name: 'T-Shirt Rood M',
          description: sharedDesc,
        }),
        makeVariation({
          id: 'var-2',
          name: 'T-Shirt Blauw L',
          description: sharedDesc,
          imageUrl: 'https://example.com/tshirt-blauw-l.jpg',
        }),
      ])
    );
  });

  test('duplicate descriptions detected as duplicateContentGroups', async () => {
    const result = await analyzeProductVariations('parent-1', 'proj-1');
    expect(result.duplicateContentGroups).toBeGreaterThan(0);
  });

  test('Dutch issue about duplicate content is generated', async () => {
    const result = await analyzeProductVariations('parent-1', 'proj-1');
    expect(result.issues.some(i => i.includes('Dubbele inhoud') || i.includes('dubbele'))).toBe(true);
  });
});

// ============================================================================
// analyzeProductVariations — Missing images
// ============================================================================

describe('analyzeProductVariations — missing images produce Dutch issue', () => {
  beforeEach(() => {
    mockProductFindFirst.mockImplementation(() => Promise.resolve(makeParent()));
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeVariation({
          id: 'var-1',
          name: 'T-Shirt Rood M',
          description: 'Unieke beschrijving rood t-shirt maat M.',
          imageUrl: 'https://example.com/tshirt-rood-m.jpg',
        }),
        makeVariation({
          id: 'var-2',
          name: 'T-Shirt Blauw L',
          description: 'Unieke beschrijving blauw t-shirt maat L.',
          imageUrl: null,
        }),
      ])
    );
  });

  test('variation without image reduces variationsWithImages count', async () => {
    const result = await analyzeProductVariations('parent-1', 'proj-1');
    expect(result.variationsWithImages).toBe(1);
    expect(result.totalVariations).toBe(2);
  });

  test('Dutch issue about missing images is generated', async () => {
    const result = await analyzeProductVariations('parent-1', 'proj-1');
    expect(result.issues.some(i => i.includes('afbeelding'))).toBe(true);
  });
});

// ============================================================================
// analyzeProductVariations — Out-of-stock variations not marked
// ============================================================================

describe('analyzeProductVariations — out-of-stock not marked produces Dutch issue', () => {
  beforeEach(() => {
    mockProductFindFirst.mockImplementation(() => Promise.resolve(makeParent()));
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeVariation({
          id: 'var-1',
          name: 'T-Shirt Rood M',
          description: 'Unieke beschrijving rood t-shirt maat M.',
          imageUrl: 'https://example.com/tshirt-rood-m.jpg',
          stockQuantity: 0,
          stockStatus: 'ACTIVE', // Not marked as out of stock
        }),
        makeVariation({
          id: 'var-2',
          name: 'T-Shirt Blauw L',
          description: 'Unieke beschrijving blauw t-shirt maat L.',
          imageUrl: 'https://example.com/tshirt-blauw-l.jpg',
          stockQuantity: 5,
          stockStatus: 'ACTIVE',
        }),
      ])
    );
  });

  test('out-of-stock variation not properly marked generates Dutch issue', async () => {
    const result = await analyzeProductVariations('parent-1', 'proj-1');
    expect(result.issues.some(i => i.includes('uit voorraad') && i.includes('niet correct gemarkeerd'))).toBe(true);
  });

  test('correctly marked out-of-stock variation does NOT generate issue', async () => {
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeVariation({
          id: 'var-1',
          name: 'T-Shirt Rood M',
          description: 'Unieke beschrijving rood t-shirt maat M.',
          imageUrl: 'https://example.com/tshirt-rood-m.jpg',
          stockQuantity: 0,
          stockStatus: 'OUT_OF_STOCK', // Correctly marked
        }),
      ])
    );
    const result = await analyzeProductVariations('parent-1', 'proj-1');
    expect(result.issues.some(i => i.includes('uit voorraad') && i.includes('niet correct gemarkeerd'))).toBe(false);
  });
});

// ============================================================================
// analyzeProductVariations — No variations
// ============================================================================

describe('analyzeProductVariations — no variations', () => {
  beforeEach(() => {
    mockProductFindFirst.mockImplementation(() => Promise.resolve(makeParent()));
    mockProductFindMany.mockImplementation(() => Promise.resolve([]));
  });

  test('no variations returns appropriate result', async () => {
    const result = await analyzeProductVariations('parent-1', 'proj-1');
    expect(result.totalVariations).toBe(0);
    expect(result.variationsWithUniqueDescriptions).toBe(0);
    expect(result.variationsWithImages).toBe(0);
    expect(result.duplicateContentGroups).toBe(0);
  });

  test('Dutch issue about no variations found', async () => {
    const result = await analyzeProductVariations('parent-1', 'proj-1');
    expect(result.issues.some(i => i.includes('variaties gevonden'))).toBe(true);
  });

  test('no recommendations when there are no variations', async () => {
    const result = await analyzeProductVariations('parent-1', 'proj-1');
    expect(result.recommendations).toEqual([]);
  });
});

// ============================================================================
// analyzeProductVariations — Parent not found
// ============================================================================

describe('analyzeProductVariations — parent not found', () => {
  beforeEach(() => {
    mockProductFindFirst.mockImplementation(() => Promise.resolve(null));
  });

  test('throws Dutch error when parent product not found', async () => {
    expect(async () => {
      await analyzeProductVariations('nonexistent', 'proj-1');
    }).toThrow('Product niet gevonden of geen toegang.');
  });
});

// ============================================================================
// analyzeProductVariations — Missing variation attributes
// ============================================================================

describe('analyzeProductVariations — missing variation attributes', () => {
  beforeEach(() => {
    mockProductFindFirst.mockImplementation(() => Promise.resolve(makeParent()));
    mockProductFindMany.mockImplementation(() =>
      Promise.resolve([
        makeVariation({
          id: 'var-1',
          name: 'T-Shirt Rood M',
          description: 'Unieke beschrijving rood t-shirt maat M.',
          imageUrl: 'https://example.com/tshirt-rood-m.jpg',
          variationAttributes: null,
        }),
        makeVariation({
          id: 'var-2',
          name: 'T-Shirt Blauw L',
          description: 'Unieke beschrijving blauw t-shirt maat L.',
          imageUrl: 'https://example.com/tshirt-blauw-l.jpg',
          variationAttributes: null,
        }),
      ])
    );
  });

  test('missing variation attributes generates Dutch issue', async () => {
    const result = await analyzeProductVariations('parent-1', 'proj-1');
    expect(result.issues.some(i => i.includes('gestructureerde attributen') || i.includes('eigenschappen'))).toBe(true);
  });
});
