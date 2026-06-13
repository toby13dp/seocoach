// ============================================================================
// Content Types — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Type definitions for the Content Brief, Draft Generation, Quality Analysis,
// and Decay Detection systems. All user-facing strings are in Dutch.
// ============================================================================

/**
 * Data required to create a new content brief.
 * Maps to the Prisma ContentBrief model fields.
 */
export interface ContentBriefData {
  /** Brief title */
  title: string;
  /** Primary target keyword */
  targetKeyword?: string;
  /** Secondary keywords to cover */
  secondaryKeywords?: string[];
  /** Search intent classification */
  searchIntent?: string;
  /** Funnel stage */
  funnelStage?: string;
  /** Content outline structure */
  outline?: OutlineItem[];
  /** Source URLs for reference */
  sources?: string[];
  /** Whether the brand profile was used to inform this brief */
  brandProfileUsed?: boolean;
  /** Internal page IDs to link to */
  internalPages?: string[];
  /** Target word count for the content */
  targetWordCount?: number;
  /** Target audience description */
  targetAudience?: string;
  /** Tone of voice guidelines */
  toneOfVoice?: string;
}

/**
 * A single item in the content outline hierarchy.
 * Supports nested H2/H3/H4 heading structures with key points.
 */
export interface OutlineItem {
  /** Unique identifier for this outline item */
  id: string;
  /** Heading text */
  heading: string;
  /** Heading level (2 = H2, 3 = H3, etc.) */
  level: number;
  /** Key points to cover in this section */
  keyPoints?: string[];
  /** Sub-headings under this item */
  children?: OutlineItem[];
  /** Sort order within the same level */
  sortOrder: number;
}

/**
 * Request to generate a content draft from a brief.
 */
export interface ContentDraftRequest {
  /** The brief to generate a draft for */
  briefId: string;
  /** The project ID (for AI provider selection) */
  projectId: string;
  /** Override the outline from the brief */
  outline?: OutlineItem[];
  /** Brand profile ID to inject into the prompt */
  brandProfileId?: string;
  /** Whether to include internal link suggestions */
  includeInternalLinks?: boolean;
  /** Target word count override */
  targetWordCount?: number;
}

/**
 * A single quality dimension with scoring and Dutch-language feedback.
 */
export interface QualityDimension {
  /** Machine-readable dimension name */
  name: string;
  /** Human-readable Dutch name for the dimension */
  dutchName: string;
  /** Score from 0 to 100 */
  score: number;
  /** Explanation of the score in Dutch */
  explanation: string;
  /** Actionable recommendations in Dutch */
  recommendations: string[];
}

/**
 * Filters for listing content briefs.
 */
export interface BriefFilters {
  /** Filter by approval status */
  approvalStatus?: string;
  /** Filter by search intent */
  searchIntent?: string;
  /** Filter by funnel stage */
  funnelStage?: string;
  /** Search in title and target keyword */
  search?: string;
  /** Sort field */
  sortBy?: 'title' | 'createdAt' | 'updatedAt';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Page number (1-based) */
  page?: number;
  /** Items per page */
  pageSize?: number;
}

/**
 * Paginated list of content briefs.
 */
export interface PaginatedBriefs {
  /** Brief summaries for the current page */
  items: BriefSummary[];
  /** Total number of briefs matching the filters */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Summary of a content brief for list views.
 */
export interface BriefSummary {
  id: string;
  title: string;
  targetKeyword?: string;
  searchIntent: string;
  funnelStage: string;
  approvalStatus: string;
  targetWordCount?: number;
  versionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Detailed view of a content brief with its versions.
 */
export interface ContentBriefWithDetails {
  id: string;
  projectId: string;
  title: string;
  targetKeyword?: string;
  secondaryKeywords: string[];
  searchIntent: string;
  funnelStage: string;
  outline: OutlineItem[];
  sources: string[];
  brandProfileUsed: boolean;
  internalPages: string[];
  targetWordCount?: number;
  targetAudience?: string;
  toneOfVoice?: string;
  approvalStatus: string;
  approvedBy?: string;
  approvedAt?: Date;
  versions: ContentVersionSummary[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Summary of a content version for brief detail views.
 */
export interface ContentVersionSummary {
  id: string;
  version: number;
  wordCount: number;
  aiGenerated: boolean;
  changeSummary?: string;
  createdAt: Date;
}

/**
 * Pruning action recommendation for decayed content.
 */
export type PruningActionType =
  | 'KEEP'
  | 'IMPROVE'
  | 'MERGE'
  | 'REDIRECT'
  | 'NOINDEX'
  | 'REMOVE';

/**
 * Risk analysis for a pruning action.
 * Warns about potential negative impacts before destructive actions.
 */
export interface RiskAnalysis {
  /** Overall risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Risk factors identified */
  factors: RiskFactor[];
  /** Dutch summary of the risk assessment */
  summary: string;
  /** Recommended precautions in Dutch */
  precautions: string[];
}

/**
 * A single risk factor in a pruning risk analysis.
 */
export interface RiskFactor {
  /** Factor type */
  type: 'backlinks' | 'traffic' | 'authority' | 'redirect_target' | 'content_value';
  /** Dutch description of the risk */
  description: string;
  /** Severity of this risk factor */
  severity: 'low' | 'medium' | 'high';
}
