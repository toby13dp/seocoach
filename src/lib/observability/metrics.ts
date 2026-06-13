/**
 * Application metrics collector for SEOCoach.
 *
 * Provides an in-memory metrics store with support for:
 * - **Counters** — monotonically increasing values (e.g. request count)
 * - **Histograms** — distribution of observed values (e.g. response duration)
 * - **Gauges** — point-in-time values that can go up or down (e.g. active connections)
 * - **Duration recording** — convenience wrapper around histograms
 *
 * All metrics are stored in memory with no external dependencies.
 *
 * @module observability/metrics
 */

// ---------------------------------------------------------------------------
// Predefined metric names
// ---------------------------------------------------------------------------

/** Well-known metric names used across the SEOCoach platform. */
export const MetricNames = {
  /** Total number of API requests received. */
  API_REQUESTS_TOTAL: 'api_requests_total',
  /** Duration of API requests in milliseconds. */
  API_REQUEST_DURATION_MS: 'api_request_duration_ms',
  /** Total number of AI provider calls. */
  AI_CALLS_TOTAL: 'ai_calls_total',
  /** Total number of AI tokens consumed. */
  AI_TOKENS_TOTAL: 'ai_tokens_total',
  /** Total cost of AI calls in USD. */
  AI_COST_TOTAL: 'ai_cost_total',
  /** Total number of crawled pages. */
  CRAWL_PAGES_TOTAL: 'crawl_pages_total',
  /** Duration of crawl operations in milliseconds. */
  CRAWL_DURATION_MS: 'crawl_duration_ms',
  /** Total number of successfully completed jobs. */
  JOB_COMPLETED_TOTAL: 'job_completed_total',
  /** Total number of failed jobs. */
  JOB_FAILED_TOTAL: 'job_failed_total',
  /** Duration of data-sync operations in milliseconds. */
  SYNC_DURATION_MS: 'sync_duration_ms',
  /** Duration of report generation in milliseconds. */
  REPORT_GENERATION_MS: 'report_generation_ms',
} as const;

export type MetricName = (typeof MetricNames)[keyof typeof MetricNames];

// ---------------------------------------------------------------------------
// Internal storage types
// ---------------------------------------------------------------------------

interface CounterEntry {
  type: 'counter';
  value: number;
  labels: Record<string, string>;
}

interface GaugeEntry {
  type: 'gauge';
  value: number;
  labels: Record<string, string>;
}

interface HistogramEntry {
  type: 'histogram';
  values: number[];
  labels: Record<string, string>;
  sum: number;
  count: number;
}

type MetricEntry = CounterEntry | GaugeEntry | HistogramEntry;

// ---------------------------------------------------------------------------
// Label key helper
// ---------------------------------------------------------------------------

/**
 * Create a stable string key from a set of labels so that metrics with the
 * same name but different label sets are stored separately.
 */
function labelsKey(labels: Record<string, string> | undefined): string {
  if (!labels || Object.keys(labels).length === 0) return '';
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

// ---------------------------------------------------------------------------
// MetricsCollector
// ---------------------------------------------------------------------------

/**
 * In-memory metrics collector.
 *
 * Methods are safe to call from any async context — there is no shared mutable
 * state that requires locking (JavaScript is single-threaded).
 */
class MetricsCollector {
  private counters = new Map<string, CounterEntry>();
  private gauges = new Map<string, GaugeEntry>();
  private histograms = new Map<string, HistogramEntry>();

  // -----------------------------------------------------------------------
  // Counter
  // -----------------------------------------------------------------------

  /**
   * Increment a counter metric by 1.
   *
   * @param name   - Metric name (prefer values from `MetricNames`).
   * @param labels - Optional key-value labels for dimensional metrics.
   *
   * @example
   * ```ts
   * incrementCounter(MetricNames.API_REQUESTS_TOTAL, { method: 'GET', path: '/api/health' });
   * ```
   */
  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = `${name}|${labelsKey(labels)}`;
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += 1;
    } else {
      this.counters.set(key, {
        type: 'counter',
        value: 1,
        labels: labels ?? {},
      });
    }
  }

  // -----------------------------------------------------------------------
  // Histogram
  // -----------------------------------------------------------------------

  /**
   * Record an observed value in a histogram metric.
   *
   * @param name   - Metric name.
   * @param value  - Observed value (e.g. duration in ms).
   * @param labels - Optional key-value labels.
   *
   * @example
   * ```ts
   * recordHistogram(MetricNames.API_REQUEST_DURATION_MS, 142, { method: 'GET' });
   * ```
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = `${name}|${labelsKey(labels)}`;
    const existing = this.histograms.get(key);
    if (existing) {
      existing.values.push(value);
      existing.sum += value;
      existing.count += 1;
    } else {
      this.histograms.set(key, {
        type: 'histogram',
        values: [value],
        labels: labels ?? {},
        sum: value,
        count: 1,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Gauge
  // -----------------------------------------------------------------------

  /**
   * Set a gauge metric to an absolute value.
   *
   * @param name   - Metric name.
   * @param value  - Current value.
   * @param labels - Optional key-value labels.
   *
   * @example
   * ```ts
   * setGauge('active_crawls', 5);
   * ```
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = `${name}|${labelsKey(labels)}`;
    this.gauges.set(key, {
      type: 'gauge',
      value,
      labels: labels ?? {},
    });
  }

  // -----------------------------------------------------------------------
  // Duration convenience
  // -----------------------------------------------------------------------

  /**
   * Record the duration of an operation that started at `startMs` (epoch ms).
   *
   * @param name    - Metric name (prefer a `_duration_ms` metric).
   * @param startMs - Start timestamp in milliseconds since epoch.
   * @param labels  - Optional key-value labels.
   *
   * @example
   * ```ts
   * const start = Date.now();
   * await doWork();
   * recordDuration(MetricNames.CRAWL_DURATION_MS, start);
   * ```
   */
  recordDuration(name: string, startMs: number, labels?: Record<string, string>): void {
    const durationMs = Date.now() - startMs;
    this.recordHistogram(name, durationMs, labels);
  }

  // -----------------------------------------------------------------------
  // Snapshot
  // -----------------------------------------------------------------------

  /**
   * Return a point-in-time snapshot of all metric values.
   *
   * The snapshot is a plain object that is safe to serialise as JSON.
   */
  getMetricsSnapshot(): MetricsSnapshot {
    const counters: Record<string, CounterSnapshot[]> = {};
    for (const [, entry] of this.counters) {
      const metricName = entry.type === 'counter'
        ? (Object.keys(counters).find(() => true) ?? 'unknown')
        : 'unknown';
      // Extract metric name from the key
      const name = this.extractNameFromEntry(entry);
      if (!counters[name]) counters[name] = [];
      counters[name].push({
        value: entry.value,
        labels: entry.labels,
      });
    }

    // Rebuild counters properly
    const countersResult: Record<string, CounterSnapshot[]> = {};
    for (const [key, entry] of this.counters) {
      const name = key.split('|')[0];
      if (!countersResult[name]) countersResult[name] = [];
      countersResult[name].push({
        value: entry.value,
        labels: entry.labels,
      });
    }

    const gaugesResult: Record<string, GaugeSnapshot[]> = {};
    for (const [key, entry] of this.gauges) {
      const name = key.split('|')[0];
      if (!gaugesResult[name]) gaugesResult[name] = [];
      gaugesResult[name].push({
        value: entry.value,
        labels: entry.labels,
      });
    }

    const histogramsResult: Record<string, HistogramSnapshot[]> = {};
    for (const [key, entry] of this.histograms) {
      const name = key.split('|')[0];
      if (!histogramsResult[name]) histogramsResult[name] = [];
      histogramsResult[name].push({
        count: entry.count,
        sum: entry.sum,
        min: entry.values.length > 0 ? Math.min(...entry.values) : 0,
        max: entry.values.length > 0 ? Math.max(...entry.values) : 0,
        avg: entry.count > 0 ? entry.sum / entry.count : 0,
        labels: entry.labels,
      });
    }

    return {
      timestamp: new Date().toISOString(),
      counters: countersResult,
      gauges: gaugesResult,
      histograms: histogramsResult,
    };
  }

  /**
   * Reset all stored metrics. Useful in tests.
   */
  resetMetrics(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Extract the metric name portion from the internal key. */
  private extractNameFromEntry(_entry: MetricEntry): string {
    // This is a fallback — prefer the key-split approach
    return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

/** Snapshot of a single counter series. */
export interface CounterSnapshot {
  value: number;
  labels: Record<string, string>;
}

/** Snapshot of a single gauge series. */
export interface GaugeSnapshot {
  value: number;
  labels: Record<string, string>;
}

/** Statistical summary of a histogram series. */
export interface HistogramSnapshot {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  labels: Record<string, string>;
}

/** Full metrics snapshot returned by `getMetricsSnapshot()`. */
export interface MetricsSnapshot {
  timestamp: string;
  counters: Record<string, CounterSnapshot[]>;
  gauges: Record<string, GaugeSnapshot[]>;
  histograms: Record<string, HistogramSnapshot[]>;
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

/**
 * Global metrics collector instance.
 *
 * @example
 * ```ts
 * import { metrics } from '@/lib/observability';
 * metrics.incrementCounter('api_requests_total', { method: 'GET' });
 * ```
 */
export const metrics = new MetricsCollector();

/**
 * Convenience functions that delegate to the global `metrics` singleton.
 * These allow direct named imports:
 *
 * ```ts
 * import { incrementCounter, recordDuration } from '@/lib/observability';
 * ```
 */
export function incrementCounter(name: string, labels?: Record<string, string>): void {
  metrics.incrementCounter(name, labels);
}

export function recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
  metrics.recordHistogram(name, value, labels);
}

export function setGauge(name: string, value: number, labels?: Record<string, string>): void {
  metrics.setGauge(name, value, labels);
}

export function recordDuration(name: string, startMs: number, labels?: Record<string, string>): void {
  metrics.recordDuration(name, startMs, labels);
}

export function getMetricsSnapshot(): MetricsSnapshot {
  return metrics.getMetricsSnapshot();
}

export function resetMetrics(): void {
  metrics.resetMetrics();
}
