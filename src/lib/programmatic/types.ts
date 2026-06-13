// ============================================================================
// Programmatic SEO Types — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Type definitions for the Programmatic SEO module. All user-facing strings
// (labels, descriptions, messages) are in Dutch.
// ============================================================================

/**
 * Supported variable types for programmatic templates.
 */
export type ProgrammaticVariableType = 'text' | 'number' | 'url' | 'select';

/**
 * A single variable definition within a programmatic template.
 * Describes the data that can be filled into template placeholders.
 */
export interface ProgrammaticVariable {
  /** Machine-readable variable name (used in {{variable}} placeholders) */
  name: string;
  /** Human-readable Dutch label */
  label: string;
  /** Data type of the variable */
  type: ProgrammaticVariableType;
  /** Whether this variable must be filled for generation */
  required: boolean;
  /** For 'select' type: available options */
  options?: string[];
  /** Default value if none provided */
  defaultValue?: string;
  /** Dutch description of what this variable represents */
  description: string;
}

/**
 * A collection of data rows for a programmatic template.
 * Each row maps variable names to their values for a single page.
 */
export type ProgrammaticDataRows = Array<Record<string, string | number>>;

/**
 * Template type identifiers matching the Prisma enum.
 */
export type TemplateType =
  | 'SERVICE_LOCATION'
  | 'PRODUCT_USE_CASE'
  | 'PRODUCT_AUDIENCE'
  | 'PRODUCT_FEATURE'
  | 'CATEGORY_FEATURE'
  | 'INDUSTRY_SERVICE'
  | 'INTEGRATION_PLATFORM'
  | 'COMPARISON'
  | 'GLOSSARY';

/**
 * Configuration for quality gates on a programmatic template.
 */
export interface QualityGatesConfig {
  /** Minimum word count per generated page (default: 300) */
  minWordCount?: number;
  /** Minimum number of unique data points per page (default: 3) */
  minUniqueDataPoints?: number;
  /** Maximum similarity threshold for duplicate detection (default: 0.8 = 80%) */
  maxSimilarityThreshold?: number;
  /** Whether to check for keyword cannibalisation (default: true) */
  checkCannibalisation?: boolean;
  /** Whether to check brand profile compliance (default: true) */
  checkBrandCompliance?: boolean;
  /** Whether to check for unsupported claims (default: true) */
  checkClaims?: boolean;
  /** Whether to require at least one internal link suggestion (default: true) */
  requireInternalLinks?: boolean;
}

/**
 * Configuration for creating a programmatic template.
 */
export interface ProgrammaticTemplateConfig {
  /** The type of template (determines default variable set) */
  templateType: TemplateType;
  /** Variable definitions for this template */
  variables: ProgrammaticVariable[];
  /** Content template string with {{variable}} placeholders */
  contentTemplate: string;
  /** Target keyword pattern with {{variable}} placeholders */
  targetKeyword: string;
  /** Quality gate configuration */
  qualityGates: QualityGatesConfig;
}

/**
 * Result of a single quality gate check.
 */
export interface QualityGateResult {
  /** Dutch name of the quality gate */
  gateName: string;
  /** Whether the page passed this gate */
  passed: boolean;
  /** Score from 0 to 100 */
  score: number;
  /** Dutch message explaining the result */
  message: string;
  /** Additional details about the check (optional) */
  details?: Record<string, unknown>;
}

/**
 * Result of generating pages from a programmatic template.
 */
export interface ProgrammaticGenerationResult {
  /** Total number of pages generated */
  totalGenerated: number;
  /** Number of pages that passed all quality gates */
  approved: number;
  /** Number of pages that were rejected */
  rejected: number;
  /** Map of rejection reason (Dutch) to count */
  rejectionReasons: Record<string, number>;
}

/**
 * A preview of a template rendered with a sample data row.
 */
export interface TemplatePreview {
  /** The rendered content with data filled in (HTML or Markdown) */
  rendered: string;
  /** The data row used for the preview */
  rowData: Record<string, string | number>;
  /** The target keyword for this preview */
  targetKeyword: string;
  /** The title generated for this preview */
  title: string;
  /** The slug generated for this preview */
  slug: string;
}

/**
 * Summary of a programmatic template for list views.
 */
export interface TemplateSummary {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  templateType: TemplateType;
  dataRowCount: number;
  pageCount: number;
  approvedCount: number;
  publishedCount: number;
  maxPages: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Detailed view of a programmatic template with its pages.
 */
export interface TemplateWithPages extends TemplateSummary {
  variables: ProgrammaticVariable[];
  contentTemplate: string;
  targetKeyword: string;
  qualityGates: QualityGatesConfig;
  dataRows: ProgrammaticDataRows;
  pages: ProgrammaticPageSummary[];
}

/**
 * Summary of a programmatic page for template detail views.
 */
export interface ProgrammaticPageSummary {
  id: string;
  title?: string;
  slug?: string;
  status: string;
  qualityScore: number;
  rejectionReasons?: string[];
  createdAt: Date;
  updatedAt: Date;
}
