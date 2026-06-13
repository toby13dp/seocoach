// ============================================================================
// Analytics & Monitoring — Time-Series Calculation Library
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Queries DailyMetric and QueryPerformance tables to produce time-series,
// period comparisons, and dashboard data.
// Never fabricates data — only shows metrics when real data exists.
// All user-facing messages are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import type {
  MetricTimeSeries,
  PeriodComparison,
  AnalyticsDashboard,
  DataFreshnessInfo,
  SyncStatusInfo,
  MetricFilters,
  AggregationMethod,
  DeviceBreakdown,
  CountryBreakdown,
  LandingPagePerformanceRow,
  QueryPerformanceRow,
} from './types';

// ============================================================================
// Date Helpers
// ============================================================================

/**
 * Format a Date object as YYYY-MM-DD.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get a Date object from a YYYY-MM-DD string.
 */
function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z');
}

/**
 * Add days to a date and return a new Date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================================================
// Metric Field Mapping
// ============================================================================

/**
 * Map a metric key to the corresponding DailyMetric field name.
 * Returns the Prisma field name for use in queries.
 */
function getMetricField(metric: string): string {
  const fieldMap: Record<string, string> = {
    clicks: 'clicks',
    impressions: 'impressions',
    ctr: 'ctr',
    averagePosition: 'averagePosition',
    position: 'averagePosition',
    sessions: 'sessions',
    users: 'users',
    newUsers: 'newUsers',
    pageViews: 'pageViews',
    bounceRate: 'bounceRate',
    avgSessionDuration: 'avgSessionDuration',
    conversions: 'conversions',
    conversionRate: 'conversionRate',
    revenue: 'revenue',
    productRevenue: 'productRevenue',
  };
  return fieldMap[metric] ?? metric;
}

/**
 * Check if a metric uses average aggregation rather than sum.
 */
function isAverageMetric(metric: string): boolean {
  return [
    'ctr',
    'averagePosition',
    'position',
    'bounceRate',
    'avgSessionDuration',
    'conversionRate',
  ].includes(metric);
}

// ============================================================================
// Change Calculation
// ============================================================================

/**
 * Calculate the percentage change between two values.
 * Handles edge cases: division by zero, null values, and zero-to-zero.
 *
 * @param current - The current period value
 * @param previous - The previous period value
 * @returns Percentage change as a number, or null if undefined
 */
export function calculateChangePercentage(
  current: number | null,
  previous: number | null
): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Determine the direction of a change.
 *
 * @param change - The percentage change value
 * @returns 'up', 'down', or 'neutral'
 */
function getChangeDirection(
  change: number | null
): 'up' | 'down' | 'neutral' | null {
  if (change === null) return null;
  if (change > 0.5) return 'up';
  if (change < -0.5) return 'down';
  return 'neutral';
}

// ============================================================================
// Aggregation
// ============================================================================

/**
 * Aggregate an array of metric values using the specified method.
 *
 * @param values - Array of numeric values
 * @param method - Aggregation method ('sum' or 'average')
 * @returns Aggregated value
 */
export function aggregateMetrics(
  values: number[],
  method: AggregationMethod
): number {
  if (values.length === 0) return 0;

  if (method === 'average') {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  return values.reduce((sum, v) => sum + v, 0);
}

// ============================================================================
// Time-Series Calculation
// ============================================================================

/**
 * Calculate a time-series for a specific metric within a date range.
 *
 * Queries DailyMetric records and returns a MetricTimeSeries with
 * data points, totals, averages, and change calculations.
 * Only returns data when real data exists — never fabricates data.
 *
 * @param projectId - The project ID
 * @param metric - The metric key (e.g. 'clicks', 'sessions', 'ctr')
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param filters - Optional segmentation filters
 * @returns MetricTimeSeries with data points and aggregations
 */
export async function calculateTimeSeries(
  projectId: string,
  metric: string,
  startDate: string,
  endDate: string,
  filters?: MetricFilters
): Promise<MetricTimeSeries> {
  const field = getMetricField(metric);
  const useAverage = isAverageMetric(metric);

  const where: Record<string, unknown> = {
    projectId,
    date: {
      gte: parseDate(startDate),
      lte: parseDate(endDate),
    },
  };

  // Apply filters
  if (filters?.source) where.source = filters.source;
  if (filters?.medium) where.medium = filters.medium;
  if (filters?.campaign) where.campaign = filters.campaign;
  if (filters?.device) where.device = filters.device;
  if (filters?.country) where.country = filters.country;
  if (filters?.landingPage) where.landingPage = filters.landingPage;
  if (filters?.connectionId) where.connectionId = filters.connectionId;

  const records = await db.dailyMetric.findMany({
    where,
    select: {
      date: true,
      [field]: true,
    },
    orderBy: { date: 'asc' },
  });

  if (records.length === 0) {
    return {
      metric,
      dataPoints: [],
      total: 0,
      average: 0,
      change: null,
      changeDirection: null,
    };
  }

  // Group by date and aggregate (multiple records per day possible due to segmentation)
  const dateMap = new Map<string, number[]>();

  for (const record of records) {
    const dateKey = formatDate(record.date);
    const value = record[field as keyof typeof record];
    if (typeof value === 'number' && !isNaN(value)) {
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(value);
    }
  }

  // Build data points
  const dataPoints: { date: string; value: number }[] = [];
  for (const [date, values] of dateMap) {
    const aggregated = useAverage
      ? aggregateMetrics(values, 'average')
      : aggregateMetrics(values, 'sum');
    dataPoints.push({ date, value: Math.round(aggregated * 100) / 100 });
  }

  // Sort by date
  dataPoints.sort((a, b) => a.date.localeCompare(b.date));

  // Calculate totals
  const allValues = dataPoints.map((dp) => dp.value);
  const total = useAverage
    ? aggregateMetrics(allValues, 'average')
    : aggregateMetrics(allValues, 'sum');
  const average =
    allValues.length > 0
      ? allValues.reduce((sum, v) => sum + v, 0) / allValues.length
      : 0;

  // Calculate change vs previous period of equal length
  const periodDays =
    Math.ceil(
      (parseDate(endDate).getTime() - parseDate(startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1;
  const prevEnd = addDays(parseDate(startDate), -1);
  const prevStart = addDays(prevEnd, -(periodDays - 1));

  const previousTotal = await getMetricTotal(
    projectId,
    metric,
    formatDate(prevStart),
    formatDate(prevEnd),
    filters
  );

  const change = calculateChangePercentage(
    useAverage ? average : total,
    previousTotal
  );
  const changeDirection = getChangeDirection(change);

  return {
    metric,
    dataPoints,
    total: Math.round(total * 100) / 100,
    average: Math.round(average * 100) / 100,
    change: change !== null ? Math.round(change * 100) / 100 : null,
    changeDirection,
  };
}

/**
 * Get the total for a metric in a period (used for change calculations).
 */
async function getMetricTotal(
  projectId: string,
  metric: string,
  startDate: string,
  endDate: string,
  filters?: MetricFilters
): Promise<number | null> {
  const field = getMetricField(metric);
  const useAverage = isAverageMetric(metric);

  const where: Record<string, unknown> = {
    projectId,
    date: {
      gte: parseDate(startDate),
      lte: parseDate(endDate),
    },
  };

  if (filters?.source) where.source = filters.source;
  if (filters?.medium) where.medium = filters.medium;
  if (filters?.campaign) where.campaign = filters.campaign;
  if (filters?.device) where.device = filters.device;
  if (filters?.country) where.country = filters.country;
  if (filters?.landingPage) where.landingPage = filters.landingPage;
  if (filters?.connectionId) where.connectionId = filters.connectionId;

  const records = await db.dailyMetric.findMany({
    where,
    select: {
      [field]: true,
    },
  });

  if (records.length === 0) return null;

  const values: number[] = [];
  for (const record of records) {
    const raw = record[field as keyof typeof record];
    if (typeof raw === 'number' && !isNaN(raw)) {
      values.push(raw);
    }
  }

  if (values.length === 0) return null;

  return useAverage
    ? aggregateMetrics(values, 'average')
    : aggregateMetrics(values, 'sum');
}

// ============================================================================
// Period Comparison
// ============================================================================

/**
 * Calculate a comparison between two periods for a metric.
 *
 * @param projectId - The project ID
 * @param metric - The metric key
 * @param currentStart - Current period start (YYYY-MM-DD)
 * @param currentEnd - Current period end (YYYY-MM-DD)
 * @param previousStart - Previous period start (YYYY-MM-DD)
 * @param previousEnd - Previous period end (YYYY-MM-DD)
 * @param filters - Optional segmentation filters
 * @returns PeriodComparison with current, previous, and optional year-over-year
 */
export async function calculatePeriodComparison(
  projectId: string,
  metric: string,
  currentStart: string,
  currentEnd: string,
  previousStart: string,
  previousEnd: string,
  filters?: MetricFilters
): Promise<PeriodComparison> {
  const [current, previous] = await Promise.all([
    calculateTimeSeries(projectId, metric, currentStart, currentEnd, filters),
    calculateTimeSeries(
      projectId,
      metric,
      previousStart,
      previousEnd,
      filters
    ),
  ]);

  // Try year-over-year if possible
  let yearOverYear: MetricTimeSeries | null = null;
  try {
    const currentStartDt = parseDate(currentStart);
    const currentEndDt = parseDate(currentEnd);
    const yoyStart = formatDate(
      new Date(currentStartDt.getFullYear() - 1, currentStartDt.getMonth(), currentStartDt.getDate())
    );
    const yoyEnd = formatDate(
      new Date(currentEndDt.getFullYear() - 1, currentEndDt.getMonth(), currentEndDt.getDate())
    );

    yearOverYear = await calculateTimeSeries(
      projectId,
      metric,
      yoyStart,
      yoyEnd,
      filters
    );

    // If no data for YoY period, set to null
    if (yearOverYear.dataPoints.length === 0) {
      yearOverYear = null;
    }
  } catch {
    // Year-over-year is optional — don't fail the whole comparison
  }

  return {
    current,
    previous,
    yearOverYear,
  };
}

/**
 * Calculate year-over-year comparison for a metric.
 *
 * @param projectId - The project ID
 * @param metric - The metric key
 * @param currentStart - Current period start (YYYY-MM-DD)
 * @param currentEnd - Current period end (YYYY-MM-DD)
 * @param filters - Optional segmentation filters
 * @returns PeriodComparison with current vs same period last year
 */
export async function calculateYearOverYear(
  projectId: string,
  metric: string,
  currentStart: string,
  currentEnd: string,
  filters?: MetricFilters
): Promise<PeriodComparison | null> {
  const currentStartDt = parseDate(currentStart);
  const currentEndDt = parseDate(currentEnd);

  const yoyStart = formatDate(
    new Date(
      currentStartDt.getFullYear() - 1,
      currentStartDt.getMonth(),
      currentStartDt.getDate()
    )
  );
  const yoyEnd = formatDate(
    new Date(
      currentEndDt.getFullYear() - 1,
      currentEndDt.getMonth(),
      currentEndDt.getDate()
    )
  );

  // Check if YoY data exists
  const yoyCount = await db.dailyMetric.count({
    where: {
      projectId,
      date: {
        gte: parseDate(yoyStart),
        lte: parseDate(yoyEnd),
      },
      ...(filters?.connectionId ? { connectionId: filters.connectionId } : {}),
    },
  });

  if (yoyCount === 0) return null;

  return calculatePeriodComparison(
    projectId,
    metric,
    currentStart,
    currentEnd,
    yoyStart,
    yoyEnd,
    filters
  );
}

// ============================================================================
// Dashboard Data
// ============================================================================

/**
 * Get complete dashboard data for a project.
 *
 * Aggregates search performance, analytics, conversions, and revenue
 * metrics. Only includes sections where real data exists.
 *
 * @param projectId - The project ID
 * @param days - Number of days to look back (default 28)
 * @returns AnalyticsDashboard with all available metrics
 */
export async function getDashboardData(
  projectId: string,
  days: number = 28
): Promise<AnalyticsDashboard> {
  const endDate = formatDate(new Date());
  const startDate = formatDate(addDays(new Date(), -(days - 1)));

  // Calculate search performance metrics (always available if any data exists)
  const [clicks, impressions, ctr, position, dataFreshness, syncStatus] =
    await Promise.all([
      calculateTimeSeries(projectId, 'clicks', startDate, endDate),
      calculateTimeSeries(projectId, 'impressions', startDate, endDate),
      calculateTimeSeries(projectId, 'ctr', startDate, endDate),
      calculateTimeSeries(projectId, 'averagePosition', startDate, endDate),
      getDataFreshness(projectId),
      getSyncStatus(projectId),
    ]);

  const dashboard: AnalyticsDashboard = {
    searchPerformance: {
      clicks,
      impressions,
      ctr,
      position,
    },
    dataFreshness,
    syncStatus,
  };

  // Check if analytics data exists
  const sessionsCount = await db.dailyMetric.count({
    where: {
      projectId,
      date: { gte: parseDate(startDate), lte: parseDate(endDate) },
      sessions: { gt: 0 },
    },
  });

  if (sessionsCount > 0) {
    const [sessions, users, bounceRate] = await Promise.all([
      calculateTimeSeries(projectId, 'sessions', startDate, endDate),
      calculateTimeSeries(projectId, 'users', startDate, endDate),
      calculateTimeSeries(projectId, 'bounceRate', startDate, endDate),
    ]);

    dashboard.analytics = { sessions, users, bounceRate };
  }

  // Check if conversion data exists
  const conversionCount = await db.dailyMetric.count({
    where: {
      projectId,
      date: { gte: parseDate(startDate), lte: parseDate(endDate) },
      conversions: { gt: 0 },
    },
  });

  if (conversionCount > 0) {
    const [conversions, conversionRate] = await Promise.all([
      calculateTimeSeries(projectId, 'conversions', startDate, endDate),
      calculateTimeSeries(projectId, 'conversionRate', startDate, endDate),
    ]);

    dashboard.conversions = { conversions, conversionRate };
  }

  // Check if revenue data exists
  const revenueCount = await db.dailyMetric.count({
    where: {
      projectId,
      date: { gte: parseDate(startDate), lte: parseDate(endDate) },
      revenue: { not: null },
    },
  });

  if (revenueCount > 0) {
    const revenue = await calculateTimeSeries(
      projectId,
      'revenue',
      startDate,
      endDate
    );
    dashboard.revenue = { revenue };
  }

  return dashboard;
}

// ============================================================================
// Query & Page Performance
// ============================================================================

/**
 * Get top queries by clicks for a date range.
 *
 * @param projectId - The project ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param limit - Maximum number of results (default 20)
 * @returns Array of query performance entries
 */
export async function getTopQueries(
  projectId: string,
  startDate: string,
  endDate: string,
  limit: number = 20
): Promise<QueryPerformanceRow[]> {
  const records = await db.queryPerformance.findMany({
    where: {
      projectId,
      date: {
        gte: parseDate(startDate),
        lte: parseDate(endDate),
      },
    },
    select: {
      query: true,
      clicks: true,
      impressions: true,
      ctr: true,
      position: true,
    },
    orderBy: { clicks: 'desc' },
    take: limit * 5, // Get more to aggregate
  });

  if (records.length === 0) return [];

  // Aggregate by query
  const queryMap = new Map<
    string,
    { clicks: number; impressions: number; ctrValues: number[]; positionValues: number[] }
  >();

  for (const record of records) {
    const existing = queryMap.get(record.query);
    if (existing) {
      existing.clicks += record.clicks;
      existing.impressions += record.impressions;
      existing.ctrValues.push(record.ctr);
      existing.positionValues.push(record.position);
    } else {
      queryMap.set(record.query, {
        clicks: record.clicks,
        impressions: record.impressions,
        ctrValues: [record.ctr],
        positionValues: [record.position],
      });
    }
  }

  // Convert to array and sort
  const results: QueryPerformanceRow[] = Array.from(queryMap.entries())
    .map(([query, data]) => ({
      query,
      clicks: data.clicks,
      impressions: data.impressions,
      ctr:
        data.impressions > 0
          ? data.clicks / data.impressions
          : 0,
      position:
        data.positionValues.length > 0
          ? data.positionValues.reduce((s, v) => s + v, 0) /
            data.positionValues.length
          : 0,
      date: '', // Aggregated across dates
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit);

  return results;
}

/**
 * Get top landing pages by clicks for a date range.
 *
 * @param projectId - The project ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param limit - Maximum number of results (default 20)
 * @returns Array of landing page performance entries
 */
export async function getTopLandingPages(
  projectId: string,
  startDate: string,
  endDate: string,
  limit: number = 20
): Promise<LandingPagePerformanceRow[]> {
  const records = await db.dailyMetric.findMany({
    where: {
      projectId,
      date: {
        gte: parseDate(startDate),
        lte: parseDate(endDate),
      },
      landingPage: { not: null },
    },
    select: {
      landingPage: true,
      clicks: true,
      impressions: true,
      ctr: true,
      averagePosition: true,
      sessions: true,
      bounceRate: true,
    },
    orderBy: { clicks: 'desc' },
    take: limit * 5,
  });

  if (records.length === 0) return [];

  // Aggregate by landing page
  const pageMap = new Map<
    string,
    {
      clicks: number;
      impressions: number;
      ctrValues: number[];
      positionValues: number[];
      sessions: number;
      bounceRateValues: number[];
    }
  >();

  for (const record of records) {
    const page = record.landingPage ?? '(onbekend)';
    const existing = pageMap.get(page);
    if (existing) {
      existing.clicks += record.clicks;
      existing.impressions += record.impressions;
      existing.ctrValues.push(record.ctr);
      existing.positionValues.push(record.averagePosition);
      existing.sessions += record.sessions;
      if (record.bounceRate !== null) {
        existing.bounceRateValues.push(record.bounceRate);
      }
    } else {
      pageMap.set(page, {
        clicks: record.clicks,
        impressions: record.impressions,
        ctrValues: [record.ctr],
        positionValues: [record.averagePosition],
        sessions: record.sessions,
        bounceRateValues: record.bounceRate !== null ? [record.bounceRate] : [],
      });
    }
  }

  const results: LandingPagePerformanceRow[] = Array.from(pageMap.entries())
    .map(([landingPage, data]) => ({
      landingPage,
      clicks: data.clicks,
      impressions: data.impressions,
      ctr:
        data.impressions > 0
          ? data.clicks / data.impressions
          : 0,
      position:
        data.positionValues.length > 0
          ? data.positionValues.reduce((s, v) => s + v, 0) /
            data.positionValues.length
          : 0,
      sessions: data.sessions > 0 ? data.sessions : undefined,
      bounceRate:
        data.bounceRateValues.length > 0
          ? data.bounceRateValues.reduce((s, v) => s + v, 0) /
            data.bounceRateValues.length
          : null,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit);

  return results;
}

// ============================================================================
// Segmentation
// ============================================================================

/**
 * Get a metric broken down by device category.
 *
 * @param projectId - The project ID
 * @param metric - The metric key
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Array of device breakdowns
 */
export async function getMetricByDevice(
  projectId: string,
  metric: string,
  startDate: string,
  endDate: string
): Promise<DeviceBreakdown[]> {
  const field = getMetricField(metric);
  const useAverage = isAverageMetric(metric);

  // Dutch device labels
  const deviceLabels: Record<string, string> = {
    desktop: 'Desktop',
    mobile: 'Mobiel',
    tablet: 'Tablet',
  };

  const records = await db.dailyMetric.findMany({
    where: {
      projectId,
      date: {
        gte: parseDate(startDate),
        lte: parseDate(endDate),
      },
      device: { not: null },
    },
    select: {
      device: true,
      [field]: true,
    },
  });

  if (records.length === 0) return [];

  // Group by device
  const deviceMap = new Map<string, number[]>();
  for (const record of records) {
    const device = record.device ?? '(onbekend)';
    const value = record[field as keyof typeof record];
    if (typeof value === 'number' && !isNaN(value)) {
      if (!deviceMap.has(device)) {
        deviceMap.set(device, []);
      }
      deviceMap.get(device)!.push(value);
    }
  }

  const results: DeviceBreakdown[] = Array.from(deviceMap.entries())
    .map(([device, values]) => ({
      device,
      value: Math.round(
        (useAverage
          ? aggregateMetrics(values, 'average')
          : aggregateMetrics(values, 'sum')) *
          100
      ) / 100,
      label: deviceLabels[device.toLowerCase()] ?? device,
    }))
    .sort((a, b) => b.value - a.value);

  return results;
}

/**
 * Get a metric broken down by country.
 *
 * @param projectId - The project ID
 * @param metric - The metric key
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param limit - Maximum number of results (default 10)
 * @returns Array of country breakdowns
 */
export async function getMetricByCountry(
  projectId: string,
  metric: string,
  startDate: string,
  endDate: string,
  limit: number = 10
): Promise<CountryBreakdown[]> {
  const field = getMetricField(metric);
  const useAverage = isAverageMetric(metric);

  // Dutch country labels for common countries
  const countryLabels: Record<string, string> = {
    NLD: 'Nederland',
    BEL: 'België',
    DEU: 'Duitsland',
    GBR: 'Verenigd Koninkrijk',
    FRA: 'Frankrijk',
    USA: 'Verenigde Staten',
    nld: 'Nederland',
    bel: 'België',
    deu: 'Duitsland',
    gbr: 'Verenigd Koninkrijk',
    fra: 'Frankrijk',
    usa: 'Verenigde Staten',
    NL: 'Nederland',
    BE: 'België',
    DE: 'Duitsland',
    GB: 'Verenigd Koninkrijk',
    FR: 'Frankrijk',
    US: 'Verenigde Staten',
  };

  const records = await db.dailyMetric.findMany({
    where: {
      projectId,
      date: {
        gte: parseDate(startDate),
        lte: parseDate(endDate),
      },
      country: { not: null },
    },
    select: {
      country: true,
      [field]: true,
    },
  });

  if (records.length === 0) return [];

  // Group by country
  const countryMap = new Map<string, number[]>();
  for (const record of records) {
    const country = record.country ?? '(onbekend)';
    const value = record[field as keyof typeof record];
    if (typeof value === 'number' && !isNaN(value)) {
      if (!countryMap.has(country)) {
        countryMap.set(country, []);
      }
      countryMap.get(country)!.push(value);
    }
  }

  const results: CountryBreakdown[] = Array.from(countryMap.entries())
    .map(([country, values]) => ({
      country,
      value: Math.round(
        (useAverage
          ? aggregateMetrics(values, 'average')
          : aggregateMetrics(values, 'sum')) *
          100
      ) / 100,
      label: countryLabels[country] ?? country,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);

  return results;
}

// ============================================================================
// Data Freshness
// ============================================================================

/**
 * Get data freshness information for a project.
 *
 * Checks last sync time, data ranges, and generates Dutch explanations
 * for any gaps or missing data.
 *
 * @param projectId - The project ID
 * @returns DataFreshnessInfo with freshness details
 */
export async function getDataFreshness(
  projectId: string
): Promise<DataFreshnessInfo> {
  // Get the most recent sync
  const latestSync = await db.dataConnection.findFirst({
    where: {
      projectId,
      deletedAt: null,
      lastSyncAt: { not: null },
    },
    orderBy: { lastSyncAt: 'desc' },
    select: { lastSyncAt: true },
  });

  // Get data range
  const dateRange = await db.dailyMetric.aggregate({
    where: { projectId },
    _min: { date: true },
    _max: { date: true },
  });

  const dataStartDate = dateRange._min.date;
  const dataEndDate = dateRange._max.date;
  const hasData = dataStartDate !== null && dataEndDate !== null;

  // Generate Dutch data note
  let dataNote: string | null = null;

  if (!hasData) {
    dataNote =
      'Er is nog geen gegevens beschikbaar. Importeer gegevens via een CSV-bestand of verbind Google Search Console.';
  } else if (latestSync?.lastSyncAt) {
    const hoursSinceSync = Math.floor(
      (Date.now() - latestSync.lastSyncAt.getTime()) / (1000 * 60 * 60)
    );

    if (hoursSinceSync > 48) {
      dataNote = `Gegevens zijn meer dan ${Math.floor(hoursSinceSync / 24)} dagen geleden voor het laatst gesynchroniseerd. Controleer je gegevensverbindingen.`;
    } else if (hoursSinceSync > 24) {
      dataNote = `Gegevens zijn ${Math.floor(hoursSinceSync / 24)} dagen geleden gesynchroniseerd. De meest recente gegevens kunnen ontbreken.`;
    }

    // Check if data is recent (GSC data has a 2-3 day delay)
    const dataEnd = dataEndDate!;
    const now = new Date();
    const dataAgeDays = Math.floor(
      (now.getTime() - dataEnd.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dataAgeDays > 5) {
      dataNote =
        dataNote ??
        `De meest recente gegevens zijn van ${dataAgeDays} dagen geleden. Google Search Console-gegevens hebben een vertraging van 2-3 dagen.`;
    }
  }

  return {
    lastSyncAt: latestSync?.lastSyncAt ?? null,
    dataStartDate,
    dataEndDate,
    dataNote,
    isDataAvailable: hasData,
  };
}

// ============================================================================
// Sync Status
// ============================================================================

/**
 * Get sync status for all data connections of a project.
 *
 * @param projectId - The project ID
 * @returns Array of SyncStatusInfo for each connection
 */
export async function getSyncStatus(
  projectId: string
): Promise<SyncStatusInfo[]> {
  const connections = await db.dataConnection.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      lastSyncAt: true,
      lastSyncError: true,
      nextSyncAt: true,
    },
  });

  return connections.map((conn) => ({
    connectionId: conn.id,
    connectionName: conn.name,
    connectionType: conn.type,
    status: conn.status,
    lastSyncAt: conn.lastSyncAt,
    lastSyncError: conn.lastSyncError,
    nextSyncAt: conn.nextSyncAt,
  }));
}
