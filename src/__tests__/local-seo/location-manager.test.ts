/**
 * Location Manager Tests
 * Tests for /src/lib/local-seo/location-manager.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockLocationFindMany = mock(() => Promise.resolve([]));
const mockLocationFindUnique = mock(() => Promise.resolve(null));
const mockLocationCreate = mock(() => Promise.resolve({ id: 'loc-1' }));
const mockLocationUpdate = mock(() => Promise.resolve({ id: 'loc-1' }));
const mockLocationCount = mock(() => Promise.resolve(0));

const mockKeywordFindMany = mock(() => Promise.resolve([]));
const mockLandingPageFindMany = mock(() => Promise.resolve([]));
const mockHealthCheckFindMany = mock(() => Promise.resolve([]));
const mockReviewFindMany = mock(() => Promise.resolve([]));
const mockGBPFindUnique = mock(() => Promise.resolve(null));

mock.module('@/lib/db', () => ({
  db: {
    location: {
      findMany: mockLocationFindMany,
      findUnique: mockLocationFindUnique,
      create: mockLocationCreate,
      update: mockLocationUpdate,
      count: mockLocationCount,
    },
    localKeyword: {
      findMany: mockKeywordFindMany,
    },
    localLandingPage: {
      findMany: mockLandingPageFindMany,
    },
    locationHealthCheck: {
      findMany: mockHealthCheckFindMany,
    },
    review: {
      findMany: mockReviewFindMany,
    },
    googleBusinessProfile: {
      findUnique: mockGBPFindUnique,
    },
  },
}));

// Import AFTER mock.module
import {
  createLocation,
  updateLocation,
  deleteLocation,
  getLocation,
  listLocations,
  compareLocations,
} from '@/lib/local-seo';

// ============================================================================
// Test: createLocation
// ============================================================================

describe('createLocation', () => {
  beforeEach(() => {
    mockLocationCreate.mockReset();
  });

  test('creates a location with required fields and sets projectId', async () => {
    mockLocationCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'loc-1', ...args.data })
    );

    const result = await createLocation('proj-1', {
      name: 'Amsterdam Centraal',
    });

    expect(mockLocationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          name: 'Amsterdam Centraal',
        }),
      })
    );
  });

  test('sets defaults for optional fields (country=NL, gbpStatus=not_connected)', async () => {
    mockLocationCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'loc-2', ...args.data })
    );

    await createLocation('proj-1', { name: 'Test Locatie' });

    expect(mockLocationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          country: 'NL',
          gbpStatus: 'not_connected',
        }),
      })
    );
  });

  test('serializes openingHours as JSON string when provided as object', async () => {
    mockLocationCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'loc-3', ...args.data })
    );

    const hours = { mon: { open: '09:00', close: '18:00' } };
    await createLocation('proj-1', {
      name: 'Test Locatie',
      openingHours: hours,
    });

    expect(mockLocationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          openingHours: JSON.stringify(hours),
        }),
      })
    );
  });

  test('passes all provided fields to create', async () => {
    mockLocationCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'loc-4', ...args.data })
    );

    await createLocation('proj-1', {
      name: 'Kantoor Rotterdam',
      address: 'Coolsingel 1',
      city: 'Rotterdam',
      postalCode: '3011AA',
      phone: '+31 10 1234567',
      email: 'info@example.nl',
      website: 'https://example.nl',
      latitude: 51.9244,
      longitude: 4.4777,
      businessType: 'dentist',
      serviceArea: '["Rotterdam", "Schiedam"]',
      notes: 'Hoofdkantoor',
    });

    expect(mockLocationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          address: 'Coolsingel 1',
          city: 'Rotterdam',
          postalCode: '3011AA',
          phone: '+31 10 1234567',
          email: 'info@example.nl',
          website: 'https://example.nl',
          latitude: 51.9244,
          longitude: 4.4777,
          businessType: 'dentist',
          serviceArea: '["Rotterdam", "Schiedam"]',
          notes: 'Hoofdkantoor',
        }),
      })
    );
  });

  test('sets openingHours to null when not provided', async () => {
    mockLocationCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'loc-5', ...args.data })
    );

    await createLocation('proj-1', { name: 'No Hours' });

    expect(mockLocationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          openingHours: null,
        }),
      })
    );
  });
});

// ============================================================================
// Test: updateLocation
// ============================================================================

describe('updateLocation', () => {
  beforeEach(() => {
    mockLocationUpdate.mockReset();
  });

  test('updates specified fields on a location', async () => {
    mockLocationUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'loc-1', ...args.data })
    );

    await updateLocation('loc-1', { name: 'Updated Name', city: 'Utrecht' });

    expect(mockLocationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'loc-1' },
        data: expect.objectContaining({
          name: 'Updated Name',
          city: 'Utrecht',
        }),
      })
    );
  });

  test('serializes openingHours as JSON when provided as object', async () => {
    mockLocationUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'loc-1', ...args.data })
    );

    const hours = { mon: { open: '08:00', close: '17:00' } };
    await updateLocation('loc-1', { openingHours: hours });

    expect(mockLocationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          openingHours: JSON.stringify(hours),
        }),
      })
    );
  });

  test('keeps openingHours as-is when it is already a string', async () => {
    mockLocationUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'loc-1', ...args.data })
    );

    const hoursStr = '{"mon":{"open":"09:00","close":"18:00"}}';
    await updateLocation('loc-1', { openingHours: hoursStr });

    expect(mockLocationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          openingHours: hoursStr,
        }),
      })
    );
  });

  test('updates gbpStatus field', async () => {
    mockLocationUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'loc-1', ...args.data })
    );

    await updateLocation('loc-1', { gbpStatus: 'connected' });

    expect(mockLocationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gbpStatus: 'connected',
        }),
      })
    );
  });
});

// ============================================================================
// Test: deleteLocation (soft delete)
// ============================================================================

describe('deleteLocation', () => {
  beforeEach(() => {
    mockLocationUpdate.mockReset();
  });

  test('soft deletes by setting deletedAt timestamp', async () => {
    mockLocationUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'loc-1', ...args.data })
    );

    await deleteLocation('loc-1');

    expect(mockLocationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'loc-1' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      })
    );
  });

  test('does not hard delete — uses update, not delete', async () => {
    mockLocationUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'loc-1', ...args.data })
    );

    await deleteLocation('loc-1');

    // Should call update, not any delete method
    expect(mockLocationUpdate).toHaveBeenCalledTimes(1);
    expect(mockLocationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'loc-1' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      })
    );
  });

  test('sets deletedAt to current time (not a fixed date)', async () => {
    const before = new Date();
    mockLocationUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'loc-1', ...args.data })
    );

    await deleteLocation('loc-1');

    const callArgs = mockLocationUpdate.mock.calls[0][0] as any;
    const deletedAt = callArgs.data.deletedAt as Date;
    const after = new Date();

    expect(deletedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(deletedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

// ============================================================================
// Test: getLocation
// ============================================================================

describe('getLocation', () => {
  beforeEach(() => {
    mockLocationFindUnique.mockReset();
    mockKeywordFindMany.mockReset();
    mockLandingPageFindMany.mockReset();
    mockHealthCheckFindMany.mockReset();
    mockReviewFindMany.mockReset();
    mockGBPFindUnique.mockReset();
  });

  test('returns location with related data when found', async () => {
    const mockLocation = {
      id: 'loc-1',
      name: 'Amsterdam',
      projectId: 'proj-1',
      localKeywords: [],
      landingPages: [],
      healthChecks: [],
      reviews: [],
      googleBusinessProfile: null,
    };
    mockLocationFindUnique.mockImplementation(() => Promise.resolve(mockLocation));

    const result = await getLocation('loc-1');

    expect(result).toEqual(mockLocation);
    expect(mockLocationFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'loc-1', deletedAt: null },
        include: expect.objectContaining({
          localKeywords: expect.any(Object),
          landingPages: expect.any(Object),
          healthChecks: expect.any(Object),
          reviews: expect.any(Object),
          googleBusinessProfile: true,
        }),
      })
    );
  });

  test('returns null when location not found', async () => {
    mockLocationFindUnique.mockImplementation(() => Promise.resolve(null));

    const result = await getLocation('nonexistent');

    expect(result).toBeNull();
  });

  test('returns null for soft-deleted locations (deletedAt filter)', async () => {
    mockLocationFindUnique.mockImplementation(() => Promise.resolve(null));

    const result = await getLocation('deleted-loc');

    expect(result).toBeNull();
    expect(mockLocationFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    );
  });
});

// ============================================================================
// Test: listLocations
// ============================================================================

describe('listLocations', () => {
  beforeEach(() => {
    mockLocationFindMany.mockReset();
    mockLocationCount.mockReset();
  });

  test('lists locations filtered by projectId', async () => {
    mockLocationFindMany.mockImplementation(() => Promise.resolve([]));
    mockLocationCount.mockImplementation(() => Promise.resolve(0));

    await listLocations('proj-1');

    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'proj-1',
          deletedAt: null,
        }),
      })
    );
  });

  test('filters by city (contains)', async () => {
    mockLocationFindMany.mockImplementation(() => Promise.resolve([]));
    mockLocationCount.mockImplementation(() => Promise.resolve(0));

    await listLocations('proj-1', { city: 'Amsterdam' });

    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          city: { contains: 'Amsterdam' },
        }),
      })
    );
  });

  test('filters by businessType', async () => {
    mockLocationFindMany.mockImplementation(() => Promise.resolve([]));
    mockLocationCount.mockImplementation(() => Promise.resolve(0));

    await listLocations('proj-1', { businessType: 'dentist' });

    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessType: 'dentist',
        }),
      })
    );
  });

  test('filters by minHealthScore', async () => {
    mockLocationFindMany.mockImplementation(() => Promise.resolve([]));
    mockLocationCount.mockImplementation(() => Promise.resolve(0));

    await listLocations('proj-1', { minHealthScore: 50 });

    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          localHealthScore: { gte: 50 },
        }),
      })
    );
  });

  test('filters by minRating', async () => {
    mockLocationFindMany.mockImplementation(() => Promise.resolve([]));
    mockLocationCount.mockImplementation(() => Promise.resolve(0));

    await listLocations('proj-1', { minRating: 4.0 });

    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          avgRating: { gte: 4.0 },
        }),
      })
    );
  });

  test('excludes soft-deleted locations', async () => {
    mockLocationFindMany.mockImplementation(() => Promise.resolve([]));
    mockLocationCount.mockImplementation(() => Promise.resolve(0));

    await listLocations('proj-1');

    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      })
    );
  });

  test('returns paginated results with total count', async () => {
    const mockLocations = [
      { id: 'loc-1', name: 'Amsterdam' },
      { id: 'loc-2', name: 'Rotterdam' },
    ];
    mockLocationFindMany.mockImplementation(() => Promise.resolve(mockLocations));
    mockLocationCount.mockImplementation(() => Promise.resolve(25));

    const result = await listLocations('proj-1', { limit: 10, offset: 0 });

    expect(result.data).toEqual(mockLocations);
    expect(result.total).toBe(25);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
  });

  test('defaults limit=50 and offset=0 when not specified', async () => {
    mockLocationFindMany.mockImplementation(() => Promise.resolve([]));
    mockLocationCount.mockImplementation(() => Promise.resolve(0));

    const result = await listLocations('proj-1');

    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });
});

// ============================================================================
// Test: compareLocations
// ============================================================================

describe('compareLocations', () => {
  beforeEach(() => {
    mockLocationFindMany.mockReset();
  });

  test('returns comparison data for multiple locations in the same project', async () => {
    const mockLocations = [
      { id: 'loc-1', name: 'Amsterdam', projectId: 'proj-1', healthChecks: [], localKeywords: [] },
      { id: 'loc-2', name: 'Rotterdam', projectId: 'proj-1', healthChecks: [], localKeywords: [] },
    ];
    mockLocationFindMany.mockImplementation(() => Promise.resolve(mockLocations));

    const result = await compareLocations('proj-1', ['loc-1', 'loc-2']);

    expect(result.locations).toEqual(mockLocations);
    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['loc-1', 'loc-2'] },
          projectId: 'proj-1',
          deletedAt: null,
        }),
      })
    );
  });

  test('enforces projectId isolation — only returns locations for the given project', async () => {
    mockLocationFindMany.mockImplementation(() => Promise.resolve([]));

    await compareLocations('proj-1', ['loc-other-project']);

    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'proj-1',
        }),
      })
    );
  });

  test('excludes soft-deleted locations from comparison', async () => {
    mockLocationFindMany.mockImplementation(() => Promise.resolve([]));

    await compareLocations('proj-1', ['loc-1']);

    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      })
    );
  });

  test('includes health checks and keywords in comparison data', async () => {
    mockLocationFindMany.mockImplementation(() => Promise.resolve([]));

    await compareLocations('proj-1', ['loc-1']);

    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          healthChecks: expect.any(Object),
          localKeywords: expect.any(Object),
        }),
      })
    );
  });

  test('returns empty locations array when no matching IDs found', async () => {
    mockLocationFindMany.mockImplementation(() => Promise.resolve([]));

    const result = await compareLocations('proj-1', ['nonexistent']);

    expect(result.locations).toEqual([]);
  });
});
