// ============================================================================
// Product Feeds — Feed Importer
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Import feed data from raw content (XML/CSV/TSV) or URL, persist items to
// the database, match them to existing Products, and compute validation
// summaries. All functions verify projectId for tenant isolation.
// All user-facing messages are in Dutch.
// ============================================================================

import { FeedValidationStatus } from '@prisma/client';
import { db } from '@/lib/db';
import type {
  FeedItemData,
  FeedImportResult,
  FeedValidationSummary,
  ItemValidationResult,
  ProductMatchResult,
} from './types';
import { parseFeed } from './feed-parser';
import {
  validateFeedItem,
  validateFeedItems,
  saveValidationResults,
} from './feed-validator';
import { updateFeedStats } from './feed-manager';

// ============================================================================
// Import Feed from Raw Content
// ============================================================================

/**
 * Import a feed from raw content (XML, CSV, or TSV).
 *
 * Steps:
 * 1. Parse the content into FeedItemData[]
 * 2. Validate each item
 * 3. Persist items to the database (create or update by dedup key)
 * 4. Update feed statistics
 *
 * Deduplication: Match existing feed items by GTIN, then SKU, then link.
 *
 * @param projectId - The project the feed belongs to (tenant isolation)
 * @param feedId - The feed to import into
 * @param content - Raw feed content
 * @param format - Optional format override ('xml' | 'csv' | 'tsv')
 * @returns Import result with counts and any errors
 */
export async function importFeed(
  projectId: string,
  feedId: string,
  content: string,
  format?: 'xml' | 'csv' | 'tsv'
): Promise<FeedImportResult> {
  // Verify feed ownership
  const feed = await db.productFeed.findFirst({
    where: { id: feedId, projectId, deletedAt: null },
    select: { id: true, feedType: true },
  });

  if (!feed) {
    return {
      totalItems: 0,
      imported: 0,
      updated: 0,
      errors: ['Feed niet gevonden of behoort niet tot dit project.'],
    };
  }

  // Parse
  let items: FeedItemData[];
  try {
    items = parseFeed(content, format);
  } catch (err) {
    return {
      totalItems: 0,
      imported: 0,
      updated: 0,
      errors: [
        `Fout bij het parseren van de feed: ${err instanceof Error ? err.message : 'Onbekende fout'}. Controleer het formaat.`,
      ],
    };
  }

  if (items.length === 0) {
    return {
      totalItems: 0,
      imported: 0,
      updated: 0,
      errors: ['Geen producten gevonden in de feed. Controleer de inhoud en het formaat.'],
    };
  }

  // Validate all items
  const validationResults = validateFeedItems(items, feed.feedType);

  // Persist items
  let imported = 0;
  let updated = 0;
  const errors: string[] = [];
  const savedResults: ItemValidationResult[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const validationResult = validationResults[i];

    try {
      const existingItem = await findExistingFeedItem(feedId, item);

      if (existingItem) {
        // Update existing item
        await db.productFeedItem.update({
          where: { id: existingItem.id },
          data: {
            title: item.title ?? null,
            description: item.description ?? null,
            gtin: item.gtin ?? null,
            mpn: item.mpn ?? null,
            sku: item.sku ?? null,
            brand: item.brand ?? null,
            category: item.category ?? null,
            productType: item.productType ?? null,
            price: item.price ?? null,
            salePrice: item.salePrice ?? null,
            currency: item.currency ?? 'EUR',
            availability: item.availability ?? null,
            link: item.link ?? null,
            imageLink: item.imageLink ?? null,
            validationStatus: validationResult.validationStatus,
            issues: JSON.stringify(validationResult.issues),
          },
        });

        savedResults.push({
          itemId: existingItem.id,
          validationStatus: validationResult.validationStatus,
          issues: validationResult.issues,
        });
        updated++;
      } else {
        // Create new item
        const created = await db.productFeedItem.create({
          data: {
            feedId,
            title: item.title ?? null,
            description: item.description ?? null,
            gtin: item.gtin ?? null,
            mpn: item.mpn ?? null,
            sku: item.sku ?? null,
            brand: item.brand ?? null,
            category: item.category ?? null,
            productType: item.productType ?? null,
            price: item.price ?? null,
            salePrice: item.salePrice ?? null,
            currency: item.currency ?? 'EUR',
            availability: item.availability ?? null,
            link: item.link ?? null,
            imageLink: item.imageLink ?? null,
            validationStatus: validationResult.validationStatus,
            issues: JSON.stringify(validationResult.issues),
          },
        });

        savedResults.push({
          itemId: created.id,
          validationStatus: validationResult.validationStatus,
          issues: validationResult.issues,
        });
        imported++;
      }
    } catch (err) {
      errors.push(
        `Fout bij item ${i + 1}${item.title ? ` "${item.title}"` : ''}: ${err instanceof Error ? err.message : 'Onbekende fout'}.`
      );
    }
  }

  // Update feed stats
  await updateFeedStatsFromResults(feedId, projectId, savedResults);

  // Update feed's lastFetchedAt
  await db.productFeed.update({
    where: { id: feedId },
    data: { lastFetchedAt: new Date() },
  });

  return {
    totalItems: items.length,
    imported,
    updated,
    errors,
  };
}

// ============================================================================
// Import Feed from URL
// ============================================================================

/**
 * Import a feed by fetching it from the feed's configured sourceUrl.
 *
 * @param projectId - The project the feed belongs to (tenant isolation)
 * @param feedId - The feed to import into (must have a sourceUrl configured)
 * @returns Import result with counts and any errors
 */
export async function importFeedFromURL(
  projectId: string,
  feedId: string
): Promise<FeedImportResult> {
  // Verify feed ownership and get source URL
  const feed = await db.productFeed.findFirst({
    where: { id: feedId, projectId, deletedAt: null },
    select: { id: true, sourceUrl: true, sourceFormat: true },
  });

  if (!feed) {
    return {
      totalItems: 0,
      imported: 0,
      updated: 0,
      errors: ['Feed niet gevonden of behoort niet tot dit project.'],
    };
  }

  if (!feed.sourceUrl) {
    return {
      totalItems: 0,
      imported: 0,
      updated: 0,
      errors: ['Feed heeft geen bron-URL geconfigureerd. Stel een URL in voordat u importeert.'],
    };
  }

  // Fetch the feed content
  let content: string;
  try {
    const response = await fetch(feed.sourceUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/xml, text/csv, text/tab-separated-values, text/plain, application/xml, application/rss+xml',
        'User-Agent': 'SEOCoach-FeedImporter/1.0',
      },
      signal: AbortSignal.timeout(60_000), // 60 second timeout
    });

    if (!response.ok) {
      return {
        totalItems: 0,
        imported: 0,
        updated: 0,
        errors: [
          `Kan feed niet ophalen: HTTP ${response.status} ${response.statusText}. Controleer de URL en probeer opnieuw.`,
        ],
      };
    }

    content = await response.text();
  } catch (err) {
    return {
      totalItems: 0,
      imported: 0,
      updated: 0,
      errors: [
        `Kan feed niet ophalen: ${err instanceof Error ? err.message : 'Onbekende fout'}. Controleer de URL en de netwerkverbinding.`,
      ],
    };
  }

  // Determine format
  const format = feed.sourceFormat as 'xml' | 'csv' | 'tsv' | undefined;

  // Import using the content-based function
  return importFeed(projectId, feedId, content, format);
}

// ============================================================================
// Match Feed Items to Products
// ============================================================================

/**
 * Match feed items to existing Product records in the project.
 *
 * Matching priority:
 * 1. GTIN match
 * 2. SKU match
 * 3. Product URL match
 *
 * Unmatched items will have new Product records created.
 *
 * @param feedId - The feed whose items to match
 * @param projectId - The project (tenant isolation)
 * @returns Match statistics
 */
export async function matchFeedItemsToProducts(
  feedId: string,
  projectId: string
): Promise<ProductMatchResult> {
  // Verify feed ownership
  const feed = await db.productFeed.findFirst({
    where: { id: feedId, projectId, deletedAt: null },
    select: { id: true },
  });

  if (!feed) {
    throw new Error('Feed niet gevonden of behoort niet tot dit project.');
  }

  // Get all unmatched items in this feed
  const feedItems = await db.productFeedItem.findMany({
    where: { feedId, productId: null },
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

  let matched = 0;
  let newProducts = 0;

  for (const item of feedItems) {
    // Try to find matching Product
    const product = await findMatchingProduct(projectId, item);

    if (product) {
      // Link the feed item to the existing product
      await db.productFeedItem.update({
        where: { id: item.id },
        data: { productId: product.id },
      });
      matched++;
    } else {
      // Create a new Product record
      const newProduct = await db.product.create({
        data: {
          projectId,
          name: item.title ?? 'Onbekend product',
          description: item.description ?? null,
          gtin: item.gtin ?? null,
          mpn: item.mpn ?? null,
          sku: item.sku ?? null,
          brand: item.brand ?? null,
          productType: item.productType ?? null,
          regularPrice: item.price ?? null,
          salePrice: item.salePrice ?? null,
          currency: item.currency ?? 'EUR',
          productUrl: item.link ?? null,
          imageUrl: item.imageLink ?? null,
          source: 'feed_import',
        },
      });

      // Link the feed item to the new product
      await db.productFeedItem.update({
        where: { id: item.id },
        data: { productId: newProduct.id },
      });
      newProducts++;
    }
  }

  return {
    matched,
    unmatched: feedItems.length - matched - newProducts,
    newProducts,
  };
}

// ============================================================================
// Get Feed Validation Summary
// ============================================================================

/**
 * Get the current validation summary for a feed from the database.
 * Does not re-run validation — returns the stored state.
 *
 * @param feedId - The feed to summarize
 * @param projectId - The project (tenant isolation)
 * @returns Validation summary
 */
export async function getFeedValidationSummary(
  feedId: string,
  projectId: string
): Promise<FeedValidationSummary> {
  // Verify feed ownership
  const feed = await db.productFeed.findFirst({
    where: { id: feedId, projectId, deletedAt: null },
    select: {
      id: true,
      totalProducts: true,
      validProducts: true,
      warningProducts: true,
      invalidProducts: true,
    },
  });

  if (!feed) {
    throw new Error('Feed niet gevonden of behoort niet tot dit project.');
  }

  // Get items to compute top issues
  const feedItems = await db.productFeedItem.findMany({
    where: { feedId },
    select: {
      id: true,
      validationStatus: true,
      issues: true,
    },
  });

  let validItems = 0;
  let warningItems = 0;
  let invalidItems = 0;
  let errorItems = 0;

  // Aggregate issues across all items
  const issueMap = new Map<string, { field: string; count: number; message: string }>();

  for (const item of feedItems) {
    switch (item.validationStatus) {
      case FeedValidationStatus.VALID:
        validItems++;
        break;
      case FeedValidationStatus.VALID_WITH_WARNINGS:
        warningItems++;
        break;
      case FeedValidationStatus.INVALID:
        invalidItems++;
        break;
      case FeedValidationStatus.ERROR:
        errorItems++;
        break;
      default:
        // PENDING or VALIDATING — count as error for summary purposes
        errorItems++;
        break;
    }

    // Parse issues JSON
    if (item.issues) {
      try {
        const parsed = JSON.parse(item.issues) as Array<{ field: string; message: string; ruleName: string }>;
        for (const issue of parsed) {
          const key = `${issue.field}:${issue.ruleName}`;
          const existing = issueMap.get(key);
          if (existing) {
            existing.count++;
          } else {
            issueMap.set(key, {
              field: issue.field,
              count: 1,
              message: issue.message,
            });
          }
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }

  const topIssues = Array.from(issueMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    feedId,
    totalItems: feed.totalProducts,
    validItems,
    warningItems,
    invalidItems,
    errorItems,
    topIssues,
  };
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Find an existing ProductFeedItem in the given feed by dedup keys.
 * Priority: GTIN → SKU → link
 */
async function findExistingFeedItem(
  feedId: string,
  item: FeedItemData
): Promise<{ id: string } | null> {
  // Try GTIN match
  if (item.gtin) {
    const byGtin = await db.productFeedItem.findFirst({
      where: { feedId, gtin: item.gtin },
      select: { id: true },
    });
    if (byGtin) return byGtin;
  }

  // Try SKU match
  if (item.sku) {
    const bySku = await db.productFeedItem.findFirst({
      where: { feedId, sku: item.sku },
      select: { id: true },
    });
    if (bySku) return bySku;
  }

  // Try link match
  if (item.link) {
    const byLink = await db.productFeedItem.findFirst({
      where: { feedId, link: item.link },
      select: { id: true },
    });
    if (byLink) return byLink;
  }

  return null;
}

/**
 * Find a matching Product in the project by dedup keys.
 * Priority: GTIN → SKU → productUrl
 */
async function findMatchingProduct(
  projectId: string,
  item: {
    gtin: string | null;
    sku: string | null;
    link: string | null;
  }
): Promise<{ id: string } | null> {
  // Try GTIN match
  if (item.gtin) {
    const byGtin = await db.product.findFirst({
      where: { projectId, gtin: item.gtin, deletedAt: null },
      select: { id: true },
    });
    if (byGtin) return byGtin;
  }

  // Try SKU match
  if (item.sku) {
    const bySku = await db.product.findFirst({
      where: { projectId, sku: item.sku, deletedAt: null },
      select: { id: true },
    });
    if (bySku) return bySku;
  }

  // Try product URL match
  if (item.link) {
    const byUrl = await db.product.findFirst({
      where: { projectId, productUrl: item.link, deletedAt: null },
      select: { id: true },
    });
    if (byUrl) return byUrl;
  }

  return null;
}

/**
 * Update feed statistics from validation results.
 * Computes aggregated counts and determines overall feed status.
 */
async function updateFeedStatsFromResults(
  feedId: string,
  projectId: string,
  results: ItemValidationResult[]
): Promise<void> {
  let validProducts = 0;
  let warningProducts = 0;
  let invalidProducts = 0;

  for (const r of results) {
    switch (r.validationStatus) {
      case FeedValidationStatus.VALID:
        validProducts++;
        break;
      case FeedValidationStatus.VALID_WITH_WARNINGS:
        warningProducts++;
        break;
      default:
        invalidProducts++;
        break;
    }
  }

  let status: FeedValidationStatus;
  if (invalidProducts > 0) {
    status = FeedValidationStatus.INVALID;
  } else if (warningProducts > 0) {
    status = FeedValidationStatus.VALID_WITH_WARNINGS;
  } else {
    status = FeedValidationStatus.VALID;
  }

  await updateFeedStats(feedId, projectId, {
    totalProducts: results.length,
    validProducts,
    warningProducts,
    invalidProducts,
    status,
  });
}
