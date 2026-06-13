/**
 * Observability module — central re-export for all SEOCoach observability
 * utilities.
 *
 * Import everything from `@/lib/observability`:
 *
 * ```ts
 * import { appLogger, metrics, withRetry, runAllChecks } from '@/lib/observability';
 * ```
 *
 * @module observability
 */

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export {
  createLogger,
  appLogger,
  type Logger,
  type LogContext,
  type LogLevel,
} from './logger';

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export {
  metrics,
  MetricNames,
  incrementCounter,
  recordHistogram,
  setGauge,
  recordDuration,
  getMetricsSnapshot,
  resetMetrics,
  type MetricName,
  type MetricsSnapshot,
  type CounterSnapshot,
  type GaugeSnapshot,
  type HistogramSnapshot,
} from './metrics';

// ---------------------------------------------------------------------------
// Request ID
// ---------------------------------------------------------------------------

export {
  generateRequestId,
  getRequestId,
  setRequestId,
  withRequestId,
} from './request-id';

// ---------------------------------------------------------------------------
// Health Checks
// ---------------------------------------------------------------------------

export {
  checkDatabase,
  checkOllama,
  checkDiskSpace,
  checkMemory,
  runAllChecks,
  type HealthCheckResult,
  type OverallHealth,
} from './health';

// ---------------------------------------------------------------------------
// Reliability
// ---------------------------------------------------------------------------

export {
  withRetry,
  withCircuitBreaker,
  withTimeout,
  withIdempotency,
  getCircuitBreakerState,
  CircuitBreakerOpenError,
  TimeoutError,
  type RetryOptions,
  type CircuitBreakerOptions,
  type CircuitState,
} from './reliability';
