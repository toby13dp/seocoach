// ============================================================================
// Local SEO — Core Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for the Local SEO module.
// All user-facing text is in Dutch.
// CRITICAL: Never fabricate data. Use "— —" for missing numeric values.
// ============================================================================

import type {
  LocalHealthCategory,
  LocalHealthStatus,
  LocalKeywordIntent,
} from '@prisma/client';

// ============================================================================
// NAP (Name, Address, Phone) Record
// ============================================================================

/** Standardised NAP record for a location */
export interface NAPRecord {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  email?: string;
  website?: string;
}

// ============================================================================
// Opening Hours
// ============================================================================

/** Opening hours for a single day */
export interface DayHours {
  open: string; // "09:00"
  close: string; // "18:00"
  isClosed: boolean;
}

/** Opening hours for a full week (Dutch day abbreviations) */
export interface OpeningHours {
  ma: DayHours;
  di: DayHours;
  wo: DayHours;
  do: DayHours;
  vr: DayHours;
  za: DayHours;
  zo: DayHours;
}

// ============================================================================
// Local Keywords
// ============================================================================

/** Local keyword with intent and ranking data */
export interface LocalKeywordData {
  keyword: string;
  intent: LocalKeywordIntent;
  searchVolume?: number;
  difficulty?: number;
  currentRank?: number;
  targetRank?: number;
  url?: string;
}

// ============================================================================
// Landing Page Quality
// ============================================================================

/** Quality analysis result for a local landing page */
export interface LandingPageQuality {
  url: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  wordCount: number;
  hasStructuredData: boolean;
  hasNAP: boolean;
  hasMap: boolean;
  hasOpeningHours: boolean;
  qualityScore: number; // 0-100
  issues: string[]; // Dutch issue descriptions
}

// ============================================================================
// Location Health Check
// ============================================================================

/** Result of a single location health check */
export interface LocationHealthResult {
  category: LocalHealthCategory;
  status: LocalHealthStatus;
  score: number;
  title: string; // Dutch
  description: string; // Dutch
  recommendation?: string; // Dutch
  evidence?: Record<string, unknown>;
}

// ============================================================================
// Location Comparison
// ============================================================================

/** Comparison data for multiple locations */
export interface LocationComparison {
  locationId: string;
  locationName: string;
  avgRating: number;
  reviewCount: number;
  napConsistency: number;
  localHealthScore: number;
  keywordCount: number;
  landingPageCount: number;
}

// ============================================================================
// Dutch Label Mappings
// ============================================================================

/** Dutch labels for each Local SEO health category */
export const LOCAL_HEALTH_CATEGORY_LABELS: Record<LocalHealthCategory, string> = {
  NAP_CONSISTENCY: 'NAP-consistentie',
  OPENING_HOURS: 'Openingstijden',
  LOCAL_STRUCTURED_DATA: 'Lokale gestructureerde gegevens',
  LANDING_PAGES: 'Bestemmingspagina\'s',
  LOCAL_KEYWORDS: 'Lokale zoekwoorden',
  REVIEWS: 'Beoordelingen',
  GOOGLE_BUSINESS_PROFILE: 'Google Bedrijfsprofiel',
  LOCAL_LINKS: 'Lokale links',
  PHOTOS: 'Foto\'s',
  SERVICE_AREAS: 'Servicegebieden',
};

/** Dutch labels for each health check status */
export const LOCAL_HEALTH_STATUS_LABELS: Record<LocalHealthStatus, string> = {
  PASSING: 'Goed',
  NEEDS_IMPROVEMENT: 'Verbetering nodig',
  FAILING: 'Onvoldoende',
  NOT_CHECKED: 'Niet gecontroleerd',
};

/** Dutch labels for each local keyword intent */
export const LOCAL_KEYWORD_INTENT_LABELS: Record<LocalKeywordIntent, string> = {
  NAVIGATIONAL: 'Navigatie',
  INFORMATIONAL: 'Informatief',
  TRANSACTIONAL: 'Transactioneel',
  COMMERCIAL: 'Commercieel',
  LOCAL: 'Lokaal',
};

// Re-export Prisma enums for convenience
export type { LocalHealthCategory, LocalHealthStatus, LocalKeywordIntent };
