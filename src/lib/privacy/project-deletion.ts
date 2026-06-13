/**
 * @fileoverview Project Deletion Module — Project data erasure (PRIV-002)
 *
 * Implements a project deletion flow with a 7-day grace period and
 * confirmation mechanism. During the grace period the deletion can be
 * cancelled. After confirmation all project-related records are permanently
 * removed via Prisma cascade deletes.
 *
 * The scheduled deletion metadata is stored in the project's `settings` JSON
 * field so no schema changes are required.
 */

import { db } from "@/lib/db";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of a scheduled project deletion. */
export interface DeletionStatus {
  scheduledAt: Date;
  scheduledDeletionAt: Date;
  confirmationCode: string;
  requestedBy: string;
  cancelledAt: Date | null;
}

/** Grace period in days before a project can be permanently deleted. */
const PROJECT_DELETION_GRACE_DAYS = 7;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read the deletion status from the project's `settings` JSON field.
 * Returns `null` when no deletion is scheduled.
 */
async function readDeletionStatus(
  projectId: string
): Promise<DeletionStatus | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { settings: true },
  });

  if (!project?.settings) return null;

  try {
    const parsed = JSON.parse(project.settings);
    if (parsed?.projectDeletion && !parsed.projectDeletion.cancelledAt) {
      return parsed.projectDeletion as DeletionStatus;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write the deletion status to the project's `settings` JSON field.
 */
async function writeDeletionStatus(
  projectId: string,
  status: DeletionStatus | null
): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { settings: true },
  });

  let settings: Record<string, unknown> = {};
  try {
    settings = project?.settings ? JSON.parse(project.settings) : {};
  } catch {
    settings = {};
  }

  if (status) {
    settings.projectDeletion = status;
  } else {
    delete settings.projectDeletion;
  }

  await db.project.update({
    where: { id: projectId },
    data: { settings: JSON.stringify(settings) },
  });
}

/**
 * Verify that the requesting user has permission to delete the project.
 * The user must be a member of the project's organisation with at least
 * ORG_OWNER or SEO_MANAGER role.
 */
async function verifyDeletePermission(
  projectId: string,
  userId: string
): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });

  if (!project) {
    throw new Error("Project niet gevonden");
  }

  const membership = await db.organizationMembership.findFirst({
    where: {
      organizationId: project.organizationId,
      userId,
      deletedAt: null,
      role: { in: ["ORG_OWNER", "AGENCY_OWNER", "SEO_MANAGER", "PLATFORM_ADMIN"] },
    },
  });

  if (!membership) {
    throw new Error(
      "U heeft geen toestemming om dit project te verwijderen"
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Schedule a project deletion.
 *
 * The deletion will be queued for execution after the 7-day grace period.
 * A confirmation code is generated that must be presented when calling
 * {@link confirmProjectDeletion}.
 *
 * @param projectId - The ID of the project to delete.
 * @param userId - The ID of the user requesting the deletion.
 * @returns The scheduled deletion date and confirmation code.
 * @throws {Error} If the project does not exist, permission is denied, or a
 *   deletion is already scheduled.
 */
export async function requestProjectDeletion(
  projectId: string,
  userId: string
): Promise<{ scheduledAt: Date; confirmationCode: string }> {
  await verifyDeletePermission(projectId, userId);

  const existingStatus = await readDeletionStatus(projectId);
  if (existingStatus) {
    throw new Error(
      "Er is al een verwijdering gepland voor dit project. U kunt deze annuleren via de instellingen."
    );
  }

  const scheduledAt = new Date();
  const scheduledDeletionAt = new Date(
    scheduledAt.getTime() + PROJECT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000
  );
  const confirmationCode = randomUUID();

  await writeDeletionStatus(projectId, {
    scheduledAt,
    scheduledDeletionAt,
    confirmationCode,
    requestedBy: userId,
    cancelledAt: null,
  });

  return { scheduledAt, confirmationCode };
}

/**
 * Confirm and execute the project deletion.
 *
 * The confirmation code must match the one generated during
 * {@link requestProjectDeletion}. After confirmation all project-related
 * records are permanently removed via Prisma cascade deletes.
 *
 * @param projectId - The ID of the project.
 * @param confirmationCode - The confirmation code received when deletion was requested.
 * @throws {Error} If no deletion is scheduled, the code is incorrect, or the
 *   grace period has not yet expired.
 */
export async function confirmProjectDeletion(
  projectId: string,
  confirmationCode: string
): Promise<void> {
  const status = await readDeletionStatus(projectId);
  if (!status) {
    throw new Error("Geen verwijdering gepland voor dit project");
  }

  if (status.confirmationCode !== confirmationCode) {
    throw new Error("Ongeldig bevestigingscode");
  }

  if (new Date() < status.scheduledDeletionAt) {
    throw new Error(
      "De bedenktijd is nog niet verstreken. U kunt dit project pas na 7 dagen definitief verwijderen."
    );
  }

  // The Prisma schema has onDelete: Cascade on all project-related relations,
  // so deleting the project will automatically cascade to:
  // - domains, locations, brandProfile, jobs, auditLogs, actionItems
  // - crawlSessions -> pages -> pageSnapshots, technicalIssues, renderedComparisons
  // - keywords -> opportunityScores, keywordPages
  // - topics -> topicKeywords, topicRelations
  // - aiProviders -> aiCallLogs, promptTemplates
  // - contentBriefs -> contentVersions
  // - deliverables, timeEntries, recurringTasks, approvalItems
  // - pmIntegrations -> pmTaskExports
  // - benchmarkResults, benchmarkConsents
  // - copilotConversations -> copilotMessages
  // - agentRuns, automationRules
  // - migrationProjects -> urlMappings, preLaunchChecks, launchBlockers
  // - deploymentRecords -> deploymentChecks

  await db.project.delete({
    where: { id: projectId },
  });
}

/**
 * Cancel a scheduled project deletion.
 *
 * @param projectId - The ID of the project.
 * @throws {Error} If no deletion is currently scheduled.
 */
export async function cancelProjectDeletion(
  projectId: string
): Promise<void> {
  const status = await readDeletionStatus(projectId);
  if (!status) {
    throw new Error("Geen verwijdering gepland om te annuleren");
  }

  // Store cancellation for audit trail, then clear the active deletion flag
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { settings: true },
  });

  let settings: Record<string, unknown> = {};
  try {
    settings = project?.settings ? JSON.parse(project.settings) : {};
  } catch {
    settings = {};
  }

  // Keep audit trail of the cancellation
  settings.lastCancelledDeletion = {
    scheduledAt: status.scheduledAt,
    requestedBy: status.requestedBy,
    cancelledAt: new Date().toISOString(),
  };

  delete settings.projectDeletion;

  await db.project.update({
    where: { id: projectId },
    data: { settings: JSON.stringify(settings) },
  });
}

/**
 * Get the current deletion status for a project.
 *
 * @param projectId - The ID of the project.
 * @returns The deletion status, or `null` if no deletion is scheduled.
 */
export async function getProjectDeletionStatus(
  projectId: string
): Promise<DeletionStatus | null> {
  return readDeletionStatus(projectId);
}
