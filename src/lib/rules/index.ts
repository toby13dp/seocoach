// ============================================================================
// SEO Rule Engine — Barrel Export
// ============================================================================

// Types
export type {
  TechnicalRule,
  IssueEvidence,
  TechnicalIssueResult,
  PageAnalysis,
  RuleEntry,
  CrossPageRuleEntry,
} from './types';

// Engine
export { RuleEngine, getRuleEngine, resetRuleEngine } from './engine';

// Session Analyzer
export {
  analyzeCrawlSession,
  getSessionIssues,
  getSessionSummary,
  pageToAnalysis,
} from './session-analyzer';

export type { AnalysisSummary } from './session-analyzer';

// Individual rule modules (for direct import if needed)
export { statusCodesRules } from './rules/status-codes';
export { redirectChainRules } from './rules/redirect-chains';
export { redirectLoopRules } from './rules/redirect-loops';
export { canonicalErrorRules } from './rules/canonical-errors';
export { metaIssueRules, metaCrossPageRules } from './rules/meta-issues';
export { headingIssueRules } from './rules/heading-issues';
export { brokenLinksRules, checkBrokenLinksCrossPage } from './rules/broken-links';
export { orphanPageRules } from './rules/orphan-pages';
export { deepPageRules } from './rules/deep-pages';
export { thinContentRules } from './rules/thin-content';
export { duplicateContentRules, checkDuplicateContentCrossPage } from './rules/duplicate-content';
export { imageIssueRules } from './rules/image-issues';
export { httpsIssueRules } from './rules/https-issues';
export { structuredDataIssueRules } from './rules/structured-data-issues';
export { hreflangIssueRules, hreflangCrossPageRules } from './rules/hreflang-issues';
export { sitemapIssueRules } from './rules/sitemap-issues';
