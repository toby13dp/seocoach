// ============================================================================
// Secret Masker — AI-Driven SEO Automation Platform (SEC-002)
// ============================================================================
// Utilities for masking sensitive values in logs, error messages, and API
// responses. Prevents accidental exposure of passwords, API keys, tokens,
// and other secrets.
// ============================================================================

// ---------------------------------------------------------------------------
// Predefined sensitive key patterns
// ---------------------------------------------------------------------------

/**
 * Key names (case-insensitive) that are recognised as containing sensitive
 * data. Any object field whose name matches one of these patterns will be
 * automatically masked by `maskObject`.
 */
export const SENSITIVE_KEY_PATTERNS: string[] = [
  "password",
  "secret",
  "token",
  "apikey",
  "apisecret",
  "consumerkey",
  "consumersecret",
  "apikeyencrypted",
  "applicationpassword",
  "hashedpassword",
  "accesstoken",
  "refreshtoken",
];

/**
 * Compiled set of sensitive key names in lowercase for fast lookups.
 */
const SENSITIVE_KEYS_SET: Set<string> = new Set(
  SENSITIVE_KEY_PATTERNS.map((k) => k.toLowerCase())
);

// ---------------------------------------------------------------------------
// Single value masking
// ---------------------------------------------------------------------------

/**
 * Mask a secret value, showing only the first 4 characters followed by `***`.
 *
 * - Values shorter than 4 characters are completely masked as `****`.
 * - `null` and `undefined` are returned as-is (not masked).
 * - Non-string values are converted to string before masking.
 *
 * @param value - The secret value to mask
 * @returns The masked string
 *
 * @example
 * ```ts
 * maskSecret('sk-abc123xyz789') // → 'sk-a***'
 * maskSecret('abc')              // → '****'
 * maskSecret(null)               // → null
 * ```
 */
export function maskSecret(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return value ?? null;

  const str = String(value);

  if (str.length <= 4) {
    return "****";
  }

  return str.slice(0, 4) + "***";
}

// ---------------------------------------------------------------------------
// Object masking
// ---------------------------------------------------------------------------

/**
 * Recursively mask sensitive fields in an object.
 *
 * Field names are matched **case-insensitively** against the predefined
 * `SENSITIVE_KEY_PATTERNS`. You can also provide additional keys to mask
 * via the `sensitiveKeys` parameter.
 *
 * The function returns a **new** object; the original is not mutated.
 *
 * @param obj           - The object to mask
 * @param sensitiveKeys - Additional key names to treat as sensitive
 *                        (merged with the predefined patterns)
 * @returns A new object with sensitive fields masked
 *
 * @example
 * ```ts
 * maskObject(
 *   { name: 'John', password: 'secret123', apiKey: 'sk-abc' },
 *   []
 * )
 * // → { name: 'John', password: 'secr***', apiKey: 'sk-a***' }
 *
 * maskObject(
 *   { user: { email: 'a@b.com', token: 'abc123' } },
 *   ['email']
 * )
 * // → { user: { email: 'a@b.***', token: 'abc1***' } }
 * ```
 */
export function maskObject(
  obj: Record<string, unknown>,
  sensitiveKeys: string[] = []
): Record<string, unknown> {
  // Merge additional keys with predefined patterns
  const allSensitiveKeys = new Set([
    ...SENSITIVE_KEYS_SET,
    ...sensitiveKeys.map((k) => k.toLowerCase()),
  ]);

  return maskObjectRecursive(obj, allSensitiveKeys) as Record<string, unknown>;
}

/**
 * Internal recursive masking function.
 *
 * @param obj             - The current value to process
 * @param sensitiveKeys   - Set of lowercase key names to mask
 * @param parentKey       - The key name of the current value in its parent (for matching)
 * @returns The masked value
 */
function maskObjectRecursive(
  obj: unknown,
  sensitiveKeys: Set<string>,
  parentKey?: string
): unknown {
  // Check if the current key is sensitive
  if (parentKey && sensitiveKeys.has(parentKey.toLowerCase())) {
    if (typeof obj === "string") {
      return maskSecret(obj);
    }
    if (typeof obj === "number" || typeof obj === "boolean") {
      return "***";
    }
    return "***";
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => maskObjectRecursive(item, sensitiveKeys));
  }

  // Handle plain objects
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = maskObjectRecursive(value, sensitiveKeys, key);
    }
    return result;
  }

  // Primitives and null — return as-is
  return obj;
}

// ---------------------------------------------------------------------------
// URL credential masking
// ---------------------------------------------------------------------------

/**
 * Mask credentials embedded in a URL.
 *
 * Converts URLs of the form `protocol://user:password@host/path` to
 * `protocol://user:***@host/path`.
 *
 * If the URL does not contain credentials, it is returned unchanged.
 *
 * @param url - The URL string to mask
 * @returns The URL with credentials masked
 *
 * @example
 * ```ts
 * maskUrl('https://admin:pass123@api.example.com/v1/data')
 * // → 'https://admin:***@api.example.com/v1/data'
 *
 * maskUrl('https://api.example.com/v1/data')
 * // → 'https://api.example.com/v1/data' (no credentials)
 * ```
 */
export function maskUrl(url: string): string {
  if (!url || typeof url !== "string") return url ?? "";

  // Match URLs with credentials: protocol://user:pass@host
  // This regex captures:
  //   group 1: protocol://
  //   group 2: username
  //   group 3: :password
  //   group 4: @host/path
  const credRegex = /^(https?:\/\/)([^:@\s]+)(:[^@\s]+)?(@.*)$/i;
  const match = url.match(credRegex);

  if (match) {
    const protocol = match[1];
    const username = match[2];
    // group 4 includes the @ and the rest
    const remainder = match[4];
    return `${protocol}${username}:***${remainder}`;
  }

  return url;
}

// ---------------------------------------------------------------------------
// Convenience: mask for logging
// ---------------------------------------------------------------------------

/**
 * Prepare an object for safe logging by masking all known sensitive fields
 * and any additional keys provided.
 *
 * This is a convenience wrapper around `maskObject` that also handles
 * the URL masking of any field named `url` that contains credentials.
 *
 * @param data           - The data to prepare for logging
 * @param extraKeys      - Additional key names to mask
 * @returns A new object safe for logging
 *
 * @example
 * ```ts
 * const safe = maskForLogging(
 *   { user: 'admin', password: 's3cret', callbackUrl: 'https://u:p@host' },
 *   []
 * );
 * // → { user: 'admin', password: 's3cr***', callbackUrl: 'https://u:***@host' }
 * ```
 */
export function maskForLogging(
  data: Record<string, unknown>,
  extraKeys: string[] = []
): Record<string, unknown> {
  // First, mask sensitive fields
  const masked = maskObject(data, extraKeys);

  // Then, mask any URL fields that might contain credentials
  for (const [key, value] of Object.entries(masked)) {
    if (typeof value === "string" && value.includes("://") && value.includes("@")) {
      masked[key] = maskUrl(value);
    }
  }

  return masked;
}
