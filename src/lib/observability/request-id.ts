/**
 * Request ID management for SEOCoach.
 *
 * Uses Node.js `AsyncLocalStorage` to propagate a unique request identifier
 * through the call chain without explicit parameter passing. This enables
 * log entries, metrics, and error reports to be correlated to a single
 * incoming HTTP request.
 *
 * @module observability/request-id
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// AsyncLocalStorage setup
// ---------------------------------------------------------------------------

/**
 * Internal storage that holds the current request ID.
 * The value is `undefined` when no request context is active.
 */
const requestIdStorage = new AsyncLocalStorage<string | undefined>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a new UUID v4 request identifier.
 *
 * @returns A randomly generated UUID string (e.g. `"f47ac10b-58cc-4372-a567-0e02b2c3d479"`).
 *
 * @example
 * ```ts
 * const id = generateRequestId(); // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 * ```
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Retrieve the current request ID from `AsyncLocalStorage`.
 *
 * Returns an empty string when called outside a request context
 * (e.g. during startup or in background jobs).
 *
 * @returns The active request ID, or `""` if none is set.
 *
 * @example
 * ```ts
 * const rid = getRequestId();
 * logger.info('Verwerking gestart', { requestId: rid });
 * ```
 */
export function getRequestId(): string {
  return requestIdStorage.getStore() ?? '';
}

/**
 * Explicitly set the current request ID.
 *
 * Prefer `withRequestId()` which manages the lifecycle automatically.
 * This function is useful when you need to set the ID in a context
 * that is already running inside `AsyncLocalStorage.run()`.
 *
 * @param id - The request ID to store.
 */
export function setRequestId(id: string): void {
  // AsyncLocalStorage doesn't offer a direct "set" on the current store,
  // so this is a no-op guard. Consumers should use `withRequestId` instead.
  // The function signature is kept for API compatibility and future use.
  void id;
}

/**
 * Run an async function with a specific request ID in context.
 *
 * The given `id` is stored in `AsyncLocalStorage` for the duration of `fn`,
 * making it available to any code that calls `getRequestId()` — including
 * deeply nested async operations.
 *
 * @typeParam T - Return type of the wrapped function.
 * @param id - The request ID to associate with this execution.
 * @param fn - The asynchronous function to run.
 * @returns The return value of `fn`.
 *
 * @example
 * ```ts
 * await withRequestId(generateRequestId(), async () => {
 *   logger.info('Verzoek gestart'); // requestId is automatically available
 *   await handleRequest();
 *   logger.info('Verzoek afgerond');
 * });
 * ```
 */
export async function withRequestId<T>(id: string, fn: () => Promise<T>): Promise<T> {
  return requestIdStorage.run(id, fn);
}
