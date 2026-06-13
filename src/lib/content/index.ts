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
