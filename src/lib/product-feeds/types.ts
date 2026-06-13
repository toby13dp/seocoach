// ============================================================================
// Product Feeds — Core Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for feed management, parsing, validation, and import.
// All user-facing labels and messages are in Dutch.
// ============================================================================

import { FeedType, FeedValidationStatus, FeedIssueSeverity } from '@prisma/client';

// ============================================================================
// Feed Item Data (for import)
// ============================================================================

/**
 * Data representing a single product from an external feed.
 * Used as the intermediate format between parsing and database storage.
 */
export interface FeedItemData {
  title?: string;
  description?: string;
  gtin?: string;
  mpn?: string;
  sku?: string;
  brand?: string;
  category?: string;
  productType?: string;
  price?: number;
  salePrice?: number;
  currency?: string;
  availability?: string;
  link?: string;
  imageLink?: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * A single validation issue found on a feed item.
 * Messages are always in Dutch.
 */
export interface ValidationIssue {
  /** The field that has the issue, e.g. "title", "gtin", "price" */
  field: string;
  /** Severity level of the issue */
  severity: FeedIssueSeverity;
  /** Name of the validation rule that failed, e.g. "required", "maxLength", "pattern" */
  ruleName: string;
  /** Dutch message describing the issue */
  message: string;
  /** The problematic value (optional, for debugging) */
  value?: string;
}

/**
 * Validation result for a single feed item.
 */
export interface ItemValidationResult {
  /** Database ID of the feed item (if already saved) */
  itemId?: string;
  /** Overall validation status */
  validationStatus: FeedValidationStatus;
  /** All issues found for this item */
  issues: ValidationIssue[];
}

/**
 * Aggregated validation summary for an entire feed.
 * All messages are in Dutch.
 */
export interface FeedValidationSummary {
  /** Feed database ID */
  feedId: string;
  /** Total number of items in the feed */
  totalItems: number;
  /** Items with no issues */
  validItems: number;
  /** Items with only warnings */
  warningItems: number;
  /** Items with errors (invalid) */
  invalidItems: number;
  /** Items that could not be processed at all */
  errorItems: number;
  /** Most common issues across all items (Dutch messages) */
  topIssues: { field: string; count: number; message: string }[];
}

// ============================================================================
// Import Result
// ============================================================================

/**
 * Result of a feed import operation.
 * All messages are in Dutch.
 */
export interface FeedImportResult {
  /** Total items found in the source */
  totalItems: number;
  /** Items newly created */
  imported: number;
  /** Items updated (already existed) */
  updated: number;
  /** Dutch error messages for items that could not be imported */
  errors: string[];
}

// ============================================================================
// Product Match Result
// ============================================================================

/**
 * Result of matching feed items to existing products.
 */
export interface ProductMatchResult {
  /** Items matched to an existing Product record */
  matched: number;
  /** Items that could not be matched */
  unmatched: number;
  /** New Product records created for unmatched items */
  newProducts: number;
}

// ============================================================================
// Dutch Label Maps
// ============================================================================

/** Dutch labels for feed types */
export const FEED_TYPE_LABELS: Record<FeedType, string> = {
  MERCHANT: 'Merchant feed',
  META_CATALOGUE: 'Meta-catalogus',
  COMPARISON: 'Vergelijkingsfeed',
  MARKETPLACE: 'Marketplace',
  AFFILIATE: 'Affiliate feed',
};

/** Dutch labels for feed validation statuses */
export const FEED_VALIDATION_STATUS_LABELS: Record<FeedValidationStatus, string> = {
  PENDING: 'In afwachting',
  VALIDATING: 'Valideren',
  VALID: 'Geldig',
  VALID_WITH_WARNINGS: 'Geldig met waarschuwingen',
  INVALID: 'Ongeldig',
  ERROR: 'Fout',
};

/** Dutch labels for feed issue severity levels */
export const FEED_ISSUE_SEVERITY_LABELS: Record<FeedIssueSeverity, string> = {
  ERROR: 'Fout',
  WARNING: 'Waarschuwing',
  INFO: 'Informatie',
};

// ============================================================================
// Required & Recommended Fields Per Feed Type
// ============================================================================

/** Fields that are required for each feed type */
export const FEED_REQUIRED_FIELDS: Record<FeedType, string[]> = {
  MERCHANT: ['title', 'link', 'price', 'availability'],
  META_CATALOGUE: ['title', 'link', 'price', 'imageLink'],
  COMPARISON: ['title', 'price', 'link'],
  MARKETPLACE: ['title', 'price', 'availability', 'link'],
  AFFILIATE: ['title', 'link', 'price'],
};

/** Fields that are recommended (but not required) for each feed type */
export const FEED_RECOMMENDED_FIELDS: Record<FeedType, string[]> = {
  MERCHANT: ['description', 'gtin', 'brand', 'imageLink', 'productType'],
  META_CATALOGUE: ['description', 'gtin', 'brand', 'availability'],
  COMPARISON: ['description', 'gtin', 'brand', 'imageLink'],
  MARKETPLACE: ['description', 'gtin', 'brand', 'imageLink', 'productType'],
  AFFILIATE: ['description', 'gtin', 'brand', 'imageLink'],
};

// ============================================================================
// Dutch Field Labels
// ============================================================================

/** Dutch labels for feed item fields (for display in UI) */
export const FEED_FIELD_LABELS: Record<string, string> = {
  title: 'Titel',
  description: 'Beschrijving',
  gtin: 'GTIN (EAN/UPC)',
  mpn: 'MPN',
  sku: 'SKU / Artikelnummer',
  brand: 'Merk',
  category: 'Categorie',
  productType: 'Producttype',
  price: 'Prijs',
  salePrice: 'Aanbiedingsprijs',
  currency: 'Valuta',
  availability: 'Beschikbaarheid',
  link: 'Product-URL',
  imageLink: 'Afbeelding',
};
