// ============================================================================
// Internal Linking Types — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Type definitions for the Internal Linking module.
// Covers link candidate generation, approval workflows, diff generation,
// bulk operations, filtering, and cannibalization warnings.
// ============================================================================

/**
 * The strategy used to generate a link candidate.
 * Maps directly to the InternalLinkStrategy Prisma enum.
 */
export type LinkStrategy =
  | 'SEMANTIC'
  | 'TOPIC_CLUSTER'
  | 'ORPHAN_PAGE'
  | 'STRONG_PAGE'
  | 'BROKEN_REPLACEMENT';

/**
 * The approval status of an internal link.
 * Maps directly to the InternalLinkStatus Prisma enum.
 */
export type LinkStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'ROLLED_BACK';

/**
 * A candidate for an internal link between two pages.
 * Represents a suggested link that has not yet been approved or published.
 * Maps to the InternalLink Prisma model fields.
 */
export interface LinkCandidate {
  /** Database ID (assigned after persistence) */
  id?: string;
  /** Project ID this candidate belongs to */
  projectId: string;
  /** Source page database ID (page containing the link) */
  sourcePageId: string | null;
  /** Target page database ID (page being linked to) */
  targetPageId: string | null;
  /** URL of the source page */
  sourceUrl: string;
  /** URL of the target page */
  targetUrl: string;
  /** Suggested anchor text for the link */
  anchorText: string;
  /** Context snippet — surrounding text where the link would be inserted */
  surroundingText: string | null;
  /** Strategy used to generate this candidate */
  strategy: LinkStrategy;
  /** Confidence score between 0 and 1 */
  confidence: number;
  /** Whether this link already exists on the source page */
  isExisting: boolean;
  /** Whether the existing link is broken (only relevant if isExisting is true) */
  isBroken: boolean;
  /** ID of the link this candidate replaces (for BROKEN_REPLACEMENT strategy) */
  replacesLinkId: string | null;
}

/**
 * Approval decision for a single internal link.
 */
export interface LinkApproval {
  /** The internal link ID */
  linkId: string;
  /** Whether the link was approved or rejected */
  decision: 'approved' | 'rejected';
  /** User ID who made the decision */
  approvedBy: string;
  /** Optional notes explaining the decision */
  notes?: string;
}

/**
 * A before/after diff showing where a link would be inserted
 * in the source page content. Used for review before approval.
 */
export interface LinkDiff {
  /** The internal link ID this diff belongs to */
  linkId: string;
  /** Source page URL */
  sourceUrl: string;
  /** Target page URL */
  targetUrl: string;
  /** Anchor text to be used */
  anchorText: string;
  /** Content before the link insertion (plain text excerpt) */
  before: string;
  /** Content after the link insertion (plain text excerpt with link markup) */
  after: string;
  /** Character offset where the insertion would occur */
  insertionOffset: number;
  /** Dutch-language explanation of the suggested insertion */
  explanation: string;
}

/**
 * Result of a bulk approval operation.
 * Provides a summary of how many links were approved, rejected, or skipped.
 */
export interface BulkApprovalResult {
  /** Total number of links in the bulk operation */
  total: number;
  /** Number of links successfully approved */
  approved: number;
  /** Number of links rejected */
  rejected: number;
  /** Number of links skipped (e.g., already processed, not in PENDING status) */
  skipped: number;
  /** Dutch-language summary of the operation */
  summary: string;
  /** Per-link results with details */
  details: BulkApprovalDetail[];
}

/**
 * Detail result for a single link in a bulk approval operation.
 */
export interface BulkApprovalDetail {
  /** The link ID */
  linkId: string;
  /** Outcome for this specific link */
  outcome: 'approved' | 'rejected' | 'skipped';
  /** Reason if skipped or rejected (in Dutch) */
  reason?: string;
}

/**
 * Filters for querying internal links.
 * Used by the approval workflow and listing endpoints.
 */
export interface InternalLinkFilters {
  /** Filter by link status */
  status?: LinkStatus;
  /** Filter by generation strategy */
  strategy?: LinkStrategy;
  /** Filter by source page ID */
  sourcePageId?: string;
  /** Filter by target page ID */
  targetPageId?: string;
  /** Minimum confidence score (inclusive) */
  minConfidence?: number;
  /** Maximum confidence score (inclusive) */
  maxConfidence?: number;
}

/**
 * Warning about keyword cannibalization between pages.
 * Triggered when two pages target the same primary keyword and
 * linking between them might confuse search engines.
 */
export interface CannibalizationWarning {
  /** First page URL involved in the potential cannibalization */
  pageUrl1: string;
  /** First page database ID */
  pageId1: string;
  /** Second page URL involved in the potential cannibalization */
  pageUrl2: string;
  /** Second page database ID */
  pageId2: string;
  /** The keyword both pages appear to target */
  sharedKeyword: string;
  /** Dutch-language explanation of why this is a cannibalization risk */
  warning: string;
  /** Severity of the cannibalization risk */
  severity: 'low' | 'medium' | 'high';
  /** Suggested action in Dutch (e.g., "Overweeg om één pagina te canonicaliseren") */
  suggestedAction: string;
}

/**
 * Anchor text variation with confidence score.
 * Generated by the anchor variation module for Dutch-language content.
 */
export interface AnchorVariation {
  /** The anchor text string */
  anchorText: string;
  /** Type of anchor variation */
  type: 'exact_match' | 'partial_match' | 'descriptive' | 'action_oriented' | 'natural_language';
  /** Dutch label for the variation type */
  typeLabel: string;
  /** Confidence score between 0 and 1 */
  confidence: number;
}

/**
 * Summary of a page's linking profile, used internally
 * for generating link candidates.
 */
export interface PageLinkProfile {
  /** Page database ID */
  pageId: string;
  /** Page URL */
  url: string;
  /** Normalized URL (without trailing slashes, lowercase) */
  normalizedUrl: string;
  /** Page title */
  title: string | null;
  /** Meta description or H1 as fallback snippet */
  snippet: string | null;
  /** Primary keyword targeting this page */
  primaryKeyword: string | null;
  /** Number of internal links pointing TO this page (incoming) */
  incomingLinks: number;
  /** Number of internal links FROM this page (outgoing) */
  outgoingLinks: number;
  /** Word count of the page content */
  wordCount: number;
  /** Whether this page is flagged as an orphan (no incoming links) */
  isOrphan: boolean;
  /** Topic cluster ID this page belongs to */
  clusterId: string | null;
  /** Whether this page is a pillar page */
  isPillar: boolean;
  /** URLs this page already links to (from crawled internalLinks JSON) */
  existingOutgoingUrls: string[];
  /** Main content of the page for context extraction */
  mainContent: string | null;
}

/**
 * Result of the full candidate generation process.
 */
export interface CandidateGenerationResult {
  /** Total number of candidates generated */
  totalCandidates: number;
  /** Candidates grouped by strategy */
  byStrategy: Record<LinkStrategy, number>;
  /** Cannibalization warnings detected during generation */
  cannibalizationWarnings: CannibalizationWarning[];
  /** Dutch-language summary of the generation results */
  summary: string;
}
