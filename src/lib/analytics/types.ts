// ============================================================================
// Analytics & Monitoring — Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for analytics data connections, CSV import, time-series
// calculation, and dashboard data. All user-facing text is in Dutch.
// ============================================================================

// ============================================================================
// Data Connection Types
// ============================================================================

/**
 * Configuration for a data connection.
 * Different fields are used depending on the connection type.
 */
export interface DataConnectionConfig {
  /** GSC property URL (e.g., 'https://example.com/') or GA4 property ID (e.g., 'properties/123456') */
  propertyId?: string;
  /** GSC/GA4/GBP account ID */
  accountId?: string;
  /** GBP location ID (e.g., 'accounts/123/locations/456') */
  locationIdGBP?: string;
  /** CSV file reference name */
  fileName?: string;
  /** Whether to auto-sync data */
  autoSync?: boolean;
  /** Sync interval in minutes */
  syncIntervalMinutes?: number;
}

// ============================================================================
// Metric Types
// ============================================================================

/** Search performance metrics from Google Search Console */
export interface SearchMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
}

/** Analytics metrics from Google Analytics 4 */
export interface AnalyticsMetrics {
  sessions: number;
  users: number;
  newUsers: number;
  pageViews: number;
  bounceRate: number | null;
  avgSessionDuration: number | null;
}

/** Conversion metrics */
export interface ConversionMetrics {
  conversions: number;
  conversionRate: number | null;
}

/** Revenue metrics */
export interface RevenueMetrics {
  revenue: number | null;
  productRevenue: number | null;
}

/** A single row of daily metrics with optional segmentation */
export interface DailyMetricsRow
  extends SearchMetrics,
    Partial<AnalyticsMetrics>,
    Partial<ConversionMetrics>,
    Partial<RevenueMetrics> {
  date: string; // YYYY-MM-DD
  source?: string;
  medium?: string;
  campaign?: string;
  device?: string;
  country?: string;
  landingPage?: string;
}

// ============================================================================
// Time-Series Types
// ============================================================================

/** A time-series result for a single metric */
export interface MetricTimeSeries {
  metric: string;
  dataPoints: { date: string; value: number }[];
  total: number;
  average: number;
  change: number | null; // percentage change vs previous period
  changeDirection: 'up' | 'down' | 'neutral' | null;
}

/** Comparison between two periods for a metric */
export interface PeriodComparison {
  current: MetricTimeSeries;
  previous: MetricTimeSeries;
  yearOverYear?: MetricTimeSeries | null;
}

// ============================================================================
// Dashboard Types
// ============================================================================

/** Complete analytics dashboard data */
export interface AnalyticsDashboard {
  searchPerformance: {
    clicks: MetricTimeSeries;
    impressions: MetricTimeSeries;
    ctr: MetricTimeSeries;
    position: MetricTimeSeries;
  };
  analytics?: {
    sessions: MetricTimeSeries;
    users: MetricTimeSeries;
    bounceRate: MetricTimeSeries;
  };
  conversions?: {
    conversions: MetricTimeSeries;
    conversionRate: MetricTimeSeries;
  };
  revenue?: {
    revenue: MetricTimeSeries;
  };
  dataFreshness: DataFreshnessInfo;
  syncStatus: SyncStatusInfo[];
}

/** Information about data freshness and availability */
export interface DataFreshnessInfo {
  lastSyncAt: Date | null;
  dataStartDate: Date | null;
  dataEndDate: Date | null;
  dataNote: string | null; // Dutch explanation for gaps
  isDataAvailable: boolean;
}

/** Sync status for a single data connection */
export interface SyncStatusInfo {
  connectionId: string;
  connectionName: string;
  connectionType: string;
  status: string;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  nextSyncAt: Date | null;
}

// ============================================================================
// CSV Import Types
// ============================================================================

/** Result of a CSV import operation */
export interface CSVImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Flexible column mapping for CSV import.
 * Each field maps to an array of possible header names (Dutch & English).
 */
export interface CSVColumnMapping {
  // Search performance columns
  date?: string[];
  clicks?: string[];
  impressions?: string[];
  ctr?: string[];
  position?: string[];
  // Analytics columns
  sessions?: string[];
  users?: string[];
  newUsers?: string[];
  pageViews?: string[];
  bounceRate?: string[];
  avgSessionDuration?: string[];
  // Conversion columns
  conversions?: string[];
  conversionRate?: string[];
  // Revenue columns
  revenue?: string[];
  productRevenue?: string[];
  // Segmentation columns
  source?: string[];
  medium?: string[];
  campaign?: string[];
  device?: string[];
  country?: string[];
  landingPage?: string[];
  // Query performance
  query?: string[];
  page?: string[];
}

/**
 * Default column mappings supporting Dutch & English headers,
 * as well as common GSC/GA4 export formats.
 */
export const DEFAULT_COLUMN_MAPPINGS: CSVColumnMapping = {
  date: ['date', 'datum', 'dag', 'day'],
  clicks: ['clicks', 'kliks', 'klik'],
  impressions: ['impressions', 'weergaven', 'vertoningen'],
  ctr: ['ctr', 'klikfrequentie', 'click through rate'],
  position: ['position', 'positie', 'avg position', 'gem positie'],
  sessions: ['sessions', 'sessies', 'bezoeken'],
  users: ['users', 'gebruikers', 'bezoekers'],
  newUsers: ['new users', 'nieuwe gebruikers', 'nieuwe bezoekers'],
  pageViews: ['pageviews', 'paginaweergaven', 'page views'],
  bounceRate: ['bounce rate', 'bouncepercentage', 'weigeringspercentage'],
  avgSessionDuration: [
    'avg session duration',
    'gem sessieduur',
    'avg session',
    'gemiddelde sessieduur',
  ],
  conversions: ['conversions', 'conversies'],
  conversionRate: [
    'conversion rate',
    'conversiepercentage',
    'conversieratio',
  ],
  revenue: ['revenue', 'omzet', 'inkomsten', 'opbrengst'],
  productRevenue: ['product revenue', 'productomzet', 'item revenue'],
  source: ['source', 'bron', 'medium source'],
  medium: ['medium'],
  campaign: ['campaign', 'campagne'],
  device: ['device', 'apparaat', 'device category'],
  country: ['country', 'land'],
  landingPage: [
    'landing page',
    'bestemmingspagina',
    'landing page url',
  ],
  query: ['query', 'zoekwoord', 'search term', 'zoekterm'],
  page: ['page', 'pagina', 'landing page url'],
};

// ============================================================================
// Metric Display Info (Dutch)
// ============================================================================

/** Display information for a metric, with Dutch labels and explanations */
export interface MetricDisplayInfo {
  key: string;
  label: string; // Dutch label
  format: 'number' | 'percentage' | 'currency' | 'seconds';
  direction: 'up' | 'down' | 'neutral'; // which direction is "good"
  dutchExplanation: string; // Plain Dutch explanation
}

/** Predefined display info for all supported metrics */
export const METRIC_DISPLAY_INFO: MetricDisplayInfo[] = [
  {
    key: 'clicks',
    label: 'Kliks',
    format: 'number',
    direction: 'up',
    dutchExplanation:
      'Het aantal keer dat mensen op je website klikten in de zoekresultaten.',
  },
  {
    key: 'impressions',
    label: 'Weergaven',
    format: 'number',
    direction: 'up',
    dutchExplanation:
      'Hoe vaak je website verscheen in de zoekresultaten.',
  },
  {
    key: 'ctr',
    label: 'Klikfrequentie',
    format: 'percentage',
    direction: 'up',
    dutchExplanation:
      'Het percentage weergaven dat resulteerde in een klik.',
  },
  {
    key: 'averagePosition',
    label: 'Gemiddelde positie',
    format: 'number',
    direction: 'down',
    dutchExplanation:
      'De gemiddelde positie van je website in de zoekresultaten. Lager is beter.',
  },
  {
    key: 'sessions',
    label: 'Sessies',
    format: 'number',
    direction: 'up',
    dutchExplanation: 'Het aantal bezoeken aan je website.',
  },
  {
    key: 'users',
    label: 'Gebruikers',
    format: 'number',
    direction: 'up',
    dutchExplanation: 'Het aantal unieke bezoekers van je website.',
  },
  {
    key: 'bounceRate',
    label: 'Bouncepercentage',
    format: 'percentage',
    direction: 'down',
    dutchExplanation:
      'Het percentage bezoekers dat je website direct weer verliet.',
  },
  {
    key: 'conversions',
    label: 'Conversies',
    format: 'number',
    direction: 'up',
    dutchExplanation:
      'Het aantal keer dat een bezoeker een gewenste actie voltooide.',
  },
  {
    key: 'conversionRate',
    label: 'Conversiepercentage',
    format: 'percentage',
    direction: 'up',
    dutchExplanation:
      'Het percentage bezoeken dat resulteerde in een conversie.',
  },
  {
    key: 'revenue',
    label: 'Omzet',
    format: 'currency',
    direction: 'up',
    dutchExplanation:
      'De totale omzet die via je website werd gegenereerd.',
  },
];

// ============================================================================
// Query & Page Performance Types
// ============================================================================

/** A query performance entry from GSC data */
export interface QueryPerformanceRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
  country?: string;
  device?: string;
  page?: string;
}

/** A landing page performance entry */
export interface LandingPagePerformanceRow {
  landingPage: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  sessions?: number;
  bounceRate?: number | null;
}

/** Breakdown by device category */
export interface DeviceBreakdown {
  device: string;
  value: number;
  label: string; // Dutch label
}

/** Breakdown by country */
export interface CountryBreakdown {
  country: string;
  value: number;
  label: string; // Dutch label
}

// ============================================================================
// Aggregation Types
// ============================================================================

/** Aggregation method for metrics */
export type AggregationMethod = 'sum' | 'average';

/** Filter options for time-series queries */
export interface MetricFilters {
  source?: string;
  medium?: string;
  campaign?: string;
  device?: string;
  country?: string;
  landingPage?: string;
  connectionId?: string;
}
