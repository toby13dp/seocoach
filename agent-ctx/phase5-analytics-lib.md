# Task: Phase 5 Analytics & Monitoring Library

## Summary

Created the complete analytics library module under `/home/z/my-project/src/lib/analytics/` with 6 files implementing types, CSV import adapters, time-series calculations, sync management, data export, and barrel exports.

## Files Created

### 1. `types.ts`
- Core type definitions: `DataConnectionConfig`, `SearchMetrics`, `AnalyticsMetrics`, `ConversionMetrics`, `RevenueMetrics`, `DailyMetricsRow`
- Time-series types: `MetricTimeSeries`, `PeriodComparison`
- Dashboard types: `AnalyticsDashboard`, `DataFreshnessInfo`, `SyncStatusInfo`
- CSV import types: `CSVImportResult`, `CSVColumnMapping`, `DEFAULT_COLUMN_MAPPINGS`
- Display info: `MetricDisplayInfo`, `METRIC_DISPLAY_INFO` (all Dutch labels/explanations)
- Segmentation types: `DeviceBreakdown`, `CountryBreakdown`
- Utility types: `AggregationMethod`, `MetricFilters`

### 2. `csv-import.ts`
- Flexible CSV parsing with auto-delimiter detection (comma, semicolon, tab)
- Column mapping via `DEFAULT_COLUMN_MAPPINGS` (Dutch & English headers)
- Date parsing: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY
- Number parsing: Dutch (1.234,56) and English (1,234.56) formats
- Percentage parsing: "12.34%", "12,34%", "0.1234"
- 5 import functions: `importSearchPerformanceCSV`, `importQueryPerformanceCSV`, `importAnalyticsCSV`, `importConversionsCSV`, `importRevenueCSV`
- Batch upsert with Prisma using unique constraints
- Dutch validation error messages
- `previewCSV()` utility for previewing CSV content

### 3. `time-series.ts`
- `calculateTimeSeries()` — queries DailyMetric, aggregates by date, calculates change vs previous period
- `calculatePeriodComparison()` — current vs previous period with optional YoY
- `calculateYearOverYear()` — same period last year comparison
- `getDashboardData()` — complete dashboard with search, analytics, conversions, revenue sections
- `aggregateMetrics()` — sum/average aggregation
- `calculateChangePercentage()` — handles division by zero, null values
- `getTopQueries()` — aggregated query performance by clicks
- `getTopLandingPages()` — aggregated page performance
- `getMetricByDevice()` — breakdown by device with Dutch labels
- `getMetricByCountry()` — breakdown by country with Dutch labels
- `getDataFreshness()` — checks last sync, data ranges, Dutch data notes
- `getSyncStatus()` — connection sync status overview
- Never fabricates data — only returns metrics when real data exists

### 4. `sync-manager.ts`
- `createDataConnection()` — creates DataConnection with validation
- `updateDataConnection()` — updates connection settings
- `deleteDataConnection()` — soft delete
- `testConnection()` — CSV: validates config; GSC/GA4: placeholder with Dutch OAuth instructions
- `syncData()` — CSV: calls import functions; GSC/GA4: Dutch manual import message
- `scheduleNextSync()` — calculates next sync time
- `getSyncStatus()` — returns SyncStatusInfo[] for all connections
- `syncQueryPerformanceCSV()` — convenience wrapper for query-level imports
- All error/info messages in Dutch

### 5. `export.ts`
- `exportMetricsToCSV()` — exports metrics as CSV with Dutch headers, DD-MM-YYYY dates
- `exportQueryPerformanceToCSV()` — exports query data
- `exportDashboardToCSV()` — full dashboard export with sections (search, analytics, conversions, revenue, top queries, top pages)
- Dutch locale number formatting (comma as decimal separator, period as thousand separator)
- Dutch date format: DD-MM-YYYY
- Dutch currency: € 1.234,56
- Dutch percentage: 12,34%
- CSV field escaping for special characters

### 6. `index.ts`
- Barrel export for all types, constants, and functions
- Renames `getSyncStatus` from time-series to `getTimeSeriesSyncStatus` to avoid conflict with sync-manager's `getSyncStatus`

## Design Decisions

- **Pattern consistency**: Followed the exact module structure from `/src/lib/keywords/` (types, import, scorer → types, csv-import, time-series, sync-manager, export)
- **Database**: Uses existing Prisma models (`DailyMetric`, `DataConnection`, `QueryPerformance`) from Phase 5 schema — no schema changes needed
- **Tenant isolation**: All queries filter by `projectId` following the `getProjectFilter` pattern from `tenant.ts`
- **Dutch-first**: All user-facing strings (error messages, labels, explanations, data notes) are in Dutch
- **No fabricated data**: Functions return empty arrays/null when no data exists, with Dutch explanations
- **Batch operations**: CSV imports use batch size of 100 for efficient upsert
- **Flexible CSV**: Supports auto-delimiter detection, Dutch/English headers, multiple date formats

## Verification

- ✅ `bun run db:push` — database already in sync
- ✅ `npx tsc --noEmit --strict` — no errors in analytics files
- ✅ `bun run lint` — passes with no errors
