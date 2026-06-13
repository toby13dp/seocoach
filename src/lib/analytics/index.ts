// ============================================================================
// Analytics & Monitoring — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Re-exports all analytics modules from a single entry point.
// Import from '@/lib/analytics' to access the full analytics functionality.
// ============================================================================

// Types
export type {
  DataConnectionConfig,
  SearchMetrics,
  AnalyticsMetrics,
  ConversionMetrics,
  RevenueMetrics,
  DailyMetricsRow,
  MetricTimeSeries,
  PeriodComparison,
  AnalyticsDashboard,
  DataFreshnessInfo,
  SyncStatusInfo,
  CSVImportResult,
  CSVColumnMapping,
  MetricDisplayInfo,
  QueryPerformanceRow,
  LandingPagePerformanceRow,
  DeviceBreakdown,
  CountryBreakdown,
  AggregationMethod,
  MetricFilters,
} from './types';

export {
  DEFAULT_COLUMN_MAPPINGS,
  METRIC_DISPLAY_INFO,
} from './types';

// CSV Import
export {
  importSearchPerformanceCSV,
  importQueryPerformanceCSV,
  importAnalyticsCSV,
  importConversionsCSV,
  importRevenueCSV,
  previewCSV,
} from './csv-import';

// Time-Series
export {
  calculateTimeSeries,
  calculatePeriodComparison,
  calculateYearOverYear,
  getDashboardData,
  aggregateMetrics,
  calculateChangePercentage,
  getTopQueries,
  getTopLandingPages,
  getMetricByDevice,
  getMetricByCountry,
  getDataFreshness,
  getSyncStatus as getTimeSeriesSyncStatus,
} from './time-series';

// Sync Manager
export {
  createDataConnection,
  updateDataConnection,
  deleteDataConnection,
  testConnection,
  syncData,
  scheduleNextSync,
  getSyncStatus,
  syncQueryPerformanceCSV,
} from './sync-manager';

// Export
export {
  exportMetricsToCSV,
  exportQueryPerformanceToCSV,
  exportDashboardToCSV,
} from './export';
