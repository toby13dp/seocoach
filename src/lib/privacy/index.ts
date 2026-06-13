/**
 * @fileoverview Privacy Module Index — Re-exports all privacy sub-modules.
 *
 * Central export point for the privacy and data management features:
 * - Data export (GDPR right to portability)
 * - Account deletion (GDPR right to erasure)
 * - Project deletion
 * - Consent management
 * - Data retention management
 */

export {
  exportUserData,
  generateExportFile,
  type UserDataExport,
} from "./data-export";

export {
  requestAccountDeletion,
  confirmAccountDeletion,
  cancelAccountDeletion,
  getDeletionStatus,
  type DeletionStatus as AccountDeletionStatus,
} from "./account-deletion";

export {
  requestProjectDeletion,
  confirmProjectDeletion,
  cancelProjectDeletion,
  getProjectDeletionStatus,
  type DeletionStatus as ProjectDeletionStatus,
} from "./project-deletion";

export {
  ConsentType,
  recordConsent,
  checkConsent,
  withdrawConsent,
  getConsentHistory,
  type ConsentRecord,
} from "./consent-manager";

export {
  getRetentionPolicy,
  listRetentionPolicies,
  enforceRetentionPolicy,
  enforceAllRetentionPolicies,
  type RetentionPolicy,
  type RetentionEnforcementResult,
} from "./retention-manager";
