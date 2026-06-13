// ============================================================================
// Competitor Intelligence — Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for competitor tracking, crawling, and change detection.
// All user-facing text is in Dutch.
// CRITICAL: Do NOT invent traffic or revenue data for competitors.
// ============================================================================

import type { CompetitorChangeType } from '@prisma/client';

/**
 * Dutch labels for all 12 competitor change types.
 * Used in the feed and change detection UI.
 */
export const CHANGE_TYPE_LABELS: Record<CompetitorChangeType, string> = {
  NEW_PAGE: 'Nieuwe pagina',
  TITLE_CHANGE: 'Titelwijziging',
  HEADING_CHANGE: 'Kopwijziging',
  TOPIC_CHANGE: 'Onderwerpwijziging',
  SERVICE_CHANGE: 'Dienstwijziging',
  CATEGORY_CHANGE: 'Categoriewijziging',
  LOCATION_CHANGE: 'Locatiewijziging',
  STRUCTURED_DATA_CHANGE: 'Gestructureerde data wijziging',
  INTERNAL_LINK_CHANGE: 'Interne link wijziging',
  PRICE_CHANGE: 'Prijswijziging',
  PUBLISHING_FREQUENCY_CHANGE: 'Publicatiefrequentie wijziging',
  POSITIONING_CHANGE: 'Positioneringswijziging',
};

/**
 * Dutch descriptions for change types with guidance on potential impact.
 */
export const CHANGE_TYPE_DESCRIPTIONS: Record<CompetitorChangeType, string> = {
  NEW_PAGE:
    'De concurrent heeft een nieuwe pagina gepubliceerd. Dit kan een nieuwe dienst, blogpost of landingspagina zijn.',
  TITLE_CHANGE:
    'De concurrent heeft de paginatitel gewijzigd. Dit kan wijzen op een nieuwe SEO-strategie of herpositionering.',
  HEADING_CHANGE:
    'De concurrent heeft koppen (H1/H2/H3) gewijzigd. Dit beïnvloedt de contentstructuur en relevantie.',
  TOPIC_CHANGE:
    'De concurrent behandelt nieuwe of andere onderwerpen. Dit kan nieuwe kansen of bedreigingen opleveren.',
  SERVICE_CHANGE:
    'De concurrent heeft diensten toegevoegd of gewijzigd. Controleer of dit overlapt met uw aanbod.',
  CATEGORY_CHANGE:
    'De concurrent heeft categorieën gewijzigd. Dit beïnvloedt de sitestructuur en navigatie.',
  LOCATION_CHANGE:
    'De concurrent heeft locatie-informatie gewijzigd. Dit is relevant voor lokale SEO.',
  STRUCTURED_DATA_CHANGE:
    'De concurrent heeft gestructureerde data gewijzigd. Dit beïnvloedt rich results en AI-interpreteerbaarheid.',
  INTERNAL_LINK_CHANGE:
    'De concurrent heeft interne links gewijzigd. Dit beïnvloedt de link-structuur en paginawicht.',
  PRICE_CHANGE:
    'De concurrent heeft prijzen gewijzigd. Dit is relevant voor uw positionering en concurrentiekracht.',
  PUBLISHING_FREQUENCY_CHANGE:
    'De concurrent publiceert vaker of minder vaak. Dit beïnvloedt de contentversheid en zichtbaarheid.',
  POSITIONING_CHANGE:
    'De concurrent heeft zijn positionering gewijzigd. Dit kan uw strategie beïnvloeden.',
};

/**
 * Filters for querying competitors.
 */
export interface CompetitorFilters {
  /** Only include active competitors */
  isActive?: boolean;
  /** Filter by website URL domain */
  domain?: string;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Filters for the competitor change feed.
 */
export interface CompetitorFeedFilters {
  /** Filter by competitor ID */
  competitorId?: string;
  /** Filter by change type */
  changeType?: CompetitorChangeType;
  /** Only show non-dismissed changes */
  showDismissed?: boolean;
  /** Filter changes since this date */
  since?: Date;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

// Re-export Prisma enum for convenience
export type { CompetitorChangeType };
