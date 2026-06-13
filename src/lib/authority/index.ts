// ============================================================================
// Authority — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================

// Types
export type {
  AuthorityRecordType,
  AuthorityRecordFilters,
  AuthorityImportResult,
  AuthoritySummary,
} from './types';

export {
  AUTHORITY_TYPE_LABELS,
  AUTHORITY_TYPE_DESCRIPTIONS,
  AUTHORITY_CSV_COLUMNS,
} from './types';

// Manager
export {
  addAuthorityRecord,
  getAuthorityRecords,
  importAuthorityCSV,
  markAsLost,
  getAuthorityRecord,
  updateAuthorityRecord,
  getAuthoritySummary,
} from './manager';

// Outreach
export {
  createCampaign,
  updateCampaign,
  addToCampaign,
  removeFromCampaign,
  getCampaigns,
  updateCampaignStats,
} from './outreach';

// Aliases for API route compatibility
export { importAuthorityCSV as importCsvBacklinks } from './manager';
export { getAuthoritySummary as calculateAuthoritySummary } from './manager';
export { getCampaigns as getOutreachCampaigns } from './outreach';
export { createCampaign as createOutreachCampaign } from './outreach';
