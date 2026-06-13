// ============================================================================
// Programmatic SEO Module — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Barrel export of all public functions and types for the Programmatic SEO
// module. Import from '@/lib/programmatic' to access the full API.
// ============================================================================

// --- Types ---
export type {
  ProgrammaticVariable,
  ProgrammaticVariableType,
  ProgrammaticDataRows,
  TemplateType,
  QualityGatesConfig,
  ProgrammaticTemplateConfig,
  QualityGateResult,
  ProgrammaticGenerationResult,
  TemplatePreview,
  TemplateSummary,
  TemplateWithPages,
  ProgrammaticPageSummary,
} from './types';

// --- Template Manager ---
export {
  TEMPLATE_TYPE_LABELS,
  getDefaultVariables,
  getDefaultContentTemplate,
  getDefaultKeywordPattern,
  createTemplate,
  updateTemplate,
  getTemplate,
  listTemplates,
  deleteTemplate,
  addDataRows,
  renderTemplate,
  generateSlug,
  extractTitle,
  previewTemplate,
  previewBulk,
} from './template-manager';

// --- Quality Gates ---
export type { QualityGateRunResult } from './quality-gates';
export { runQualityGates } from './quality-gates';

// --- Generator ---
export {
  generatePages,
  regeneratePage,
  publishApprovedPages,
  setPublicationLimit,
} from './generator';
