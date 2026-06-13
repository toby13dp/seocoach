// ============================================================================
// Reviews & Reputation — Review Importer
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Imports reviews from CSV files and other sources.
// Supports flexible column mapping (Dutch/English), multiple date formats,
// and automatic deduplication by externalId or authorName+reviewDate+source.
// All error messages are in Dutch.
// ============================================================================

import { ReviewSource } from '@prisma/client';
import { db } from '@/lib/db';
import { DEFAULT_REVIEW_COLUMN_MAPPINGS } from './types';
import type { ReviewImportData } from './types';

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Mapping of flexible CSV column names to normalized field names.
 * Built from DEFAULT_REVIEW_COLUMN_MAPPINGS plus additional aliases.
 */
const COLUMN_ALIASES: Record<string, keyof Omit<ReviewImportData, 'source' | 'language'>> = {};

// Build the alias map from DEFAULT_REVIEW_COLUMN_MAPPINGS
for (const [field, aliases] of Object.entries(DEFAULT_REVIEW_COLUMN_MAPPINGS)) {
  for (const alias of aliases) {
    COLUMN_ALIASES[alias.toLowerCase().replace(/[\s-]+/g, '_')] = field as keyof Omit<ReviewImportData, 'source' | 'language'>;
  }
  // Also add the field name itself
  COLUMN_ALIASES[field.toLowerCase()] = field as keyof Omit<ReviewImportData, 'source' | 'language'>;
}

/**
 * Normalize a column header for matching.
 * Trims whitespace, lowercases, and replaces spaces/hyphens with underscores.
 */
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Parse a single CSV line, respecting quoted fields.
 * Handles commas inside double-quoted fields correctly.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

/**
 * Parse a date string in various formats.
 * Supports: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, YYYY/MM/DD
 *
 * @param dateStr - Date string to parse
 * @returns Date object or null if unparseable
 */
function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim().length === 0) return null;

  const trimmed = dateStr.trim();

  // Try ISO format first (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  const isoDate = new Date(trimmed);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try MM/DD/YYYY (US format, less common in NL but supported)
  const mdyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Parse a CSV string into an array of ReviewImportData objects.
 *
 * Supports flexible column names through alias mapping. The first row is
 * treated as headers. Handles quoted fields (with commas inside quotes).
 *
 * @param csvContent - Raw CSV content as a string
 * @param source - The review source to assign to all imported reviews
 * @returns Array of parsed ReviewImportData objects
 */
export function parseReviewCSV(
  csvContent: string,
  source: ReviewSource
): ReviewImportData[] {
  const lines = csvContent
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]).map(normalizeHeader);

  // Map headers to field names
  const fieldMap: Map<number, keyof Omit<ReviewImportData, 'source' | 'language'>> = new Map();
  for (let i = 0; i < headers.length; i++) {
    const field = COLUMN_ALIASES[headers[i]];
    if (field) {
      fieldMap.set(i, field);
    }
  }

  const results: ReviewImportData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: Partial<Record<keyof Omit<ReviewImportData, 'source' | 'language'>, string>> = {};
    for (let j = 0; j < values.length; j++) {
      const field = fieldMap.get(j);
      if (field) {
        row[field] = values[j]?.trim() ?? '';
      }
    }

    // Rating is required
    const ratingStr = row.rating;
    if (!ratingStr) continue;

    const rating = parseFloat(ratingStr);
    if (isNaN(rating) || rating < 0 || rating > 5) continue;

    const importData: ReviewImportData = {
      source,
      rating: Math.round(rating * 10) / 10, // Round to 1 decimal
    };

    if (row.authorName && row.authorName.length > 0) {
      importData.authorName = row.authorName;
    }
    if (row.title && row.title.length > 0) {
      importData.title = row.title;
    }
    if (row.content && row.content.length > 0) {
      importData.content = row.content;
    }
    if (row.sourceUrl && row.sourceUrl.length > 0) {
      importData.sourceUrl = row.sourceUrl;
    }
    if (row.externalId && row.externalId.length > 0) {
      importData.externalId = row.externalId;
    }
    if (row.reviewDate && row.reviewDate.length > 0) {
      const parsedDate = parseFlexibleDate(row.reviewDate);
      if (parsedDate) {
        importData.reviewDate = parsedDate;
      }
    }

    results.push(importData);
  }

  return results;
}

// ============================================================================
// Single Review Import
// ============================================================================

/**
 * Import a single review into the database.
 * Performs automatic deduplication by externalId or authorName+reviewDate+source.
 *
 * @param projectId - The project to import the review into
 * @param data - Review import data
 * @param locationId - Optional location ID to associate with
 * @param importBatch - Batch identifier for grouping imports
 * @returns The created or updated Review record
 */
export async function importReview(
  projectId: string,
  data: ReviewImportData,
  locationId?: string,
  importBatch?: string
) {
  // Check for existing review by externalId
  if (data.externalId) {
    const existing = await db.review.findFirst({
      where: {
        projectId,
        externalId: data.externalId,
        source: data.source,
        deletedAt: null,
      },
    });

    if (existing) {
      // Update existing review
      return db.review.update({
        where: { id: existing.id },
        data: {
          rating: data.rating,
          title: data.title ?? existing.title,
          content: data.content ?? existing.content,
          authorName: data.authorName ?? existing.authorName,
          sourceUrl: data.sourceUrl ?? existing.sourceUrl,
          reviewDate: data.reviewDate ?? existing.reviewDate,
          locationId: locationId ?? existing.locationId,
        },
      });
    }
  }

  // Check for duplicate by authorName+reviewDate+source
  if (data.authorName && data.reviewDate) {
    const existing = await db.review.findFirst({
      where: {
        projectId,
        authorName: data.authorName,
        reviewDate: data.reviewDate,
        source: data.source,
        deletedAt: null,
      },
    });

    if (existing) {
      // Update existing review
      return db.review.update({
        where: { id: existing.id },
        data: {
          rating: data.rating,
          title: data.title ?? existing.title,
          content: data.content ?? existing.content,
          sourceUrl: data.sourceUrl ?? existing.sourceUrl,
          locationId: locationId ?? existing.locationId,
        },
      });
    }
  }

  // Create new review
  return db.review.create({
    data: {
      projectId,
      locationId: locationId ?? null,
      source: data.source,
      externalId: data.externalId ?? null,
      sourceUrl: data.sourceUrl ?? null,
      authorName: data.authorName ?? null,
      rating: data.rating,
      title: data.title ?? null,
      content: data.content ?? null,
      reviewDate: data.reviewDate ?? null,
      language: data.language ?? 'nl',
      importBatch: importBatch ?? null,
    },
  });
}

// ============================================================================
// Bulk Review Import
// ============================================================================

/**
 * Import multiple reviews in bulk.
 * Each review is validated and deduplicated individually.
 *
 * @param projectId - The project to import reviews into
 * @param reviews - Array of review import data
 * @param locationId - Optional location ID for all reviews
 * @param importBatch - Batch identifier for grouping this import
 * @returns Counts of imported, updated reviews and any errors
 */
export async function importReviewsBulk(
  projectId: string,
  reviews: ReviewImportData[],
  locationId?: string,
  importBatch?: string
): Promise<{ imported: number; updated: number; errors: string[] }> {
  let imported = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const review of reviews) {
    try {
      // Validate rating
      if (review.rating < 0 || review.rating > 5) {
        errors.push(
          `Beoordeling ${review.rating} voor "${review.authorName ?? 'onbekend'}" is ongeldig (moet 0-5 zijn)`
        );
        continue;
      }

      // Check for existing review by externalId
      let existing: Awaited<ReturnType<typeof db.review.findFirst>> = null;

      if (review.externalId) {
        existing = await db.review.findFirst({
          where: {
            projectId,
            externalId: review.externalId,
            source: review.source,
            deletedAt: null,
          },
        });
      }

      // Check for duplicate by authorName+reviewDate+source
      if (!existing && review.authorName && review.reviewDate) {
        existing = await db.review.findFirst({
          where: {
            projectId,
            authorName: review.authorName,
            reviewDate: review.reviewDate,
            source: review.source,
            deletedAt: null,
          },
        });
      }

      if (existing) {
        // Update existing review
        await db.review.update({
          where: { id: existing.id },
          data: {
            rating: review.rating,
            title: review.title ?? existing.title,
            content: review.content ?? existing.content,
            authorName: review.authorName ?? existing.authorName,
            sourceUrl: review.sourceUrl ?? existing.sourceUrl,
            reviewDate: review.reviewDate ?? existing.reviewDate,
            locationId: locationId ?? existing.locationId,
          },
        });
        updated++;
      } else {
        // Create new review
        await db.review.create({
          data: {
            projectId,
            locationId: locationId ?? null,
            source: review.source,
            externalId: review.externalId ?? null,
            sourceUrl: review.sourceUrl ?? null,
            authorName: review.authorName ?? null,
            rating: review.rating,
            title: review.title ?? null,
            content: review.content ?? null,
            reviewDate: review.reviewDate ?? null,
            language: review.language ?? 'nl',
            importBatch: importBatch ?? null,
          },
        });
        imported++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(
        `Fout bij importeren review van "${review.authorName ?? 'onbekend'}": ${msg}`
      );
    }
  }

  return { imported, updated, errors };
}

// ============================================================================
// CSV File Import
// ============================================================================

/**
 * Import reviews from a CSV file content string.
 * Parses the CSV, maps columns, and performs bulk import with deduplication.
 *
 * @param projectId - The project to import reviews into
 * @param csvContent - Raw CSV content as a string
 * @param source - The review source to assign (typically CSV_IMPORT)
 * @param locationId - Optional location ID for all reviews
 * @returns Import batch ID and counts of imported/updated reviews and errors
 */
export async function importReviewsCSV(
  projectId: string,
  csvContent: string,
  source: ReviewSource,
  locationId?: string
): Promise<{
  importBatch: string;
  imported: number;
  updated: number;
  errors: string[];
}> {
  // Generate a batch ID for this import
  const importBatch = `csv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Parse CSV
  const reviews = parseReviewCSV(csvContent, source);

  if (reviews.length === 0) {
    return {
      importBatch,
      imported: 0,
      updated: 0,
      errors: ['Geen geldige reviews gevonden in het CSV-bestand'],
    };
  }

  // Bulk import
  const result = await importReviewsBulk(
    projectId,
    reviews,
    locationId,
    importBatch
  );

  return {
    importBatch,
    ...result,
  };
}
