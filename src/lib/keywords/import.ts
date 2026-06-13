// ============================================================================
// Keyword Management — CSV Import & Bulk Operations
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Parses CSV files with flexible column names, validates keyword entries,
// and performs bulk import with duplicate handling.
// All user-facing messages are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import type { KeywordImport, KeywordCSVRow, ImportResult } from './types';

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Mapping of flexible CSV column names to normalized field names.
 * Supports common variations found in SEO tools (Ahrefs, SEMrush, Moz, etc.)
 */
const COLUMN_ALIASES: Record<string, keyof KeywordCSVRow> = {
  // keyword
  keyword: 'keyword',
  keyphrase: 'keyword',
  zoekwoord: 'keyword',
  zoekterm: 'keyword',
  term: 'keyword',
  query: 'keyword',
  // search_volume
  search_volume: 'search_volume',
  volume: 'search_volume',
  zoekvolume: 'search_volume',
  monthly_volume: 'search_volume',
  monthly_searches: 'search_volume',
  avg_monthly_searches: 'search_volume',
  searches: 'search_volume',
  // difficulty
  difficulty: 'difficulty',
  kd: 'difficulty',
  keyword_difficulty: 'difficulty',
  moeilijkheid: 'difficulty',
  difficulty_score: 'difficulty',
  // cpc
  cpc: 'cpc',
  cost_per_click: 'cpc',
  cpc_eur: 'cpc',
  cpc_usd: 'cpc',
  // current_ranking
  current_ranking: 'current_ranking',
  position: 'current_ranking',
  rank: 'current_ranking',
  ranking: 'current_ranking',
  huidige_positie: 'current_ranking',
  current_position: 'current_ranking',
  pos: 'current_ranking',
  // current_url
  current_url: 'current_url',
  url: 'current_url',
  landing_page: 'current_url',
  pagina: 'current_url',
  page: 'current_url',
  // group
  group: 'group',
  groep: 'group',
  cluster: 'group',
  topic: 'group',
  category: 'group',
  categorie: 'group',
  // tags
  tags: 'tags',
  labels: 'tags',
  label: 'tags',
  tag: 'tags',
};

/**
 * Normalize a column header by trimming whitespace, converting to lowercase,
 * and replacing spaces/hyphens with underscores.
 *
 * @param header - Raw CSV column header
 * @returns Normalized column name
 */
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Parse a CSV string into an array of KeywordImport objects.
 *
 * Supports flexible column names through alias mapping. The first row is
 * treated as headers. Handles quoted fields (with commas inside quotes)
 * and various CSV dialects.
 *
 * @param csvText - Raw CSV content as a string
 * @returns Array of parsed KeywordImport objects
 *
 * @example
 * ```typescript
 * const csv = `keyword,volume,difficulty,cpc
 * seo tools,1000,45,2.50
 * marketing software,500,60,3.00`;
 * const keywords = parseCSV(csv);
 * // [{ keyword: "seo tools", searchVolume: 1000, difficulty: 45, cpc: 2.50 }, ...]
 * ```
 */
export function parseCSV(csvText: string): KeywordImport[] {
  const lines = csvText
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]).map(normalizeHeader);

  // Map headers to KeywordCSVRow field names
  const fieldMap: Map<number, keyof KeywordCSVRow> = new Map();
  for (let i = 0; i < headers.length; i++) {
    const alias = COLUMN_ALIASES[headers[i]];
    if (alias) {
      fieldMap.set(i, alias);
    }
  }

  // Check that at least a keyword column exists
  let hasKeywordColumn = false;
  for (const [, field] of fieldMap) {
    if (field === 'keyword') {
      hasKeywordColumn = true;
      break;
    }
  }

  if (!hasKeywordColumn) {
    // Try using the first column as keyword if no keyword column is found
    fieldMap.set(0, 'keyword');
  }

  const results: KeywordImport[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    if (values.length === 0) continue;

    const row: Partial<KeywordCSVRow> = {};
    for (let j = 0; j < values.length; j++) {
      const field = fieldMap.get(j);
      if (field) {
        (row as Record<string, string>)[field] = values[j]?.trim() ?? '';
      }
    }

    if (!row.keyword || row.keyword.trim().length === 0) continue;

    const importItem = csvRowToKeywordImport(row as KeywordCSVRow);
    results.push(importItem);
  }

  return results;
}

/**
 * Parse a single CSV line, respecting quoted fields.
 * Handles commas inside double-quoted fields correctly.
 *
 * @param line - A single CSV line
 * @returns Array of field values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote (double quote)
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip the next quote
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
 * Convert a CSV row with string values to a KeywordImport object
 * with properly typed fields.
 *
 * @param row - The raw CSV row with string values
 * @returns A KeywordImport object with typed fields
 */
function csvRowToKeywordImport(row: KeywordCSVRow): KeywordImport {
  const result: KeywordImport = {
    keyword: row.keyword.trim(),
  };

  if (row.search_volume !== undefined && row.search_volume !== '') {
    const vol = parseInt(row.search_volume, 10);
    if (!isNaN(vol) && vol >= 0) {
      result.searchVolume = vol;
    }
  }

  if (row.difficulty !== undefined && row.difficulty !== '') {
    const diff = parseFloat(row.difficulty);
    if (!isNaN(diff) && diff >= 0 && diff <= 100) {
      result.difficulty = diff;
    }
  }

  if (row.cpc !== undefined && row.cpc !== '') {
    const cpc = parseFloat(row.cpc);
    if (!isNaN(cpc) && cpc >= 0) {
      result.cpc = cpc;
    }
  }

  if (row.current_ranking !== undefined && row.current_ranking !== '') {
    const rank = parseInt(row.current_ranking, 10);
    if (!isNaN(rank) && rank >= 0) {
      result.currentRanking = rank;
    }
  }

  if (row.current_url !== undefined && row.current_url !== '') {
    result.currentUrl = row.current_url.trim();
  }

  if (row.group !== undefined && row.group !== '') {
    result.groupId = row.group.trim();
  }

  if (row.tags !== undefined && row.tags !== '') {
    result.tags = row.tags
      .split(/[;|,]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  return result;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a keyword import entry before it is persisted to the database.
 *
 * Checks for:
 * - Non-empty keyword string
 * - Keyword length (max 500 characters)
 * - Search volume range (0-10,000,000)
 * - Difficulty range (0-100)
 * - CPC range (0-1000)
 * - Current ranking range (0-200)
 * - Valid URL format (if provided)
 *
 * @param data - The keyword import data to validate
 * @returns Object with `valid` flag and array of Dutch error messages
 *
 * @example
 * ```typescript
 * const result = validateKeywordImport({ keyword: '', searchVolume: -5 });
 * // { valid: false, errors: ["Zoekwoord mag niet leeg zijn", "Zoekvolume moet tussen 0 en 10.000.000 liggen"] }
 * ```
 */
export function validateKeywordImport(data: KeywordImport): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Keyword validation
  if (!data.keyword || data.keyword.trim().length === 0) {
    errors.push('Zoekwoord mag niet leeg zijn');
  } else if (data.keyword.trim().length > 500) {
    errors.push(
      'Zoekwoord mag maximaal 500 tekens bevatten'
    );
  }

  // Search volume validation
  if (data.searchVolume !== undefined) {
    if (data.searchVolume < 0) {
      errors.push('Zoekvolume moet tussen 0 en 10.000.000 liggen');
    } else if (data.searchVolume > 10_000_000) {
      errors.push('Zoekvolume moet tussen 0 en 10.000.000 liggen');
    }
  }

  // Difficulty validation
  if (data.difficulty !== undefined) {
    if (data.difficulty < 0 || data.difficulty > 100) {
      errors.push('Moeilijkheidsgraad moet tussen 0 en 100 liggen');
    }
  }

  // CPC validation
  if (data.cpc !== undefined) {
    if (data.cpc < 0 || data.cpc > 1000) {
      errors.push('CPC moet tussen 0 en 1000 liggen');
    }
  }

  // Current ranking validation
  if (data.currentRanking !== undefined) {
    if (data.currentRanking < 0 || data.currentRanking > 200) {
      errors.push('Huidige positie moet tussen 0 en 200 liggen');
    }
  }

  // URL validation (if provided)
  if (data.currentUrl !== undefined && data.currentUrl.trim().length > 0) {
    try {
      new URL(data.currentUrl);
    } catch {
      errors.push('Ongeldige URL-indeling');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Normalization
// ============================================================================

/**
 * Normalize a keyword string for deduplication.
 * Lowercases, trims, collapses multiple spaces, and removes diacritical
 * marks to catch near-duplicates.
 *
 * @param keyword - The raw keyword string
 * @returns Normalized keyword for comparison
 */
export function normalizeKeyword(keyword: string): string {
  return keyword
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritical marks
}

// ============================================================================
// Bulk Import
// ============================================================================

/**
 * Import keywords into the database for a project.
 *
 * Handles duplicates gracefully:
 * - If a keyword with the same normalized text already exists in the project
 *   (and is not soft-deleted), it will be updated with new data.
 * - If the existing data is identical to the import data, the keyword is skipped.
 * - All import data is validated before persistence.
 *
 * @param projectId - The project to import keywords into
 * @param keywords - Array of keyword import data
 * @param source - The source of the import ('manual', 'csv', or 'ai')
 * @returns Import result with counts of imported, updated, and skipped keywords
 *
 * @example
 * ```typescript
 * const result = await importKeywords('project-123', [
 *   { keyword: 'seo tools', searchVolume: 1000, difficulty: 45 },
 *   { keyword: 'marketing software', searchVolume: 500 },
 * ], 'csv');
 * // { imported: 2, updated: 0, skipped: 0, errors: [] }
 * ```
 */
export async function importKeywords(
  projectId: string,
  keywords: KeywordImport[],
  source: 'manual' | 'csv' | 'ai'
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  if (keywords.length === 0) {
    return result;
  }

  // Validate all keywords first
  const validKeywords: KeywordImport[] = [];
  for (const kw of keywords) {
    const validation = validateKeywordImport(kw);
    if (!validation.valid) {
      result.errors.push({
        keyword: kw.keyword || '(leeg)',
        errors: validation.errors,
      });
    } else {
      validKeywords.push(kw);
    }
  }

  // Fetch existing keywords for this project to check duplicates
  const normalizedKeywords = validKeywords.map((kw) =>
    normalizeKeyword(kw.keyword)
  );

  const existingKeywords = await db.keyword.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      keyword: true,
      searchVolume: true,
      difficulty: true,
      cpc: true,
      currentRanking: true,
      currentUrl: true,
      searchIntent: true,
      funnelStage: true,
      groupId: true,
      tags: true,
    },
  });

  // Build a map of normalized keyword -> existing keyword record
  const existingMap = new Map<
    string,
    (typeof existingKeywords)[0]
  >();
  for (const existing of existingKeywords) {
    existingMap.set(normalizeKeyword(existing.keyword), existing);
  }

  // Process each valid keyword
  for (let i = 0; i < validKeywords.length; i++) {
    const kw = validKeywords[i];
    const normalized = normalizedKeywords[i];
    const existing = existingMap.get(normalized);

    try {
      if (existing) {
        // Check if there are meaningful differences
        const hasChanges = hasKeywordChanges(existing, kw);

        if (!hasChanges) {
          result.skipped++;
          continue;
        }

        // Update existing keyword
        await db.keyword.update({
          where: { id: existing.id },
          data: {
            searchVolume: kw.searchVolume ?? existing.searchVolume,
            difficulty: kw.difficulty ?? existing.difficulty,
            cpc: kw.cpc ?? existing.cpc,
            currentRanking: kw.currentRanking ?? existing.currentRanking,
            currentUrl: kw.currentUrl ?? existing.currentUrl,
            searchIntent: kw.searchIntent ?? (existing.searchIntent as keyof typeof kw.searchIntent),
            funnelStage: kw.funnelStage ?? (existing.funnelStage as keyof typeof kw.funnelStage),
            groupId: kw.groupId ?? existing.groupId,
            tags: kw.tags
              ? JSON.stringify(kw.tags)
              : existing.tags,
            source,
          },
        });

        result.updated++;
      } else {
        // Create new keyword
        await db.keyword.create({
          data: {
            projectId,
            keyword: kw.keyword.trim(),
            searchVolume: kw.searchVolume ?? null,
            difficulty: kw.difficulty ?? null,
            cpc: kw.cpc ?? null,
            currentRanking: kw.currentRanking ?? null,
            currentUrl: kw.currentUrl ?? null,
            searchIntent: kw.searchIntent ?? 'UNKNOWN',
            funnelStage: kw.funnelStage ?? 'UNKNOWN',
            groupId: kw.groupId ?? null,
            tags: kw.tags ? JSON.stringify(kw.tags) : null,
            source,
          },
        });

        result.imported++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push({
        keyword: kw.keyword,
        errors: [`Fout bij importeren: ${msg}`],
      });
    }
  }

  return result;
}

/**
 * Check if a keyword import has meaningful changes compared to the existing record.
 * Used to determine whether an update is needed or the keyword can be skipped.
 *
 * @param existing - The existing keyword record from the database
 * @param newData - The new import data
 * @returns true if there are meaningful differences
 */
function hasKeywordChanges(
  existing: {
    searchVolume: number | null;
    difficulty: number | null;
    cpc: number | null;
    currentRanking: number | null;
    currentUrl: string | null;
    searchIntent: string;
    funnelStage: string;
    groupId: string | null;
    tags: string | null;
  },
  newData: KeywordImport
): boolean {
  if (
    newData.searchVolume !== undefined &&
    newData.searchVolume !== existing.searchVolume
  )
    return true;
  if (
    newData.difficulty !== undefined &&
    newData.difficulty !== existing.difficulty
  )
    return true;
  if (newData.cpc !== undefined && newData.cpc !== existing.cpc) return true;
  if (
    newData.currentRanking !== undefined &&
    newData.currentRanking !== existing.currentRanking
  )
    return true;
  if (
    newData.currentUrl !== undefined &&
    newData.currentUrl !== existing.currentUrl
  )
    return true;
  if (
    newData.searchIntent !== undefined &&
    newData.searchIntent !== existing.searchIntent
  )
    return true;
  if (
    newData.funnelStage !== undefined &&
    newData.funnelStage !== existing.funnelStage
  )
    return true;
  if (
    newData.groupId !== undefined &&
    newData.groupId !== existing.groupId
  )
    return true;
  if (newData.tags !== undefined) {
    const existingTags = existing.tags ? JSON.parse(existing.tags) : [];
    if (JSON.stringify(newData.tags.sort()) !== JSON.stringify(existingTags.sort()))
      return true;
  }

  return false;
}
