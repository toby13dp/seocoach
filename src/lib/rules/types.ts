// ============================================================================
// SEO Rule Engine — Type Definitions
// ============================================================================

/**
 * Definition of a technical SEO rule.
 * Each rule has metadata (name, severity, category) but no check logic here.
 * The check logic lives in the rule files under ./rules/
 */
export interface TechnicalRule {
  id: string;
  name: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  effort: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  /** e.g. 'status-codes', 'canonical', 'meta', 'links', 'content', 'structured-data' */
  category: string;
}

/**
 * Evidence that supports an issue finding — the specific field, its actual value,
 * the expected value (optional), and any related URLs.
 */
export interface IssueEvidence {
  field: string;
  value: string | number | boolean | null;
  expected?: string | number;
  urls?: string[];
}

/**
 * The output of a rule check — a fully described issue ready for display
 * or storage in the TechnicalIssue table.
 */
export interface TechnicalIssueResult {
  ruleId: string;
  ruleName: string;
  dutchExplanation: string;
  technicalDetails?: string;
  evidence: IssueEvidence[];
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact: string;
  effort: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  affectedUrls: string[];
  recommendedAction: string;
  autoFixAvailable: boolean;
  /** 0–1 confidence score for the detection */
  confidence: number;
}

/**
 * Analysed representation of a crawled page, consumed by every rule check.
 * This is the unified "view" that the rule engine works with, decoupled from
 * the raw Prisma Page model.
 */
export interface PageAnalysis {
  url: string;
  statusCode: number | null;
  title: string | null;
  description: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  metaRobots: string | null;
  wordCount: number;
  internalLinkCount: number;
  externalLinkCount: number;
  imageCount: number;
  imagesWithoutAlt: number;
  structuredData: any[] | null;
  crawlDepth: number;
  isOrphan: boolean;
  contentType: string;
  language: string | null;
  indexability: string;
  duplicateGroup: string | null;
  similarityScore: number | null;
  redirectChain: string[] | null;
  loadTimeMs: number | null;
  htmlSizeBytes: number | null;
  hreflang: any[] | null;
  headings: { level: number; text: string }[] | null;
  internalLinks: { href: string; anchor: string }[] | null;
  externalLinks: { href: string; anchor: string }[] | null;
  images: { src: string; alt: string | null; width?: number; height?: number; sizeBytes?: number }[] | null;
}

/**
 * A rule entry used internally by the engine.
 * Combines the rule definition with the check function.
 */
export interface RuleEntry {
  definition: TechnicalRule;
  check: (page: PageAnalysis) => TechnicalIssueResult | null;
}

/**
 * Cross-page rule: a rule that needs access to all pages in a session
 * to detect issues (e.g. duplicate titles, duplicate content).
 */
export interface CrossPageRuleEntry {
  definition: TechnicalRule;
  check: (pages: PageAnalysis[]) => TechnicalIssueResult[];
}
