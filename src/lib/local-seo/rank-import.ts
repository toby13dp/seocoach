// ============================================================================
// Local SEO — Rank CSV Import
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Imports keyword ranking data from CSV files.
// Supports both Dutch and English column names.
// Handles BOM, quoted fields, and flexible delimiters.
// ============================================================================

import { db } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

export interface RankImportResult {
  batch: string;
  rowCount: number;
  successCount: number;
  errorCount: number;
  errors: string[];
}

export interface ParsedRankRow {
  keyword: string;
  searchVolume?: number;
  difficulty?: number;
  currentRank?: number;
  targetRank?: number;
  url?: string;
  intent?: string;
}

// ============================================================================
// Column Name Mappings (Dutch & English)
// ============================================================================

const COLUMN_MAPPINGS: Record<string, string[]> = {
  keyword: ['zoekwoord', 'keyword', 'zoekterm', 'term', 'keyphrase'],
  searchVolume: [
    'zoekvolume',
    'search volume',
    'searchvolume',
    'volume',
    'zoek volume',
    'sv',
  ],
  difficulty: [
    'moeilijkheid',
    'difficulty',
    'diff',
    'kd',
    'keyword difficulty',
    'concurrentie',
  ],
  currentRank: [
    'huidige rang',
    'current rank',
    'current position',
    'positie',
    'position',
    'rank',
    'huidige positie',
  ],
  targetRank: [
    'doelrang',
    'target rank',
    'target position',
    'doel positie',
    'doel',
  ],
  url: ['url', 'pagina', 'page', 'landing page', 'bestemmingspagina'],
  intent: ['intentie', 'intent', 'zoekerintentie', 'search intent'],
};

// ============================================================================
// CSV Parsing Helpers
// ============================================================================

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Detect CSV delimiter (comma, semicolon, or tab).
 */
function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0] ?? '';
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

/**
 * Remove BOM (Byte Order Mark) from the start of CSV content.
 */
function removeBOM(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
}

/**
 * Map CSV headers to our field names using flexible Dutch/English mapping.
 */
function mapHeaders(
  headers: string[]
): Map<number, string> {
  const mapping = new Map<number, string>();

  for (const [fieldName, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
    for (const possible of possibleNames) {
      const normalizedPossible = possible.toLowerCase().replace(/\s+/g, '_');
      for (let i = 0; i < headers.length; i++) {
        const normalizedHeader = headers[i]
          .toLowerCase()
          .trim()
          .replace(/^["']|["']$/g, '')
          .replace(/\s+/g, '_');
        if (normalizedHeader === normalizedPossible) {
          mapping.set(i, fieldName);
          break;
        }
      }
    }
  }

  return mapping;
}

// ============================================================================
// Parse Rank CSV
// ============================================================================

/**
 * Parse a CSV string into rank rows.
 * Supports Dutch and English column names, BOM, and quoted fields.
 *
 * @param csvContent - The raw CSV content
 * @returns Parsed rows and any errors
 */
export function parseRankCSV(
  csvContent: string
): { rows: ParsedRankRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: ParsedRankRow[] = [];

  // Remove BOM
  const content = removeBOM(csvContent);

  // Detect delimiter
  const delimiter = detectDelimiter(content);

  // Split into lines
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    errors.push('CSV-bestand bevat geen geldige rijen.');
    return { rows, errors };
  }

  // Parse headers
  const headers = parseCSVLine(lines[0], delimiter);
  const columnMapping = mapHeaders(headers);

  // Check for minimum required columns (keyword)
  const hasKeyword = Array.from(columnMapping.values()).includes('keyword');
  if (!hasKeyword) {
    errors.push(
      'Kolom "zoekwoord" of "keyword" ontbreekt. Dit is vereist.'
    );
    return { rows, errors };
  }

  // Process each row
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter);

    // Map fields to our data structure
    const mapped: Record<string, string> = {};
    for (const [colIndex, fieldName] of columnMapping.entries()) {
      if (colIndex < fields.length) {
        mapped[fieldName] = fields[colIndex].replace(/^["']|["']$/g, '');
      }
    }

    // Validate: keyword is required
    if (!mapped.keyword || !mapped.keyword.trim()) {
      errors.push(`Rij ${i + 1}: zoekwoord ontbreekt, rij overgeslagen.`);
      continue;
    }

    const row: ParsedRankRow = {
      keyword: mapped.keyword.trim(),
    };

    // Parse optional numeric fields
    if (mapped.searchVolume) {
      const val = parseInt(mapped.searchVolume.replace(/[.,]/g, ''), 10);
      if (!isNaN(val)) row.searchVolume = val;
    }

    if (mapped.difficulty) {
      const val = parseFloat(mapped.difficulty.replace(',', '.'));
      if (!isNaN(val)) row.difficulty = Math.min(100, Math.max(0, val));
    }

    if (mapped.currentRank) {
      const val = parseInt(mapped.currentRank, 10);
      if (!isNaN(val)) row.currentRank = Math.max(1, val);
    }

    if (mapped.targetRank) {
      const val = parseInt(mapped.targetRank, 10);
      if (!isNaN(val)) row.targetRank = Math.max(1, val);
    }

    if (mapped.url) {
      row.url = mapped.url.trim();
    }

    if (mapped.intent) {
      row.intent = mapped.intent.trim();
    }

    rows.push(row);
  }

  return { rows, errors };
}

// ============================================================================
// Import Rank CSV
// ============================================================================

/**
 * Import keyword ranking data from CSV.
 * Creates a RankImport record and LocalKeyword records for each valid row.
 *
 * @param projectId - The project to import data for
 * @param csvContent - The raw CSV content
 * @param locationId - Optional location to associate keywords with
 * @returns Import result with batch ID and counts
 */
export async function importRankCSV(
  projectId: string,
  csvContent: string,
  locationId?: string
): Promise<RankImportResult> {
  const { rows, errors: parseErrors } = parseRankCSV(csvContent);
  const importErrors: string[] = [...parseErrors];

  const batch = `rank_${projectId}_${Date.now()}`;
  let successCount = 0;

  // If locationId is provided, we need to validate it exists
  if (locationId) {
    const location = await db.location.findUnique({
      where: { id: locationId, deletedAt: null },
    });
    if (!location) {
      return {
        batch,
        rowCount: rows.length,
        successCount: 0,
        errorCount: rows.length,
        errors: ['Locatie niet gevonden of verwijderd.'],
      };
    }
  }

  // Import each row
  for (const row of rows) {
    try {
      // Determine intent value
      let intentValue: string = 'LOCAL';
      if (row.intent) {
        const normalized = row.intent.toUpperCase().replace(/\s+/g, '_');
        const validIntents = [
          'NAVIGATIONAL',
          'INFORMATIONAL',
          'TRANSACTIONAL',
          'COMMERCIAL',
          'LOCAL',
        ];
        if (validIntents.includes(normalized)) {
          intentValue = normalized;
        }
      }

      await db.localKeyword.create({
        data: {
          projectId,
          locationId: locationId ?? '',  // Will be set by caller if needed
          keyword: row.keyword,
          intent: intentValue as any,
          searchVolume: row.searchVolume ?? null,
          difficulty: row.difficulty ?? null,
          currentRank: row.currentRank ?? null,
          targetRank: row.targetRank ?? null,
          url: row.url ?? null,
        },
      });
      successCount++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      importErrors.push(
        `Rij "${row.keyword}": fout bij importeren — ${msg}`
      );
    }
  }

  const errorCount = rows.length - successCount;

  // Create RankImport record
  await db.rankImport.create({
    data: {
      projectId,
      locationId: locationId ?? null,
      importBatch: batch,
      source: 'csv_import',
      rowCount: rows.length,
      successCount,
      errorCount,
      errors: importErrors.length > 0 ? JSON.stringify(importErrors) : null,
    },
  });

  return {
    batch,
    rowCount: rows.length,
    successCount,
    errorCount,
    errors: importErrors,
  };
}
