// ============================================================================
// Product Feeds — Feed Validator
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Validate feed items against feed-type-specific rules.
// All validation messages are in Dutch. Never auto-fix issues — only report.
// ============================================================================

import { FeedType, FeedValidationStatus, FeedIssueSeverity } from '@prisma/client';
import { db } from '@/lib/db';
import type {
  FeedItemData,
  ValidationIssue,
  ItemValidationResult,
  FeedValidationSummary,
} from './types';
import {
  FEED_REQUIRED_FIELDS,
  FEED_RECOMMENDED_FIELDS,
  FEED_TYPE_LABELS,
} from './types';
import { updateFeedStats } from './feed-manager';

// ============================================================================
// Promotional Text Patterns (Dutch)
// ============================================================================

/** Dutch promotional words that should not appear in product titles */
const PROMOTIONAL_WORDS = [
  'beste',
  'goedkoopste',
  'kwaliteit',
  'top',
  'nummer 1',
  '#1',
  'nr.1',
  'uitverkoop',
  'sale',
  'korting',
  'discount',
  'gratis',
  'free',
  'actie',
  'voordeel',
  'grootste',
  'snelste',
  'langste',
  'sterkste',
];

// ============================================================================
// Validate Single Feed Item
// ============================================================================

/**
 * Validate a single feed item against the rules for the given feed type.
 * Returns all issues found (errors, warnings, and info messages).
 *
 * @param item - The feed item data to validate
 * @param feedType - The type of feed (determines which rules apply)
 * @returns Validation result with status and all issues
 */
export function validateFeedItem(
  item: FeedItemData,
  feedType: FeedType
): ItemValidationResult {
  const issues: ValidationIssue[] = [];

  // Run all validation checks
  issues.push(...validateRequired(item, feedType));
  issues.push(...validateTitle(item));
  issues.push(...validateDescription(item, feedType));
  issues.push(...validateGTIN(item, feedType));
  issues.push(...validatePrice(item));
  issues.push(...validateImages(item, feedType));
  issues.push(...validateAvailability(item, feedType));
  issues.push(...validateCategory(item, feedType));
  issues.push(...validateLinks(item));

  // Determine overall status
  const hasErrors = issues.some((i) => i.severity === FeedIssueSeverity.ERROR);
  const hasWarnings = issues.some((i) => i.severity === FeedIssueSeverity.WARNING);

  let validationStatus: FeedValidationStatus;
  if (hasErrors) {
    validationStatus = FeedValidationStatus.INVALID;
  } else if (hasWarnings) {
    validationStatus = FeedValidationStatus.VALID_WITH_WARNINGS;
  } else {
    validationStatus = FeedValidationStatus.VALID;
  }

  return {
    validationStatus,
    issues,
  };
}

// ============================================================================
// Validate Batch of Items
// ============================================================================

/**
 * Validate a batch of feed items without saving results.
 * Useful for preview/validation before import.
 *
 * @param items - Array of feed item data to validate
 * @param feedType - The type of feed
 * @returns Array of validation results, one per item
 */
export function validateFeedItems(
  items: FeedItemData[],
  feedType: FeedType
): ItemValidationResult[] {
  return items.map((item) => validateFeedItem(item, feedType));
}

// ============================================================================
// Validate Entire Feed (from database)
// ============================================================================

/**
 * Validate all items in a feed and update the feed's statistics.
 * Reads items from the database, validates each one, saves the results,
 * and updates the feed's aggregated stats.
 *
 * @param feedId - The feed to validate
 * @param projectId - The project the feed must belong to (tenant isolation)
 * @returns Validation summary
 */
export async function validateFeed(
  feedId: string,
  projectId: string
): Promise<FeedValidationSummary> {
  // Verify ownership and get feed type
  const feed = await db.productFeed.findFirst({
    where: { id: feedId, projectId, deletedAt: null },
    select: { id: true, feedType: true },
  });

  if (!feed) {
    throw new Error('Feed niet gevonden of behoort niet tot dit project.');
  }

  // Mark feed as validating
  await db.productFeed.update({
    where: { id: feedId },
    data: { status: FeedValidationStatus.VALIDATING },
  });

  // Fetch all items for this feed
  const feedItems = await db.productFeedItem.findMany({
    where: { feedId },
    select: {
      id: true,
      title: true,
      description: true,
      gtin: true,
      mpn: true,
      sku: true,
      brand: true,
      category: true,
      productType: true,
      price: true,
      salePrice: true,
      currency: true,
      availability: true,
      link: true,
      imageLink: true,
    },
  });

  if (feedItems.length === 0) {
    await updateFeedStats(feedId, projectId, {
      totalProducts: 0,
      validProducts: 0,
      warningProducts: 0,
      invalidProducts: 0,
      status: FeedValidationStatus.VALID,
    });

    return {
      feedId,
      totalItems: 0,
      validItems: 0,
      warningItems: 0,
      invalidItems: 0,
      errorItems: 0,
      topIssues: [],
    };
  }

  // Validate each item
  const results: ItemValidationResult[] = feedItems.map((dbItem) => {
    const itemData: FeedItemData = {
      title: dbItem.title ?? undefined,
      description: dbItem.description ?? undefined,
      gtin: dbItem.gtin ?? undefined,
      mpn: dbItem.mpn ?? undefined,
      sku: dbItem.sku ?? undefined,
      brand: dbItem.brand ?? undefined,
      category: dbItem.category ?? undefined,
      productType: dbItem.productType ?? undefined,
      price: dbItem.price ?? undefined,
      salePrice: dbItem.salePrice ?? undefined,
      currency: dbItem.currency ?? undefined,
      availability: dbItem.availability ?? undefined,
      link: dbItem.link ?? undefined,
      imageLink: dbItem.imageLink ?? undefined,
    };

    const result = validateFeedItem(itemData, feed.feedType);
    result.itemId = dbItem.id;
    return result;
  });

  // Save validation results
  await saveValidationResults(feedId, projectId, results);

  // Compute aggregated stats
  let validItems = 0;
  let warningItems = 0;
  let invalidItems = 0;
  let errorItems = 0;

  for (const r of results) {
    switch (r.validationStatus) {
      case FeedValidationStatus.VALID:
        validItems++;
        break;
      case FeedValidationStatus.VALID_WITH_WARNINGS:
        warningItems++;
        break;
      case FeedValidationStatus.INVALID:
        invalidItems++;
        break;
      default:
        errorItems++;
        break;
    }
  }

  // Determine overall feed status
  let feedStatus: FeedValidationStatus;
  if (errorItems > 0) {
    feedStatus = FeedValidationStatus.ERROR;
  } else if (invalidItems > 0) {
    feedStatus = FeedValidationStatus.INVALID;
  } else if (warningItems > 0) {
    feedStatus = FeedValidationStatus.VALID_WITH_WARNINGS;
  } else {
    feedStatus = FeedValidationStatus.VALID;
  }

  await updateFeedStats(feedId, projectId, {
    totalProducts: feedItems.length,
    validProducts: validItems,
    warningProducts: warningItems,
    invalidProducts: invalidItems,
    status: feedStatus,
  });

  // Compute top issues
  const issueMap = new Map<string, { field: string; count: number; message: string }>();
  for (const r of results) {
    for (const issue of r.issues) {
      const key = `${issue.field}:${issue.ruleName}`;
      const existing = issueMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        issueMap.set(key, { field: issue.field, count: 1, message: issue.message });
      }
    }
  }

  const topIssues = Array.from(issueMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    feedId,
    totalItems: feedItems.length,
    validItems,
    warningItems,
    invalidItems,
    errorItems,
    topIssues,
  };
}

// ============================================================================
// Save Validation Results to Database
// ============================================================================

/**
 * Persist validation results to the database.
 * Updates each ProductFeedItem's validationStatus and issues JSON.
 *
 * @param feedId - The feed the items belong to
 * @param projectId - The project (for tenant isolation verification)
 * @param results - Validation results with itemId references
 */
export async function saveValidationResults(
  feedId: string,
  projectId: string,
  results: ItemValidationResult[]
): Promise<void> {
  // Verify ownership
  const feed = await db.productFeed.findFirst({
    where: { id: feedId, projectId, deletedAt: null },
    select: { id: true },
  });

  if (!feed) {
    throw new Error('Feed niet gevonden of behoort niet tot dit project.');
  }

  // Update each item in a transaction
  await db.$transaction(
    results
      .filter((r) => r.itemId)
      .map((r) =>
        db.productFeedItem.update({
          where: { id: r.itemId! },
          data: {
            validationStatus: r.validationStatus,
            issues: JSON.stringify(r.issues),
          },
        })
      )
  );
}

// ============================================================================
// Individual Validation Functions
// ============================================================================

/**
 * Validate that all required fields for the feed type are present.
 */
function validateRequired(
  item: FeedItemData,
  feedType: FeedType
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requiredFields = FEED_REQUIRED_FIELDS[feedType];

  for (const field of requiredFields) {
    const value = item[field as keyof FeedItemData];
    if (value === undefined || value === null || value === '') {
      issues.push({
        field,
        severity: FeedIssueSeverity.ERROR,
        ruleName: 'required',
        message: `${fieldLabel(field)} is verplicht voor ${FEED_TYPE_LABELS[feedType]}.`,
        value: undefined,
      });
    }
  }

  return issues;
}

/**
 * Validate the title field.
 */
function validateTitle(item: FeedItemData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const title = item.title;

  if (!title) {
    // Required check is handled by validateRequired
    return issues;
  }

  // Max length check
  if (title.length > 150) {
    issues.push({
      field: 'title',
      severity: FeedIssueSeverity.ERROR,
      ruleName: 'maxLength',
      message: `Titel is te lang (${title.length} tekens). Maximum is 150 tekens.`,
      value: title.substring(0, 50) + '…',
    });
  }

  // Min length check
  if (title.length < 10) {
    issues.push({
      field: 'title',
      severity: FeedIssueSeverity.WARNING,
      ruleName: 'minLength',
      message: `Titel is te kort (${title.length} tekens). Minimum is 10 tekens.`,
      value: title,
    });
  }

  // Promotional text check
  const titleLower = title.toLowerCase();
  const foundPromo = PROMOTIONAL_WORDS.filter((word) =>
    titleLower.includes(word.toLowerCase())
  );

  if (foundPromo.length > 0) {
    issues.push({
      field: 'title',
      severity: FeedIssueSeverity.WARNING,
      ruleName: 'promotionalText',
      message:
        'Titel bevat promotionele tekst. Gebruik objectieve beschrijvingen.',
      value: title,
    });
  }

  return issues;
}

/**
 * Validate the description field.
 */
function validateDescription(
  item: FeedItemData,
  feedType: FeedType
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const description = item.description;
  const recommended = FEED_RECOMMENDED_FIELDS[feedType];

  if (!description) {
    // Check if recommended
    if (recommended.includes('description')) {
      issues.push({
        field: 'description',
        severity: FeedIssueSeverity.INFO,
        ruleName: 'recommended',
        message:
          'Beschrijving wordt aanbevolen voor betere zichtbaarheid.',
      });
    }
    return issues;
  }

  // Too short
  if (description.length < 30) {
    issues.push({
      field: 'description',
      severity: FeedIssueSeverity.WARNING,
      ruleName: 'minLength',
      message:
        'Beschrijving is te kort. Voeg meer productdetails toe.',
      value: description,
    });
  }

  // Duplicate of title
  if (item.title && description.trim().toLowerCase() === item.title.trim().toLowerCase()) {
    issues.push({
      field: 'description',
      severity: FeedIssueSeverity.WARNING,
      ruleName: 'duplicateOfTitle',
      message:
        'Beschrijving is hetzelfde als de titel. Voeg unieke informatie toe.',
    });
  }

  return issues;
}

/**
 * Validate the GTIN (EAN/UPC/ISBN) field.
 */
function validateGTIN(item: FeedItemData, feedType: FeedType): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const gtin = item.gtin;

  if (!gtin) {
    // GTIN is required for MERCHANT feeds
    if (feedType === FeedType.MERCHANT) {
      issues.push({
        field: 'gtin',
        severity: FeedIssueSeverity.ERROR,
        ruleName: 'required',
        message: 'GTIN (EAN/UPC) is verplicht voor merchant feeds.',
      });
    } else {
      // Recommended for other types
      issues.push({
        field: 'gtin',
        severity: FeedIssueSeverity.INFO,
        ruleName: 'recommended',
        message:
          'GTIN wordt aanbevolen voor betere productherkenning.',
      });
    }
    return issues;
  }

  // Validate GTIN format: should be 8, 12, 13, or 14 digits
  const digitsOnly = gtin.replace(/[\s-]/g, '');
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(digitsOnly)) {
    issues.push({
      field: 'gtin',
      severity: FeedIssueSeverity.ERROR,
      ruleName: 'pattern',
      message:
        'GTIN-formaat is ongeldig. Verwacht 8, 12, 13 of 14 cijfers.',
      value: gtin,
    });
  }

  return issues;
}

/**
 * Validate the price fields.
 */
function validatePrice(item: FeedItemData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const price = item.price;
  const salePrice = item.salePrice;

  if (price === undefined || price === null) {
    // Required check handled by validateRequired
    return issues;
  }

  // Negative price
  if (price < 0) {
    issues.push({
      field: 'price',
      severity: FeedIssueSeverity.ERROR,
      ruleName: 'negative',
      message: 'Prijs kan niet negatief zijn.',
      value: String(price),
    });
  }

  // Zero price
  if (price === 0) {
    issues.push({
      field: 'price',
      severity: FeedIssueSeverity.WARNING,
      ruleName: 'zero',
      message: 'Prijs is nul. Controleer of dit correct is.',
      value: '0',
    });
  }

  // Sale price > regular price
  if (salePrice !== undefined && salePrice !== null && price > 0 && salePrice > price) {
    issues.push({
      field: 'salePrice',
      severity: FeedIssueSeverity.ERROR,
      ruleName: 'saleGreaterThanRegular',
      message:
        'Aanbiedingsprijs is hoger dan de reguliere prijs.',
      value: `Regulier: ${price}, Aanbieding: ${salePrice}`,
    });
  }

  return issues;
}

/**
 * Validate image fields.
 */
function validateImages(
  item: FeedItemData,
  feedType: FeedType
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const imageLink = item.imageLink;
  const requiredFields = FEED_REQUIRED_FIELDS[feedType];
  const recommendedFields = FEED_RECOMMENDED_FIELDS[feedType];

  if (!imageLink) {
    if (requiredFields.includes('imageLink')) {
      issues.push({
        field: 'imageLink',
        severity: FeedIssueSeverity.ERROR,
        ruleName: 'required',
        message: `Afbeelding is verplicht voor ${FEED_TYPE_LABELS[feedType]}.`,
      });
    } else if (recommendedFields.includes('imageLink')) {
      issues.push({
        field: 'imageLink',
        severity: FeedIssueSeverity.INFO,
        ruleName: 'recommended',
        message:
          'Afbeelding wordt aanbevolen voor betere klikfrequentie.',
      });
    }
  }

  return issues;
}

/**
 * Validate the availability field.
 */
function validateAvailability(
  item: FeedItemData,
  feedType: FeedType
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const availability = item.availability;
  const requiredFields = FEED_REQUIRED_FIELDS[feedType];

  if (!availability) {
    if (requiredFields.includes('availability')) {
      issues.push({
        field: 'availability',
        severity: FeedIssueSeverity.ERROR,
        ruleName: 'required',
        message: `Beschikbaarheid is verplicht voor ${FEED_TYPE_LABELS[feedType]}.`,
      });
    }
  }

  return issues;
}

/**
 * Validate the category field.
 */
function validateCategory(
  item: FeedItemData,
  feedType: FeedType
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const category = item.category;
  const recommendedFields = FEED_RECOMMENDED_FIELDS[feedType];

  if (!category && recommendedFields.includes('category')) {
    issues.push({
      field: 'category',
      severity: FeedIssueSeverity.INFO,
      ruleName: 'recommended',
      message: 'Categorisatie wordt aanbevolen voor betere vindbaarheid.',
    });
  }

  return issues;
}

/**
 * Validate the link (URL) field.
 */
function validateLinks(item: FeedItemData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const link = item.link;

  if (!link) {
    // Required check handled by validateRequired
    return issues;
  }

  // Validate URL format
  try {
    const url = new URL(link);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Invalid protocol');
    }
  } catch {
    issues.push({
      field: 'link',
      severity: FeedIssueSeverity.ERROR,
      ruleName: 'invalidUrl',
      message:
        'URL-formaat is ongeldig. Gebruik een volledige URL inclusief https://.',
      value: link,
    });
  }

  return issues;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get a Dutch label for a feed item field.
 * Used in validation messages.
 */
function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: 'Titel',
    description: 'Beschrijving',
    gtin: 'GTIN',
    mpn: 'MPN',
    sku: 'SKU',
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
  return labels[field] ?? field;
}
