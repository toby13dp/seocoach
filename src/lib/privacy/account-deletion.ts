/**
 * @fileoverview Account Deletion Module — GDPR Right to Erasure (PRIV-002)
 *
 * Implements a safe account deletion flow with a 30-day grace period.
 * During the grace period the user can cancel the deletion. After the period
 * expires, a confirmation code is required to execute the actual deletion.
 *
 * Deletion steps:
 *   1. Remove user from all organisation memberships (transfer ownership if
 *      the user is the last ORG_OWNER).
 *   2. Anonymize the user record — replace PII with "Verwijderd [date]".
 *   3. Soft-delete the user record (set deletedAt).
 *   4. Remove or anonymize personal data in audit logs.
 *   5. Keep aggregated/anonymized analytics data intact.
 */

import { db } from "@/lib/db";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of a scheduled account deletion. */
export interface DeletionStatus {
  scheduledAt: Date;
  scheduledDeletionAt: Date;
  confirmationCode: string;
  cancelledAt: Date | null;
}

/** Grace period in days before the account can be permanently deleted. */
const ACCOUNT_DELETION_GRACE_DAYS = 30;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read the deletion status from the user's `privacyPreferences` JSON field.
 * Returns `null` when no deletion is scheduled.
 */
async function readDeletionStatus(
  userId: string
): Promise<DeletionStatus | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { privacyPreferences: true },
  });

  if (!user?.privacyPreferences) return null;

  try {
    const parsed = JSON.parse(user.privacyPreferences);
    if (parsed?.accountDeletion && !parsed.accountDeletion.cancelledAt) {
      return parsed.accountDeletion as DeletionStatus;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write the deletion status to the user's `privacyPreferences` JSON field.
 */
async function writeDeletionStatus(
  userId: string,
  status: DeletionStatus | null
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { privacyPreferences: true },
  });

  let prefs: Record<string, unknown> = {};
  try {
    prefs = user?.privacyPreferences
      ? JSON.parse(user.privacyPreferences)
      : {};
  } catch {
    prefs = {};
  }

  if (status) {
    prefs.accountDeletion = status;
  } else {
    delete prefs.accountDeletion;
  }

  await db.user.update({
    where: { id: userId },
    data: { privacyPreferences: JSON.stringify(prefs) },
  });
}

/**
 * Transfer ownership of an organisation when the departing user is the last
 * ORG_OWNER. Promotes the most senior remaining member; if no other members
 * exist, the organisation is left without an owner (may be cleaned up later).
 */
async function transferOrganisationOwnership(
  orgId: string,
  departingUserId: string
): Promise<void> {
  // Count remaining owners
  const otherOwners = await db.organizationMembership.findMany({
    where: {
      organizationId: orgId,
      role: "ORG_OWNER",
      userId: { not: departingUserId },
      deletedAt: null,
    },
    orderBy: { acceptedAt: "asc" },
  });

  if (otherOwners.length > 0) {
    // Ownership is covered — nothing to do.
    return;
  }

  // No other owner exists — promote the most senior non-owner member.
  const otherMembers = await db.organizationMembership.findMany({
    where: {
      organizationId: orgId,
      userId: { not: departingUserId },
      deletedAt: null,
    },
    orderBy: { acceptedAt: "asc" },
    take: 1,
  });

  if (otherMembers.length > 0) {
    await db.organizationMembership.update({
      where: { id: otherMembers[0].id },
      data: { role: "ORG_OWNER" },
    });
  }
  // If no members at all, the organisation will remain without an owner.
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Schedule an account deletion.
 *
 * The deletion will be queued for execution after the 30-day grace period.
 * A confirmation code is generated that must be presented when calling
 * {@link confirmAccountDeletion}.
 *
 * @param userId - The ID of the user who wants to delete their account.
 * @returns The scheduled deletion date and confirmation code.
 * @throws {Error} If the user does not exist or a deletion is already scheduled.
 */
export async function requestAccountDeletion(
  userId: string
): Promise<{ scheduledAt: Date; confirmationCode: string }> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("Gebruiker niet gevonden");
  }

  const existingStatus = await readDeletionStatus(userId);
  if (existingStatus) {
    throw new Error(
      "Er is al een verwijdering gepland. U kunt deze annuleren via de instellingen."
    );
  }

  const scheduledAt = new Date();
  const scheduledDeletionAt = new Date(
    scheduledAt.getTime() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000
  );
  const confirmationCode = randomUUID();

  await writeDeletionStatus(userId, {
    scheduledAt,
    scheduledDeletionAt,
    confirmationCode,
    cancelledAt: null,
  });

  return { scheduledAt, confirmationCode };
}

/**
 * Confirm and execute the account deletion.
 *
 * The confirmation code must match the one generated during
 * {@link requestAccountDeletion}. After confirmation the user record is
 * anonymized and soft-deleted, memberships are removed, and audit logs are
 * cleaned up.
 *
 * @param userId - The ID of the user.
 * @param confirmationCode - The confirmation code received when deletion was requested.
 * @throws {Error} If no deletion is scheduled, the code is incorrect, or the
 *   grace period has not yet expired.
 */
export async function confirmAccountDeletion(
  userId: string,
  confirmationCode: string
): Promise<void> {
  const status = await readDeletionStatus(userId);
  if (!status) {
    throw new Error("Geen verwijdering gepland");
  }

  if (status.confirmationCode !== confirmationCode) {
    throw new Error("Ongeldig bevestigingscode");
  }

  if (new Date() < status.scheduledDeletionAt) {
    throw new Error(
      "De bedenktijd is nog niet verstreken. U kunt uw account pas na 30 dagen definitief verwijderen."
    );
  }

  // --- Step 1: Handle organisation memberships --------------------------------
  const memberships = await db.organizationMembership.findMany({
    where: { userId, deletedAt: null },
  });

  for (const membership of memberships) {
    if (membership.role === "ORG_OWNER") {
      await transferOrganisationOwnership(
        membership.organizationId,
        userId
      );
    }
  }

  // Remove all memberships
  await db.organizationMembership.updateMany({
    where: { userId },
    data: { deletedAt: new Date() },
  });

  // --- Step 2: Anonymize user record ------------------------------------------
  const deletionLabel = `Verwijderd ${new Date().toISOString()}`;
  await db.user.update({
    where: { id: userId },
    data: {
      email: `${deletionLabel}`,
      name: deletionLabel,
      hashedPassword: null,
      image: null,
      locale: "nl-NL",
      timezone: null,
      automationLevel: null,
      notificationPreferences: null,
    },
  });

  // --- Step 3: Soft-delete user record ----------------------------------------
  await db.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });

  // --- Step 4: Anonymize personal data in audit logs --------------------------
  await db.auditLog.updateMany({
    where: { userId },
    data: {
      userId: null,
      ipAddress: null,
      userAgent: null,
    },
  });

  // --- Step 5: Delete user sessions and accounts (NextAuth) -------------------
  await db.session.deleteMany({ where: { userId } });
  await db.account.deleteMany({ where: { userId } });

  // --- Step 6: Delete user settings -------------------------------------------
  await db.userSettings.deleteMany({ where: { userId } });

  // --- Step 7: Clear deletion status ------------------------------------------
  await writeDeletionStatus(userId, null);
}

/**
 * Cancel a scheduled account deletion.
 *
 * @param userId - The ID of the user.
 * @throws {Error} If no deletion is currently scheduled.
 */
export async function cancelAccountDeletion(userId: string): Promise<void> {
  const status = await readDeletionStatus(userId);
  if (!status) {
    throw new Error("Geen verwijdering gepland om te annuleren");
  }

  // Mark cancellation timestamp in the stored status for audit purposes,
  // then clear the active deletion flag.
  await db.user.update({
    where: { id: userId },
    data: {
      privacyPreferences: JSON.stringify({
        accountDeletion: {
          ...status,
          cancelledAt: new Date().toISOString(),
        },
        lastCancelledDeletion: {
          scheduledAt: status.scheduledAt,
          cancelledAt: new Date().toISOString(),
        },
      }),
    },
  });

  // Now clear the active deletion status so a new one can be requested
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { privacyPreferences: true },
  });

  let prefs: Record<string, unknown> = {};
  try {
    prefs = user?.privacyPreferences
      ? JSON.parse(user.privacyPreferences)
      : {};
  } catch {
    prefs = {};
  }

  delete prefs.accountDeletion;

  await db.user.update({
    where: { id: userId },
    data: { privacyPreferences: JSON.stringify(prefs) },
  });
}

/**
 * Get the current deletion status for a user.
 *
 * @param userId - The ID of the user.
 * @returns The deletion status, or `null` if no deletion is scheduled.
 */
export async function getDeletionStatus(
  userId: string
): Promise<DeletionStatus | null> {
  return readDeletionStatus(userId);
}
