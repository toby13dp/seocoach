// ============================================================================
// GEO Readiness — Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for GEO (Generative Engine Optimization) readiness analysis.
// All user-facing text is in Dutch.
// CRITICAL: GEO readiness is NOT measured external AI visibility.
// ============================================================================

import type { GeoCheckCategory, GeoCheckStatus } from '@prisma/client';

/**
 * All 15 GEO check categories with Dutch labels and descriptions.
 * Each category represents an aspect of content that AI engines
 * may use to generate answers.
 */
export const GEO_CHECK_CATEGORIES: Record<
  GeoCheckCategory,
  { label: string; description: string }
> = {
  DIRECT_ANSWERS: {
    label: 'Directe antwoorden',
    description:
      'Pagina\'s bevatten duidelijke antwoordparagrafen die AI-modellen direct kunnen citeren.',
  },
  DEFINITIONS: {
    label: 'Definities',
    description:
      'Pagina\'s bevatten definitie-achtige content met "is een"-formuleringen.',
  },
  ANSWER_BLOCKS: {
    label: 'Antwoordblokken',
    description:
      'Pagina\'s bevatten FAQ-stijl vraag-en-antwoord secties.',
  },
  ENTITY_CLARITY: {
    label: 'Entiteitsduidelijkheid',
    description:
      'Gestructureerde data met organisatie- of persoonsentiteiten is aanwezig.',
  },
  ORGANISATION_CLARITY: {
    label: 'Organisatieduidelijkheid',
    description:
      'Organization-schema en duidelijke bedrijfsinformatie zijn beschikbaar.',
  },
  AUTHOR_INFORMATION: {
    label: 'Auteursinformatie',
    description:
      'Auteur-markup en over-pagina\'s zijn aanwezig voor E-E-A-T signalen.',
  },
  SOURCE_TRANSPARENCY: {
    label: 'Brondtransparantie',
    description:
      'Pagina\'s bevatten citaten, bronvermeldingen en verwijzingen naar originele bronnen.',
  },
  DATES: {
    label: 'Publicatiedatums',
    description:
      'Pagina\'s tonen publicatie- en wijzigingsdatums voor actualiteitsignalen.',
  },
  STRUCTURED_DATA: {
    label: 'Gestructureerde data',
    description:
      'Valide gestructureerde data (JSON-LD) is aanwezig op de pagina\'s.',
  },
  FAQS: {
    label: 'FAQ-secties',
    description:
      'FAQ-pagina\'s of FAQ-secties met gestructureerde vragen en antwoorden.',
  },
  UNIQUE_INFORMATION: {
    label: 'Unieke informatie',
    description:
      'Content bevat unieke informatie die niet elders beschikbaar is.',
  },
  CITABLE_FACTS: {
    label: 'Citeerbare feiten',
    description:
      'Pagina\'s bevatten statistieken, datapunten en onderbouwde claims die AI kan citeren.',
  },
  CRAWLABILITY: {
    label: 'Crawlbaarheid',
    description:
      'robots.txt staat crawlen toe en er zijn geen blokkerende issues.',
  },
  INDEXABILITY: {
    label: 'Indexeerbaarheid',
    description:
      'Pagina\'s zijn indexeerbaar (geen noindex, geen canonicalisatie naar andere URL\'s).',
  },
  BRAND_CONSISTENCY: {
    label: 'Merkconsistentie',
    description:
      'De merknaam wordt consistent gebruikt over alle pagina\'s heen.',
  },
};

/**
 * Dutch labels mapping for each GEO check category.
 * Derived from GEO_CHECK_CATEGORIES for quick lookups.
 */
export const GEO_CATEGORY_LABELS: Record<GeoCheckCategory, string> =
  Object.fromEntries(
    Object.entries(GEO_CHECK_CATEGORIES).map(([key, val]) => [key, val.label])
  ) as Record<GeoCheckCategory, string>;

/**
 * Result of a single GEO check for a page.
 */
export interface GeoCheckResult {
  /** The category that was checked */
  category: GeoCheckCategory;
  /** The resulting status */
  status: GeoCheckStatus;
  /** Score for this check (0-100) */
  score: number;
  /** Dutch title for this check result */
  title: string;
  /** Dutch description of findings */
  description: string;
  /** Dutch recommendation for improvement (null if passing) */
  recommendation: string | null;
  /** JSON evidence data supporting the check result */
  evidence: Record<string, unknown> | null;
  /** Page ID if the check is page-specific */
  pageId?: string | null;
  /** URL if the check is page-specific */
  url?: string | null;
}

/**
 * Configuration for GEO readiness analysis.
 * Controls which checks to run and how they are weighted.
 */
export interface GeoReadinessConfig {
  /** Minimum word count for a page to be considered for answer checks */
  minWordCountForAnswers?: number;
  /** Minimum number of FAQ items to pass the FAQ check */
  minFaqItems?: number;
  /** Categories to skip (default: none) */
  skipCategories?: GeoCheckCategory[];
  /** Whether to re-check already passing checks (default: false) */
  recheckPassing?: boolean;
}

/** Default GEO readiness configuration */
export const DEFAULT_GEO_CONFIG: Required<GeoReadinessConfig> = {
  minWordCountForAnswers: 100,
  minFaqItems: 3,
  skipCategories: [],
  recheckPassing: false,
};

// Re-export Prisma enums for convenience
export type { GeoCheckCategory, GeoCheckStatus };
