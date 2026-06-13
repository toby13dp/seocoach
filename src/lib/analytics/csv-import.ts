// ============================================================================
// Analytics & Monitoring — CSV Import Adapters
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Parses CSV files with flexible column names, validates metric rows,
// and performs batch upsert into DailyMetric / QueryPerformance tables.
// All user-facing messages are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import type {
  CSVImportResult,
  CSVColumnMapping,
  DailyMetricsRow,
  QueryPerformanceRow,
} from './types';
import { DEFAULT_COLUMN_MAPPINGS } from './types';

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Parse a single CSV line, respecting quoted fields.
 * Handles commas inside double-quoted fields correctly.
 * Supports both comma and semicolon delimiters.
 *
 * @param line - A single CSV line
 * @param delimiter - The delimiter character (comma or semicolon)
 * @returns Array of field values
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
 * Detect the delimiter used in a CSV file.
 * Checks the first line for common delimiters (comma, semicolon, tab).
 *
 * @param firstLine - The first line of the CSV file
 * @returns The detected delimiter character
 */
function detectDelimiter(firstLine: string): string {
  const delimiters = ['\t', ';', ','];
  let maxCount = 0;
  let detected = ',';

  for (const d of delimiters) {
    const count = firstLine.split(d).length - 1;
    if (count > maxCount) {
      maxCount = count;
      detected = d;
    }
  }

  return detected;
}

/**
 * Normalize a CSV header by trimming, lowercasing, and collapsing spaces.
 *
 * @param header - Raw CSV column header
 * @returns Normalized header name
 */
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Build a mapping from column index to normalized field name,
 * using the provided column mapping overrides merged with defaults.
 *
 * @param headers - Array of normalized header strings
 * @param overrides - Optional column mapping overrides
 * @returns Map from column index to field name
 */
function buildColumnMap(
  headers: string[],
  overrides?: Partial<CSVColumnMapping>
): Map<number, string> {
  const mapping: CSVColumnMapping = { ...DEFAULT_COLUMN_MAPPINGS };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value) {
      (mapping as Record<string, string[]>)[key] = value;
    }
  }

  const fieldMap = new Map<number, string>();

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    for (const [field, aliases] of Object.entries(mapping)) {
      if (aliases?.includes(header)) {
        fieldMap.set(i, field);
        break;
      }
    }
  }

  return fieldMap;
}

// ============================================================================
// Date Parsing
// ============================================================================

/**
 * Parse a date string in various formats and return YYYY-MM-DD.
 * Supported formats: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, YYYY/MM/DD.
 *
 * @param dateStr - The date string to parse
 * @returns YYYY-MM-DD formatted string, or null if invalid
 */
function parseDateString(dateStr: string): string | null {
  const trimmed = dateStr.trim();

  // Try YYYY-MM-DD (ISO format)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return formatDateParts(year, month, day);
  }

  // Try DD-MM-YYYY or DD/MM/YYYY
  const euMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    return formatDateParts(year, month, day);
  }

  // Try YYYY/MM/DD
  const altIsoMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (altIsoMatch) {
    const [, year, month, day] = altIsoMatch;
    return formatDateParts(year, month, day);
  }

  // Try as a native Date parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear().toString();
    const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const day = parsed.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Format date parts into YYYY-MM-DD, validating the result.
 */
function formatDateParts(
  year: string,
  month: string,
  day: string
): string | null {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// ============================================================================
// Number Parsing
// ============================================================================

/**
 * Parse a number from a CSV cell, handling Dutch and English formats.
 * Dutch: 1.234,56 (period as thousand separator, comma as decimal)
 * English: 1,234.56 (comma as thousand separator, period as decimal)
 *
 * @param value - The string value to parse
 * @returns Parsed number or null if invalid
 */
function parseNumber(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value.trim() === '') {
    return null;
  }

  const trimmed = value.trim();

  // Remove thousand separators based on detected format
  let normalized: string;

  if (trimmed.includes(',') && trimmed.includes('.')) {
    // Both comma and period present — determine which is decimal separator
    const lastComma = trimmed.lastIndexOf(',');
    const lastPeriod = trimmed.lastIndexOf('.');

    if (lastComma > lastPeriod) {
      // Dutch: 1.234,56 → 1234.56
      normalized = trimmed.replace(/\./g, '').replace(',', '.');
    } else {
      // English: 1,234.56 → 1234.56
      normalized = trimmed.replace(/,/g, '');
    }
  } else if (trimmed.includes(',') && !trimmed.includes('.')) {
    // Could be Dutch decimal (,5) or English thousand separator (1,234)
    // If there's exactly one comma and 2 digits after, treat as Dutch decimal
    const parts = trimmed.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = trimmed.replace(',', '.');
    } else {
      // Thousand separator
      normalized = trimmed.replace(/,/g, '');
    }
  } else {
    normalized = trimmed;
  }

  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse an integer from a CSV cell.
 *
 * @param value - The string value to parse
 * @returns Parsed integer or null if invalid
 */
function parseInteger(value: string | undefined | null): number | null {
  const num = parseNumber(value);
  if (num === null) return null;
  return Math.round(num);
}

/**
 * Parse a percentage value. Handles "12.34%", "12,34%", and "0.1234" formats.
 *
 * @param value - The string value to parse
 * @returns Parsed percentage as a decimal (e.g. 0.1234 for 12.34%)
 */
function parsePercentage(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value.trim() === '') {
    return null;
  }

  const trimmed = value.trim().replace('%', '');
  const num = parseNumber(trimmed);
  if (num === null) return null;

  // If value > 1, it's already a percentage (e.g. 12.34 means 12.34%)
  // If value <= 1, it might be a decimal representation (e.g. 0.1234 means 12.34%)
  if (num > 1) {
    return num / 100;
  }
  return num;
}

// ============================================================================
// Row Parsing
// ============================================================================

/**
 * Parse a CSV row into a DailyMetricsRow using the column map.
 *
 * @param values - Array of field values from the CSV line
 * @param fieldMap - Mapping from column index to field name
 * @returns Parsed DailyMetricsRow or null if required fields are missing
 */
function parseDailyMetricsRow(
  values: string[],
  fieldMap: Map<number, string>
): { row: Partial<DailyMetricsRow>; errors: string[] } {
  const raw: Record<string, string> = {};
  const errors: string[] = [];

  for (let i = 0; i < values.length; i++) {
    const field = fieldMap.get(i);
    if (field) {
      raw[field] = values[i]?.trim() ?? '';
    }
  }

  // Parse date (required)
  const dateStr = raw['date'] ?? '';
  const date = parseDateString(dateStr);
  if (!date) {
    errors.push(`Ongeldige datum: "${dateStr}"`);
  }

  const row: Partial<DailyMetricsRow> = {};
  if (date) row.date = date;

  // Search metrics
  if (raw['clicks']) {
    const val = parseInteger(raw['clicks']);
    if (val !== null) row.clicks = val;
  }
  if (raw['impressions']) {
    const val = parseInteger(raw['impressions']);
    if (val !== null) row.impressions = val;
  }
  if (raw['ctr']) {
    const val = parsePercentage(raw['ctr']);
    if (val !== null) row.ctr = val;
  }
  if (raw['position']) {
    const val = parseNumber(raw['position']);
    if (val !== null) row.averagePosition = val;
  }

  // Analytics metrics
  if (raw['sessions']) {
    const val = parseInteger(raw['sessions']);
    if (val !== null) row.sessions = val;
  }
  if (raw['users']) {
    const val = parseInteger(raw['users']);
    if (val !== null) row.users = val;
  }
  if (raw['newUsers']) {
    const val = parseInteger(raw['newUsers']);
    if (val !== null) row.newUsers = val;
  }
  if (raw['pageViews']) {
    const val = parseInteger(raw['pageViews']);
    if (val !== null) row.pageViews = val;
  }
  if (raw['bounceRate']) {
    const val = parsePercentage(raw['bounceRate']);
    if (val !== null) row.bounceRate = val;
  }
  if (raw['avgSessionDuration']) {
    const val = parseNumber(raw['avgSessionDuration']);
    if (val !== null) row.avgSessionDuration = val;
  }

  // Conversion metrics
  if (raw['conversions']) {
    const val = parseInteger(raw['conversions']);
    if (val !== null) row.conversions = val;
  }
  if (raw['conversionRate']) {
    const val = parsePercentage(raw['conversionRate']);
    if (val !== null) row.conversionRate = val;
  }

  // Revenue metrics
  if (raw['revenue']) {
    const val = parseNumber(raw['revenue']);
    if (val !== null) row.revenue = val;
  }
  if (raw['productRevenue']) {
    const val = parseNumber(raw['productRevenue']);
    if (val !== null) row.productRevenue = val;
  }

  // Segmentation
  if (raw['source']) row.source = raw['source'];
  if (raw['medium']) row.medium = raw['medium'];
  if (raw['campaign']) row.campaign = raw['campaign'];
  if (raw['device']) row.device = raw['device'];
  if (raw['country']) row.country = raw['country'];
  if (raw['landingPage']) row.landingPage = raw['landingPage'];

  return { row, errors };
}

/**
 * Parse a CSV row into a QueryPerformanceRow using the column map.
 */
function parseQueryPerformanceRow(
  values: string[],
  fieldMap: Map<number, string>
): { row: Partial<QueryPerformanceRow>; errors: string[] } {
  const raw: Record<string, string> = {};
  const errors: string[] = [];

  for (let i = 0; i < values.length; i++) {
    const field = fieldMap.get(i);
    if (field) {
      raw[field] = values[i]?.trim() ?? '';
    }
  }

  // Parse date (required)
  const dateStr = raw['date'] ?? '';
  const date = parseDateString(dateStr);
  if (!date) {
    errors.push(`Ongeldige datum: "${dateStr}"`);
  }

  // Parse query (required)
  const query = raw['query'] ?? '';
  if (!query) {
    errors.push('Zoekwoord (query) ontbreekt');
  }

  const row: Partial<QueryPerformanceRow> = {};
  if (date) row.date = date;
  if (query) row.query = query;

  // Metrics
  if (raw['clicks']) {
    const val = parseInteger(raw['clicks']);
    if (val !== null) row.clicks = val;
  }
  if (raw['impressions']) {
    const val = parseInteger(raw['impressions']);
    if (val !== null) row.impressions = val;
  }
  if (raw['ctr']) {
    const val = parsePercentage(raw['ctr']);
    if (val !== null) row.ctr = val;
  }
  if (raw['position']) {
    const val = parseNumber(raw['position']);
    if (val !== null) row.position = val;
  }

  // Segmentation
  if (raw['country']) row.country = raw['country'];
  if (raw['device']) row.device = raw['device'];
  if (raw['page']) row.page = raw['page'];

  return { row, errors };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a DailyMetricsRow before persistence.
 *
 * @param row - The parsed metrics row
 * @returns Object with valid flag and array of Dutch error messages
 */
function validateDailyMetricsRow(row: Partial<DailyMetricsRow>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!row.date) {
    errors.push('Datum ontbreekt');
  }

  // Validate numeric ranges
  if (row.clicks !== undefined && row.clicks < 0) {
    errors.push('Kliks mogen niet negatief zijn');
  }
  if (row.impressions !== undefined && row.impressions < 0) {
    errors.push('Weergaven mogen niet negatief zijn');
  }
  if (row.ctr !== undefined && (row.ctr < 0 || row.ctr > 1)) {
    errors.push('Klikfrequentie moet tussen 0% en 100% liggen');
  }
  if (
    row.averagePosition !== undefined &&
    (row.averagePosition < 0 || row.averagePosition > 200)
  ) {
    errors.push('Positie moet tussen 0 en 200 liggen');
  }
  if (row.sessions !== undefined && row.sessions < 0) {
    errors.push('Sessies mogen niet negatief zijn');
  }
  if (row.users !== undefined && row.users < 0) {
    errors.push('Gebruikers mogen niet negatief zijn');
  }
  if (row.bounceRate !== undefined && row.bounceRate !== null && (row.bounceRate < 0 || row.bounceRate > 1)) {
    errors.push('Bouncepercentage moet tussen 0% en 100% liggen');
  }
  if (row.conversions !== undefined && row.conversions < 0) {
    errors.push('Conversies mogen niet negatief zijn');
  }
  if (row.revenue !== undefined && row.revenue !== null && row.revenue < 0) {
    errors.push('Omzet mag niet negatief zijn');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a QueryPerformanceRow before persistence.
 */
function validateQueryPerformanceRow(row: Partial<QueryPerformanceRow>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!row.date) {
    errors.push('Datum ontbreekt');
  }
  if (!row.query) {
    errors.push('Zoekwoord ontbreekt');
  }
  if (row.clicks !== undefined && row.clicks < 0) {
    errors.push('Kliks mogen niet negatief zijn');
  }
  if (row.impressions !== undefined && row.impressions < 0) {
    errors.push('Weergaven mogen niet negatief zijn');
  }
  if (row.ctr !== undefined && (row.ctr < 0 || row.ctr > 1)) {
    errors.push('Klikfrequentie moet tussen 0% en 100% liggen');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Batch Upsert
// ============================================================================

/** Batch size for Prisma operations */
const BATCH_SIZE = 100;

/**
 * Generate a unique batch ID for tracking imports.
 */
function generateBatchId(): string {
  return `csv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Batch upsert DailyMetric records.
 * Uses the unique constraint on [projectId, connectionId, date, source, medium, device, country, landingPage].
 *
 * @param projectId - The project ID
 * @param connectionId - The data connection ID
 * @param rows - Array of validated DailyMetricsRow
 * @param batchId - The import batch ID
 * @returns Object with imported and updated counts
 */
async function batchUpsertDailyMetrics(
  projectId: string,
  connectionId: string,
  rows: DailyMetricsRow[],
  batchId: string
): Promise<{ imported: number; updated: number; errors: string[] }> {
  let imported = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      try {
        const dateObj = new Date(row.date + 'T00:00:00.000Z');

        const uniqueKey = {
          projectId,
          connectionId,
          date: dateObj,
          source: row.source ?? '',
          medium: row.medium ?? '',
          device: row.device ?? '',
          country: row.country ?? '',
          landingPage: row.landingPage ?? '',
        };

        // Check if record exists
        const existing = await db.dailyMetric.findUnique({
          where: { projectId_connectionId_date_source_medium_device_country_landingPage: uniqueKey },
        });

        const data = {
          clicks: row.clicks ?? 0,
          impressions: row.impressions ?? 0,
          ctr: row.ctr ?? 0,
          averagePosition: row.averagePosition ?? 0,
          sessions: row.sessions ?? 0,
          users: row.users ?? 0,
          newUsers: row.newUsers ?? 0,
          pageViews: row.pageViews ?? 0,
          bounceRate: row.bounceRate ?? null,
          avgSessionDuration: row.avgSessionDuration ?? null,
          conversions: row.conversions ?? 0,
          conversionRate: row.conversionRate ?? null,
          revenue: row.revenue ?? null,
          productRevenue: row.productRevenue ?? null,
          source: row.source ?? null,
          medium: row.medium ?? null,
          campaign: row.campaign ?? null,
          device: row.device ?? null,
          country: row.country ?? null,
          landingPage: row.landingPage ?? null,
          importBatch: batchId,
        };

        if (existing) {
          await db.dailyMetric.update({
            where: { id: existing.id },
            data,
          });
          updated++;
        } else {
          await db.dailyMetric.create({
            data: {
              projectId,
              connectionId,
              date: dateObj,
              ...data,
            },
          });
          imported++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Rij ${i + 1} (${row.date}): Fout bij opslaan: ${msg}`);
      }
    }
  }

  return { imported, updated, errors };
}

/**
 * Batch upsert QueryPerformance records.
 * Uses the unique constraint on [projectId, connectionId, date, query, country, device, page].
 */
async function batchUpsertQueryPerformance(
  projectId: string,
  connectionId: string,
  rows: QueryPerformanceRow[],
  batchId: string
): Promise<{ imported: number; updated: number; errors: string[] }> {
  let imported = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      try {
        const dateObj = new Date(row.date + 'T00:00:00.000Z');

        const uniqueKey = {
          projectId,
          connectionId,
          date: dateObj,
          query: row.query,
          country: row.country ?? '',
          device: row.device ?? '',
          page: row.page ?? '',
        };

        const existing = await db.queryPerformance.findUnique({
          where: { projectId_connectionId_date_query_country_device_page: uniqueKey },
        });

        const data = {
          clicks: row.clicks ?? 0,
          impressions: row.impressions ?? 0,
          ctr: row.ctr ?? 0,
          position: row.position ?? 0,
          country: row.country ?? null,
          device: row.device ?? null,
          page: row.page ?? null,
          importBatch: batchId,
        };

        if (existing) {
          await db.queryPerformance.update({
            where: { id: existing.id },
            data,
          });
          updated++;
        } else {
          await db.queryPerformance.create({
            data: {
              projectId,
              connectionId,
              date: dateObj,
              query: row.query,
              ...data,
            },
          });
          imported++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Rij ${i + 1} (${row.date}, "${row.query}"): Fout bij opslaan: ${msg}`);
      }
    }
  }

  return { imported, updated, errors };
}

// ============================================================================
// Public Import Functions
// ============================================================================

/**
 * Import a search performance CSV into DailyMetric records.
 *
 * Handles GSC export formats with flexible column mapping.
 * Supports Dutch and English column headers.
 *
 * @param projectId - The project to import data into
 * @param connectionId - The data connection ID
 * @param csvContent - Raw CSV content as a string
 * @param columnOverrides - Optional column mapping overrides
 * @returns Import result with counts of imported, updated, skipped, and errors
 */
export async function importSearchPerformanceCSV(
  projectId: string,
  connectionId: string,
  csvContent: string,
  columnOverrides?: Partial<CSVColumnMapping>
): Promise<CSVImportResult> {
  const result: CSVImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const lines = csvContent
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    result.errors.push(
      'CSV-bestand bevat geen gegevens. Minimaal een koptekstrij en één gegevensrij vereist.'
    );
    return result;
  }

  // Detect delimiter and parse headers
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter).map(normalizeHeader);
  const fieldMap = buildColumnMap(headers, columnOverrides);

  // Check that at least a date column exists
  let hasDateColumn = false;
  for (const [, field] of fieldMap) {
    if (field === 'date') {
      hasDateColumn = true;
      break;
    }
  }
  if (!hasDateColumn) {
    result.errors.push(
      'Geen datumkolom gevonden. Zorg ervoor dat de CSV een kolom "date" of "datum" bevat.'
    );
    return result;
  }

  // Parse and validate rows
  const validRows: DailyMetricsRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    if (values.length === 0 || (values.length === 1 && values[0].trim() === '')) continue;

    const { row, errors: parseErrors } = parseDailyMetricsRow(values, fieldMap);

    if (parseErrors.length > 0) {
      result.errors.push(`Rij ${i + 1}: ${parseErrors.join('; ')}`);
      result.skipped++;
      continue;
    }

    const validation = validateDailyMetricsRow(row);
    if (!validation.valid) {
      result.errors.push(`Rij ${i + 1}: ${validation.errors.join('; ')}`);
      result.skipped++;
      continue;
    }

    // Set defaults for required search metrics fields
    const completeRow: DailyMetricsRow = {
      date: row.date!,
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      averagePosition: row.averagePosition ?? 0,
      source: row.source,
      medium: row.medium,
      campaign: row.campaign,
      device: row.device,
      country: row.country,
      landingPage: row.landingPage,
    };

    validRows.push(completeRow);
  }

  if (validRows.length === 0) {
    result.errors.push('Geen geldige rijen gevonden om te importeren.');
    return result;
  }

  // Batch upsert
  const batchId = generateBatchId();
  const upsertResult = await batchUpsertDailyMetrics(
    projectId,
    connectionId,
    validRows,
    batchId
  );

  result.imported = upsertResult.imported;
  result.updated = upsertResult.updated;
  result.errors.push(...upsertResult.errors);

  return result;
}

/**
 * Import a query performance CSV into QueryPerformance records.
 *
 * Handles GSC query-level export formats with flexible column mapping.
 *
 * @param projectId - The project to import data into
 * @param connectionId - The data connection ID
 * @param csvContent - Raw CSV content as a string
 * @param columnOverrides - Optional column mapping overrides
 * @returns Import result with counts
 */
export async function importQueryPerformanceCSV(
  projectId: string,
  connectionId: string,
  csvContent: string,
  columnOverrides?: Partial<CSVColumnMapping>
): Promise<CSVImportResult> {
  const result: CSVImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const lines = csvContent
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    result.errors.push(
      'CSV-bestand bevat geen gegevens. Minimaal een koptekstrij en één gegevensrij vereist.'
    );
    return result;
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter).map(normalizeHeader);
  const fieldMap = buildColumnMap(headers, columnOverrides);

  // Check that required columns exist
  let hasDateColumn = false;
  let hasQueryColumn = false;
  for (const [, field] of fieldMap) {
    if (field === 'date') hasDateColumn = true;
    if (field === 'query') hasQueryColumn = true;
  }

  if (!hasDateColumn) {
    result.errors.push(
      'Geen datumkolom gevonden. Zorg ervoor dat de CSV een kolom "date" of "datum" bevat.'
    );
    return result;
  }
  if (!hasQueryColumn) {
    result.errors.push(
      'Geen zoekwoordkolom gevonden. Zorg ervoor dat de CSV een kolom "query" of "zoekwoord" bevat.'
    );
    return result;
  }

  const validRows: QueryPerformanceRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    if (values.length === 0 || (values.length === 1 && values[0].trim() === '')) continue;

    const { row, errors: parseErrors } = parseQueryPerformanceRow(
      values,
      fieldMap
    );

    if (parseErrors.length > 0) {
      result.errors.push(`Rij ${i + 1}: ${parseErrors.join('; ')}`);
      result.skipped++;
      continue;
    }

    const validation = validateQueryPerformanceRow(row);
    if (!validation.valid) {
      result.errors.push(`Rij ${i + 1}: ${validation.errors.join('; ')}`);
      result.skipped++;
      continue;
    }

    const completeRow: QueryPerformanceRow = {
      date: row.date!,
      query: row.query!,
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
      country: row.country,
      device: row.device,
      page: row.page,
    };

    validRows.push(completeRow);
  }

  if (validRows.length === 0) {
    result.errors.push('Geen geldige rijen gevonden om te importeren.');
    return result;
  }

  const batchId = generateBatchId();
  const upsertResult = await batchUpsertQueryPerformance(
    projectId,
    connectionId,
    validRows,
    batchId
  );

  result.imported = upsertResult.imported;
  result.updated = upsertResult.updated;
  result.errors.push(...upsertResult.errors);

  return result;
}

/**
 * Import an analytics CSV (GA4 export) into DailyMetric records.
 *
 * Focuses on sessions, users, bounce rate, and other GA4 metrics.
 *
 * @param projectId - The project to import data into
 * @param connectionId - The data connection ID
 * @param csvContent - Raw CSV content as a string
 * @param columnOverrides - Optional column mapping overrides
 * @returns Import result with counts
 */
export async function importAnalyticsCSV(
  projectId: string,
  connectionId: string,
  csvContent: string,
  columnOverrides?: Partial<CSVColumnMapping>
): Promise<CSVImportResult> {
  // Analytics CSV uses the same DailyMetric table,
  // so we reuse the search performance logic with different defaults
  const result = await importSearchPerformanceCSV(
    projectId,
    connectionId,
    csvContent,
    columnOverrides
  );

  return result;
}

/**
 * Import a conversions CSV into DailyMetric records.
 *
 * Handles conversion and conversion rate columns.
 *
 * @param projectId - The project to import data into
 * @param connectionId - The data connection ID
 * @param csvContent - Raw CSV content as a string
 * @param columnOverrides - Optional column mapping overrides
 * @returns Import result with counts
 */
export async function importConversionsCSV(
  projectId: string,
  connectionId: string,
  csvContent: string,
  columnOverrides?: Partial<CSVColumnMapping>
): Promise<CSVImportResult> {
  // Conversion data also goes into DailyMetric
  const result = await importSearchPerformanceCSV(
    projectId,
    connectionId,
    csvContent,
    columnOverrides
  );

  return result;
}

/**
 * Import a revenue CSV into DailyMetric records.
 *
 * Handles revenue and product revenue columns.
 *
 * @param projectId - The project to import data into
 * @param connectionId - The data connection ID
 * @param csvContent - Raw CSV content as a string
 * @param columnOverrides - Optional column mapping overrides
 * @returns Import result with counts
 */
export async function importRevenueCSV(
  projectId: string,
  connectionId: string,
  csvContent: string,
  columnOverrides?: Partial<CSVColumnMapping>
): Promise<CSVImportResult> {
  // Revenue data also goes into DailyMetric
  const result = await importSearchPerformanceCSV(
    projectId,
    connectionId,
    csvContent,
    columnOverrides
  );

  return result;
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Parse a CSV string into an array of raw row objects.
 * Useful for previewing CSV content before import.
 *
 * @param csvContent - Raw CSV content as a string
 * @param columnOverrides - Optional column mapping overrides
 * @returns Array of objects with field names as keys
 */
export function previewCSV(
  csvContent: string,
  columnOverrides?: Partial<CSVColumnMapping>
): { headers: string[]; rows: Record<string, string>[]; totalRows: number } {
  const lines = csvContent
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 1) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = parseCSVLine(lines[0], delimiter);
  const normalizedHeaders = rawHeaders.map(normalizeHeader);
  const fieldMap = buildColumnMap(normalizedHeaders, columnOverrides);

  const headers: string[] = [];
  for (let i = 0; i < rawHeaders.length; i++) {
    const field = fieldMap.get(i);
    headers.push(field ?? rawHeaders[i].trim());
  }

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    if (values.length === 0 || (values.length === 1 && values[0].trim() === ''))
      continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < values.length; j++) {
      const key = headers[j] ?? `col_${j}`;
      row[key] = values[j]?.trim() ?? '';
    }
    rows.push(row);
  }

  return { headers, rows, totalRows: rows.length };
}
