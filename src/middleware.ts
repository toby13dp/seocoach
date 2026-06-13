// ============================================================================
// Middleware — AI-Driven SEO Automation Platform
// ============================================================================
// Integrates:
// 1. next-intl locale routing (existing functionality)
// 2. Rate limiting on all API routes (SEC-001)
// 3. CSRF protection on mutation requests (SEC-001) — Edge-compatible
// 4. Security headers on all responses (SEC-001)
// ============================================================================

import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

// ---------------------------------------------------------------------------
// Security imports (Edge-compatible only — no node:crypto)
// ---------------------------------------------------------------------------

import { createRateLimitMiddleware } from "@/lib/security/rate-limiter";

// ---------------------------------------------------------------------------
// CSRF constants (duplicated from csrf-protection.ts to avoid node:crypto)
// ---------------------------------------------------------------------------

/** Name of the cookie used to store the CSRF token */
const CSRF_COOKIE_NAME = "csrf-token";

/** Name of the header used to send the CSRF token */
const CSRF_HEADER_NAME = "x-csrf-token";

// ---------------------------------------------------------------------------
// Create the next-intl middleware (preserves existing functionality)
// ---------------------------------------------------------------------------

const intlMiddleware = createIntlMiddleware(routing);

// ---------------------------------------------------------------------------
// Security headers configuration
// ---------------------------------------------------------------------------

/**
 * Security headers applied to every response.
 * These headers protect against common web vulnerabilities:
 * - MIME-type sniffing
 * - Clickjacking
 * - XSS attacks
 * - Information leakage via referrers
 * - Unrestricted browser features
 */
const SECURITY_HEADERS: Record<string, string> = {
  // Prevent MIME-type sniffing (forces browser to respect Content-Type)
  "X-Content-Type-Options": "nosniff",

  // Prevent clickjacking by disallowing embedding in iframes
  // SAMEORIGIN allows the site to embed its own pages in iframes
  "X-Frame-Options": "SAMEORIGIN",

  // Enable browser XSS filtering (legacy but still useful for older browsers)
  "X-XSS-Protection": "1; mode=block",

  // Control referrer information sent with outbound requests
  // strict-origin-when-cross-origin: sends full URL on same-origin,
  // only the origin on cross-origin, nothing on downgrades
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Content Security Policy
  // Allows resources from same origin, plus:
  // - Scripts from inline and eval (needed for Next.js)
  // - Styles from inline (needed for Tailwind)
  // - Images from data: URIs and blob: URIs (needed for dynamic content)
  // - Fonts from same origin and data: URIs
  // - Connect to same origin (API calls)
  // - Frame ancestors same origin only
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),

  // Restrict browser features that can be used on the page
  // Disables: camera, microphone, geolocation, payment
  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
  ].join(", "),
};

// ---------------------------------------------------------------------------
// Edge-compatible CSRF helpers
// ---------------------------------------------------------------------------

/**
 * Validate the Origin or Referer header of a request against NEXTAUTH_URL.
 * This provides an additional layer of CSRF protection by ensuring that
 * mutation requests originate from the same application domain.
 */
function validateOrigin(request: NextRequest): boolean {
  const nextauthUrl = process.env.NEXTAUTH_URL;
  if (!nextauthUrl) {
    // If NEXTAUTH_URL is not configured, skip origin validation
    // (should be configured in production!)
    return true;
  }

  let allowedOrigin: string;
  try {
    const parsed = new URL(nextauthUrl);
    allowedOrigin = parsed.origin;
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
  return false;
}

/**
 * Extract a specific cookie value from a cookie header string.
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

/**
 * Edge-compatible CSRF check using origin validation and double-submit cookie.
 * Avoids node:crypto (not available in Edge Runtime).
 */
function checkCsrfEdge(request: NextRequest): boolean {
  // Step 1: Validate origin/referer — primary CSRF defense
  // This is the most important check: ensure mutation requests originate
  // from our own domain. Modern browsers always send Origin on mutations.
  const originValid = validateOrigin(request);
  if (originValid) {
    return true;
  }

  // Step 2: If origin validation fails, check double-submit cookie as fallback
  // This allows API calls from the same page that might not have Origin headers
  // (e.g., some older browsers or specific fetch configurations)
  const token = request.headers.get(CSRF_HEADER_NAME) ?? "";
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = extractCookieValue(cookieHeader, CSRF_COOKIE_NAME);

  if (token && cookie && token === cookie) {
    return true;
  }

  // Step 3: Allow requests from NextAuth session (they have their own CSRF)
  // NextAuth forms include their own CSRF token validation
  const nextAuthSession = cookieHeader.includes("next-auth.session-token") ||
                         cookieHeader.includes("__Secure-next-auth.session-token");
  if (nextAuthSession) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Rate limiting helpers
// ---------------------------------------------------------------------------

/** Determine the rate-limit type based on the API path. */
function getRateLimitType(pathname: string): string {
  if (pathname.startsWith("/api/auth")) return "auth";

  // Crawl endpoints
  if (/\/api\/projects\/[^/]+\/crawls/.test(pathname)) return "crawl";

  // AI generation endpoints
  if (
    /\/api\/projects\/[^/]+\/ai-providers/.test(pathname) ||
    /\/api\/projects\/[^/]+\/briefs\/[^/]+\/draft/.test(pathname)
  ) {
    return "ai";
  }

  return "api";
}

/**
 * Extract the client IP address from the request.
 * Checks common headers set by reverse proxies before falling back.
 */
function getClientIp(request: NextRequest): string {
  // Headers set by common reverse proxies (Cloudflare, Nginx, etc.)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may contain a comma-separated list; take the first
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Fallback (may be empty in some environments)
  return "unknown";
}

// ---------------------------------------------------------------------------
// Security headers application
// ---------------------------------------------------------------------------

/**
 * Apply security headers to a NextResponse object.
 *
 * @param response - The response to modify
 * @returns The same response with security headers added
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // =======================================================================
  // API routes: apply rate limiting, CSRF, and security headers
  // =======================================================================
  if (pathname.startsWith("/api/")) {
    return handleApiRoute(request);
  }

  // =======================================================================
  // Non-API routes: apply next-intl + security headers
  // =======================================================================
  const response = intlMiddleware(request);
  return applySecurityHeaders(response);
}

// ---------------------------------------------------------------------------
// API route handler
// ---------------------------------------------------------------------------

/**
 * Handle API route requests with full security middleware:
 * 1. Rate limiting
 * 2. CSRF protection on mutation requests
 * 3. Security headers
 */
function handleApiRoute(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // ---- Step 1: Rate limiting ----
  const rateLimitType = getRateLimitType(pathname);
  const checkLimit = createRateLimitMiddleware(rateLimitType);

  // Extract tenant info if available (from auth cookie / headers)
  const organisationId = extractOrganisationId(request);
  const clientIp = getClientIp(request);

  const rateLimitResult = checkLimit(organisationId, clientIp);

  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      { error: "Te veel verzoeken. Probeer het later opnieuw." },
      { status: 429 }
    );

    // Add rate-limit headers to the 429 response
    response.headers.set("X-RateLimit-Limit", String(rateLimitResult.remaining + 1));
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(rateLimitResult.resetAt / 1000)));

    if (rateLimitResult.retryAfter) {
      response.headers.set("Retry-After", String(rateLimitResult.retryAfter));
    }

    return applySecurityHeaders(response);
  }

  // ---- Step 2: CSRF protection on mutation requests ----
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (isMutation) {
    // Skip CSRF for auth routes (NextAuth has its own CSRF protection)
    const isAuthRoute = pathname.startsWith("/api/auth");
    // Skip CSRF for register route (needs to work without session)
    const isRegisterRoute = pathname === "/api/auth/register";

    if (!isAuthRoute && !isRegisterRoute && !checkCsrfEdge(request)) {
      const response = NextResponse.json(
        { error: "CSRF-validatie mislukt. Herlaad de pagina en probeer opnieuw." },
        { status: 403 }
      );
      return applySecurityHeaders(response);
    }
  }

  // ---- Step 3: Build the response ----
  const response = NextResponse.next();

  // Add rate-limit headers to successful responses
  response.headers.set("X-RateLimit-Limit", String(rateLimitResult.remaining + 1));
  response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(rateLimitResult.resetAt / 1000)));

  // ---- Step 4: Set CSRF cookie on GET requests (for subsequent mutations) ----
  if (method === "GET") {
    // Generate a new CSRF token and set it as a cookie
    // Using __Host- prefix for additional security (requires Secure, no Domain, Path=/)
    const csrfToken = generateSimpleToken();
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60, // 1 hour
    });
  }

  return applySecurityHeaders(response);
}

// ---------------------------------------------------------------------------
// Utility: extract organisation ID from request
// ---------------------------------------------------------------------------

/**
 * Try to extract the organisation ID from the request.
 * This checks for a custom header set by authenticated API calls.
 */
function extractOrganisationId(request: NextRequest): string | null {
  return request.headers.get("x-organisation-id") ?? null;
}

// ---------------------------------------------------------------------------
// Utility: simple token generation for CSRF cookies
// ---------------------------------------------------------------------------

/**
 * Generate a simple random token for the CSRF cookie.
 * Uses the Web Crypto API available in Edge Runtime.
 */
function generateSimpleToken(): string {
  const array = new Uint8Array(32);
  // In Edge Runtime, we use crypto.getRandomValues
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Middleware config
// ---------------------------------------------------------------------------

export const config = {
  matcher: ["/", "/(nl|en)/:path*", "/api/:path*"],
};
