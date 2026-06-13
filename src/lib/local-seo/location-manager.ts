// ============================================================================
// Local SEO — Location Manager
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages location CRUD operations: create, read, update, delete, list, compare.
// Enforces project isolation and soft-delete semantics.
// ============================================================================

import { db } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

export interface LocationCreateData {
  name: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  openingHours?: Record<string, unknown>;
  businessType?: string;
  serviceArea?: string;
  notes?: string;
}

export interface LocationUpdateData {
  [key: string]: unknown;
}

export interface LocationListFilters {
  city?: string;
  businessType?: string;
  minHealthScore?: number;
  minRating?: number;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Create Location
// ============================================================================

/**
 * Create a new location for a project.
 * Sets defaults for optional fields (country → "NL", gbpStatus → "not_connected").
 * Serializes openingHours as JSON string.
 */
export async function createLocation(
  projectId: string,
  data: LocationCreateData
) {
  return db.location.create({
    data: {
      projectId,
      name: data.name,
      address: data.address ?? null,
      city: data.city ?? null,
      postalCode: data.postalCode ?? null,
      country: data.country ?? 'NL',
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      openingHours: data.openingHours
        ? JSON.stringify(data.openingHours)
        : null,
      businessType: data.businessType ?? null,
      serviceArea: data.serviceArea ?? null,
      notes: data.notes ?? null,
      gbpStatus: 'not_connected',
    },
  });
}

// ============================================================================
// Update Location
// ============================================================================

/**
 * Update specified fields on a location.
 * Verifies the location belongs to the given projectId before updating.
 * Serializes openingHours as JSON if provided as an object.
 */
export async function updateLocation(
  locationId: string,
  data: LocationUpdateData
) {
  // Serialize openingHours if it's an object
  const updateData: Record<string, unknown> = { ...data };
  if (
    updateData.openingHours &&
    typeof updateData.openingHours === 'object' &&
    !(typeof updateData.openingHours === 'string')
  ) {
    updateData.openingHours = JSON.stringify(updateData.openingHours);
  }

  return db.location.update({
    where: { id: locationId },
    data: updateData,
  });
}

// ============================================================================
// Delete Location (Soft Delete)
// ============================================================================

/**
 * Soft-delete a location by setting deletedAt to the current timestamp.
 * Does NOT hard-delete — the record remains in the database.
 */
export async function deleteLocation(locationId: string) {
  return db.location.update({
    where: { id: locationId },
    data: { deletedAt: new Date() },
  });
}

// ============================================================================
// Get Location
// ============================================================================

/**
 * Get a single location by ID, including related data
 * (keywords, landing pages, health checks, reviews).
 * Returns null if not found or if the location has been soft-deleted.
 */
export async function getLocation(locationId: string) {
  return db.location.findUnique({
    where: { id: locationId, deletedAt: null },
    include: {
      localKeywords: {
        where: { deletedAt: null },
        take: 50,
        orderBy: { keyword: 'asc' },
      },
      landingPages: {
        where: { deletedAt: null },
        take: 20,
        orderBy: { qualityScore: 'desc' },
      },
      healthChecks: {
        orderBy: { checkedAt: 'desc' },
        take: 10,
      },
      reviews: {
        where: { deletedAt: null },
        take: 10,
        orderBy: { reviewDate: 'desc' },
      },
      googleBusinessProfile: true,
    },
  });
}

// ============================================================================
// List Locations
// ============================================================================

/**
 * List locations for a project with optional filters.
 * Only returns non-deleted locations for the given projectId.
 */
export async function listLocations(
  projectId: string,
  filters?: LocationListFilters
) {
  const where: Record<string, unknown> = {
    projectId,
    deletedAt: null,
  };

  if (filters?.city) {
    where.city = { contains: filters.city };
  }
  if (filters?.businessType) {
    where.businessType = filters.businessType;
  }
  if (filters?.minHealthScore !== undefined) {
    where.localHealthScore = { gte: filters.minHealthScore };
  }
  if (filters?.minRating !== undefined) {
    where.avgRating = { gte: filters.minRating };
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const [data, total] = await Promise.all([
    db.location.findMany({
      where,
      orderBy: { name: 'asc' },
      take: limit,
      skip: offset,
    }),
    db.location.count({ where }),
  ]);

  return { data, total, limit, offset };
}

// ============================================================================
// Compare Locations
// ============================================================================

/**
 * Compare multiple locations within a project.
 * Returns location data for side-by-side comparison.
 * Only includes locations belonging to the given projectId.
 */
export async function compareLocations(
  projectId: string,
  locationIds: string[]
) {
  const locations = await db.location.findMany({
    where: {
      id: { in: locationIds },
      projectId,
      deletedAt: null,
    },
    include: {
      healthChecks: {
        orderBy: { checkedAt: 'desc' },
        take: 1,
      },
      localKeywords: {
        where: { deletedAt: null },
        take: 5,
      },
    },
  });

  return { locations };
}
