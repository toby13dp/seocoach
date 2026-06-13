// ============================================================================
// CRO & Behaviour — Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for behaviour data import, CRO finding generation, and
// analysis. All user-facing labels are in Dutch.
// ============================================================================

import { CROCategory, CROSeverity, BehaviourType } from '@prisma/client';

// ============================================================================
// Behaviour Import Data
// ============================================================================

/**
 * Data for importing a single behaviour record.
 * Captures user interaction data such as scroll depth, clicks,
 * rage clicks, dead clicks, form abandonment, device type, and engagement.
 */
export interface BehaviourImportData {
  /** Type of behaviour event */
  behaviourType: BehaviourType;
  /** URL of the page where the behaviour occurred */
  pageUrl?: string;
  /** CSS selector or element description */
  element?: string;
  /** Numeric value (e.g. scroll depth percentage) */
  value?: number;
  /** JSON string for additional metadata */
  metadata?: string;
  /** Session identifier */
  sessionId?: string;
  /** Device type: "desktop", "mobile", "tablet" */
  deviceType?: string;
  /** When the behaviour was recorded */
  recordedAt?: Date;
}

// ============================================================================
// CRO Finding Data
// ============================================================================

/**
 * Data for creating a CRO finding.
 * All text fields (title, description, recommendation, estimatedImpact)
 * must be in Dutch.
 */
export interface CROFindingData {
  /** CRO category */
  category: CROCategory;
  /** Severity level */
  severity: CROSeverity;
  /** Dutch title for the finding */
  title: string;
  /** Dutch description of the finding */
  description: string;
  /** Dutch recommendation for improvement */
  recommendation: string;
  /** JSON evidence data supporting the finding */
  evidence?: string;
  /** Page URL where the finding applies */
  pageUrl?: string;
  /** Dutch estimated impact description */
  estimatedImpact?: string;
  /** Effort level: "low", "medium", "high" */
  effort?: string;
}

// ============================================================================
// Dutch Label Maps
// ============================================================================

/** Dutch labels for CRO categories */
export const CRO_CATEGORY_LABELS: Record<CROCategory, string> = {
  CTA: 'Call-to-action',
  FORMS: 'Formulieren',
  TRUST: 'Vertrouwen',
  VALUE_PROPOSITION: 'Waardepropositie',
  PRICING_COMMUNICATION: 'Prijscommunicatie',
  MOBILE_UX: 'Mobiele UX',
  FUNNELS: 'Funnels',
  LANDING_PAGES: 'Bestemmingspagina\'s',
  PRODUCT_PAGES: 'Productpagina\'s',
};

/** Dutch labels for CRO severity levels */
export const CRO_SEVERITY_LABELS: Record<CROSeverity, string> = {
  CRITICAL: 'Kritiek',
  HIGH: 'Hoog',
  MEDIUM: 'Gemiddeld',
  LOW: 'Laag',
};

/** Dutch labels for behaviour types */
export const BEHAVIOUR_TYPE_LABELS: Record<BehaviourType, string> = {
  SCROLL_DEPTH: 'Scroll-diepte',
  CLICK: 'Klik',
  RAGE_CLICK: 'Woedeklik',
  DEAD_CLICK: 'Dode klik',
  FORM_ABANDONMENT: 'Formulier-afbreking',
  DEVICE_TYPE: 'Apparaattype',
  ENGAGEMENT: 'Betrokkenheid',
};
