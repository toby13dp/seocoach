// ============================================================================
// Rate Limiter — AI-Driven SEO Automation Platform (SEC-001)
// ============================================================================
// In-memory sliding-window rate limiter with tenant-aware and IP-based limiting.
// Expired entries are cleaned up automatically every 60 seconds.
// ============================================================================

/** Represents a single request timestamp within the sliding window */
interface RequestEntry {
  timestamp: number;
}

/** Internal store: key → list of request timestamps */
type RateLimitStore = Map<string, RequestEntry[]>;

/**
 * Predefined rate-limit configurations per endpoint type.
 * Each config specifies the maximum number of requests and the time window.
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Endpoint-type rate-limit presets.
 * - auth:  10 requests per minute   (login, register, password reset)
 * - api:   60 requests per minute   (general API endpoints)
 * - crawl:  5 requests per minute   (crawl initiation — resource-heavy)
 * - ai:    20 requests per minute   (AI generation endpoints)
 */
export const RATE_LIMIT_PRESETS: Record<string, RateLimitConfig> = {
  auth: { limit: 10, windowMs: 60_000 },
  api: { limit: 60, windowMs: 60_000 },
  crawl: { limit: 5, windowMs: 60_000 },
  ai: { limit: 20, windowMs: 60_000 },
} as const;

/**
 * Result of a rate-limit check.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the limit will reset */
  resetAt: number;
  /** Retry-After value in seconds (only set when `allowed` is false) */
  retryAfter?: number;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** The in-memory store for rate-limit tracking */
const store: RateLimitStore = new Map();

/** Cleanup interval handle (kept for potential teardown) */
let cleanupHandle: ReturnType<typeof setInterval> | null = null;

/** Interval in milliseconds between cleanup sweeps */
const CLEANUP_INTERVAL_MS = 60_000;

/**
 * Remove expired entries from the store.
 * An entry is considered expired if all its timestamps fall outside the
 * largest possible window (60 000 ms).
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entries] of store) {
    // Keep only entries within the last 60 seconds (max window)
    const filtered = entries.filter((e) => now - e.timestamp < 60_000);
    if (filtered.length === 0) {
      store.delete(key);
    } else {
      store.set(key, filtered);
    }
  }
}

/**
 * Start the periodic cleanup timer.
 * Called automatically on first use, but exported for explicit control.
 */
export function startCleanupTimer(): void {
  if (cleanupHandle === null) {
    cleanupHandle = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
    // Allow the process to exit even if the timer is still running
    if (cleanupHandle && typeof cleanupHandle === "object" && "unref" in cleanupHandle) {
      (cleanupHandle as ReturnType<typeof setInterval> & { unref: () => void }).unref();
    }
  }
}

/**
 * Stop the periodic cleanup timer.
 * Useful for testing or graceful shutdown.
 */
export function stopCleanupTimer(): void {
  if (cleanupHandle !== null) {
    clearInterval(cleanupHandle);
    cleanupHandle = null;
  }
}

// Auto-start the cleanup timer when this module is first imported
startCleanupTimer();

// ---------------------------------------------------------------------------
// Core rate-limit check
// ---------------------------------------------------------------------------

/**
 * Check whether a request identified by `key` is allowed under the given
 * rate limit configuration.
 *
 * Uses a **sliding window** algorithm: requests older than `windowMs` are
 * discarded, and the remaining count within the window is compared to `limit`.
 *
 * @param key     - Unique identifier (tenant ID, IP address, or composite key)
 * @param limit   - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns A `RateLimitResult` describing whether the request is allowed
 *
 * @example
 * ```ts
 * const result = checkRateLimit("org_abc123:api", 60, 60_000);
 * if (!result.allowed) {
 *   return Response.json({ error: "Te veel verzoeken" }, { status: 429 });
 * }
 * ```
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Retrieve or create the entry list for this key
  let entries = store.get(key) ?? [];

  // Discard timestamps outside the sliding window
  entries = entries.filter((e) => e.timestamp > windowStart);

  // Calculate the earliest time the window will reset
  const resetAt =
    entries.length > 0 ? entries[0].timestamp + windowMs : now + windowMs;

  const currentCount = entries.length;
  const remaining = Math.max(0, limit - currentCount);

  if (currentCount >= limit) {
    // Request is NOT allowed — update store and return denial
    store.set(key, entries);
    const retryAfter = Math.ceil((resetAt - now) / 1000);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter,
    };
  }

  // Request IS allowed — record the timestamp
  entries.push({ timestamp: now });
  store.set(key, entries);

  return {
    allowed: true,
    remaining: remaining - 1, // subtract the current request
    resetAt,
  };
}

// ---------------------------------------------------------------------------
// Rate-limit key builders
// ---------------------------------------------------------------------------

/**
 * Build a rate-limit key scoped to a specific organisation (tenant).
 *
 * @param organisationId - The organisation's unique identifier
 * @param type           - The endpoint type preset name
 * @returns A composite key string
 */
export function buildTenantKey(
  organisationId: string,
  type: string
): string {
  return `tenant:${organisationId}:${type}`;
}

/**
 * Build a rate-limit key scoped to an IP address.
 * Used as a fallback for unauthenticated requests.
 *
 * @param ip   - The client's IP address
 * @param type - The endpoint type preset name
 * @returns A composite key string
 */
export function buildIpKey(ip: string, type: string): string {
  return `ip:${ip}:${type}`;
}

// ---------------------------------------------------------------------------
// Middleware helper
// ---------------------------------------------------------------------------

/**
 * Create a rate-limit checking function for a specific endpoint type.
 *
 * The returned function accepts an optional `organisationId` and a required
 * `ip` address. It checks the tenant-scoped limit first (if authenticated)
 * and falls back to the IP-based limit otherwise.
 *
 * @param type - One of the preset types: "auth" | "api" | "crawl" | "ai",
 *               or a custom key that exists in `RATE_LIMIT_PRESETS`
 * @returns A function that checks the rate limit and returns a `RateLimitResult`
 *
 * @example
 * ```ts
 * const checkAuth = createRateLimitMiddleware("auth");
 * const result = checkAuth("org_123", "192.168.1.1");
 * if (!result.allowed) {
 *   return new Response("Te veel verzoeken", { status: 429 });
 * }
 * ```
 */
export function createRateLimitMiddleware(
  type: string
): (organisationId: string | null, ip: string) => RateLimitResult {
  const config = RATE_LIMIT_PRESETS[type] ?? RATE_LIMIT_PRESETS.api;

  return (organisationId: string | null, ip: string): RateLimitResult => {
    if (organisationId) {
      // Tenant-aware rate limiting
      const key = buildTenantKey(organisationId, type);
      return checkRateLimit(key, config.limit, config.windowMs);
    }

    // IP-based fallback for unauthenticated requests
    const key = buildIpKey(ip, type);
    return checkRateLimit(key, config.limit, config.windowMs);
  };
}

// ---------------------------------------------------------------------------
// Store inspection (useful for debugging / monitoring)
// ---------------------------------------------------------------------------

/**
 * Get the current size of the rate-limit store.
 * Primarily useful for health checks and monitoring.
 */
export function getStoreSize(): number {
  return store.size;
}

/**
 * Clear all rate-limit entries.
 * Should only be used in testing scenarios.
 */
export function clearStore(): void {
  store.clear();
}
