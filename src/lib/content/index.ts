// ============================================================================
// Content Module — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Central export point for the content management module.
// Import from '@/lib/content' to access all content functionality.
// ============================================================================

// Types
export type {
  ContentBriefData,
  OutlineItem,
  ContentDraftRequest,
  QualityDimension,
  BriefFilters,
  PaginatedBriefs,
  BriefSummary,
  ContentBriefWithDetails,
  ContentVersionSummary,
  PruningActionType,
  RiskAnalysis,
  RiskFactor,
} from './types';

// Brief Manager
export {
  createBrief,
  updateBrief,
  deleteBrief,
  getBrief,
  listBriefs,
  approveBrief,
  generateOutline,
} from './brief-manager';

// Draft Generator
export {
  generateDraft,
  regenerateDraft,
  saveManualDraft,
} from './draft-generator';

// Quality Analyzer
export {
  analyzeQuality,
  getQualityDimensions,
} from './quality-analyzer';

// Decay Detector
export {
  detectDecay,
  recommendPruningAction,
  assessPruningRisk,
} from './decay-detector';

// Quality Controls
export {
  runPrePublicationChecks,
  getFindings,
  dismissFinding,
  hasBlockingFindings,
} from './quality-controls';

export type {
  CheckType,
  FindingSeverity,
  FindingFilters,
  PrePublicationCheckResult,
} from './quality-controls';

// Change History
export {
  recordChange,
  getChangeHistory,
  getChangeDetail,
  rollbackChange,
  getContentDiff,
} from './change-history';

export type {
  ChangeType,
  RecordChangeParams,
  ChangeHistoryFilters,
  PaginatedChangeHistory,
  ChangeHistoryEntry,
  ChangeDetail,
  RollbackResult,
  ContentDiff,
} from './change-history';

// Source Grounding
export {
  addContentSource,
  listContentSources,
  removeContentSource,
  selectSourcesForBrief,
  getSourcesForBrief,
  checkClaimSupport,
  importPageAsSource,
  importBrandProfileAsSource,
} from './source-grounding';

export type {
  AddSourceParams,
  ClaimStatus,
  ClaimCheckItem,
  ClaimCheckResult,
  ContentSourceRecord,
} from './source-grounding';

// Content Workflow
export {
  startWorkflow,
  selectOpportunity,
  selectContentType,
  generateBriefFromWorkflow,
  editOutline,
  selectSourcesForWorkflow,
  generateDraftFromWorkflow,
  runQualityChecksFromWorkflow,
  reviewClaimsFromWorkflow,
  addInternalLinksFromWorkflow,
  previewContent,
  approveContent,
  saveAsCMSDraft,
  scheduleOrPublish,
  getWorkflowStatus,
  listWorkflows,
  contentTypeOptions,
} from './workflow';

export type {
  WorkflowStepStatus,
  WorkflowSummary,
} from './workflow';

// Decay & Pruning Workflows
export {
  viewDecliningPages,
  generateUpdateBrief,
  compareContent,
  approveRevision,
  publishUpdate,
  monitorPostUpdateMetrics,
  recommendPruningAction as recommendPruningActionWorkflow,
  approvePruning,
} from './decay-workflow';

export type {
  DecliningPageSummary,
  ContentComparisonResult,
  EnhancedPruningRecommendation,
  PruningApprovalResult,
} from './decay-workflow';
