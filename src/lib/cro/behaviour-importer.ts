// ============================================================================
// CRO & Behaviour — Behaviour Importer
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Imports behaviour data from CSV files and individual records.
// Supports flexible column mapping (Dutch/English), automatic date parsing,
// and batch import tracking. All error messages are in Dutch.
// All functions verify projectId for tenant isolation.
// ============================================================================

import { db } from '@/lib/db';
import { BehaviourType } from '@prisma/client';
import type { BehaviourImportData } from './types';

// ============================================================================
// CSV Column Mapping
// ============================================================================

/**
 * Flexible column mapping for behaviour CSV imports.
 * Each field maps to an array of possible header names (Dutch & English).
 */
const COLUMN_ALIASES: Record<string, keyof BehaviourImportData> = {};

const DEFAULT_COLUMN_MAPPINGS: Record<keyof BehaviourImportData, string[]> = {
  behaviourType: ['type', 'behaviour_type', 'gedrag_type', 'gedragstype'],
  pageUrl: ['pagina', 'page_url', 'url', 'page', 'paginanurl'],
  element: ['element', 'selector', 'css_selector'],
  value: ['wade', 'waarde', 'value', 'percentage', 'score'],
  metadata: ['metadata', 'meta', 'extra', 'aanvullend'],
  sessionId: ['sessie', 'session_id', 'session', 'sessie_id'],
  deviceType: ['apparaat', 'device_type', 'device', 'apparaattype'],
  recordedAt: ['datum', 'date', 'recorded_at', 'timestamp', 'tijd', 'tijd stip'],
};

// Build the alias map
for (const [field, aliases] of Object.entries(DEFAULT_COLUMN_MAPPINGS)) {
  for (const alias of aliases) {
    COLUMN_ALIASES[alias.toLowerCase().replace(/[\s-]+/g, '_')] =
      field as keyof BehaviourImportData;
  }
  COLUMN_ALIASES[field.toLowerCase()] = field as keyof BehaviourImportData;
}

// ============================================================================
// CSV Parsing Helpers
// ============================================================================

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
 * Supports: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, ISO datetime
 */
function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim().length === 0) return null;

  const trimmed = dateStr.trim();

  // Try ISO format first
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

  return null;
}

/**
 * Map a behaviour type string to the BehaviourType enum.
 * Supports both English enum values and Dutch labels.
 */
function mapBehaviourType(value: string): BehaviourType | null {
  const normalized = value.trim().toUpperCase().replace(/[-\s]+/g, '_');

  const typeMap: Record<string, BehaviourType> = {
    SCROLL_DEPTH: BehaviourType.SCROLL_DEPTH,
    CLICK: BehaviourType.CLICK,
    RAGE_CLICK: BehaviourType.RAGE_CLICK,
    DEAD_CLICK: BehaviourType.DEAD_CLICK,
    FORM_ABANDONMENT: BehaviourType.FORM_ABANDONMENT,
    DEVICE_TYPE: BehaviourType.DEVICE_TYPE,
    ENGAGEMENT: BehaviourType.ENGAGEMENT,
    // Dutch aliases
    SCROLL_DIEPTE: BehaviourType.SCROLL_DEPTH,
    WOEDEKLIK: BehaviourType.RAGE_CLICK,
    DODE_KLIK: BehaviourType.DEAD_CLICK,
    FORMULIER_AFBREKING: BehaviourType.FORM_ABANDONMENT,
    APPARAATTYPE: BehaviourType.DEVICE_TYPE,
    BETROKKENHEID: BehaviourType.ENGAGEMENT,
    KLIK: BehaviourType.CLICK,
  };

  return typeMap[normalized] ?? null;
}

// ============================================================================
// Project Verification
// ============================================================================

/**
 * Verify that a project exists and is not soft-deleted.
 * Throws an error in Dutch if the project is not found.
 */
async function verifyProject(projectId: string): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });

  if (!project) {
    throw new Error(`Project met ID "${projectId}" niet gevonden of verwijderd.`);
  }
}

// ============================================================================
// CSV Import
// ============================================================================

/**
 * Import behaviour data from a CSV file content string.
 * Supports flexible column names (Dutch/English) and maps them to
 * BehaviourImportData fields. Each row is validated and imported individually.
 *
 * @param projectId - The project ID for tenant isolation
 * @param csvContent - Raw CSV content as a string
 * @param source - Source identifier for the import (default: "import")
 * @returns Count of imported records and any errors
 */
export async function importBehaviourCSV(
  projectId: string,
  csvContent: string,
  source: string = 'import'
): Promise<{ imported: number; errors: string[] }> {
  await verifyProject(projectId);

  const lines = csvContent
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      imported: 0,
      errors: ['Geen geldige gegevens gevonden in het CSV-bestand. Het bestand moet een koptekst en minimaal één gegevensrij bevatten.'],
    };
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]).map(normalizeHeader);

  // Map headers to field names
  const fieldMap = new Map<number, keyof BehaviourImportData>();
  for (let i = 0; i < headers.length; i++) {
    const field = COLUMN_ALIASES[headers[i]];
    if (field) {
      fieldMap.set(i, field);
    }
  }

  // Generate batch ID
  const importBatch = `csv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  let imported = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const row: Partial<Record<keyof BehaviourImportData, string>> = {};
      for (let j = 0; j < values.length; j++) {
        const field = fieldMap.get(j);
        if (field) {
          row[field] = values[j]?.trim() ?? '';
        }
      }

      // behaviourType is required
      const behaviourTypeStr = row.behaviourType;
      if (!behaviourTypeStr) {
        errors.push(
          `Rij ${i + 1}: Gedragstype ontbreekt. Dit veld is verplicht.`
        );
        continue;
      }

      const behaviourType = mapBehaviourType(behaviourTypeStr);
      if (!behaviourType) {
        errors.push(
          `Rij ${i + 1}: Ongeldig gedragstype "${behaviourTypeStr}".`
        );
        continue;
      }

      const data: BehaviourImportData = {
        behaviourType,
      };

      if (row.pageUrl && row.pageUrl.length > 0) {
        data.pageUrl = row.pageUrl;
      }
      if (row.element && row.element.length > 0) {
        data.element = row.element;
      }
      if (row.value && row.value.length > 0) {
        const numValue = parseFloat(row.value);
        if (!isNaN(numValue)) {
          data.value = numValue;
        }
      }
      if (row.metadata && row.metadata.length > 0) {
        data.metadata = row.metadata;
      }
      if (row.sessionId && row.sessionId.length > 0) {
        data.sessionId = row.sessionId;
      }
      if (row.deviceType && row.deviceType.length > 0) {
        data.deviceType = row.deviceType;
      }
      if (row.recordedAt && row.recordedAt.length > 0) {
        const parsedDate = parseFlexibleDate(row.recordedAt);
        if (parsedDate) {
          data.recordedAt = parsedDate;
        }
      }

      await db.behaviourRecord.create({
        data: {
          projectId,
          behaviourType: data.behaviourType,
          pageUrl: data.pageUrl ?? null,
          element: data.element ?? null,
          value: data.value ?? null,
          metadata: data.metadata ?? null,
          sessionId: data.sessionId ?? null,
          deviceType: data.deviceType ?? null,
          source,
          importBatch,
          recordedAt: data.recordedAt ?? new Date(),
        },
      });

      imported++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Rij ${i + 1}: Fout bij importeren — ${msg}`);
    }
  }

  return { imported, errors };
}

// ============================================================================
// Single Record Import
// ============================================================================

/**
 * Import a single behaviour record into the database.
 *
 * @param projectId - The project ID for tenant isolation
 * @param data - Behaviour import data
 * @returns The created BehaviourRecord
 */
export async function importBehaviourRecord(
  projectId: string,
  data: BehaviourImportData
) {
  await verifyProject(projectId);

  return db.behaviourRecord.create({
    data: {
      projectId,
      behaviourType: data.behaviourType,
      pageUrl: data.pageUrl ?? null,
      element: data.element ?? null,
      value: data.value ?? null,
      metadata: data.metadata ?? null,
      sessionId: data.sessionId ?? null,
      deviceType: data.deviceType ?? null,
      source: 'first_party',
      recordedAt: data.recordedAt ?? new Date(),
    },
  });
}

// ============================================================================
// List Behaviour Records
// ============================================================================

/**
 * List behaviour records for a project with optional filters.
 * Supports filtering by behaviour type, page URL, and date range.
 * Results are paginated with limit/offset.
 *
 * @param projectId - The project ID for tenant isolation
 * @param filters - Optional filters for the query
 * @returns Paginated list of behaviour records with total count
 */
export async function listBehaviourRecords(
  projectId: string,
  filters?: {
    behaviourType?: BehaviourType;
    pageUrl?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<{ records: Awaited<ReturnType<typeof db.behaviourRecord.findMany>>; total: number }> {
  await verifyProject(projectId);

  const where: Record<string, unknown> = {
    projectId,
  };

  if (filters?.behaviourType) {
    where.behaviourType = filters.behaviourType;
  }

  if (filters?.pageUrl) {
    where.pageUrl = filters.pageUrl;
  }

  if (filters?.startDate || filters?.endDate) {
    const recordedAt: Record<string, Date> = {};
    if (filters.startDate) recordedAt.gte = filters.startDate;
    if (filters.endDate) recordedAt.lte = filters.endDate;
    where.recordedAt = recordedAt;
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const [records, total] = await Promise.all([
    db.behaviourRecord.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.behaviourRecord.count({ where }),
  ]);

  return { records, total };
}
