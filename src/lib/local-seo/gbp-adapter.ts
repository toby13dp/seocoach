// ============================================================================
// Local SEO — Google Business Profile Adapter
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Interface for Google Business Profile (GBP) integration.
// Now uses real Google OAuth tokens and API calls via the google lib.
// ============================================================================

import { db } from '@/lib/db';
import type { GoogleBusinessProfile } from '@prisma/client';
import { syncGBPDataToDb } from '@/lib/google/google-api';
import { getOAuthTokens } from '@/lib/google/oauth-client';
import { appLogger as logger } from '@/lib/observability/logger';

// ============================================================================
// Connect GBP (via DataConnection OAuth flow)
// ============================================================================

/**
 * Connect a Google Business Profile to a location.
 * Now links the GBP DataConnection's OAuth tokens to this location.
 * The actual OAuth flow is handled through the Integrations page.
 *
 * After connecting via OAuth, call this to associate the connection
 * with a specific location and set the account/location IDs.
 */
export async function connectGBP(
  locationId: string,
  projectId: string,
  data: {
    accountId: string;
    locationIdGBP: string;
    connectionId: string;
  }
): Promise<GoogleBusinessProfile> {
  // Verify tenant isolation
  const location = await db.location.findFirst({
    where: { id: locationId, projectId, deletedAt: null },
  });
  if (!location) {
    throw new Error('Locatie niet gevonden of geen toegang');
  }

  // Verify the data connection exists and has OAuth tokens
  const connection = await db.dataConnection.findFirst({
    where: { id: data.connectionId, projectId, type: 'GOOGLE_BUSINESS_PROFILE', deletedAt: null },
  });
  if (!connection) {
    throw new Error('Google Bedrijfsprofiel verbinding niet gevonden. Koppel eerst je Google-account via de koppelingen-pagina.');
  }

  const tokens = await getOAuthTokens(data.connectionId);
  if (!tokens) {
    throw new Error('Geen OAuth-tokens gevonden. Koppel je Google-account opnieuw via de koppelingen-pagina.');
  }

  // Update the DataConnection config with account/location info
  const existingConfig = connection.config ? JSON.parse(connection.config) : {};
  await db.dataConnection.update({
    where: { id: data.connectionId },
    data: {
      config: JSON.stringify({
        ...existingConfig,
        accountId: data.accountId,
        locationIdGBP: data.locationIdGBP,
      }),
    },
  });

  // Check if GBP already exists for this location
  const existing = await db.googleBusinessProfile.findUnique({
    where: { locationId },
  });

  if (existing) {
    // Update existing connection
    return db.googleBusinessProfile.update({
      where: { id: existing.id },
      data: {
        accountId: data.accountId,
        locationIdGBP: data.locationIdGBP,
        syncStatus: 'connected',
        syncError: null,
      },
    });
  }

  // Create new GBP connection
  return db.googleBusinessProfile.create({
    data: {
      projectId,
      locationId,
      accountId: data.accountId,
      locationIdGBP: data.locationIdGBP,
      syncStatus: 'connected',
    },
  });
}

// ============================================================================
// Disconnect GBP
// ============================================================================

/**
 * Disconnect a Google Business Profile from a location.
 * Clears tokens and resets sync status.
 * Verifies projectId for tenant isolation.
 */
export async function disconnectGBP(
  locationId: string,
  projectId: string
): Promise<GoogleBusinessProfile> {
  // Verify tenant isolation
  const location = await db.location.findFirst({
    where: { id: locationId, projectId, deletedAt: null },
  });
  if (!location) {
    throw new Error('Locatie niet gevonden of geen toegang');
  }

  const existing = await db.googleBusinessProfile.findUnique({
    where: { locationId },
  });
  if (!existing) {
    throw new Error('Geen Google Bedrijfsprofiel gevonden voor deze locatie');
  }

  return db.googleBusinessProfile.update({
    where: { id: existing.id },
    data: {
      accessToken: null,
      refreshToken: null,
      syncStatus: 'not_connected',
      syncError: null,
      lastSyncAt: null,
    },
  });
}

// ============================================================================
// Sync GBP Data (Real API)
// ============================================================================

/**
 * Sync GBP data from Google API.
 * Uses the DataConnection's OAuth tokens to call the Google Business Profile API.
 * Fetches profile info, reviews, and review stats.
 */
export async function syncGBPData(
  locationId: string,
  projectId: string
): Promise<{
  synced: boolean;
  reviewCount: number;
  avgRating: number;
  error?: string;
}> {
  // Verify tenant isolation
  const location = await db.location.findFirst({
    where: { id: locationId, projectId, deletedAt: null },
  });
  if (!location) {
    return {
      synced: false,
      reviewCount: 0,
      avgRating: 0,
      error: 'Locatie niet gevonden of geen toegang',
    };
  }

  const gbp = await db.googleBusinessProfile.findUnique({
    where: { locationId },
  });

  if (!gbp) {
    return {
      synced: false,
      reviewCount: 0,
      avgRating: 0,
      error:
        'Google Bedrijfsprofiel is niet gekoppeld. Koppel eerst een profiel voordat u kunt synchroniseren.',
    };
  }

  if (gbp.syncStatus === 'not_connected') {
    return {
      synced: false,
      reviewCount: 0,
      avgRating: 0,
      error:
        'Google Bedrijfsprofiel is niet verbonden. Koppel je Google-account via de koppelingen-pagina.',
    };
  }

  // Find the GBP data connection for this project
  const connection = await db.dataConnection.findFirst({
    where: {
      projectId,
      type: 'GOOGLE_BUSINESS_PROFILE',
      deletedAt: null,
    },
  });

  if (!connection) {
    return {
      synced: false,
      reviewCount: 0,
      avgRating: 0,
      error: 'Geen Google Bedrijfsprofiel verbinding gevonden. Koppel je Google-account via de koppelingen-pagina.',
    };
  }

  // Get config with account/location IDs
  const config = connection.config ? JSON.parse(connection.config) : {};
  const accountId = config.accountId ?? gbp.accountId;
  const locationName = config.locationIdGBP ?? gbp.locationIdGBP;

  if (!accountId || !locationName) {
    return {
      synced: false,
      reviewCount: 0,
      avgRating: 0,
      error: 'Geen GBP-account of locatie geconfigureerd. Selecteer een locatie via de koppelingen-pagina.',
    };
  }

  try {
    // Use the real Google API sync function
    const result = await syncGBPDataToDb(
      connection.id,
      locationId,
      projectId,
      accountId,
      locationName
    );

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Update GBP record with error
    await db.googleBusinessProfile.update({
      where: { id: gbp.id },
      data: {
        syncStatus: 'error',
        syncError: `Synchronisatie mislukt: ${message}`,
      },
    });

    logger.error('GBP sync failed', { locationId, projectId, error: message });

    return {
      synced: false,
      reviewCount: 0,
      avgRating: 0,
      error: `Synchronisatie mislukt: ${message}`,
    };
  }
}

// ============================================================================
// Get GBP Status
// ============================================================================

/**
 * Get the current Google Business Profile connection status.
 * Verifies projectId for tenant isolation.
 */
export async function getGBPStatus(
  locationId: string,
  projectId: string
): Promise<{
  connected: boolean;
  lastSyncAt: Date | null;
  syncStatus: string;
  businessName: string | null;
  avgRating: number | null;
  totalReviews: number;
  error: string | null;
}> {
  // Verify tenant isolation
  const location = await db.location.findFirst({
    where: { id: locationId, projectId, deletedAt: null },
  });
  if (!location) {
    return {
      connected: false,
      lastSyncAt: null,
      syncStatus: 'not_connected',
      businessName: null,
      avgRating: null,
      totalReviews: 0,
      error: 'Locatie niet gevonden of geen toegang',
    };
  }

  const gbp = await db.googleBusinessProfile.findUnique({
    where: { locationId },
  });

  if (!gbp) {
    return {
      connected: false,
      lastSyncAt: null,
      syncStatus: 'not_connected',
      businessName: null,
      avgRating: null,
      totalReviews: 0,
      error: null,
    };
  }

  // Check if there's an active OAuth connection
  const connection = await db.dataConnection.findFirst({
    where: {
      projectId,
      type: 'GOOGLE_BUSINESS_PROFILE',
      deletedAt: null,
    },
  });

  const hasOAuthTokens = connection ? !!(await getOAuthTokens(connection.id)) : false;
  const connected = (gbp.syncStatus === 'connected' || hasOAuthTokens);
  let error: string | null = null;

  if (gbp.syncStatus === 'error') {
    error = gbp.syncError ?? 'Er is een onbekende fout opgetreden bij de synchronisatie.';
  } else if (!connected) {
    error = 'Google Bedrijfsprofiel is niet verbonden. Koppel je Google-account via de koppelingen-pagina.';
  }

  return {
    connected,
    lastSyncAt: gbp.lastSyncAt,
    syncStatus: gbp.syncStatus,
    businessName: gbp.businessName,
    avgRating: gbp.avgRating,
    totalReviews: gbp.totalReviews,
    error,
  };
}
