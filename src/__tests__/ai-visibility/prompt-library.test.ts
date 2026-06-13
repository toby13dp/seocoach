/**
 * AI Visibility Prompt Library Tests
 * Tests for /src/lib/ai-visibility/index.ts (prompt-related functions)
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockPromptFindMany = mock(() => Promise.resolve([]));
const mockPromptFindUnique = mock(() => Promise.resolve(null));
const mockPromptCreate = mock(() => Promise.resolve({ id: 'prompt-1' }));
const mockPromptUpdate = mock(() => Promise.resolve({ id: 'prompt-1' }));
const mockClusterFindMany = mock(() => Promise.resolve([]));
const mockClusterCreate = mock(() => Promise.resolve({ id: 'cluster-1' }));

mock.module('@/lib/db', () => ({
  db: {
    aIPromptLibrary: {
      findMany: mockPromptFindMany,
      findUnique: mockPromptFindUnique,
      create: mockPromptCreate,
      update: mockPromptUpdate,
    },
    aIPromptCluster: {
      findMany: mockClusterFindMany,
      create: mockClusterCreate,
    },
    aIVisibilityResult: {
      findMany: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve({ id: 'result-1' })),
      count: mock(() => Promise.resolve(0)),
    },
    aIVisibilitySummary: {
      upsert: mock(() => Promise.resolve({ id: 'summary-1' })),
    },
  },
}));

import {
  getPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  softDeletePrompt,
  createCluster,
  getClusters,
} from '@/lib/ai-visibility';

// ============================================================================
// Test: createPrompt
// ============================================================================

describe('createPrompt', () => {
  beforeEach(() => {
    mockPromptCreate.mockReset();
  });

  test('creates a new prompt with required fields', async () => {
    mockPromptCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'prompt-1', ...args.data, cluster: null })
    );

    const result = await createPrompt('proj-1', 'SEO-tools query', 'Wat zijn de beste SEO-tools?');

    expect(mockPromptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          name: 'SEO-tools query',
          prompt: 'Wat zijn de beste SEO-tools?',
        }),
      })
    );
    expect(result.id).toBe('prompt-1');
  });

  test('creates a prompt with optional cluster and funnel stage', async () => {
    mockPromptCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'prompt-2', ...args.data, cluster: null })
    );

    await createPrompt('proj-1', 'Brand query', 'Wie is de marktleider in SEO?', 'cluster-1', 'CONSIDERATION', 'COMMERCIAL_INVESTIGATION');

    expect(mockPromptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clusterId: 'cluster-1',
          funnelStage: 'CONSIDERATION',
          searchIntent: 'COMMERCIAL_INVESTIGATION',
        }),
      })
    );
  });
});

// ============================================================================
// Test: updatePrompt
// ============================================================================

describe('updatePrompt', () => {
  beforeEach(() => {
    mockPromptUpdate.mockReset();
  });

  test('updates prompt name and text', async () => {
    mockPromptUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'prompt-1', ...args.data, cluster: null })
    );

    await updatePrompt('prompt-1', {
      name: 'Updated name',
      prompt: 'Updated prompt text',
    });

    expect(mockPromptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prompt-1' },
        data: expect.objectContaining({
          name: 'Updated name',
          prompt: 'Updated prompt text',
        }),
      })
    );
  });

  test('only updates provided fields', async () => {
    mockPromptUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'prompt-1', ...args.data, cluster: null })
    );

    await updatePrompt('prompt-1', { name: 'New name only' });

    expect(mockPromptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'New name only',
        }),
      })
    );
    // Should NOT contain prompt in data
    const dataArg = mockPromptUpdate.mock.calls[0][0].data;
    expect(dataArg.prompt).toBeUndefined();
  });
});

// ============================================================================
// Test: softDeletePrompt
// ============================================================================

describe('softDeletePrompt', () => {
  beforeEach(() => {
    mockPromptUpdate.mockReset();
  });

  test('sets isActive to false instead of deleting', async () => {
    mockPromptUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'prompt-1', isActive: false })
    );

    await softDeletePrompt('prompt-1');

    expect(mockPromptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prompt-1' },
        data: { isActive: false },
      })
    );
  });
});

// ============================================================================
// Test: createCluster
// ============================================================================

describe('createCluster', () => {
  beforeEach(() => {
    mockClusterCreate.mockReset();
  });

  test('creates a new cluster', async () => {
    mockClusterCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'cluster-1', ...args.data })
    );

    const result = await createCluster('proj-1', 'Brand queries');

    expect(mockClusterCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          name: 'Brand queries',
        }),
      })
    );
  });

  test('creates a cluster with description', async () => {
    mockClusterCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'cluster-2', ...args.data })
    );

    await createCluster('proj-1', 'Product queries', 'Alle productgerelateerde prompts');

    expect(mockClusterCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Alle productgerelateerde prompts',
        }),
      })
    );
  });
});

// ============================================================================
// Test: getPrompts with filters
// ============================================================================

describe('getPrompts with filters', () => {
  beforeEach(() => {
    mockPromptFindMany.mockReset();
  });

  test('filters by clusterId', async () => {
    mockPromptFindMany.mockImplementation(() => Promise.resolve([]));

    await getPrompts('proj-1', { clusterId: 'cluster-1' });

    expect(mockPromptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clusterId: 'cluster-1',
        }),
      })
    );
  });

  test('filters by funnelStage', async () => {
    mockPromptFindMany.mockImplementation(() => Promise.resolve([]));

    await getPrompts('proj-1', { funnelStage: 'CONSIDERATION' });

    expect(mockPromptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          funnelStage: 'CONSIDERATION',
        }),
      })
    );
  });

  test('filters by searchIntent', async () => {
    mockPromptFindMany.mockImplementation(() => Promise.resolve([]));

    await getPrompts('proj-1', { searchIntent: 'INFORMATIONAL' });

    expect(mockPromptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          searchIntent: 'INFORMATIONAL',
        }),
      })
    );
  });

  test('returns all prompts when no filters provided', async () => {
    mockPromptFindMany.mockImplementation(() => Promise.resolve([]));

    await getPrompts('proj-1');

    expect(mockPromptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'proj-1',
          isActive: true,
        }),
      })
    );
  });
});
