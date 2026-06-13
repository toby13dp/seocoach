// ============================================================================
// Reporting Module — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Central export point for the Reporting module.
// Import from '@/lib/reporting' to access all reporting functionality.
// ============================================================================

// Types
export type {
  ReportSection,
  KpiCardConfig,
  ChartConfig,
  TableConfig,
  TableColumn,
  ReportCreateConfig,
  WhiteLabelProfileData,
  ShareLinkOptions,
  SharedReportAccess,
} from './types';

export {
  REPORT_TYPE_LABELS,
  REPORT_STATUS_LABELS,
  SECTION_TYPE_LABELS,
  REPORT_TYPE_DESCRIPTIONS,
} from './types';

// Builder
export {
  getDefaultSections,
  createReport,
  updateReportSections,
  addSection,
  removeSection,
  reorderSections,
  previewReport,
  generateSnapshot,
  approveReport,
  archiveReport,
} from './builder';

// White-Label
export {
  createWhiteLabelProfile,
  updateWhiteLabelProfile,
  getWhiteLabelProfiles,
  getDefaultProfile,
  applyWhiteLabeling,
} from './white-label';

// Sharing
export {
  createShareLink,
  accessSharedReport,
  revokeShareLink,
  isShareLinkValid,
  addReportComment,
  getReportComments,
  resolveComment,
} from './sharing';

// Render
export {
  renderSection,
  renderReportToHTML,
  renderReportToPDF,
} from './render';
