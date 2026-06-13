// ============================================================================
// Audit Logging — AI-Driven SEO Automation Platform
// ============================================================================

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

interface LogAuditEventParams {
  organizationId?: string | null;
  projectId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ---------------------------------------------------------------------------
// Core audit logger
// ---------------------------------------------------------------------------

/**
 * Create an AuditLog entry.
 * The `changes` object is serialised to JSON before storage.
 */
export async function logAuditEvent(params: LogAuditEventParams) {
  const {
    organizationId = null,
    projectId = null,
    userId = null,
    action,
    entity,
    entityId = null,
    changes = null,
    ipAddress = null,
    userAgent = null,
  } = params;

  return db.auditLog.create({
    data: {
      organizationId,
      projectId,
      userId,
      action,
      entity,
      entityId,
      changes: changes ? JSON.stringify(changes) : null,
      ipAddress,
      userAgent,
    },
  });
}

// ---------------------------------------------------------------------------
// Domain-specific helpers
// ---------------------------------------------------------------------------

interface AuditContext {
  organizationId?: string | null;
  projectId?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Log an authentication-related event (sign-in, sign-out, failed attempt, …).
 */
export async function logAuthEvent(
  action: string,
  userId: string | null,
  details?: Record<string, unknown>,
  context?: Omit<AuditContext, "userId">
) {
  return logAuditEvent({
    organizationId: context?.organizationId ?? null,
    projectId: context?.projectId ?? null,
    userId,
    action,
    entity: "auth",
    entityId: userId,
    changes: details ?? null,
    ipAddress: context?.ipAddress ?? null,
    userAgent: context?.userAgent ?? null,
  });
}

/**
 * Log a membership change (invite, accept, remove, …).
 */
export async function logMembershipChange(
  action: string,
  membershipId: string,
  details: Record<string, unknown>,
  context: AuditContext
) {
  return logAuditEvent({
    organizationId: context.organizationId,
    projectId: context.projectId,
    userId: context.userId,
    action,
    entity: "organization_membership",
    entityId: membershipId,
    changes: details,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
}

/**
 * Log a role change event.
 */
export async function logRoleChange(
  membershipId: string,
  details: { previousRole: string; newRole: string; [key: string]: unknown },
  context: AuditContext
) {
  return logAuditEvent({
    organizationId: context.organizationId,
    projectId: context.projectId,
    userId: context.userId,
    action: "role_change",
    entity: "organization_membership",
    entityId: membershipId,
    changes: details,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
}

/**
 * Log a project-related change (create, update, archive, …).
 */
export async function logProjectChange(
  action: string,
  projectId: string,
  details?: Record<string, unknown>,
  context?: Omit<AuditContext, "projectId">
) {
  return logAuditEvent({
    organizationId: context?.organizationId ?? null,
    projectId,
    userId: context?.userId ?? null,
    action,
    entity: "project",
    entityId: projectId,
    changes: details ?? null,
    ipAddress: context?.ipAddress ?? null,
    userAgent: context?.userAgent ?? null,
  });
}

/**
 * Log a brand profile change.
 */
export async function logBrandProfileChange(
  action: string,
  brandProfileId: string,
  projectId: string,
  details?: Record<string, unknown>,
  context?: Omit<AuditContext, "projectId">
) {
  return logAuditEvent({
    organizationId: context?.organizationId ?? null,
    projectId,
    userId: context?.userId ?? null,
    action,
    entity: "brand_profile",
    entityId: brandProfileId,
    changes: details ?? null,
    ipAddress: context?.ipAddress ?? null,
    userAgent: context?.userAgent ?? null,
  });
}

/**
 * Log an integration change (connect, disconnect, configure, …).
 */
export async function logIntegrationChange(
  action: string,
  integrationId: string,
  details: Record<string, unknown>,
  context: AuditContext
) {
  return logAuditEvent({
    organizationId: context.organizationId,
    projectId: context.projectId,
    userId: context.userId,
    action,
    entity: "integration",
    entityId: integrationId,
    changes: details,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
}

/**
 * Log a sensitive / high-risk action (e.g. bulk delete, data export, API key rotation).
 */
export async function logSensitiveAction(
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, unknown>,
  context: AuditContext
) {
  return logAuditEvent({
    organizationId: context.organizationId,
    projectId: context.projectId,
    userId: context.userId,
    action,
    entity,
    entityId,
    changes: details,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
}
