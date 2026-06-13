// ============================================================================
// Authority — Manager
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages authority records: add, query, CSV import, mark as lost, and summary.
// Provider-neutral: works with data from Ahrefs, Moz, or any CSV source.
// ============================================================================

import { db } from '@/lib/db';
import type { AuthorityRecordType } from '@prisma/client';
import type {
  AuthorityRecordFilters,
  AuthorityImportResult,
  AuthoritySummary,
} from './types';
import { AUTHORITY_CSV_COLUMNS } from './types';

// ============================================================================
// Record Management
// ============================================================================

/**
 * Add a new authority record.
 *
 * @param projectId - The project to add the record for
 * @param data - Authority record data
 * @returns The created AuthorityRecord
 */
export async function addAuthorityRecord(
  projectId: string,
  data: {
    type: AuthorityRecordType;
    sourceUrl?: string;
    targetUrl?: string;
    anchorText?: string;
    domain?: string;
    discoveredAt?: Date;
    domainAuthority?: number;
    pageAuthority?: number;
    isNofollow?: boolean;
    notes?: string;
    campaignId?: string;
    status?: string;
    providerSource?: string;
  }
) {
  return db.authorityRecord.create({
    data: {
      projectId,
      type: data.type,
      sourceUrl: data.sourceUrl ?? null,
      targetUrl: data.targetUrl ?? null,
      anchorText: data.anchorText ?? null,
      domain: data.domain ?? null,
      discoveredAt: data.discoveredAt ?? new Date(),
      domainAuthority: data.domainAuthority ?? null,
      pageAuthority: data.pageAuthority ?? null,
      isNofollow: data.isNofollow ?? false,
      notes: data.notes ?? null,
      campaignId: data.campaignId ?? null,
      status: data.status ?? 'active',
      providerSource: data.providerSource ?? null,
    },
  });
}

/**
 * Query authority records with filters.
 *
 * @param projectId - The project to query records for
 * @param filters - Optional filters
 * @returns Array of authority records
 */
export async function getAuthorityRecords(
  projectId: string,
  filters?: AuthorityRecordFilters
) {
  const where: Record<string, unknown> = {
    projectId,
    deletedAt: null,
  };

  if (filters?.type) where.type = filters.type;
  if (filters?.status) where.status = filters.status;
  if (filters?.domain) where.domain = { contains: filters.domain };
  if (filters?.campaignId) where.campaignId = filters.campaignId;

  if (filters?.discoveredAfter || filters?.discoveredBefore) {
    const discoveredAtFilter: Record<string, Date> = {};
    if (filters.discoveredAfter) discoveredAtFilter.gte = filters.discoveredAfter;
    if (filters.discoveredBefore) discoveredAtFilter.lte = filters.discoveredBefore;
    where.discoveredAt = discoveredAtFilter;
  }

  return db.authorityRecord.findMany({
    where,
    orderBy: { discoveredAt: 'desc' },
    take: filters?.limit ?? 50,
    skip: filters?.offset ?? 0,
  });
}

/**
 * Mark an authority record as lost.
 * Sets status to "lost" and records the lostAt date.
 *
 * @param recordId - The record to mark as lost
 * @returns The updated authority record
 */
export async function markAsLost(recordId: string) {
  return db.authorityRecord.update({
    where: { id: recordId },
    data: {
      status: 'lost',
      lostAt: new Date(),
    },
  });
}

/**
 * Get a single authority record by ID.
 *
 * @param recordId - The record ID to retrieve
 * @returns The authority record or null
 */
export async function getAuthorityRecord(recordId: string) {
  return db.authorityRecord.findUnique({
    where: { id: recordId },
  });
}

/**
 * Update an authority record.
 *
 * @param recordId - The record to update
 * @param updates - Partial update data
 * @returns The updated authority record
 */
export async function updateAuthorityRecord(
  recordId: string,
  updates: {
    type?: AuthorityRecordType;
    sourceUrl?: string | null;
    targetUrl?: string | null;
    anchorText?: string | null;
    domain?: string | null;
    domainAuthority?: number | null;
    pageAuthority?: number | null;
    isNofollow?: boolean;
    notes?: string | null;
    campaignId?: string | null;
    status?: string;
  }
) {
  return db.authorityRecord.update({
    where: { id: recordId },
    data: updates,
  });
}

// ============================================================================
// CSV Import
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
 * Detect CSV delimiter.
 */
function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0] ?? '';
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Map CSV headers to our field names.
 */
function mapColumns(headers: string[]): Map<string, string> {
  const mapping = new Map<string, string>();

  for (const [fieldName, possibleNames] of Object.entries(AUTHORITY_CSV_COLUMNS)) {
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
 * Import authority/backlink data from CSV.
 *
 * Supports common export formats from Ahrefs, Moz, Semrush, etc.
 * Flexible column mapping for Dutch & English headers.
 *
 * @param projectId - The project to import data for
 * @param csvContent - The raw CSV content
 * @returns Import result with counts and errors
 */
export async function importAuthorityCSV(
  projectId: string,
  csvContent: string
): Promise<AuthorityImportResult> {
  const errors: string[] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  const batchId = `auth_${projectId}_${Date.now()}`;

  // Parse CSV
  const delimiter = detectDelimiter(csvContent);
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: ['CSV-bestand bevat geen geldige rijen.'],
      batchId,
    };
  }

  // Parse headers
  const headers = lines[0].split(delimiter).map((h) =>
    h.toLowerCase().trim().replace(/^["']|["']$/g, '')
  );
  const columnMapping = mapColumns(headers);

  // Check for minimum required columns
  const hasSourceOrDomain = Array.from(columnMapping.values()).some((f) =>
    ['sourceUrl', 'domain'].includes(f)
  );
  if (!hasSourceOrDomain) {
    return {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [
        'Kolom "source url" of "domain" ontbreekt. Minimaal één van beide is vereist.',
      ],
      batchId,
    };
  }

  // Process each row
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(delimiter).map((f) =>
      f.trim().replace(/^["']|["']$/g, '')
    );

    // Map fields
    const mapped: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < fields.length; j++) {
      const fieldName = columnMapping.get(headers[j]);
      if (fieldName) {
        mapped[fieldName] = fields[j];
      }
    }

    // Validate: need at least a source URL or domain
    if (!mapped.sourceUrl && !mapped.domain) {
      errors.push(`Rij ${i + 2}: geen bron-URL of domein gevonden, rij overgeslagen.`);
      skipped++;
      continue;
    }

    // Parse values
    const sourceUrl = mapped.sourceUrl?.trim() || null;
    const targetUrl = mapped.targetUrl?.trim() || null;
    const anchorText = mapped.anchorText?.trim() || null;
    const domain = mapped.domain?.trim() || (sourceUrl ? extractDomain(sourceUrl) : null);

    const domainAuthority = mapped.domainAuthority
      ? parseFloat(mapped.domainAuthority.replace(',', '.'))
      : null;
    const pageAuthority = mapped.pageAuthority
      ? parseFloat(mapped.pageAuthority.replace(',', '.'))
      : null;

    const isNofollow = mapped.isNofollow
      ? ['nofollow', 'no', 'n', 'true', '1'].includes(mapped.isNofollow.toLowerCase().trim())
      : false;

    const discoveredAt = mapped.discoveredAt
      ? parseDateSafe(mapped.discoveredAt)
      : new Date();

    const lostAt = mapped.lostAt ? parseDateSafe(mapped.lostAt) : null;
    const status = lostAt ? 'lost' : (mapped.status?.trim()?.toLowerCase() || 'active');

    // Determine record type
    const type: AuthorityRecordType = lostAt ? 'LOST_LINK' : 'BACKLINK';

    try {
      await db.authorityRecord.create({
        data: {
          projectId,
          type,
          sourceUrl,
          targetUrl,
          anchorText,
          domain,
          discoveredAt: discoveredAt ?? new Date(),
          lostAt,
          domainAuthority: domainAuthority !== null && !isNaN(domainAuthority)
            ? Math.min(100, Math.max(0, domainAuthority))
            : null,
          pageAuthority: pageAuthority !== null && !isNaN(pageAuthority)
            ? Math.min(100, Math.max(0, pageAuthority))
            : null,
          isNofollow,
          notes: mapped.notes?.trim() || null,
          status,
          providerSource: 'csv_import',
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

  return { imported, updated, skipped, errors, batchId };
}

// ============================================================================
// Summary
// ============================================================================

/**
 * Get an aggregated summary of authority records for a project.
 *
 * @param projectId - The project to get the summary for
 * @returns Summary with counts by type, status, and top domains
 */
export async function getAuthoritySummary(
  projectId: string
): Promise<AuthoritySummary> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [allRecords, newLinks, lostLinks] = await Promise.all([
    db.authorityRecord.findMany({
      where: { projectId, deletedAt: null },
      select: {
        type: true,
        status: true,
        domain: true,
      },
    }),
    db.authorityRecord.count({
      where: {
        projectId,
        deletedAt: null,
        type: 'NEW_LINK',
        discoveredAt: { gte: thirtyDaysAgo },
      },
    }),
    db.authorityRecord.count({
      where: {
        projectId,
        deletedAt: null,
        status: 'lost',
        lostAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  // Count by type
  const byType: Record<string, number> = {};
  for (const record of allRecords) {
    byType[record.type] = (byType[record.type] ?? 0) + 1;
  }

  // Count by status
  const byStatus: Record<string, number> = {};
  for (const record of allRecords) {
    byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
  }

  // Top domains
  const domainCounts: Record<string, number> = {};
  for (const record of allRecords) {
    if (record.domain) {
      domainCounts[record.domain] = (domainCounts[record.domain] ?? 0) + 1;
    }
  }
  const topDomains = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  return {
    total: allRecords.length,
    byType,
    byStatus,
    newLinks30Days: newLinks,
    lostLinks30Days: lostLinks,
    topDomains,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract domain from a URL string.
 */
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Safely parse a date string, returning null if invalid.
 */
function parseDateSafe(value: string): Date | null {
  if (!value || value.trim().length === 0) return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}
