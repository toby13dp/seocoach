// ============================================================================
// Analytics & Monitoring — Data Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Exports analytics data to CSV format with Dutch headers, DD-MM-YYYY date
// formatting, and Dutch locale number formatting (comma as decimal separator).
// ============================================================================

import { db } from '@/lib/db';
import type { MetricFilters } from './types';
import { getDashboardData, getTopQueries, getTopLandingPages } from './time-series';

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Dutch header mappings for metrics.
 */
const DUTCH_HEADERS: Record<string, string> = {
  date: 'Datum',
  clicks: 'Kliks',
  impressions: 'Weergaven',
  ctr: 'Klikfrequentie',
  averagePosition: 'Gemiddelde positie',
  position: 'Positie',
  sessions: 'Sessies',
  users: 'Gebruikers',
  newUsers: 'Nieuwe gebruikers',
  pageViews: 'Paginaweergaven',
  bounceRate: 'Bouncepercentage',
  avgSessionDuration: 'Gemiddelde sessieduur',
  conversions: 'Conversies',
  conversionRate: 'Conversiepercentage',
  revenue: 'Omzet',
  productRevenue: 'Productomzet',
  source: 'Bron',
  medium: 'Medium',
  campaign: 'Campagne',
  device: 'Apparaat',
  country: 'Land',
  landingPage: 'Bestemmingspagina',
  query: 'Zoekwoord',
  page: 'Pagina',
  metric: 'Metriek',
  value: 'Waarde',
  total: 'Totaal',
  average: 'Gemiddelde',
  change: 'Verandering',
};

/**
 * Format a Date object as DD-MM-YYYY (Dutch convention).
 *
 * @param date - The date to format
 * @returns DD-MM-YYYY formatted string
 */
function formatDutchDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return `${day}-${month}-${year}`;
}

/**
 * Format a YYYY-MM-DD string as DD-MM-YYYY (Dutch convention).
 *
 * @param dateStr - The ISO date string
 * @returns DD-MM-YYYY formatted string
 */
function formatDutchDateFromISO(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
}

/**
 * Format a number using Dutch locale conventions.
 * Uses comma as decimal separator and period as thousand separator.
 *
 * @param value - The number to format
 * @param decimals - Number of decimal places (default 2)
 * @returns Formatted number string
 */
function formatDutchNumber(value: number | null, decimals: number = 2): string {
  if (value === null) return '';

  const fixed = value.toFixed(decimals);
  const parts = fixed.split('.');
  const intPart = parts[0];
  const decPart = parts[1];

  // Add thousand separators (period)
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (decPart && decPart !== '00') {
    return `${formatted},${decPart}`;
  }

  if (decimals > 0 && value % 1 !== 0) {
    return `${formatted},${decPart}`;
  }

  return formatted;
}

/**
 * Format a percentage as a Dutch string.
 *
 * @param value - The percentage as a decimal (e.g. 0.1234 for 12.34%)
 * @returns Formatted percentage string (e.g. "12,34%")
 */
function formatDutchPercentage(value: number | null): string {
  if (value === null) return '';
  return `${formatDutchNumber(value * 100, 2)}%`;
}

/**
 * Format a duration in seconds as a human-readable Dutch string.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration (e.g. "2m 34s")
 */
function formatDutchDuration(seconds: number | null): string {
  if (seconds === null) return '';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Format a currency value in Dutch format (EUR).
 *
 * @param value - The revenue value
 * @returns Formatted currency string (e.g. "€ 1.234,56")
 */
function formatDutchCurrency(value: number | null): string {
  if (value === null) return '';
  return `€ ${formatDutchNumber(value, 2)}`;
}

/**
 * Escape a CSV field value (handle quotes, commas, newlines).
 *
 * @param value - The value to escape
 * @returns Escaped CSV field value
 */
function escapeCSVField(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes(';')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Join an array of field values into a CSV line.
 *
 * @param fields - Array of field values
 * @returns CSV line string
 */
function joinCSVLine(fields: string[]): string {
  return fields.map(escapeCSVField).join(',');
}

// ============================================================================
// Date Helpers
// ============================================================================

/**
 * Add days to a date and return a new Date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format a Date as YYYY-MM-DD.
 */
function formatDateISO(date: Date): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// Metric Export
// ============================================================================

/**
 * Get the Dutch header for a metric key.
 */
function getDutchHeader(key: string): string {
  return DUTCH_HEADERS[key] ?? key;
}

/**
 * Format a metric value based on its type.
 */
function formatMetricValue(
  metric: string,
  value: number | null
): string {
  if (value === null) return '';

  switch (metric) {
    case 'ctr':
    case 'bounceRate':
    case 'conversionRate':
      return formatDutchPercentage(value);
    case 'revenue':
    case 'productRevenue':
      return formatDutchCurrency(value);
    case 'avgSessionDuration':
      return formatDutchDuration(value);
    case 'averagePosition':
    case 'position':
      return formatDutchNumber(value, 1);
    default:
      return formatDutchNumber(value, 0);
  }
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export metrics for a project as a CSV string.
 *
 * Uses Dutch headers by default and DD-MM-YYYY date formatting.
 * Only exports data that actually exists in the database.
 *
 * @param projectId - The project ID
 * @param metric - The metric key to export
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param filters - Optional segmentation filters
 * @returns CSV string with the exported data
 */
export async function exportMetricsToCSV(
  projectId: string,
  metric: string,
  startDate: string,
  endDate: string,
  filters?: MetricFilters
): Promise<string> {
  const startDateObj = new Date(startDate + 'T00:00:00.000Z');
  const endDateObj = new Date(endDate + 'T00:00:00.000Z');

  const where: Record<string, unknown> = {
    projectId,
    date: {
      gte: startDateObj,
      lte: endDateObj,
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
    orderBy: { date: 'asc' },
  });

  if (records.length === 0) {
    return '';
  }

  // Determine available columns
  const hasSearchMetrics = records.some(
    (r) => r.clicks > 0 || r.impressions > 0
  );
  const hasAnalyticsMetrics = records.some(
    (r) => r.sessions > 0 || r.users > 0
  );
  const hasConversionMetrics = records.some((r) => r.conversions > 0);
  const hasRevenueMetrics = records.some((r) => r.revenue !== null);
  const hasSegmentation = records.some(
    (r) => r.source !== null || r.device !== null || r.country !== null || r.landingPage !== null
  );

  // Build headers
  const headers: string[] = [getDutchHeader('date')];

  if (hasSearchMetrics) {
    headers.push(
      getDutchHeader('clicks'),
      getDutchHeader('impressions'),
      getDutchHeader('ctr'),
      getDutchHeader('averagePosition')
    );
  }
  if (hasAnalyticsMetrics) {
    headers.push(
      getDutchHeader('sessions'),
      getDutchHeader('users'),
      getDutchHeader('newUsers'),
      getDutchHeader('pageViews'),
      getDutchHeader('bounceRate'),
      getDutchHeader('avgSessionDuration')
    );
  }
  if (hasConversionMetrics) {
    headers.push(
      getDutchHeader('conversions'),
      getDutchHeader('conversionRate')
    );
  }
  if (hasRevenueMetrics) {
    headers.push(getDutchHeader('revenue'), getDutchHeader('productRevenue'));
  }
  if (hasSegmentation) {
    headers.push(
      getDutchHeader('source'),
      getDutchHeader('medium'),
      getDutchHeader('campaign'),
      getDutchHeader('device'),
      getDutchHeader('country'),
      getDutchHeader('landingPage')
    );
  }

  // Build rows
  const lines: string[] = [joinCSVLine(headers)];

  for (const record of records) {
    const row: string[] = [formatDutchDate(record.date)];

    if (hasSearchMetrics) {
      row.push(
        formatDutchNumber(record.clicks, 0),
        formatDutchNumber(record.impressions, 0),
        formatDutchPercentage(record.ctr),
        formatDutchNumber(record.averagePosition, 1)
      );
    }
    if (hasAnalyticsMetrics) {
      row.push(
        formatDutchNumber(record.sessions, 0),
        formatDutchNumber(record.users, 0),
        formatDutchNumber(record.newUsers, 0),
        formatDutchNumber(record.pageViews, 0),
        formatDutchPercentage(record.bounceRate),
        formatDutchDuration(record.avgSessionDuration)
      );
    }
    if (hasConversionMetrics) {
      row.push(
        formatDutchNumber(record.conversions, 0),
        formatDutchPercentage(record.conversionRate)
      );
    }
    if (hasRevenueMetrics) {
      row.push(
        formatDutchCurrency(record.revenue),
        formatDutchCurrency(record.productRevenue)
      );
    }
    if (hasSegmentation) {
      row.push(
        record.source ?? '',
        record.medium ?? '',
        record.campaign ?? '',
        record.device ?? '',
        record.country ?? '',
        record.landingPage ?? ''
      );
    }

    lines.push(joinCSVLine(row));
  }

  return lines.join('\n');
}

/**
 * Export query performance data for a project as a CSV string.
 *
 * @param projectId - The project ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns CSV string with query performance data
 */
export async function exportQueryPerformanceToCSV(
  projectId: string,
  startDate: string,
  endDate: string
): Promise<string> {
  const queries = await getTopQueries(
    projectId,
    startDate,
    endDate,
    1000
  );

  if (queries.length === 0) {
    return '';
  }

  const headers = [
    getDutchHeader('query'),
    getDutchHeader('clicks'),
    getDutchHeader('impressions'),
    getDutchHeader('ctr'),
    getDutchHeader('position'),
  ];

  const lines: string[] = [joinCSVLine(headers)];

  for (const q of queries) {
    lines.push(
      joinCSVLine([
        q.query,
        formatDutchNumber(q.clicks, 0),
        formatDutchNumber(q.impressions, 0),
        formatDutchPercentage(q.ctr),
        formatDutchNumber(q.position, 1),
      ])
    );
  }

  return lines.join('\n');
}

/**
 * Export full dashboard data for a project as a CSV string.
 *
 * Includes search performance, analytics, conversions, and revenue
 * sections. Only includes sections where data exists.
 *
 * @param projectId - The project ID
 * @param days - Number of days to look back (default 28)
 * @returns CSV string with dashboard data
 */
export async function exportDashboardToCSV(
  projectId: string,
  days: number = 28
): Promise<string> {
  const endDate = formatDateISO(new Date());
  const startDate = formatDateISO(addDays(new Date(), -(days - 1)));

  const dashboard = await getDashboardData(projectId, days);

  const lines: string[] = [];

  // Search Performance section
  lines.push('=== Zoekprestaties ===');
  lines.push('');

  const spMetrics = [
    { key: 'clicks', ts: dashboard.searchPerformance.clicks },
    { key: 'impressions', ts: dashboard.searchPerformance.impressions },
    { key: 'ctr', ts: dashboard.searchPerformance.ctr },
    { key: 'averagePosition', ts: dashboard.searchPerformance.position },
  ];

  // Summary line
  lines.push(
    joinCSVLine([
      getDutchHeader('metric'),
      getDutchHeader('total'),
      getDutchHeader('average'),
      getDutchHeader('change'),
    ])
  );

  for (const { key, ts } of spMetrics) {
    lines.push(
      joinCSVLine([
        getDutchHeader(key),
        formatMetricValue(key, ts.total),
        formatMetricValue(key, ts.average),
        ts.change !== null
          ? `${ts.change > 0 ? '+' : ''}${formatDutchNumber(ts.change, 1)}%`
          : '',
      ])
    );
  }

  // Daily data
  lines.push('');
  lines.push('=== Dagelijkse gegevens ===');
  lines.push('');

  if (dashboard.searchPerformance.clicks.dataPoints.length > 0) {
    lines.push(
      joinCSVLine([
        getDutchHeader('date'),
        getDutchHeader('clicks'),
        getDutchHeader('impressions'),
        getDutchHeader('ctr'),
        getDutchHeader('averagePosition'),
      ])
    );

    const dataPoints = dashboard.searchPerformance.clicks.dataPoints;
    const impressionsDP =
      dashboard.searchPerformance.impressions.dataPoints;
    const ctrDP = dashboard.searchPerformance.ctr.dataPoints;
    const positionDP = dashboard.searchPerformance.position.dataPoints;

    for (let i = 0; i < dataPoints.length; i++) {
      lines.push(
        joinCSVLine([
          formatDutchDateFromISO(dataPoints[i].date),
          formatDutchNumber(dataPoints[i].value, 0),
          formatDutchNumber(impressionsDP[i]?.value ?? 0, 0),
          formatDutchPercentage(ctrDP[i]?.value ?? 0),
          formatDutchNumber(positionDP[i]?.value ?? 0, 1),
        ])
      );
    }
  }

  // Analytics section
  if (dashboard.analytics) {
    lines.push('');
    lines.push('=== Analyse ===');
    lines.push('');

    const analyticsMetrics = [
      { key: 'sessions', ts: dashboard.analytics.sessions },
      { key: 'users', ts: dashboard.analytics.users },
      { key: 'bounceRate', ts: dashboard.analytics.bounceRate },
    ];

    lines.push(
      joinCSVLine([
        getDutchHeader('metric'),
        getDutchHeader('total'),
        getDutchHeader('average'),
        getDutchHeader('change'),
      ])
    );

    for (const { key, ts } of analyticsMetrics) {
      lines.push(
        joinCSVLine([
          getDutchHeader(key),
          formatMetricValue(key, ts.total),
          formatMetricValue(key, ts.average),
          ts.change !== null
            ? `${ts.change > 0 ? '+' : ''}${formatDutchNumber(ts.change, 1)}%`
            : '',
        ])
      );
    }
  }

  // Conversions section
  if (dashboard.conversions) {
    lines.push('');
    lines.push('=== Conversies ===');
    lines.push('');

    lines.push(
      joinCSVLine([
        getDutchHeader('metric'),
        getDutchHeader('total'),
        getDutchHeader('average'),
        getDutchHeader('change'),
      ])
    );

    const convMetrics = [
      { key: 'conversions', ts: dashboard.conversions.conversions },
      { key: 'conversionRate', ts: dashboard.conversions.conversionRate },
    ];

    for (const { key, ts } of convMetrics) {
      lines.push(
        joinCSVLine([
          getDutchHeader(key),
          formatMetricValue(key, ts.total),
          formatMetricValue(key, ts.average),
          ts.change !== null
            ? `${ts.change > 0 ? '+' : ''}${formatDutchNumber(ts.change, 1)}%`
            : '',
        ])
      );
    }
  }

  // Revenue section
  if (dashboard.revenue) {
    lines.push('');
    lines.push('=== Omzet ===');
    lines.push('');

    lines.push(
      joinCSVLine([
        getDutchHeader('metric'),
        getDutchHeader('total'),
        getDutchHeader('average'),
        getDutchHeader('change'),
      ])
    );

    lines.push(
      joinCSVLine([
        getDutchHeader('revenue'),
        formatDutchCurrency(dashboard.revenue.revenue.total),
        formatDutchCurrency(dashboard.revenue.revenue.average),
        dashboard.revenue.revenue.change !== null
          ? `${dashboard.revenue.revenue.change > 0 ? '+' : ''}${formatDutchNumber(dashboard.revenue.revenue.change, 1)}%`
          : '',
      ])
    );
  }

  // Top queries section
  lines.push('');
  lines.push('=== Top zoekwoorden ===');
  lines.push('');

  const topQueries = await getTopQueries(projectId, startDate, endDate, 20);
  if (topQueries.length > 0) {
    lines.push(
      joinCSVLine([
        getDutchHeader('query'),
        getDutchHeader('clicks'),
        getDutchHeader('impressions'),
        getDutchHeader('ctr'),
        getDutchHeader('position'),
      ])
    );

    for (const q of topQueries) {
      lines.push(
        joinCSVLine([
          q.query,
          formatDutchNumber(q.clicks, 0),
          formatDutchNumber(q.impressions, 0),
          formatDutchPercentage(q.ctr),
          formatDutchNumber(q.position, 1),
        ])
      );
    }
  } else {
    lines.push('Geen zoekwoordgegevens beschikbaar.');
  }

  // Top landing pages section
  lines.push('');
  lines.push('=== Top bestemmingspagina\'s ===');
  lines.push('');

  const topPages = await getTopLandingPages(
    projectId,
    startDate,
    endDate,
    20
  );
  if (topPages.length > 0) {
    lines.push(
      joinCSVLine([
        getDutchHeader('landingPage'),
        getDutchHeader('clicks'),
        getDutchHeader('impressions'),
        getDutchHeader('ctr'),
        getDutchHeader('averagePosition'),
        getDutchHeader('sessions'),
        getDutchHeader('bounceRate'),
      ])
    );

    for (const p of topPages) {
      lines.push(
        joinCSVLine([
          p.landingPage,
          formatDutchNumber(p.clicks, 0),
          formatDutchNumber(p.impressions, 0),
          formatDutchPercentage(p.ctr),
          formatDutchNumber(p.position, 1),
          p.sessions ? formatDutchNumber(p.sessions, 0) : '',
          p.bounceRate !== null && p.bounceRate !== undefined
            ? formatDutchPercentage(p.bounceRate)
            : '',
        ])
      );
    }
  } else {
    lines.push('Geen bestemmingspaginagegevens beschikbaar.');
  }

  return lines.join('\n');
}
