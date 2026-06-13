// ============================================================================
// RBAC Permission System — AI-Driven SEO Automation Platform
// ============================================================================

// ---------------------------------------------------------------------------
// Permission Constants
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_PROJECTS: "MANAGE_PROJECTS",
  MANAGE_CONTENT: "MANAGE_CONTENT",
  MANAGE_SETTINGS: "MANAGE_SETTINGS",
  VIEW_ANALYTICS: "VIEW_ANALYTICS",
  MANAGE_INTEGRATIONS: "MANAGE_INTEGRATIONS",
  MANAGE_PUBLISHING: "MANAGE_PUBLISHING",
  VIEW_REPORTS: "VIEW_REPORTS",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ---------------------------------------------------------------------------
// Role type (mirrors Prisma enum)
// ---------------------------------------------------------------------------

export const ROLES = {
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  ORG_OWNER: "ORG_OWNER",
  AGENCY_OWNER: "AGENCY_OWNER",
  SEO_MANAGER: "SEO_MANAGER",
  CONTENT_MANAGER: "CONTENT_MANAGER",
  EDITOR: "EDITOR",
  DEVELOPER: "DEVELOPER",
  CLIENT: "CLIENT",
  READ_ONLY: "READ_ONLY",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// ---------------------------------------------------------------------------
// Role → Permission Mapping
// ---------------------------------------------------------------------------

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  PLATFORM_ADMIN: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.MANAGE_CONTENT,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.MANAGE_INTEGRATIONS,
    PERMISSIONS.MANAGE_PUBLISHING,
    PERMISSIONS.VIEW_REPORTS,
  ],

  ORG_OWNER: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.MANAGE_CONTENT,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.MANAGE_INTEGRATIONS,
    PERMISSIONS.MANAGE_PUBLISHING,
    PERMISSIONS.VIEW_REPORTS,
  ],

  AGENCY_OWNER: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.MANAGE_CONTENT,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_INTEGRATIONS,
  ],

  SEO_MANAGER: [
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.MANAGE_CONTENT,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_INTEGRATIONS,
  ],

  CONTENT_MANAGER: [
    PERMISSIONS.MANAGE_CONTENT,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_REPORTS,
  ],

  EDITOR: [
    PERMISSIONS.MANAGE_CONTENT,
    PERMISSIONS.VIEW_REPORTS,
  ],

  DEVELOPER: [
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.MANAGE_INTEGRATIONS,
  ],

  CLIENT: [
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_ANALYTICS,
  ],

  READ_ONLY: [
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_ANALYTICS,
  ],
};

// ---------------------------------------------------------------------------
// Action type
// ---------------------------------------------------------------------------

export type Action =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "manage"
  | "invite"
  | "remove"
  | "publish"
  | "configure"
  | "view";

// ---------------------------------------------------------------------------
// Helper: permission → actions mapping
// ---------------------------------------------------------------------------

const PERMISSION_ACTIONS: Record<Permission, Action[]> = {
  MANAGE_USERS: ["create", "read", "update", "delete", "invite", "remove"],
  MANAGE_PROJECTS: ["create", "read", "update", "delete", "configure"],
  MANAGE_CONTENT: ["create", "read", "update", "delete", "publish"],
  MANAGE_SETTINGS: ["read", "update", "configure"],
  VIEW_ANALYTICS: ["read", "view"],
  MANAGE_INTEGRATIONS: ["create", "read", "update", "delete", "configure"],
  MANAGE_PUBLISHING: ["create", "read", "update", "publish"],
  VIEW_REPORTS: ["read", "view"],
};

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Return the full list of permissions assigned to a given role.
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check whether a role has a specific permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return permissions.includes(permission);
}

/**
 * Determine whether a role can access project-level resources.
 * A role can access projects if it holds MANAGE_PROJECTS, VIEW_ANALYTICS,
 * VIEW_REPORTS, or MANAGE_CONTENT.
 */
export function canAccessProject(role: Role): boolean {
  const projectPermissions: Permission[] = [
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.MANAGE_CONTENT,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_REPORTS,
  ];

  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return projectPermissions.some((p) => permissions.includes(p));
}

/**
 * Determine whether a role can perform a specific action.
 * This cross-references the permission→actions mapping.
 * If the role has a permission that allows the requested action, returns true.
 */
export function canPerformAction(role: Role, action: Action): boolean {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return permissions.some((perm) => {
    const allowed = PERMISSION_ACTIONS[perm] ?? [];
    return allowed.includes(action);
  });
}
