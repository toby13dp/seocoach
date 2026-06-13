// ============================================================================
// Report Sharing — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages share links for reports, including password protection and expiry.
// Also handles report comments for client/colleague feedback.
//
// SECURITY: Share tokens are cryptographically random. Passwords are hashed
// before storage. Access counts are tracked for audit purposes.
// ============================================================================

import { db } from '@/lib/db';
import crypto from 'crypto';
import type { ShareLinkOptions, SharedReportAccess } from './types';

// ============================================================================
// Share Link Management
// ============================================================================

/**
 * Create a share link for a report.
 *
 * Generates a unique share token that can be used to access the report
 * without authentication. Optionally supports password protection and
 * expiry dates.
 *
 * @param reportId - The report ID to share
 * @param options - Optional password and expiry configuration
 * @returns The updated Report record with share token
 */
export async function createShareLink(
  reportId: string,
  options?: ShareLinkOptions,
) {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { status: true, shareToken: true },
  });

  if (!report) {
    throw new Error(`Rapport niet gevonden: ${reportId}`);
  }

  // Generate a cryptographically random share token
  const token = crypto.randomBytes(32).toString('hex');

  // Hash the password if provided
  const hashedPassword = options?.password
    ? hashPassword(options.password)
    : null;

  return db.report.update({
    where: { id: reportId },
    data: {
      shareToken: token,
      sharePassword: hashedPassword,
      shareExpiresAt: options?.expiresAt || null,
      shareAccessCount: 0,
    },
  });
}

/**
 * Access a shared report using its share token.
 *
 * Validates the token, checks for expiry, verifies the password
 * if required, and increments the access count.
 *
 * @param token - The share token
 * @param password - Optional password (required if the report has one)
 * @returns SharedReportAccess with granted/denied status
 */
export async function accessSharedReport(
  token: string,
  password?: string,
): Promise<SharedReportAccess> {
  const report = await db.report.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      shareToken: true,
      sharePassword: true,
      shareExpiresAt: true,
      shareAccessCount: true,
      htmlOutput: true,
      snapshotData: true,
      deletedAt: true,
    },
  });

  if (!report || report.deletedAt) {
    return {
      granted: false,
      reason: 'Dit rapport bestaat niet of is verwijderd',
    };
  }

  // Check if the report is approved or published
  if (report.status !== 'APPROVED' && report.status !== 'PUBLISHED') {
    return {
      granted: false,
      reason: 'Dit rapport is nog niet goedgekeurd voor delen',
    };
  }

  // Check expiry
  if (report.shareExpiresAt && new Date() > report.shareExpiresAt) {
    return {
      granted: false,
      reason: 'De deelverwijzing van dit rapport is verlopen',
    };
  }

  // Check password
  if (report.sharePassword) {
    if (!password) {
      return {
        granted: false,
        reason: 'Een wachtwoord is vereist om dit rapport te bekijken',
      };
    }
    if (!verifyPassword(password, report.sharePassword)) {
      return {
        granted: false,
        reason: 'Het ingevoerde wachtwoord is onjuist',
      };
    }
  }

  // Increment access count
  await db.report.update({
    where: { id: report.id },
    data: {
      shareAccessCount: (report.shareAccessCount ?? 0) + 1,
    },
  });

  return {
    granted: true,
    report: {
      id: report.id,
      title: report.title,
      type: report.type,
      htmlOutput: report.htmlOutput,
      snapshotData: report.snapshotData,
    },
  };
}

/**
 * Revoke a share link for a report.
 * Removes the share token, password, and expiry.
 *
 * @param reportId - The report ID to revoke sharing for
 * @returns The updated Report record
 */
export async function revokeShareLink(reportId: string) {
  return db.report.update({
    where: { id: reportId },
    data: {
      shareToken: null,
      sharePassword: null,
      shareExpiresAt: null,
      shareAccessCount: 0,
    },
  });
}

/**
 * Check if a share link is valid for a given report.
 * Returns true if the share link exists and hasn't expired.
 *
 * @param reportId - The report ID to check
 * @returns Whether the share link is valid
 */
export async function isShareLinkValid(reportId: string): Promise<boolean> {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: {
      shareToken: true,
      shareExpiresAt: true,
      deletedAt: true,
    },
  });

  if (!report || report.deletedAt || !report.shareToken) {
    return false;
  }

  // Check expiry
  if (report.shareExpiresAt && new Date() > report.shareExpiresAt) {
    return false;
  }

  return true;
}

// ============================================================================
// Report Comments
// ============================================================================

/**
 * Add a comment to a report section.
 * Comments can be from authenticated users or anonymous viewers
 * (e.g., clients viewing a shared report).
 *
 * @param reportId - The report ID
 * @param sectionId - The section ID the comment refers to
 * @param comment - The comment text (Dutch)
 * @param userId - Optional user ID (null for anonymous)
 * @returns The created ReportComment record
 */
export async function addReportComment(
  reportId: string,
  sectionId: string | null,
  comment: string,
  userId?: string,
) {
  return db.reportComment.create({
    data: {
      reportId,
      sectionId,
      comment,
      userId: userId || null,
    },
  });
}

/**
 * Get all comments for a report, ordered by creation date.
 *
 * @param reportId - The report ID
 * @returns Array of ReportComment records
 */
export async function getReportComments(reportId: string) {
  return db.reportComment.findMany({
    where: { reportId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Mark a comment as resolved.
 * Resolved comments are typically hidden from the active discussion view.
 *
 * @param commentId - The comment ID to resolve
 * @returns The updated ReportComment record
 */
export async function resolveComment(commentId: string) {
  return db.reportComment.update({
    where: { id: commentId },
    data: { resolved: true },
  });
}

// ============================================================================
// Internal Helpers — Password Hashing
// ============================================================================

/**
 * Hash a password using SHA-256 with a salt.
 * Note: In production, use bcrypt or argon2. This is a simplified
 * implementation suitable for the current project scope.
 */
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .createHash('sha256')
    .update(salt + password)
    .digest('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash.
 */
function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const computedHash = crypto
    .createHash('sha256')
    .update(salt + password)
    .digest('hex');
  return hash === computedHash;
}
