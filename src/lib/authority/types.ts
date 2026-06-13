// ============================================================================
// Authority — Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for authority record management (backlinks, brand mentions, etc.)
// and outreach campaign tracking.
// All user-facing text is in Dutch.
// ============================================================================

import type { AuthorityRecordType } from '@prisma/client';

/**
 * Dutch labels for authority record types.
 */
export const AUTHORITY_TYPE_LABELS: Record<AuthorityRecordType, string> = {
  BACKLINK: 'Backlink',
  LOST_LINK: 'Verloren link',
  NEW_LINK: 'Nieuwe link',
  BRAND_MENTION: 'Merkvermelding',
  LINK_GAP: 'Link-kloof',
  OUTREACH_OPPORTUNITY: 'Outreach-mogelijkheid',
  CAMPAIGN: 'Campagne',
};

/**
 * Dutch descriptions for authority record types.
 */
export const AUTHORITY_TYPE_DESCRIPTIONS: Record<AuthorityRecordType, string> = {
  BACKLINK: 'Een inkomende link van een externe website naar uw site.',
  LOST_LINK: 'Een backlink die niet meer actief is.',
  NEW_LINK: 'Een recent ontdekte backlink.',
  BRAND_MENTION: 'Een vermelding van uw merknaam zonder link.',
  LINK_GAP: 'Een website die naar concurrenten linkt maar niet naar u.',
  OUTREACH_OPPORTUNITY: 'Een potentiële linkbuilding-mogelijkheid.',
  CAMPAIGN: 'Een outreach-campagne.',
};

/**
 * Filters for querying authority records.
 */
export interface AuthorityRecordFilters {
  type?: AuthorityRecordType;
  status?: string;
  domain?: string;
  campaignId?: string;
  discoveredAfter?: Date;
  discoveredBefore?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Result of an authority CSV import.
 */
export interface AuthorityImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  batchId: string;
}

/**
 * Column mapping for authority CSV import.
 * Supports common Ahrefs, Moz, and other SEO tool export formats.
 */
export const AUTHORITY_CSV_COLUMNS: Record<string, string[]> = {
  sourceUrl: ['source url', 'from url', 'referring page', 'bron url', 'verwijzende pagina', 'source', 'referring_url', 'page'],
  targetUrl: ['target url', 'to url', 'destination url', 'doel url', 'bestemmingsurl', 'target', 'destination', 'link_to'],
  anchorText: ['anchor', 'anchor text', 'anchortext', 'ankertekst', 'link text', 'linktekst'],
  domain: ['domain', 'referring domain', 'verwijzend domein', 'domein', 'root domain'],
  domainAuthority: ['domain authority', 'da', 'domain_rating', 'dr', 'domeinautoriteit', 'domain_rating', 'ur'],
  pageAuthority: ['page authority', 'pa', 'url rating', 'ur', 'pagina-autoriteit', 'page_rating'],
  isNofollow: ['nofollow', 'is nofollow', 'link type', 'linktype'],
  discoveredAt: ['first seen', 'first indexed', 'first_detected', 'eerst gezien', 'ontdekt', 'discovered', 'date', 'datum'],
  lostAt: ['last seen', 'lost date', 'lost_date', 'laatst gezien', 'verloren op', 'last_check'],
  status: ['status', 'link status', 'link_status', 'linkstaat'],
  notes: ['notes', 'opmerkingen', 'comments', 'context', 'notes'],
};

/**
 * Summary of authority records for a project.
 */
export interface AuthoritySummary {
  /** Total records */
  total: number;
  /** Count by type */
  byType: Record<string, number>;
  /** Count by status */
  byStatus: Record<string, number>;
  /** New links in the last 30 days */
  newLinks30Days: number;
  /** Lost links in the last 30 days */
  lostLinks30Days: number;
  /** Top 10 referring domains by count */
  topDomains: Array<{ domain: string; count: number }>;
}

// Re-export Prisma enum
export type { AuthorityRecordType };
