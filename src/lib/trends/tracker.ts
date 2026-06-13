// ============================================================================
// Trends — Tracker
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Records trend data, queries trends, detects keyword trends,
// identifies seasonal patterns, and imports internal search data.
// ============================================================================

import { db } from '@/lib/db';
import type { TrendSourceType } from '@prisma/client';
import type {
  TrendFilters,
  InternalSearchImportResult,
  KeywordTrendResult,
  SeasonalTrendResult,
} from './types';

// ============================================================================
// Record & Query
// ============================================================================

/**
 * Record a new trend observation.
 *
 * @param projectId - The project to record the trend for
 * @param sourceType - The type of source that generated this trend signal
 * @param data - Trend data including keyword, topic, direction, and description
 * @returns The created TrendRecord
 */
export async function recordTrend(
  projectId: string,
  sourceType: TrendSourceType,
  data: {
    sourceId?: string;
    keyword?: string;
    topic?: string;
    trendDirection: string;
    magnitude?: number;
    description: string;
    evidence?: Record<string, unknown>;
    observedAt?: Date;
    expiresAt?: Date;
  }
) {
  return db.trendRecord.create({
    data: {
      projectId,
      sourceType,
      sourceId: data.sourceId ?? null,
      keyword: data.keyword ?? null,
      topic: data.topic ?? null,
      trendDirection: data.trendDirection,
      magnitude: data.magnitude ?? 0,
      description: data.description,
      evidence: data.evidence ? JSON.stringify(data.evidence) : null,
      observedAt: data.observedAt ?? new Date(),
      expiresAt: data.expiresAt ?? null,
    },
  });
}

/**
 * Query trend records with optional filters.
 *
 * @param projectId - The project to query trends for
 * @param filters - Optional filters
 * @returns Array of trend records
 */
export async function getTrends(projectId: string, filters?: TrendFilters) {
  const where: Record<string, unknown> = { projectId };

  if (filters?.sourceType) where.sourceType = filters.sourceType;
  if (filters?.trendDirection) where.trendDirection = filters.trendDirection;
  if (filters?.keyword) where.keyword = { contains: filters.keyword };
  if (filters?.topic) where.topic = { contains: filters.topic };

  if (filters?.observedAfter || filters?.observedBefore) {
    const observedAtFilter: Record<string, Date> = {};
    if (filters.observedAfter) observedAtFilter.gte = filters.observedAfter;
    if (filters.observedBefore) observedAtFilter.lte = filters.observedBefore;
    where.observedAt = observedAtFilter;
  }

  return db.trendRecord.findMany({
    where,
    orderBy: { observedAt: 'desc' },
    take: filters?.limit ?? 50,
    skip: filters?.offset ?? 0,
  });
}

// ============================================================================
// Keyword Trend Detection
// ============================================================================

/**
 * Analyze keyword data for trends (rising/declining).
 *
 * Looks at keyword search volume data over time to detect
 * significant changes that indicate rising or declining interest.
 *
 * Only creates trend records when sufficient data exists.
 *
 * @param projectId - The project to analyze keywords for
 * @returns Array of detected keyword trends
 */
export async function detectKeywordTrends(
  projectId: string
): Promise<KeywordTrendResult[]> {
  // Get keywords with search volume data
  const keywords = await db.keyword.findMany({
    where: {
      projectId,
      deletedAt: null,
      searchVolume: { not: null },
    },
    select: {
      id: true,
      keyword: true,
      searchVolume: true,
    },
  });

  const results: KeywordTrendResult[] = [];

  // Check for daily metrics that include query performance data
  const recentMetrics = await db.queryPerformance.findMany({
    where: { projectId },
    orderBy: { date: 'desc' },
    take: 90, // Last 90 days
    select: {
      query: true,
      clicks: true,
      impressions: true,
      date: true,
    },
  });

  if (recentMetrics.length === 0) {
    // No query performance data available — cannot detect trends
    return [];
  }

  // Group metrics by query
  const queryMetrics = new Map<string, Array<{ date: Date; clicks: number; impressions: number }>>();
  for (const metric of recentMetrics) {
    const existing = queryMetrics.get(metric.query) ?? [];
    existing.push({
      date: metric.date,
      clicks: metric.clicks,
      impressions: metric.impressions,
    });
    queryMetrics.set(metric.query, existing);
  }

  // Analyze each query for trends
  for (const [query, metrics] of queryMetrics.entries()) {
    if (metrics.length < 7) continue; // Need at least a week of data

    // Sort by date
    metrics.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Split into first half and second half
    const midPoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, midPoint);
    const secondHalf = metrics.slice(midPoint);

    const avgFirstHalfImpressions =
      firstHalf.reduce((sum, m) => sum + m.impressions, 0) / firstHalf.length;
    const avgSecondHalfImpressions =
      secondHalf.reduce((sum, m) => sum + m.impressions, 0) / secondHalf.length;

    // Calculate change percentage
    const changePercent =
      avgFirstHalfImpressions > 0
        ? ((avgSecondHalfImpressions - avgFirstHalfImpressions) /
            avgFirstHalfImpressions) *
          100
        : 0;

    // Only flag significant changes (>30% change)
    if (Math.abs(changePercent) < 30) continue;

    const direction = changePercent > 0 ? 'rising' : 'declining';
    const magnitude = Math.abs(changePercent);

    const result: KeywordTrendResult = {
      keyword: query,
      direction,
      magnitude,
      description:
        direction === 'rising'
          ? `"${query}" toont een stijgende trend met ${Math.round(magnitude)}% groei in weergaven.`
          : `"${query}" toont een dalende trend met ${Math.round(magnitude)}% afname in weergaven.`,
      evidence: {
        avgFirstHalfImpressions: Math.round(avgFirstHalfImpressions),
        avgSecondHalfImpressions: Math.round(avgSecondHalfImpressions),
        changePercent: Math.round(changePercent),
        dataPoints: metrics.length,
      },
    };

    results.push(result);

    // Record the trend
    await recordTrend(projectId, 'SEARCH_QUERY', {
      keyword: query,
      trendDirection: direction,
      magnitude,
      description: result.description,
      evidence: result.evidence,
    });
  }

  return results;
}

// ============================================================================
// Seasonal Trend Detection
// ============================================================================

/**
 * Identify seasonal patterns in keyword data.
 *
 * Looks for recurring patterns that follow seasonal cycles.
 * Requires at least 12 months of data for reliable detection.
 *
 * @param projectId - The project to analyze seasonal trends for
 * @returns Array of detected seasonal patterns
 */
export async function detectSeasonalTrends(
  projectId: string
): Promise<SeasonalTrendResult[]> {
  // Get query performance data spanning at least 12 months
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const metrics = await db.queryPerformance.findMany({
    where: {
      projectId,
      date: { gte: oneYearAgo },
    },
    orderBy: { date: 'asc' },
    select: {
      query: true,
      impressions: true,
      date: true,
    },
  });

  if (metrics.length === 0) return [];

  // Group by query and month
  const queryMonthlyData = new Map<
    string,
    Map<number, number[]>
  >(); // query -> month(1-12) -> impressions[]

  for (const metric of metrics) {
    const month = metric.date.getMonth() + 1; // 1-12
    const existing = queryMonthlyData.get(metric.query) ?? new Map();
    const monthData = existing.get(month) ?? [];
    monthData.push(metric.impressions);
    existing.set(month, monthData);
    queryMonthlyData.set(metric.query, existing);
  }

  const results: SeasonalTrendResult[] = [];

  for (const [query, monthlyData] of queryMonthlyData.entries()) {
    // Need at least 8 months of data
    if (monthlyData.size < 8) continue;

    // Calculate average impressions per month
    const monthlyAverages: Map<number, number> = new Map();
    for (const [month, impressions] of monthlyData.entries()) {
      monthlyAverages.set(
        month,
        impressions.reduce((sum, i) => sum + i, 0) / impressions.length
      );
    }

    // Find peak and trough months
    let peakMonth = 1;
    let troughMonth = 1;
    let peakValue = -Infinity;
    let troughValue = Infinity;

    for (const [month, avg] of monthlyAverages.entries()) {
      if (avg > peakValue) {
        peakValue = avg;
        peakMonth = month;
      }
      if (avg < troughValue) {
        troughValue = avg;
        troughMonth = month;
      }
    }

    // Calculate seasonality strength (ratio between peak and trough)
    const seasonalityRatio =
      troughValue > 0 ? peakValue / troughValue : 1;

    // Only flag significant seasonal patterns (ratio > 2.0)
    if (seasonalityRatio < 2.0) continue;

    const monthNames = [
      '', 'januari', 'februari', 'maart', 'april', 'mei', 'juni',
      'juli', 'augustus', 'september', 'oktober', 'november', 'december',
    ];

    const result: SeasonalTrendResult = {
      keyword: query,
      pattern: 'seasonal',
      peakMonth,
      troughMonth,
      description: `"${query}" vertoont een seizoenspatroon: piek in ${monthNames[peakMonth]}, dal in ${monthNames[troughMonth]}. Seizoensfactor: ${seasonalityRatio.toFixed(1)}x.`,
      evidence: {
        monthlyAverages: Object.fromEntries(monthlyAverages),
        seasonalityRatio: Math.round(seasonalityRatio * 10) / 10,
        peakMonth,
        troughMonth,
      },
    };

    results.push(result);

    // Record the trend
    await recordTrend(projectId, 'SEASONALITY', {
      keyword: query,
      trendDirection: 'seasonal',
      magnitude: seasonalityRatio,
      description: result.description,
      evidence: result.evidence,
    });
  }

  return results;
}

// ============================================================================
// Internal Search Import
// ============================================================================

/**
 * Import internal search data as trend records.
 *
 * Accepts CSV content with internal search queries.
 * Creates TREND records with sourceType=INTERNAL_SEARCH.
 *
 * Expected columns (flexible): query/zoekterm, count/aantal, date/datum
 *
 * @param projectId - The project to import data for
 * @param csvContent - The CSV content to import
 * @returns Import result with counts and errors
 */
export async function importInternalSearch(
  projectId: string,
  csvContent: string
): Promise<InternalSearchImportResult> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  // Detect delimiter
  const firstLine = csvContent.split('\n')[0] ?? '';
  const delimiter = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length
    ? ';'
    : ',';

  // Parse CSV
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      imported: 0,
      skipped: 0,
      errors: ['CSV-bestand bevat geen geldige rijen.'],
    };
  }

  // Parse headers
  const headers = lines[0].split(delimiter).map((h) =>
    h.toLowerCase().trim().replace(/^["']|["']$/g, '')
  );

  // Map headers to fields
  const queryCol = headers.findIndex((h) =>
    ['query', 'zoekterm', 'search_term', 'zoekwoord', 'term'].includes(h)
  );
  const countCol = headers.findIndex((h) =>
    ['count', 'aantal', 'volume', 'searches', 'zoekopdrachten', 'frequentie'].includes(h)
  );
  const dateCol = headers.findIndex((h) =>
    ['date', 'datum', 'dag', 'day'].includes(h)
  );

  if (queryCol === -1) {
    return {
      imported: 0,
      skipped: 0,
      errors: ['Kolom "query" of "zoekterm" ontbreekt in het CSV-bestand.'],
    };
  }

  // Process rows
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(delimiter).map((f) =>
      f.trim().replace(/^["']|["']$/g, '')
    );

    const query = fields[queryCol]?.trim();
    if (!query || query.length === 0) {
      errors.push(`Rij ${i + 1}: zoekterm is leeg, overgeslagen.`);
      skipped++;
      continue;
    }

    const count = countCol !== -1 ? parseInt(fields[countCol], 10) : 1;
    const dateStr = dateCol !== -1 ? fields[dateCol] : undefined;

    const observedAt = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(observedAt.getTime())) {
      errors.push(`Rij ${i + 1}: ongeldige datum "${dateStr}", huidige datum gebruikt.`);
    }

    try {
      await db.trendRecord.create({
        data: {
          projectId,
          sourceType: 'INTERNAL_SEARCH',
          keyword: query,
          trendDirection: 'rising', // Internal search data typically indicates rising interest
          magnitude: isNaN(count) ? 1 : count,
          description: `"${query}" werd ${isNaN(count) ? 1 : count} keer gezocht op de website.`,
          evidence: JSON.stringify({ count: isNaN(count) ? 1 : count, source: 'internal_search' }),
          observedAt: isNaN(observedAt.getTime()) ? new Date() : observedAt,
        },
      });
      imported++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Rij ${i + 1}: fout bij importeren — ${msg}`);
      skipped++;
    }
  }

  return { imported, skipped, errors };
}
