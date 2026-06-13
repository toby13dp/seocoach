# Task: Phase 5 Analytics & Monitoring — Alert Engine & Monitoring Libraries

## Agent: alert-engine-agent

## Summary

Created the complete alert engine and monitoring libraries under `/home/z/my-project/src/lib/alerts/` with 6 files, all passing TypeScript strict checks and ESLint.

## Files Created

### 1. `types.ts` — Type Definitions
- `AlertRule` — defines an alert type with Dutch labels, thresholds, metric keys, and direction
- `AlertEvaluation` — result of evaluating a metric against a rule (includes anomaly data)
- `AlertDigest` / `DigestAlertItem` — structured alert digest for daily/weekly summaries
- `AlertFilters` — query filters for active alerts
- `AlertSummary` — severity counts
- Re-exports Prisma enums (`AlertType`, `AlertSeverity`, `AlertStatus`)

### 2. `rules.ts` — All 16 Alert Rules (Dutch)
- Complete `ALERT_RULES` record mapping all `AlertType` enum values to rule definitions
- Each rule has: `dutchLabel`, `dutchDescription`, `defaultSeverity`, `defaultThreshold`, `minimumDataPoints`, `metricKey`, `direction`
- Helper functions: `getAlertRule()`, `getAllAlertRules()`, `getAlertRulesBySeverity()`, `getAlertRulesByDirection()`

### 3. `anomaly.ts` — Statistical Anomaly Detection
- `detectAnomaly(values, method)` — Z-score or IQR method
- `detectAnomalyBest(values)` — runs both methods, returns highest score
- Z-score: measures standard deviations from mean, threshold at 2.0
- IQR: checks if value is outside 1.5×IQR from quartiles
- Returns null if < 7 data points
- Scores normalised to 0–1 scale

### 4. `engine.ts` — Core Alert Engine
- `evaluateMetricAlert()` — compares current vs previous period metrics, runs anomaly detection, checks thresholds and data sufficiency
- `runAllAlertChecks()` — evaluates all 16 alert types, creates Alert records with deduplication
- Lifecycle: `acknowledgeAlert()`, `snoozeAlert()`, `resolveAlert()`, `dismissAlert()`, `assignAlert()`
- Query: `getActiveAlerts()` with filtering, `getAlertSummary()` with severity counts
- Digest: `generateDigest()` for daily/weekly periods
- All Dutch messages generated dynamically from rule + evaluation data

### 5. `notifications.ts` — Notification Preference Management
- `getNotificationPreferences()`, `createNotificationPreference()`, `updateNotificationPreference()`
- `shouldNotify()` — checks channel enabled, type/severity match, quiet hours
- `getDailyDigest()`, `getWeeklyDigest()` — wraps engine's generateDigest
- Quiet hours support overnight (e.g. 22:00–08:00)
- Channel validation (email, in_app, webhook)
- Dutch error messages for validation

### 6. `index.ts` — Barrel Export
- Exports all types, rules, anomaly functions, engine functions, notification functions

## Key Design Decisions
- Follows `/src/lib/rules/` pattern (types → rules → engine → barrel export)
- Uses `import { db } from '@/lib/db'` for Prisma access
- All user-facing strings in Dutch (nl-NL)
- Data sufficiency enforced: won't alert without `minimumDataPoints`
- Deduplication by `alertGroup` (projectId:alertType)
- Anomaly detection as additional signal, not sole trigger
- `Record<string, unknown>` for dynamic Prisma where clauses in query helpers
