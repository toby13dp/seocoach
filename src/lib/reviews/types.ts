// ============================================================================
// Reviews & Reputation — Core Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for review import, sentiment analysis, response drafting,
// and review summary statistics. All user-facing labels are in Dutch.
// ============================================================================

import { ReviewSource, ReviewSentiment, ReviewResponseStatus } from '@prisma/client';

// ============================================================================
// Review Import
// ============================================================================

/**
 * Data for importing a single review from an external source.
 * All text fields may contain content in any language, but system-generated
 * labels and analyses are always in Dutch.
 */
export interface ReviewImportData {
  /** Where this review came from */
  source: ReviewSource;
  /** External platform ID for deduplication */
  externalId?: string;
  /** Link to the original review on the source platform */
  sourceUrl?: string;
  /** Name of the reviewer */
  authorName?: string;
  /** Star rating (1-5) */
  rating: number;
  /** Review title / headline */
  title?: string;
  /** Full review text */
  content?: string;
  /** Date the review was originally posted */
  reviewDate?: Date;
  /** Language code of the review content (e.g. "nl", "en") */
  language?: string;
}

// ============================================================================
// Sentiment Analysis
// ============================================================================

/**
 * Result of sentiment analysis on a review.
 * All theme labels, complaints, and opportunities are in Dutch.
 */
export interface SentimentAnalysisResult {
  /** Overall sentiment classification */
  sentiment: ReviewSentiment;
  /** Sentiment score from -1 (very negative) to 1 (very positive) */
  score: number;
  /** Detected themes (Dutch labels) */
  themes: string[];
  /** Detected complaints (Dutch) */
  complaints: string[];
  /** Detected compliments (Dutch) */
  compliments: string[];
  /** Detected product issues (Dutch) */
  productIssues: string[];
  /** Detected service issues (Dutch) */
  serviceIssues: string[];
  /** FAQ content opportunities derived from themes and complaints (Dutch) */
  faqOpportunities: string[];
  /** Content opportunities derived from themes and complaints (Dutch) */
  contentOpportunities: string[];
  /** Trust signals identified from the review (Dutch) */
  trustSignals: string[];
}

// ============================================================================
// Review Summary
// ============================================================================

/**
 * Aggregated summary statistics for a set of reviews.
 * Used for dashboard displays and reputation overview.
 */
export interface ReviewSummary {
  /** Total number of reviews (excluding soft-deleted) */
  totalReviews: number;
  /** Average star rating across all reviews */
  avgRating: number;
  /** Distribution of ratings: { 1: count, 2: count, ... 5: count } */
  ratingDistribution: Record<number, number>;
  /** Distribution of sentiment classifications */
  sentimentDistribution: Record<ReviewSentiment, number>;
  /** Most frequently detected themes with counts (Dutch theme names) */
  topThemes: { theme: string; count: number }[];
  /** Top complaints across all reviews (Dutch) */
  topComplaints: string[];
  /** Top compliments across all reviews (Dutch) */
  topCompliments: string[];
  /** Fraction of reviews that have at least one response (0-1) */
  responseRate: number;
  /** Average time between review and first response, in hours */
  avgResponseTimeHours: number | null;
}

// ============================================================================
// Review Response Draft
// ============================================================================

/**
 * A draft response to a review, going through the approval workflow.
 * Content is always in Dutch.
 */
export interface ReviewResponseDraft {
  /** The response text (Dutch) */
  content: string;
  /** Current status in the approval workflow */
  status: ReviewResponseStatus;
}

// ============================================================================
// Dutch Label Maps
// ============================================================================

/** Dutch labels for review source types */
export const REVIEW_SOURCE_LABELS: Record<ReviewSource, string> = {
  GOOGLE: 'Google',
  WOOCOMMERCE: 'WooCommerce',
  TRUSTPILOT: 'Trustpilot',
  CSV_IMPORT: 'CSV-import',
  SURVEY: 'Enquête',
  SUPPORT_FEEDBACK: 'Klantenservice-feedback',
  MANUAL: 'Handmatig',
};

/** Dutch labels for sentiment classifications */
export const REVIEW_SENTIMENT_LABELS: Record<ReviewSentiment, string> = {
  POSITIVE: 'Positief',
  NEUTRAL: 'Neutraal',
  NEGATIVE: 'Negatief',
  MIXED: 'Gemengd',
};

/** Dutch labels for response approval statuses */
export const REVIEW_RESPONSE_STATUS_LABELS: Record<ReviewResponseStatus, string> = {
  DRAFT: 'Concept',
  PENDING_APPROVAL: 'Wacht op goedkeuring',
  APPROVED: 'Goedgekeurd',
  REJECTED: 'Afgewezen',
  PUBLISHED: 'Gepubliceerd',
};

// ============================================================================
// CSV Column Mappings
// ============================================================================

/**
 * Default column name mappings for review CSV imports.
 * Supports both Dutch and English column names, as well as common
 * variations found in review export files from different platforms.
 */
export const DEFAULT_REVIEW_COLUMN_MAPPINGS: Record<
  keyof Omit<ReviewImportData, 'source' | 'language'>,
  string[]
> = {
  authorName: [
    'auteur',
    'author',
    'naam',
    'name',
    'reviewer',
    'reviewernaam',
    'klant',
    'customer',
  ],
  rating: [
    'beoordeling',
    'rating',
    'score',
    'sterren',
    'stars',
    'cijfer',
    'waardering',
    'grade',
  ],
  title: [
    'titel',
    'title',
    'kop',
    'onderwerp',
    'subject',
    'headline',
    'samenvatting',
  ],
  content: [
    'inhoud',
    'content',
    'tekst',
    'text',
    'review',
    'reactie',
    'comment',
    'beschrijving',
    'description',
    'opmerking',
    'body',
  ],
  reviewDate: [
    'datum',
    'date',
    'reviewdatum',
    'review date',
    'geplaatst op',
    'geplaatst',
    'created_at',
    'createdat',
    'geschreven op',
    'aangemaakt',
  ],
  sourceUrl: [
    'url',
    'bron-url',
    'source url',
    'link',
    'permalink',
    'review-url',
    'bron',
  ],
  externalId: [
    'id',
    'external_id',
    'review-id',
    'review id',
    'externalid',
    'referentie',
    'reference',
  ],
};

// ============================================================================
// Sentiment Keyword Patterns (Dutch)
// ============================================================================

/** Dutch negative keywords for sentiment analysis */
export const NEGATIVE_KEYWORDS = [
  'slecht',
  'terug',
  'niet',
  'nooit',
  'teleurgesteld',
  'ontgoocheld',
  'waardeloos',
  'langzaam',
  'onvriendelijk',
  'kapot',
  'defect',
  'verkeerd',
  'klacht',
  'probleem',
  'afschuwelijk',
  'erg',
  'vreselijk',
  'onbetrouwbaar',
  'vertraging',
  'onthulling',
  'onnauwkeurig',
  'onhandig',
  'mislukt',
  'beschadigd',
  'ontbrekend',
  'trage',
  'ramp',
  'chaos',
  ' frustratie',
  'blijft uit',
  'niet aanbevolen',
  'afgeraden',
  'slechste',
] as const;

/** Dutch positive keywords for sentiment analysis */
export const POSITIVE_KEYWORDS = [
  'goed',
  'uitstekend',
  'geweldig',
  'prima',
  'top',
  'snelle',
  'snel',
  'vriendelijk',
  'aanbevelen',
  'aanbevolen',
  'tevreden',
  'perfect',
  'fijn',
  'plezierig',
  'blij',
  'super',
  'heerlijk',
  'professioneel',
  'betrouwbaar',
  'kwaliteit',
  'fantastisch',
  'geweldig',
  'voortreffelijk',
  'punctueel',
  'behulpzaam',
  'prettig',
  'soepel',
  'verrast',
  'blijvend',
  'beste',
  'aanrader',
  'topkwaliteit',
] as const;

/** Dutch product-related theme keywords */
export const PRODUCT_THEME_KEYWORDS = [
  'product',
  'artikel',
  'kwaliteit',
  'levering',
  'verpakking',
  'prijs',
  'maat',
  'kleur',
  'materiaal',
  'grootte',
  'gewicht',
  'afmeting',
  'duurzaam',
  'kapot',
  'defect',
  'beschadigd',
  'uitvoering',
  'model',
  'versie',
  'specificatie',
  'handleiding',
  'installatie',
  'gebruik',
  'bediening',
] as const;

/** Dutch service-related theme keywords */
export const SERVICE_THEME_KEYWORDS = [
  'service',
  'klantenservice',
  'medewerker',
  'wachttijd',
  'communicatie',
  'reactie',
  'help',
  'ondersteuning',
  'leverancier',
  'bezorging',
  'retour',
  'ruilen',
  'terugbetaling',
  'garantie',
  'complaint',
  'klacht',
  'bestelling',
  'leverancier',
  'support',
  'helpdesk',
  'bereikbaarheid',
  'terugbellen',
  'antwoord',
  'oplossing',
] as const;
