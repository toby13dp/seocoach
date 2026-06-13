// ============================================================================
// AI Visibility — CSV Import
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Imports AI visibility test results from CSV files.
// Supports flexible column mapping for Dutch & English headers.
// Sets method to CSV_IMPORT for all imported records.
// ============================================================================

import { db } from '@/lib/db';
import type { AIVisibilityImportResult } from './types';
import { AI_VISIBILITY_CSV_COLUMNS } from './types';

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Parse a single CSV line, respecting quoted fields.
 * Handles commas inside double-quoted fields.
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
 * Detect the delimiter used in CSV content.
 * Supports comma and semicolon.
 */
function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0] ?? '';
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Parse CSV content into an array of row objects.
 */
function parseCSV(content: string): Array<Record<string, string>> {
  const delimiter = detectDelimiter(content);
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0], delimiter).map((h) =>
    h.toLowerCase().trim().replace(/^["']|["']$/g, '')
  );

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < values.length; j++) {
      row[headers[j]] = values[j].replace(/^["']|["']$/g, '');
    }
    rows.push(row);
  }

  return rows;
}

// ============================================================================
// Column Mapping
// ============================================================================

/**
 * Map CSV headers to our field names using flexible column mapping.
 * Supports both Dutch and English headers.
 */
function mapColumns(
  headers: string[]
): Map<string, string> {
  const mapping = new Map<string, string>(); // csvHeader -> fieldName

  for (const [fieldName, possibleNames] of Object.entries(AI_VISIBILITY_CSV_COLUMNS)) {
    for (const possible of possibleNames) {
      const normalizedPossible = possible.toLowerCase().replace(/\s+/g, '_');
      for (const header of headers) {
        const normalizedHeader = header.toLowerCase().replace(/\s+/g, '_');
        if (normalizedHeader === normalizedPossible) {
          mapping.set(header, fieldName);
          break;
        }
      }
    }
  }

  return mapping;
}

/**
 * Map a raw row value to a record field using the column mapping.
 */
function mapRow(
  row: Record<string, string>,
  mapping: Map<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    const fieldName = mapping.get(header);
    if (fieldName) {
      result[fieldName] = value;
    }
  }
  return result;
}

// ============================================================================
// Value Parsing
// ============================================================================

/**
 * Parse a "mentioned" value from various formats.
 * Accepts: "yes", "no", "ja", "nee", "true", "false", "1", "0"
 */
function parseMentioned(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase().trim();
  return ['yes', 'ja', 'true', '1'].includes(lower);
}

/**
 * Parse a numeric value, returning null if not parseable.
 */
function parseOptionalFloat(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseFloat(value.replace(',', '.'));
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse a JSON-like string value into an array.
 * Handles comma-separated values and JSON arrays.
 */
function parseStringArray(value: string | undefined): string | null {
  if (!value || value.trim().length === 0) return null;

  const trimmed = value.trim();

  // Try parsing as JSON
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch {
      // Not valid JSON, fall through
    }
  }

  // Treat as comma-separated
  const items = trimmed
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return items.length > 0 ? JSON.stringify(items) : null;
}

/**
 * Parse a date string into a Date object.
 */
function parseDate(value: string | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

// ============================================================================
// Main Import Function
// ============================================================================

/**
 * Import AI visibility results from CSV content.
 *
 * Expected columns (flexible Dutch/English names):
 * - prompt, response, platform, model, date, mentioned (yes/no),
 *   urls, sources, competitors, sentiment, accuracy, confidence,
 *   country, language
 *
 * @param projectId - The project to import results for
 * @param csvContent - The raw CSV content as a string
 * @returns Import result with counts and errors
 */
export async function importAIVisibilityCSV(
  projectId: string,
  csvContent: string
): Promise<AIVisibilityImportResult> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  // Generate a unique batch ID for this import
  const batchId = `csv_${projectId}_${Date.now()}`;

  // Parse CSV
  const rows = parseCSV(csvContent);
  if (rows.length === 0) {
    return {
      imported: 0,
      skipped: 0,
      errors: ['CSV-bestand bevat geen geldige rijen.'],
      batchId,
    };
  }

  // Map columns
  const headers = Object.keys(rows[0]);
  const columnMapping = mapColumns(headers);

  // Check for required prompt column
  const hasPromptColumn = Array.from(columnMapping.values()).includes('prompt');
  if (!hasPromptColumn) {
    return {
      imported: 0,
      skipped: 0,
      errors: [
        'Kolom "prompt" ontbreekt. Vereiste kolommen: prompt, mentioned.',
      ],
      batchId,
    };
  }

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const mapped = mapRow(rawRow, columnMapping);

    // Validate required fields
    if (!mapped.prompt || mapped.prompt.trim().length === 0) {
      errors.push(`Rij ${i + 2}: prompt is leeg, rij overgeslagen.`);
      skipped++;
      continue;
    }

    const isMentioned = parseMentioned(mapped.mentioned);
    const accuracy = parseOptionalFloat(mapped.accuracy);
    const confidence = parseOptionalFloat(mapped.confidence);
    const mentionedUrls = parseStringArray(mapped.urls);
    const mentionedSources = parseStringArray(mapped.sources);
    const competitorMentions = parseStringArray(mapped.competitors);
    const testDate = parseDate(mapped.date);

    try {
      await db.aIVisibilityResult.create({
        data: {
          projectId,
          promptId: null, // CSV imports are not linked to prompt library by default
          method: 'CSV_IMPORT',
          platform: mapped.platform?.trim() || null,
          model: mapped.model?.trim() || null,
          promptText: mapped.prompt.trim(),
          response: mapped.response?.trim() || null,
          testDate,
          country: mapped.country?.trim() || 'NL',
          language: mapped.language?.trim() || 'nl-NL',
          isMentioned,
          mentionedUrls,
          mentionedSources,
          competitorMentions,
          sentiment: mapped.sentiment?.trim()?.toLowerCase() || null,
          accuracy: accuracy !== null ? Math.min(1, Math.max(0, accuracy)) : null,
          confidence: confidence !== null ? Math.min(1, Math.max(0, confidence)) : null,
          isSimulation: false,
          simulationNote: null,
          importBatch: batchId,
        },
      });
      imported++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Rij ${i + 2}: fout bij importeren — ${msg}`);
      skipped++;
    }
  }

  return { imported, skipped, errors, batchId };
}
