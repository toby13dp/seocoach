// ============================================================================
// Local SEO — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================

// Location Manager
export {
  createLocation,
  updateLocation,
  deleteLocation,
  getLocation,
  listLocations,
  compareLocations,
} from './location-manager';

export type {
  LocationCreateData,
  LocationUpdateData,
  LocationListFilters,
} from './location-manager';

// Health Checker
export {
  runLocationHealthChecks,
  saveHealthChecks,
  calculateOverallHealthScore,
  getLocationHealthChecks,
} from './health-checker';

export type { HealthCheckResult } from './health-checker';

// Landing Page Analyzer
export {
  analyzeLandingPageQuality,
  generateLocalStructuredData,
  saveLandingPageAnalysis,
} from './landing-page-analyzer';

export type {
  LandingPageQualityInput,
  QualityIssue,
  LandingPageQualityResult,
  StructuredDataInput,
  StructuredDataResult,
} from './landing-page-analyzer';

// Rank Import
export {
  parseRankCSV,
  importRankCSV,
} from './rank-import';

export type {
  RankImportResult,
  ParsedRankRow,
} from './rank-import';

// ============================================================================
// GBP Convenience Functions
// ============================================================================

import { db } from '@/lib/db';

/**
 * Get the Google Business Profile status for a location.
 */
export async function getGBPStatus(locationId: string) {
  return db.googleBusinessProfile.findUnique({
    where: { locationId },
  });
}

/**
 * Connect a Google Business Profile to a location.
 */
export async function connectGBP(
  projectId: string,
  locationId: string,
  data: {
    accountId: string;
    locationIdGBP: string;
    accessToken: string;
    refreshToken: string;
  }
) {
  // Update location gbpStatus
  await db.location.update({
    where: { id: locationId },
    data: { gbpStatus: 'connected' },
  });

  return db.googleBusinessProfile.create({
    data: {
      projectId,
      locationId,
      accountId: data.accountId,
      locationIdGBP: data.locationIdGBP,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      syncStatus: 'connected',
    },
  });
}

/**
 * Disconnect a Google Business Profile from a location.
 */
export async function disconnectGBP(locationId: string) {
  // Update location gbpStatus
  await db.location.update({
    where: { id: locationId },
    data: { gbpStatus: 'not_connected' },
  });

  // Delete the GBP record
  return db.googleBusinessProfile.delete({
    where: { locationId },
  });
}
