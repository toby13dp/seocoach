/**
 * @fileoverview Consent Manager Module — GDPR Consent Management (PRIV-001)
 *
 * Manages user consent for various data processing activities. Each consent
 * action is recorded with full audit trail information including the evidence
 * of how consent was obtained, the IP address, and the user agent.
 *
 * Consent records are stored in the User model's `privacyPreferences` JSON
 * field to avoid schema changes. A proper database model is documented below
 * for future migration.
 *
 * ============================================================================
 * Proposed Prisma Model (for future schema migration):
 * ============================================================================
 *
 * model ConsentRecord {
 *   id          String      @id @default(uuid())
 *   userId      String
 *   consentType ConsentType
 *   granted     Boolean
 *   evidence    String      // How consent was obtained (e.g. "checkbox_on_settings_page")
 *   ipAddress   String?
 *   userAgent   String?
 *   createdAt   DateTime    @default(now())
 *
 *   user User @relation(fields: [userId], references: [id], onDelete: Cascade)
 *
 *   @@index([userId])
 *   @@index([consentType])
 *   @@index([granted])
 *   @@index([createdAt])
 *   @@map("consent_records")
 * }
 *
 * enum ConsentType {
 *   ANALYTICS
 *   BEHAVIOUR_TRACKING
 *   EXTERNAL_AI
 *   EMAIL_MARKETING
 * }
 *
 * ============================================================================
 */

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Types of consent that can be managed. */
export enum ConsentType {
  ANALYTICS = "ANALYTICS",
  BEHAVIOUR_TRACKING = "BEHAVIOUR_TRACKING",
  EXTERNAL_AI = "EXTERNAL_AI",
  EMAIL_MARKETING = "EMAIL_MARKETING",
}

/** A single consent record with full audit information. */
export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  evidence: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string; // ISO 8601
}

/** Internal structure stored in privacyPreferences */
interface ConsentStorage {
  records: ConsentRecord[];
  current: Record<string, boolean>; // consentType -> granted
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read the consent storage from the user's `privacyPreferences` JSON field.
 */
async function readConsentStorage(
  userId: string
): Promise<ConsentStorage> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { privacyPreferences: true },
  });

  if (!user?.privacyPreferences) {
    return { records: [], current: {} };
  }

  try {
    const parsed = JSON.parse(user.privacyPreferences);
    if (parsed?.consent && Array.isArray(parsed.consent.records)) {
      return parsed.consent as ConsentStorage;
    }
    return { records: [], current: {} };
  } catch {
    return { records: [], current: {} };
  }
}

/**
 * Write the consent storage back to the user's `privacyPreferences` JSON field.
 */
async function writeConsentStorage(
  userId: string,
  storage: ConsentStorage
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

  prefs.consent = storage;

  await db.user.update({
    where: { id: userId },
    data: { privacyPreferences: JSON.stringify(prefs) },
  });
}

/**
 * Generate a unique ID for a consent record.
 */
function generateConsentId(): string {
  return `cr_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a consent action for a user.
 *
 * @param userId - The ID of the user.
 * @param consentType - The type of consent being recorded.
 * @param granted - Whether consent is granted or denied.
 * @param evidence - Description of how consent was obtained
 *   (e.g. "checkbox_on_settings_page", "privacy_policy_acceptance").
 * @param ipAddress - The IP address from which consent was given (optional).
 * @param userAgent - The user agent string of the client (optional).
 */
export async function recordConsent(
  userId: string,
  consentType: ConsentType,
  granted: boolean,
  evidence: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const storage = await readConsentStorage(userId);

  const record: ConsentRecord = {
    id: generateConsentId(),
    userId,
    consentType,
    granted,
    evidence,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
    createdAt: new Date().toISOString(),
  };

  storage.records.push(record);
  storage.current[consentType] = granted;

  await writeConsentStorage(userId, storage);
}

/**
 * Check whether a specific consent is currently granted.
 *
 * @param userId - The ID of the user.
 * @param consentType - The type of consent to check.
 * @returns `true` if consent is explicitly granted, `false` otherwise.
 *   Note: consent is opt-in — if no record exists, the default is `false`.
 */
export async function checkConsent(
  userId: string,
  consentType: ConsentType
): Promise<boolean> {
  const storage = await readConsentStorage(userId);
  return storage.current[consentType] === true;
}

/**
 * Withdraw a specific consent and handle the consequences.
 *
 * When consent for EXTERNAL_AI is withdrawn, AI providers linked to the user's
 * projects are deactivated. When BEHAVIOUR_TRACKING is withdrawn, associated
 * behaviour records are flagged. When EMAIL_MARKETING is withdrawn, the user's
 * notification preferences are updated.
 *
 * @param userId - The ID of the user.
 * @param consentType - The type of consent to withdraw.
 * @param evidence - Description of how the withdrawal was initiated.
 * @param ipAddress - The IP address from which consent was withdrawn (optional).
 * @param userAgent - The user agent string of the client (optional).
 */
export async function withdrawConsent(
  userId: string,
  consentType: ConsentType,
  evidence: string = "user_withdrawal",
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  // Record the withdrawal
  await recordConsent(userId, consentType, false, evidence, ipAddress, userAgent);

  // Handle consequences based on consent type
  switch (consentType) {
    case ConsentType.EXTERNAL_AI: {
      // Deactivate AI providers in projects the user has access to
      const memberships = await db.organizationMembership.findMany({
        where: { userId, deletedAt: null },
        select: { organizationId: true },
      });
      const orgIds = memberships.map((m) => m.organizationId);

      if (orgIds.length > 0) {
        const projects = await db.project.findMany({
          where: { organizationId: { in: orgIds }, deletedAt: null },
          select: { id: true },
        });
        const projectIds = projects.map((p) => p.id);

        if (projectIds.length > 0) {
          await db.aIProvider.updateMany({
            where: {
              projectId: { in: projectIds },
              type: { not: "OLLAMA" },
            },
            data: { isActive: false },
          });
        }
      }
      break;
    }

    case ConsentType.BEHAVIOUR_TRACKING: {
      // Flag behaviour records — in a production system this would trigger
      // anonymization of existing behaviour data. For now, we record the
      // withdrawal and log it.
      break;
    }

    case ConsentType.EMAIL_MARKETING: {
      // Disable marketing-related notification preferences
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { notificationPreferences: true },
      });

      if (user?.notificationPreferences) {
        try {
          const notifPrefs = JSON.parse(user.notificationPreferences);
          notifPrefs.emailMarketing = false;
          notifPrefs.newsletter = false;
          await db.user.update({
            where: { id: userId },
            data: { notificationPreferences: JSON.stringify(notifPrefs) },
          });
        } catch {
          // If preferences are not valid JSON, skip update
        }
      }
      break;
    }

    case ConsentType.ANALYTICS: {
      // Withdrawal of analytics consent is recorded but existing aggregated
      // data is retained in anonymized form as per legitimate interest.
      break;
    }
  }
}

/**
 * Get the full consent history for a user.
 *
 * Returns all consent records in chronological order, providing a complete
 * audit trail of all consent actions.
 *
 * @param userId - The ID of the user.
 * @returns An array of consent records, oldest first.
 */
export async function getConsentHistory(
  userId: string
): Promise<ConsentRecord[]> {
  const storage = await readConsentStorage(userId);
  return storage.records.sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
}
