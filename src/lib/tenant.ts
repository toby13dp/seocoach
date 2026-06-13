// ============================================================================
// Tenant Isolation — AI-Driven SEO Automation Platform
// ============================================================================

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Validate organization membership
// ---------------------------------------------------------------------------

/**
 * Verify that a user belongs to the given organization.
 * Returns the membership record (with role) or `null` if not a member.
 */
export async function validateTenantAccess(
  userId: string,
  organizationId: string
) {
  const membership = await db.organizationMembership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    select: {
      id: true,
      role: true,
      acceptedAt: true,
      deletedAt: true,
    },
  });

  // Not a member, or membership was soft-deleted, or invitation not yet accepted
  if (!membership || membership.deletedAt || !membership.acceptedAt) {
    return null;
  }

  return membership;
}

// ---------------------------------------------------------------------------
// Validate project access
// ---------------------------------------------------------------------------

/**
 * Verify that a user can access a given project.
 * This checks that the project belongs to an organization the user is a member of.
 * Returns the membership + project info or `null`.
 */
export async function validateProjectAccess(
  userId: string,
  projectId: string
) {
  const project = await db.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      organizationId: true,
      name: true,
      status: true,
    },
  });

  if (!project) {
    return null;
  }

  const membership = await validateTenantAccess(userId, project.organizationId);
  if (!membership) {
    return null;
  }

  return {
    project,
    membership,
  };
}

// ---------------------------------------------------------------------------
// Tenant filter helpers
// ---------------------------------------------------------------------------

/**
 * Returns a Prisma filter object scoped to the given organization.
 * Use this as a base `where` clause for organization-scoped queries.
 *
 * @example
 * ```ts
 * const filter = getTenantFilter(orgId);
 * const projects = await db.project.findMany({ where: filter });
 * ```
 */
export function getTenantFilter(organizationId: string) {
  return {
    organizationId,
    deletedAt: null,
  };
}

/**
 * Returns a Prisma filter object scoped to the given project.
 * Use this as a base `where` clause for project-scoped queries.
 *
 * @example
 * ```ts
 * const filter = getProjectFilter(projectId);
 * const jobs = await db.job.findMany({ where: filter });
 * ```
 */
export function getProjectFilter(projectId: string) {
  return {
    projectId,
    deletedAt: null,
  };
}
