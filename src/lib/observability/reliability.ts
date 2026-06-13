/**
 * Reliability patterns for SEOCoach.
 *
 * Provides production-grade resilience utilities:
 * - **Retry** with exponential back-off and jitter
 * - **Circuit breaker** with CLOSED / OPEN / HALF_OPEN states
 * - **Timeout** wrapper for async operations
 * - **Idempotency** guard to prevent duplicate execution
 *
 * @module observability/reliability
 */

import { randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

/** Options for the `withRetry` function. */
export interface RetryOptions {
  /** Maximum number of attempts (including the initial call). Default: 3. */
  maxAttempts?: number;
  /** Base delay in milliseconds for exponential back-off. Default: 1000. */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds. Default: 30000. */
  maxDelayMs?: number;
  /** Predicate that determines whether an error is retriable. Default: always retry. */
  retryOn?: (error: Error) => boolean;
}

/** Default retry option values. */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryOn: () => true,
};

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate the delay for a given attempt using exponential back-off with
 * full jitter.
 *
 * Formula: `random(0, min(maxDelayMs, baseDelayMs * 2^attempt))`
 */
function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(maxDelayMs, exponentialDelay);
  // Full jitter: random value between 0 and cappedDelay
  const jitter = randomBytes(4).readUInt32BE(0) / 0xffffffff;
  return Math.floor(jitter * cappedDelay);
}

/**
 * Execute `fn` with automatic retry on failure using exponential back-off
 * with jitter.
 *
 * @typeParam T - Return type of the wrapped function.
 * @param fn      - The asynchronous function to execute.
 * @param options - Retry configuration.
 * @returns The return value of `fn` on success.
 * @throws The last error after all retry attempts are exhausted.
 *
 * @example
 * ```ts
 * const data = await withRetry(
 *   () => fetchExternalApi(),
 *   { maxAttempts: 5, baseDelayMs: 500, retryOn: (err) => err.message.includes('ECONNRESET') },
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Check if this error is retriable
      if (!opts.retryOn(lastError)) {
        throw lastError;
      }

      // Don't sleep after the last attempt
      if (attempt < opts.maxAttempts - 1) {
        const delay = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error('Alle hertry-pogingen mislukt');
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

/** Possible states of a circuit breaker. */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** Options for the `withCircuitBreaker` function. */
export interface CircuitBreakerOptions {
  /** Number of failures within the monitoring period before opening. Default: 5. */
  failureThreshold?: number;
  /** Time in milliseconds before attempting to close the circuit (half-open). Default: 30000. */
  resetTimeoutMs?: number;
  /** Sliding window in milliseconds to count failures. Default: 60000. */
  monitoringPeriodMs?: number;
}

/** Default circuit breaker option values. */
const DEFAULT_CB_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  monitoringPeriodMs: 60000,
};

/**
 * In-memory state for a named circuit breaker.
 */
interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  openedAt: number;
  failureTimestamps: number[];
}

/**
 * Global registry of circuit breaker states, keyed by name.
 */
const circuitStates = new Map<string, CircuitBreakerState>();

/**
 * Get or create the state for a named circuit breaker.
 */
function getCircuitState(name: string): CircuitBreakerState {
  let state = circuitStates.get(name);
  if (!state) {
    state = {
      state: 'CLOSED',
      failures: 0,
      lastFailureTime: 0,
      openedAt: 0,
      failureTimestamps: [],
    };
    circuitStates.set(name, state);
  }
  return state;
}

/**
 * Clean up failure timestamps outside the monitoring window.
 */
function pruneOldFailures(cb: CircuitBreakerState, monitoringPeriodMs: number): void {
  const cutoff = Date.now() - monitoringPeriodMs;
  cb.failureTimestamps = cb.failureTimestamps.filter((t) => t > cutoff);
  cb.failures = cb.failureTimestamps.length;
}

/**
 * Error thrown when the circuit breaker is in the OPEN state.
 */
export class CircuitBreakerOpenError extends Error {
  /** Name of the circuit breaker that rejected the call. */
  public readonly circuitName: string;

  constructor(circuitName: string) {
    super(`Circuitbreaker "${circuitName}" is open — verzoeken worden afgewezen`);
    this.name = 'CircuitBreakerOpenError';
    this.circuitName = circuitName;
  }
}

/**
 * Execute `fn` through a circuit breaker identified by `name`.
 *
 * When the breaker is **CLOSED**, calls pass through normally. If enough
 * failures accumulate within the monitoring window, the breaker transitions
 * to **OPEN** and immediately rejects calls. After `resetTimeoutMs`, it
 * transitions to **HALF_OPEN** and allows a single probe call. If that call
 * succeeds the breaker closes again; if it fails the breaker re-opens.
 *
 * @typeParam T - Return type of the wrapped function.
 * @param name    - Unique name for this circuit breaker instance.
 * @param fn      - The asynchronous function to execute.
 * @param options - Circuit breaker configuration.
 * @returns The return value of `fn` on success.
 * @throws {CircuitBreakerOpenError} When the circuit is OPEN.
 *
 * @example
 * ```ts
 * const result = await withCircuitBreaker(
 *   'ollama',
 *   () => callOllama(prompt),
 *   { failureThreshold: 3, resetTimeoutMs: 15000 },
 * );
 * ```
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  options: CircuitBreakerOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_CB_OPTIONS, ...options };
  const cb = getCircuitState(name);

  // Prune old failures
  pruneOldFailures(cb, opts.monitoringPeriodMs);

  const now = Date.now();

  switch (cb.state) {
    case 'OPEN': {
      // Check if we should transition to HALF_OPEN
      if (now - cb.openedAt >= opts.resetTimeoutMs) {
        cb.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerOpenError(name);
      }
      break;
    }
    // CLOSED and HALF_OPEN fall through to attempt the call
    case 'CLOSED':
    case 'HALF_OPEN':
      break;
  }

  try {
    const result = await fn();

    // Success — close the circuit
    cb.state = 'CLOSED';
    cb.failures = 0;
    cb.failureTimestamps = [];

    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    cb.failures += 1;
    cb.lastFailureTime = now;
    cb.failureTimestamps.push(now);

    if (cb.state === 'HALF_OPEN') {
      // Probe failed — re-open
      cb.state = 'OPEN';
      cb.openedAt = now;
    } else if (cb.failures >= opts.failureThreshold) {
      // Threshold reached — open the circuit
      cb.state = 'OPEN';
      cb.openedAt = now;
    }

    throw error;
  }
}

/**
 * Get the current state of a named circuit breaker.
 *
 * Useful for diagnostics and dashboards.
 */
export function getCircuitBreakerState(name: string): CircuitState {
  return getCircuitState(name).state;
}

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

/**
 * Error thrown when an operation exceeds its timeout.
 */
export class TimeoutError extends Error {
  /** The configured timeout in milliseconds. */
  public readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Bewerking time-out na ${timeoutMs} ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Execute `fn` with a time limit.
 *
 * If `fn` does not settle within `timeoutMs`, the returned promise rejects
 * with a `TimeoutError`.
 *
 * @typeParam T - Return type of the wrapped function.
 * @param fn        - The asynchronous function to execute.
 * @param timeoutMs - Maximum allowed duration in milliseconds.
 * @returns The return value of `fn` on success.
 * @throws {TimeoutError} When the timeout is exceeded.
 *
 * @example
 * ```ts
 * const data = await withTimeout(() => slowApiCall(), 5000);
 * ```
 */
export async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

/**
 * In-memory store for idempotency keys.
 * Maps key → { result, expiryTimestamp }.
 */
const idempotencyStore = new Map<string, { result: unknown; expiryTimestamp: number }>();

/**
 * Periodically clean up expired idempotency entries.
 * Runs every 60 seconds.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyStore) {
    if (now >= entry.expiryTimestamp) {
      idempotencyStore.delete(key);
    }
  }
}, 60_000);

/**
 * Execute `fn` with an idempotency guard.
 *
 * If a call with the same `key` has already completed successfully within
 * the TTL window, the cached result is returned instead of re-executing `fn`.
 * This prevents duplicate side-effects (e.g. sending the same email twice).
 *
 * @typeParam T - Return type of the wrapped function.
 * @param key   - Unique idempotency key (e.g. `"invoice-create:order-123"`).
 * @param fn    - The asynchronous function to execute.
 * @param ttlMs - How long the result should be cached, in milliseconds.
 * @returns The return value of `fn` (either fresh or cached).
 *
 * @example
 * ```ts
 * const report = await withIdempotency(
 *   `report:${projectId}:${date}`,
 *   () => generateReport(projectId, date),
 *   300_000, // 5 minutes
 * );
 * ```
 */
export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const now = Date.now();

  // Check for cached result
  const cached = idempotencyStore.get(key);
  if (cached && now < cached.expiryTimestamp) {
    return cached.result as T;
  }

  // Execute and cache
  const result = await fn();
  idempotencyStore.set(key, {
    result,
    expiryTimestamp: now + ttlMs,
  });

  return result;
}
