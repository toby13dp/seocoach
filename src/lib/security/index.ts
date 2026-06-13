// ============================================================================
// Security Module — AI-Driven SEO Automation Platform
// ============================================================================
// Central entry point for all security-related utilities.
// Re-exports all sub-modules for convenient importing.
// ============================================================================

// ---- Rate Limiter ----
export {
  checkRateLimit,
  createRateLimitMiddleware,
  buildTenantKey,
  buildIpKey,
  startCleanupTimer,
  stopCleanupTimer,
  getStoreSize,
  clearStore,
  RATE_LIMIT_PRESETS,
} from "./rate-limiter";

export type {
  RateLimitConfig,
  RateLimitResult,
} from "./rate-limiter";

// ---- Input Sanitizer ----
export {
  sanitizeHtml,
  sanitizeUrl,
  sanitizeFileName,
  escapeForRegex,
  sanitizeObject,
} from "./input-sanitizer";

export type {
  SanitizeRules,
  SanitizeStrategy,
} from "./input-sanitizer";

// ---- CSRF Protection ----
export {
  generateCsrfToken,
  validateCsrfToken,
  getCsrfHeaders,
  createCsrfTokenPayload,
  parseCsrfTokenPayload,
  validateOrigin,
  checkCsrf,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from "./csrf-protection";

// ---- API Permissions ----
export {
  checkApiPermission,
  checkObjectPermission,
  requirePermission,
  withPermission,
  getRouteDescription,
  API_ROLES,
} from "./api-permissions";

export type {
  ApiRole,
  ObjectPermissionContext,
  PermissionCheckResult,
} from "./api-permissions";

// ---- Secret Masker ----
export {
  maskSecret,
  maskObject,
  maskUrl,
  maskForLogging,
  SENSITIVE_KEY_PATTERNS,
} from "./secret-masker";
