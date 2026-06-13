// ============================================================================
// CSRF Protection — AI-Driven SEO Automation Platform (SEC-001)
// ============================================================================
// Cross-Site Request Forgery protection using the double-submit cookie pattern
// with timing-safe token comparison and origin/referer validation.
// ============================================================================

import { randomBytes, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Name of the cookie used to store the CSRF token */
export const CSRF_COOKIE_NAME = "__Host-csrf-token";

/** Name of the header used to send the CSRF token */
export const CSRF_HEADER_NAME = "x-csrf-token";

/** Length of the CSRF token in bytes (before hex encoding → 64 chars) */
const CSRF_TOKEN_BYTES = 32;

/** Token expiration time in milliseconds (1 hour) */
const CSRF_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Structure of a CSRF token with its creation timestamp.
 */
interface CsrfTokenPayload {
  /** The random token value (hex-encoded) */
  token: string;
  /** Unix timestamp (ms) when the token was created */
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random CSRF token.
 *
 * Uses Node.js `crypto.randomBytes` for secure random generation.
 * The token is hex-encoded for safe transport in headers and cookies.
 *
 * @returns A hex-encoded random token string (64 characters)
 *
 * @example
 * ```ts
 * const token = generateCsrfToken();
 * // e.g. 'a3f2b8c1d4e5f6...'(64 hex chars)
 * ```
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString("hex");
}

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

/**
 * Validate a CSRF token against the expected value using a **timing-safe**
 * comparison to prevent timing attacks.
 *
 * Both values must be strings of the same length; if they differ in length
 * the function returns `false` immediately (without leaking which is longer).
 *
 * @param token    - The CSRF token provided by the client (header or body)
 * @param expected - The expected CSRF token (from the cookie)
 * @returns `true` if the tokens match, `false` otherwise
 *
 * @example
 * ```ts
 * const cookieToken = req.cookies.get(CSRF_COOKIE_NAME);
 * const headerToken = req.headers.get(CSRF_HEADER_NAME);
 *
 * if (!validateCsrfToken(headerToken, cookieToken)) {
 *   return new Response('CSRF-validatie mislukt', { status: 403 });
 * }
 * ```
 */
export function validateCsrfToken(token: string, expected: string): boolean {
  if (!token || !expected) return false;

  // Ensure both are strings
  if (typeof token !== "string" || typeof expected !== "string") return false;

  // If lengths differ, still do a comparison to avoid timing leaks
  // but the result is always false
  if (token.length !== expected.length) {
    // Compare against itself to maintain constant time
    timingSafeEqual(Buffer.from(token), Buffer.from(token));
    return false;
  }

  try {
    const tokenBuf = Buffer.from(token, "utf-8");
    const expectedBuf = Buffer.from(expected, "utf-8");
    return timingSafeEqual(tokenBuf, expectedBuf);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Double-submit cookie helpers
// ---------------------------------------------------------------------------

/**
 * Extract and validate CSRF tokens from a request using the double-submit
 * cookie pattern.
 *
 * The pattern works as follows:
 * 1. On GET requests, the server sets a cookie with a random CSRF token.
 * 2. On mutation requests (POST, PUT, PATCH, DELETE), the client must send
 *    the same token in both a cookie and a custom header.
 * 3. The server compares the two values using a timing-safe comparison.
 *
 * @param request - The incoming HTTP request
 * @returns An object containing the token from the header and the cookie
 *
 * @example
 * ```ts
 * const { token, cookie } = getCsrfHeaders(request);
 * if (!validateCsrfToken(token, cookie)) {
 *   return new Response('CSRF-validatie mislukt', { status: 403 });
 * }
 * ```
 */
export function getCsrfHeaders(
  request: Request
): { token: string; cookie: string } {
  // Extract token from the custom header
  const token = request.headers.get(CSRF_HEADER_NAME) ?? "";

  // Extract token from the cookie
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = extractCookieValue(cookieHeader, CSRF_COOKIE_NAME);

  return { token, cookie };
}

/**
 * Extract a specific cookie value from a cookie header string.
 *
 * @param cookieHeader - The raw `Cookie` header value
 * @param name         - The name of the cookie to extract
 * @returns The cookie value, or an empty string if not found
 */
function extractCookieValue(cookieHeader: string, name: string): string {
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Token payload helpers
// ---------------------------------------------------------------------------

/**
 * Create a CSRF token payload that includes a creation timestamp.
 * The payload is encoded as a base64 string for compact storage.
 *
 * @returns A base64-encoded token payload string
 */
export function createCsrfTokenPayload(): string {
  const payload: CsrfTokenPayload = {
    token: generateCsrfToken(),
    createdAt: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Parse and validate a CSRF token payload.
 *
 * Checks that the payload is well-formed and has not expired.
 *
 * @param encoded - The base64-encoded token payload
 * @returns The parsed payload, or `null` if invalid or expired
 */
export function parseCsrfTokenPayload(
  encoded: string
): CsrfTokenPayload | null {
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const payload: CsrfTokenPayload = JSON.parse(decoded);

    if (!payload.token || !payload.createdAt) return null;

    // Check expiration
    if (Date.now() - payload.createdAt > CSRF_TOKEN_EXPIRY_MS) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Origin / Referer validation
// ---------------------------------------------------------------------------

/**
 * Validate the `Origin` or `Referer` header of a request against the
 * configured `NEXTAUTH_URL` environment variable.
 *
 * This provides an additional layer of CSRF protection by ensuring that
 * mutation requests originate from the same application domain.
 *
 * @param request - The incoming HTTP request
 * @returns `true` if the origin/referer is valid, `false` otherwise
 *
 * @example
 * ```ts
 * if (!validateOrigin(request)) {
 *   return new Response('Oorsprongvalidatie mislukt', { status: 403 });
 * }
 * ```
 */
export function validateOrigin(request: Request): boolean {
  const nextauthUrl = process.env.NEXTAUTH_URL;
  if (!nextauthUrl) {
    // If NEXTAUTH_URL is not configured, skip origin validation
    // (should be configured in production!)
    return true;
  }

  let allowedOrigin: string;
  try {
    const parsed = new URL(nextauthUrl);
    allowedOrigin = parsed.origin; // e.g. "https://seocoach.nl"
  } catch {
    return false;
  }

  // Check Origin header first (preferred for CSRF protection)
  const origin = request.headers.get("origin");
  if (origin) {
    return origin === allowedOrigin;
  }

  // Fall back to Referer header
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return refererOrigin === allowedOrigin;
    } catch {
      return false;
    }
  }

  // If neither Origin nor Referer is present, reject the request
  // (strict mode — browsers always send Origin on CORS requests
  // and Referer on same-origin navigations)
  return false;
}

// ---------------------------------------------------------------------------
// Comprehensive CSRF check for API routes
// ---------------------------------------------------------------------------

/**
 * Perform a comprehensive CSRF check on a mutation request.
 *
 * This function:
 * 1. Validates the Origin/Referer header against NEXTAUTH_URL
 * 2. Extracts the CSRF token from the header and cookie
 * 3. Compares them using a timing-safe comparison
 *
 * @param request - The incoming HTTP request
 * @returns `true` if the request passes all CSRF checks, `false` otherwise
 *
 * @example
 * ```ts
 * // In an API route handler:
 * if (request.method !== 'GET' && !checkCsrf(request)) {
 *   return Response.json(
 *     { error: 'CSRF-validatie mislukt' },
 *     { status: 403 }
 *   );
 * }
 * ```
 */
export function checkCsrf(request: Request): boolean {
  // Step 1: Validate origin/referer
  if (!validateOrigin(request)) {
    return false;
  }

  // Step 2: Double-submit cookie pattern
  const { token, cookie } = getCsrfHeaders(request);

  // Both header and cookie must be present
  if (!token || !cookie) {
    return false;
  }

  // Step 3: Timing-safe comparison
  return validateCsrfToken(token, cookie);
}
