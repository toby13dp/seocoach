// ============================================================================
// API Permissions — AI-Driven SEO Automation Platform (SEC-002)
// ============================================================================
// Centralized API permission checking with role-based access control,
// route-pattern matching, and object-level permission support.
// ============================================================================

import type { Role } from "@/lib/permissions";

// ---------------------------------------------------------------------------
// Role types (re-exported for convenience)
// ---------------------------------------------------------------------------

/**
 * All supported user roles in the platform.
 * Mirrors the Prisma enum and the ROLES constant in permissions.ts.
 */
export type ApiRole =
  | "PLATFORM_ADMIN"
  | "ORG_OWNER"
  | "AGENCY_OWNER"
  | "SEO_MANAGER"
  | "CONTENT_MANAGER"
  | "EDITOR"
  | "DEVELOPER"
  | "CLIENT"
  | "READ_ONLY";

/** The set of all valid API roles */
export const API_ROLES: Set<string> = new Set<ApiRole>([
  "PLATFORM_ADMIN",
  "ORG_OWNER",
  "AGENCY_OWNER",
  "SEO_MANAGER",
  "CONTENT_MANAGER",
  "EDITOR",
  "DEVELOPER",
  "CLIENT",
  "READ_ONLY",
]);

// ---------------------------------------------------------------------------
// Permission map: route patterns → required roles per HTTP method
// ---------------------------------------------------------------------------

/**
 * A route-permission entry defines which roles are allowed to access a
 * particular API route pattern for specific HTTP methods.
 */
interface RoutePermission {
  /** Regex pattern to match against the API path */
  pattern: RegExp;
  /** HTTP methods this rule applies to ("*" means all methods) */
  methods: string[];
  /** Roles that are allowed access */
  allowedRoles: ApiRole[];
  /** Human-readable description of the route (for audit logs) */
  description: string;
}

/**
 * The master permission map that determines which roles can access which
 * API route patterns.
 *
 * Routes are evaluated in order; the **first** matching rule wins.
 * If no rule matches, the request is **denied** (deny-by-default).
 */
const ROUTE_PERMISSIONS: RoutePermission[] = [
  // ---- Auth routes ----
  {
    pattern: /^\/api\/auth\/.*/,
    methods: ["*"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Authenticatie-endpoints",
  },

  // ---- Platform admin routes ----
  {
    pattern: /^\/api\/admin\/.*/,
    methods: ["*"],
    allowedRoles: ["PLATFORM_ADMIN"],
    description: "Platformbeheer-endpoints",
  },

  // ---- Organization management ----
  {
    pattern: /^\/api\/organizations\/[^/]+$/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Organisatiegegevens raadplegen",
  },
  {
    pattern: /^\/api\/organizations\/[^/]+$/,
    methods: ["PUT", "PATCH", "DELETE"],
    allowedRoles: ["PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER"],
    description: "Organisatie-instellingen wijzigen",
  },

  // ---- Project management ----
  {
    pattern: /^\/api\/projects$/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Projecten raadplegen",
  },
  {
    pattern: /^\/api\/projects$/,
    methods: ["POST"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "DEVELOPER",
    ],
    description: "Projecten aanmaken",
  },
  {
    pattern: /^\/api\/projects\/[^/]+$/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Projectgegevens raadplegen",
  },
  {
    pattern: /^\/api\/projects\/[^/]+$/,
    methods: ["PUT", "PATCH", "DELETE"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
    ],
    description: "Projectgegevens wijzigen",
  },

  // ---- Crawl & Technical SEO ----
  {
    pattern: /^\/api\/projects\/[^/]+\/crawls/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Crawl-resultaten raadplegen",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/crawls/,
    methods: ["POST", "DELETE"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "DEVELOPER",
    ],
    description: "Crawls starten/annuleren",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/pages/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Pagina's raadplegen",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/issues/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Technische problemen raadplegen",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/issues/,
    methods: ["PATCH", "DELETE"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
    ],
    description: "Technische problemen wijzigen",
  },

  // ---- Keywords ----
  {
    pattern: /^\/api\/projects\/[^/]+\/keywords/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Zoekwoorden raadplegen",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/keywords/,
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER",
    ],
    description: "Zoekwoorden beheren",
  },

  // ---- Topics & Clusters ----
  {
    pattern: /^\/api\/projects\/[^/]+\/topics/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Onderwerpen raadplegen",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/topics/,
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER",
    ],
    description: "Onderwerpen beheren",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/clusters/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Clusters raadplegen",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/clusters/,
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER",
    ],
    description: "Clusters beheren",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/topic-relations/,
    methods: ["*"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER",
    ],
    description: "Onderwerprelaties beheren",
  },

  // ---- AI Providers ----
  {
    pattern: /^\/api\/projects\/[^/]+\/ai-providers/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "DEVELOPER",
    ],
    description: "AI-providers raadplegen",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/ai-providers/,
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    allowedRoles: ["PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "DEVELOPER"],
    description: "AI-providers beheren",
  },

  // ---- Content (briefs, drafts, quality) ----
  {
    pattern: /^\/api\/projects\/[^/]+\/briefs/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Contentbriefs raadplegen",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/briefs/,
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR",
    ],
    description: "Contentbriefs beheren",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/decay/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "CLIENT", "READ_ONLY",
    ],
    description: "Vervalanalyses raadplegen",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/decay/,
    methods: ["POST"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER",
    ],
    description: "Vervalanalyses uitvoeren",
  },

  // ---- Brand profiles ----
  {
    pattern: /^\/api\/projects\/[^/]+\/brand-profile/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Merkprofiel raadplegen",
  },
  {
    pattern: /^\/api\/projects\/[^/]+\/brand-profile/,
    methods: ["POST", "PUT", "PATCH"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER",
    ],
    description: "Merkprofiel beheren",
  },

  // ---- Audit logs ----
  {
    pattern: /^\/api\/audit-logs/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
    ],
    description: "Auditlogboeken raadplegen",
  },

  // ---- Jobs ----
  {
    pattern: /^\/api\/jobs/,
    methods: ["GET"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "DEVELOPER",
    ],
    description: "Taken raadplegen",
  },

  // ---- User settings ----
  {
    pattern: /^\/api\/user\/settings/,
    methods: ["GET", "PUT", "PATCH"],
    allowedRoles: [
      "PLATFORM_ADMIN", "ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER",
      "CONTENT_MANAGER", "EDITOR", "DEVELOPER", "CLIENT", "READ_ONLY",
    ],
    description: "Gebruikersinstellingen beheren",
  },

  // ---- Catch-all: deny by default ----
];

// ---------------------------------------------------------------------------
// Permission checking
// ---------------------------------------------------------------------------

/**
 * Check whether a user with the given role is allowed to access the
 * specified API path using the specified HTTP method.
 *
 * The function iterates through the route permission map and returns
 * `true` if the first matching rule includes the user's role.
 * If no rule matches, the request is **denied** (deny-by-default).
 *
 * @param path     - The API route path (e.g. `/api/projects/123/keywords`)
 * @param method   - The HTTP method (e.g. `GET`, `POST`)
 * @param userRole - The user's role (e.g. `SEO_MANAGER`)
 * @returns `true` if the request is allowed, `false` otherwise
 *
 * @example
 * ```ts
 * checkApiPermission('/api/admin/users', 'DELETE', 'EDITOR') // → false
 * checkApiPermission('/api/projects/123/keywords', 'GET', 'EDITOR') // → true
 * ```
 */
export function checkApiPermission(
  path: string,
  method: string,
  userRole: string
): boolean {
  const upperMethod = method.toUpperCase();

  for (const rule of ROUTE_PERMISSIONS) {
    if (!rule.pattern.test(path)) continue;

    // Check if the method matches (or rule allows all methods)
    if (rule.methods[0] !== "*" && !rule.methods.includes(upperMethod)) {
      continue;
    }

    // First matching rule — check if the role is allowed
    return rule.allowedRoles.includes(userRole as ApiRole);
  }

  // No matching rule — deny by default
  return false;
}

// ---------------------------------------------------------------------------
// Object-level permission checking
// ---------------------------------------------------------------------------

/**
 * Context provided for object-level permission checks.
 */
export interface ObjectPermissionContext {
  /** The user's ID */
  userId: string;
  /** The user's role */
  userRole: ApiRole;
  /** The organisation ID the user belongs to */
  organisationId?: string;
  /** The target resource's organisation ID (for tenant isolation) */
  resourceOrganisationId?: string;
  /** The target resource's project ID */
  resourceProjectId?: string;
  /** The action being performed */
  action: "read" | "create" | "update" | "delete";
}

/**
 * Check object-level permissions.
 *
 * This enforces tenant isolation: a user can only access resources that
 * belong to their own organisation (unless they are a PLATFORM_ADMIN).
 *
 * @param ctx - The permission context with user and resource info
 * @returns `true` if the user has access to the object, `false` otherwise
 *
 * @example
 * ```ts
 * const allowed = checkObjectPermission({
 *   userId: 'user_123',
 *   userRole: 'SEO_MANAGER',
 *   organisationId: 'org_abc',
 *   resourceOrganisationId: 'org_abc',
 *   action: 'update',
 * }); // → true (same organisation)
 * ```
 */
export function checkObjectPermission(ctx: ObjectPermissionContext): boolean {
  // Platform admins have access to everything
  if (ctx.userRole === "PLATFORM_ADMIN") return true;

  // Tenant isolation: resource must belong to the user's organisation
  if (ctx.resourceOrganisationId && ctx.organisationId) {
    if (ctx.resourceOrganisationId !== ctx.organisationId) {
      return false;
    }
  }

  // READ_ONLY role can only read
  if (ctx.userRole === "READ_ONLY" && ctx.action !== "read") {
    return false;
  }

  // CLIENT role can only read
  if (ctx.userRole === "CLIENT" && ctx.action !== "read") {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Permission decorator / wrapper for API routes
// ---------------------------------------------------------------------------

/**
 * Result of a permission check performed by `requirePermission`.
 */
export interface PermissionCheckResult {
  /** Whether the permission check passed */
  allowed: boolean;
  /** Human-readable error message in Dutch (only set when `allowed` is false) */
  error?: string;
  /** HTTP status code to return (only set when `allowed` is false) */
  statusCode?: number;
}

/**
 * Require a specific permission for an API route.
 *
 * This is a wrapper/decorator that can be used to guard API route handlers.
 * It checks whether the given role has the specified permission.
 *
 * @param permission - The permission string to check (e.g. `"MANAGE_PROJECTS"`)
 * @returns A function that accepts a role and returns a `PermissionCheckResult`
 *
 * @example
 * ```ts
 * // In an API route handler:
 * const check = requirePermission('MANAGE_PROJECTS');
 * const result = check(userRole);
 * if (!result.allowed) {
 *   return Response.json({ error: result.error }, { status: result.statusCode });
 * }
 * ```
 */
export function requirePermission(
  permission: string
): (role: string) => PermissionCheckResult {
  // Import permission helpers lazily to avoid circular deps at module level
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { hasPermission: checkPerm } = require("@/lib/permissions");

  return (role: string): PermissionCheckResult => {
    try {
      const allowed = checkPerm(role as Role, permission);
      if (!allowed) {
        return {
          allowed: false,
          error: "U heeft geen toestemming voor deze actie",
          statusCode: 403,
        };
      }
      return { allowed: true };
    } catch {
      return {
        allowed: false,
        error: "Kan machtiging niet verifiëren",
        statusCode: 500,
      };
    }
  };
}

/**
 * Higher-order function that wraps an API route handler with permission
 * checking. If the user's role does not have the required permission,
 * a 403 response is returned immediately.
 *
 * @param permission - The permission required to access the route
 * @param handler    - The actual route handler function
 * @returns A wrapped handler that enforces the permission check
 *
 * @example
 * ```ts
 * export const POST = withPermission('MANAGE_CONTENT', async (request) => {
 *   // This handler only runs if the user has MANAGE_CONTENT permission
 *   return Response.json({ success: true });
 * });
 * ```
 */
export function withPermission(
  permission: string,
  handler: (request: Request, ctx?: unknown) => Promise<Response> | Response
): (request: Request, ctx?: unknown) => Promise<Response> | Response {
  return async (request: Request, ctx?: unknown): Promise<Response> => {
    // Extract role from request (typically from auth session or middleware headers)
    const userRole = request.headers.get("x-user-role") ?? "";

    if (!userRole) {
      return Response.json(
        { error: "Authenticatie vereist" },
        { status: 401 }
      );
    }

    const check = requirePermission(permission);
    const result = check(userRole);

    if (!result.allowed) {
      return Response.json(
        { error: result.error },
        { status: result.statusCode }
      );
    }

    return handler(request, ctx);
  };
}

// ---------------------------------------------------------------------------
// Utility: get the description of the matched permission rule
// ---------------------------------------------------------------------------

/**
 * Look up the human-readable description of the permission rule that
 * matches the given path and method.
 *
 * @param path   - The API route path
 * @param method - The HTTP method
 * @returns The description string, or "Onbekende route" if no match
 */
export function getRouteDescription(path: string, method: string): string {
  const upperMethod = method.toUpperCase();

  for (const rule of ROUTE_PERMISSIONS) {
    if (!rule.pattern.test(path)) continue;
    if (rule.methods[0] !== "*" && !rule.methods.includes(upperMethod)) {
      continue;
    }
    return rule.description;
  }

  return "Onbekende route";
}
