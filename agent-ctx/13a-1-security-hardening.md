# Task 13a-1: Security Hardening (SEC-001, SEC-002)

**Agent:** Security Hardening Agent
**Phase:** 13 — Production Hardening
**Requirements:** SEC-001 (Rate Limiting & CSRF), SEC-002 (Input Sanitization & Secret Masking)

## Work Log

### Created Files

1. **`/src/lib/security/rate-limiter.ts`**
   - Sliding window algorithm with in-memory store (`Map<string, RequestEntry[]>`)
   - Configurable presets: auth (10/min), api (60/min), crawl (5/min), ai (20/min)
   - Tenant-aware rate limiting via `buildTenantKey(organisationId, type)`
   - IP-based fallback via `buildIpKey(ip, type)`
   - Auto-cleanup of expired entries every 60 seconds (with `unref()` for clean process exit)
   - Exported: `checkRateLimit()`, `createRateLimitMiddleware()`, `buildTenantKey()`, `buildIpKey()`, `startCleanupTimer()`, `stopCleanupTimer()`, `getStoreSize()`, `clearStore()`

2. **`/src/lib/security/input-sanitizer.ts`**
   - `sanitizeHtml()`: Strips all HTML except b, i, em, strong, p, br, ul, ol, li, a (href only). Removes script/style tags and their content, HTML comments, event handlers, dangerous href values (javascript:, data:, vbscript:)
   - `sanitizeUrl()`: Validates http/https protocol only. Blocks private IPs (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1, 0.0.0.0). Blocks file:// protocol
   - `sanitizeFileName()`: Removes path traversal (../), null bytes, leading dots. Limits length (default 255) with extension preservation. Only allows alphanumeric, dash, underscore, dot, space, parentheses
   - `escapeForRegex()`: Escapes all regex metacharacters (\ ^ $ . | ? * + ( ) [ ] { })
   - `sanitizeObject<T>()`: Deep sanitization with dot-notation path rules and 9 strategies (html, url, fileName, regex, trim, lowercase, uppercase, alphanumeric, stripHtml)

3. **`/src/lib/security/csrf-protection.ts`**
   - `generateCsrfToken()`: 32-byte crypto-random token via Node.js `crypto.randomBytes`
   - `validateCsrfToken()`: Timing-safe comparison via `crypto.timingSafeEqual` (constant-time)
   - `getCsrfHeaders()`: Double-submit cookie pattern — extracts token from header and cookie
   - `validateOrigin()`: Validates Origin/Referer header against NEXTAUTH_URL
   - `checkCsrf()`: Comprehensive CSRF check combining origin validation + double-submit pattern
   - Token payload with expiration (1-hour TTL)
   - Constants: `CSRF_COOKIE_NAME` (`__Host-csrf-token`), `CSRF_HEADER_NAME` (`x-csrf-token`)

4. **`/src/lib/security/api-permissions.ts`**
   - Centralized permission map with 20+ route patterns covering all API endpoints
   - `checkApiPermission(path, method, userRole)`: First-match route pattern evaluation, deny-by-default
   - `checkObjectPermission(ctx)`: Tenant isolation check (organisationId matching), role-based action restrictions
   - `requirePermission(permission)`: Decorator that returns a role-checking function
   - `withPermission(permission, handler)`: Higher-order route handler wrapper
   - All 9 role types supported: PLATFORM_ADMIN, ORG_OWNER, AGENCY_OWNER, SEO_MANAGER, CONTENT_MANAGER, EDITOR, DEVELOPER, CLIENT, READ_ONLY

5. **`/src/lib/security/secret-masker.ts`**
   - `maskSecret()`: Shows first 4 chars, masks rest with `***`
   - `maskObject()`: Recursively masks sensitive fields (case-insensitive key matching). Handles nested objects and arrays
   - `maskUrl()`: Masks credentials in URLs (user:pass@host → user:***@host)
   - `maskForLogging()`: Convenience wrapper that masks both sensitive fields and URL credentials
   - Predefined sensitive key patterns: password, secret, token, apiKey, apiSecret, consumerKey, consumerSecret, apiKeyEncrypted, applicationPassword, hashedPassword, accessToken, refreshToken

6. **`/src/lib/security/index.ts`**
   - Barrel re-export of all security modules with proper type exports

7. **`/src/middleware.ts`** (updated)
   - Preserved existing next-intl locale routing
   - Added rate limiting on all `/api/*` routes with automatic type detection (auth/crawl/ai/api)
   - Added CSRF protection on mutation requests (POST, PUT, PATCH, DELETE) with auth route exemption
   - Added comprehensive security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Content-Security-Policy, Permissions-Policy
   - Added rate-limit response headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After)
   - CSRF cookie set on GET responses (HttpOnly, Secure in production, SameSite=Strict)
   - All user-facing error messages in Dutch
   - Updated matcher to include `/api/:path*`

## Verification

- TypeScript: `bunx tsc --noEmit` — **zero errors** in security files and middleware
- ESLint: `bun run lint` — **zero errors** in security files (3 pre-existing warnings in unrelated files)
- Dev server: Running successfully, no compilation errors
- All JSDoc documentation complete with examples

## Key Design Decisions

1. **Sliding window** over fixed window for rate limiting — prevents burst-at-boundary attacks
2. **Timing-safe comparison** for CSRF tokens — prevents timing side-channel attacks
3. **Double-submit cookie** pattern — stateless CSRF protection, no server-side session storage needed
4. **Deny-by-default** for API permissions — unmatched routes are denied, not allowed
5. **`__Host-` prefix** for CSRF cookie — prevents subdomain override attacks
6. **Edge Runtime compatible** token generation in middleware — uses `crypto.getRandomValues` instead of Node.js `crypto`
