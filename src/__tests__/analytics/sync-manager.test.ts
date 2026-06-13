/**
 * Sync Manager Tests
 * Tests for /src/lib/analytics/sync-manager.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockCreate = mock(() => Promise.resolve({ id: 'conn-1' }));
const mockFindFirst = mock(() => Promise.resolve(null));
const mockUpdate = mock(() => Promise.resolve({ id: 'conn-1' }));
const mockFindMany = mock(() => Promise.resolve([]));
const mockFindUnique = mock(() => Promise.resolve(null));
const mockAggregate = mock(() =>
  Promise.resolve({ _min: { date: null }, _max: { date: null } })
);

mock.module('@/lib/db', () => ({
  db: {
    dataConnection: {
      create: mockCreate,
      findFirst: mockFindFirst,
      update: mockUpdate,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
    },
    dailyMetric: {
      findUnique: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({ id: 'dm-1' })),
      update: mock(() => Promise.resolve({ id: 'dm-1' })),
      findMany: mock(() => Promise.resolve([])),
      aggregate: mockAggregate,
    },
    queryPerformance: {
      findUnique: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({ id: 'qp-1' })),
      update: mock(() => Promise.resolve({ id: 'qp-1' })),
      findMany: mock(() => Promise.resolve([])),
    },
  },
}));

import {
  createDataConnection,
  updateDataConnection,
  deleteDataConnection,
  testConnection,
  syncData,
  getSyncStatus,
} from '@/lib/analytics/sync-manager';

// ============================================================================
// Test: createDataConnection
// ============================================================================

describe('createDataConnection', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  test('creates a new data connection with valid data', async () => {
    const mockConnection = {
      id: 'conn-1',
      projectId: 'proj-1',
      name: 'GSC Export Januari',
      type: 'CSV_SEARCH_PERFORMANCE',
      status: 'PENDING',
      config: JSON.stringify({ fileName: 'gsc-jan.csv', autoSync: false }),
      syncIntervalMinutes: 1440,
    };

    mockCreate.mockImplementation(() => Promise.resolve(mockConnection));

    const result = await createDataConnection(
      'proj-1',
      'GSC Export Januari',
      'CSV_SEARCH_PERFORMANCE',
      { fileName: 'gsc-jan.csv', autoSync: false }
    );

    expect(result.id).toBe('conn-1');
    expect(result.name).toBe('GSC Export Januari');
    expect(result.type).toBe('CSV_SEARCH_PERFORMANCE');
    expect(result.status).toBe('PENDING');
  });

  test('throws error for empty name', async () => {
    await expect(
      createDataConnection('proj-1', '', 'CSV_SEARCH_PERFORMANCE', {})
    ).rejects.toThrow('Verbindingsnaam mag niet leeg zijn');
  });

  test('throws error for whitespace-only name', async () => {
    await expect(
      createDataConnection('proj-1', '   ', 'CSV_SEARCH_PERFORMANCE', {})
    ).rejects.toThrow('Verbindingsnaam mag niet leeg zijn');
  });

  test('throws error for name exceeding 200 characters', async () => {
    const longName = 'A'.repeat(201);
    await expect(
      createDataConnection('proj-1', longName, 'CSV_SEARCH_PERFORMANCE', {})
    ).rejects.toThrow('200 tekens');
  });
});

// ============================================================================
// Test: updateDataConnection
// ============================================================================

describe('updateDataConnection', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockUpdate.mockReset();
  });

  test('updates name with partial updates', async () => {
    const existing = {
      id: 'conn-1',
      name: 'Old Name',
      deletedAt: null,
    };

    mockFindFirst.mockImplementation(() => Promise.resolve(existing));
    mockUpdate.mockImplementation(() =>
      Promise.resolve({ ...existing, name: 'New Name' })
    );

    const result = await updateDataConnection('conn-1', { name: 'New Name' });
    expect(result.name).toBe('New Name');
  });

  test('throws error for empty updated name', async () => {
    const existing = {
      id: 'conn-1',
      name: 'Old Name',
      deletedAt: null,
    };

    mockFindFirst.mockImplementation(() => Promise.resolve(existing));

    await expect(
      updateDataConnection('conn-1', { name: '' })
    ).rejects.toThrow('Verbindingsnaam mag niet leeg zijn');
  });

  test('throws error when connection not found', async () => {
    mockFindFirst.mockImplementation(() => Promise.resolve(null));

    await expect(
      updateDataConnection('conn-999', { name: 'Test' })
    ).rejects.toThrow('Gegevensverbinding niet gevonden');
  });

  test('throws error for sync interval below 15 minutes', async () => {
    const existing = {
      id: 'conn-1',
      name: 'Test',
      deletedAt: null,
    };

    mockFindFirst.mockImplementation(() => Promise.resolve(existing));

    await expect(
      updateDataConnection('conn-1', { syncIntervalMinutes: 5 })
    ).rejects.toThrow('15 minuten');
  });
});

// ============================================================================
// Test: deleteDataConnection (soft delete)
// ============================================================================

describe('deleteDataConnection — soft delete', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockUpdate.mockReset();
  });

  test('soft-deletes a connection by setting deletedAt', async () => {
    const existing = {
      id: 'conn-1',
      name: 'Test Connection',
      deletedAt: null,
    };

    mockFindFirst.mockImplementation(() => Promise.resolve(existing));
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ ...existing, deletedAt: args.data.deletedAt })
    );

    await deleteDataConnection('conn-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });

  test('throws error when connection not found', async () => {
    mockFindFirst.mockImplementation(() => Promise.resolve(null));

    await expect(deleteDataConnection('conn-999')).rejects.toThrow(
      'Gegevensverbinding niet gevonden'
    );
  });

  test('throws error when connection already soft-deleted', async () => {
    // findFirst with deletedAt: null should return null for soft-deleted records
    // In the real DB, the WHERE clause filters these out
    mockFindFirst.mockImplementation(() => Promise.resolve(null));

    await expect(deleteDataConnection('conn-1')).rejects.toThrow(
      'Gegevensverbinding niet gevonden'
    );
  });
});

// ============================================================================
// Test: testConnection
// ============================================================================

describe('testConnection', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
  });

  test('returns success for CSV type with valid file', async () => {
    const connection = {
      id: 'conn-1',
      type: 'CSV_SEARCH_PERFORMANCE',
      config: JSON.stringify({ fileName: 'gsc-export.csv' }),
      deletedAt: null,
    };

    mockFindFirst.mockImplementation(() => Promise.resolve(connection));

    const result = await testConnection('conn-1');
    expect(result.success).toBe(true);
    expect(result.message).toContain('CSV-bestand');
  });

  test('returns failure for CSV type without fileName', async () => {
    const connection = {
      id: 'conn-1',
      type: 'CSV_SEARCH_PERFORMANCE',
      config: JSON.stringify({}),
      deletedAt: null,
    };

    mockFindFirst.mockImplementation(() => Promise.resolve(connection));

    const result = await testConnection('conn-1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('bestandsnaam');
  });

  test('returns failure when connection not found', async () => {
    mockFindFirst.mockImplementation(() => Promise.resolve(null));

    const result = await testConnection('conn-999');
    expect(result.success).toBe(false);
    expect(result.message).toContain('niet gevonden');
  });

  test('returns info message for Google Search Console type', async () => {
    const connection = {
      id: 'conn-1',
      type: 'GOOGLE_SEARCH_CONSOLE',
      config: JSON.stringify({ propertyId: 'prop-123' }),
      deletedAt: null,
    };

    mockFindFirst.mockImplementation(() => Promise.resolve(connection));

    const result = await testConnection('conn-1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('OAuth');
  });
});

// ============================================================================
// Test: syncData
// ============================================================================

describe('syncData', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  test('triggers import for CSV_SEARCH_PERFORMANCE type', async () => {
    const connection = {
      id: 'conn-1',
      projectId: 'proj-1',
      type: 'CSV_SEARCH_PERFORMANCE',
      syncIntervalMinutes: 1440,
      deletedAt: null,
    };

    mockFindFirst.mockImplementation(() => Promise.resolve(connection));
    mockFindUnique.mockImplementation(() => Promise.resolve({ syncIntervalMinutes: 1440 }));
    mockAggregate.mockImplementation(() =>
      Promise.resolve({ _min: { date: null }, _max: { date: null } })
    );
    mockUpdate.mockImplementation(() => Promise.resolve(connection));

    const csvContent = `date,clicks,impressions,ctr,position
2025-01-15,100,500,0.20,5.5`;

    const result = await syncData('conn-1', csvContent);
    expect(result.success).toBe(true);
    expect(result.message).toBeDefined();
  });

  test('returns failure when csvContent is missing for CSV type', async () => {
    const connection = {
      id: 'conn-1',
      projectId: 'proj-1',
      type: 'CSV_SEARCH_PERFORMANCE',
      deletedAt: null,
    };

    mockFindFirst.mockImplementation(() => Promise.resolve(connection));

    const result = await syncData('conn-1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('CSV-inhoud');
  });

  test('returns failure for unsupported Google connection types', async () => {
    const connection = {
      id: 'conn-1',
      projectId: 'proj-1',
      type: 'GOOGLE_SEARCH_CONSOLE',
      deletedAt: null,
    };

    mockFindFirst.mockImplementation(() => Promise.resolve(connection));
    mockUpdate.mockImplementation(() => Promise.resolve(connection));

    const result = await syncData('conn-1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('nog niet beschikbaar');
  });

  test('returns failure when connection not found', async () => {
    mockFindFirst.mockImplementation(() => Promise.resolve(null));

    const result = await syncData('conn-999');
    expect(result.success).toBe(false);
    expect(result.message).toContain('niet gevonden');
  });
});

// ============================================================================
// Test: getSyncStatus
// ============================================================================

describe('getSyncStatus', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  test('returns connection statuses for a project', async () => {
    const connections = [
      {
        id: 'conn-1',
        name: 'GSC Export',
        type: 'CSV_SEARCH_PERFORMANCE',
        status: 'CONNECTED',
        lastSyncAt: new Date(),
        lastSyncError: null,
        nextSyncAt: new Date(),
      },
      {
        id: 'conn-2',
        name: 'GA4 Export',
        type: 'CSV_ANALYTICS',
        status: 'PENDING',
        lastSyncAt: null,
        lastSyncError: null,
        nextSyncAt: null,
      },
    ];

    mockFindMany.mockImplementation(() => Promise.resolve(connections));

    const result = await getSyncStatus('proj-1');
    expect(result.length).toBe(2);
    expect(result[0].connectionId).toBe('conn-1');
    expect(result[0].status).toBe('CONNECTED');
    expect(result[1].connectionId).toBe('conn-2');
    expect(result[1].status).toBe('PENDING');
  });

  test('returns empty array when no connections exist', async () => {
    mockFindMany.mockImplementation(() => Promise.resolve([]));

    const result = await getSyncStatus('proj-1');
    expect(result).toEqual([]);
  });
});
