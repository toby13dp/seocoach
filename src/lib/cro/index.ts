// ============================================================================
// CRO & Behaviour — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Re-exports all CRO and behaviour modules from a single entry point.
// Import from '@/lib/cro' to access the full CRO functionality.
// ============================================================================

// Types
export type {
  BehaviourImportData,
  CROFindingData,
} from './types';

export {
  CRO_CATEGORY_LABELS,
  CRO_SEVERITY_LABELS,
  BEHAVIOUR_TYPE_LABELS,
} from './types';

// Behaviour Importer
export {
  importBehaviourCSV,
  importBehaviourRecord,
  listBehaviourRecords,
} from './behaviour-importer';

// CRO Analyzer
export {
  analyzeCROFindings,
  analyzeScrollDepth,
  analyzeRageClicks,
  analyzeDeadClicks,
  analyzeFormAbandonment,
  analyzeDeviceEngagement,
  saveCROFindings,
  getCROFindings,
  updateCROFinding,
  generateManualFinding,
} from './cro-analyzer';

// Re-export Prisma types from cro-analyzer
export type {
  BehaviourRecord,
  CROFinding,
} from './cro-analyzer';
