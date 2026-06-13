// ============================================================================
// Internal Linking Module — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Central export point for the internal linking module.
// Import from '@/lib/linking' to access all linking functionality.
// ============================================================================

// Types
export type {
  LinkStrategy,
  LinkStatus,
  LinkCandidate,
  LinkApproval,
  LinkDiff,
  BulkApprovalResult,
  BulkApprovalDetail,
  InternalLinkFilters,
  CannibalizationWarning,
  AnchorVariation,
  PageLinkProfile,
  CandidateGenerationResult,
} from './types';

// Candidate Generator
export { generateLinkCandidates } from './candidate-generator';

// Anchor Variation
export { generateAnchorVariations } from './anchor-variation';

// Approval Workflow
export {
  approveLink,
  rejectLink,
  bulkApproveLinks,
  generateLinkDiff,
  publishApprovedLinks,
  rollbackLink,
} from './approval-workflow';
