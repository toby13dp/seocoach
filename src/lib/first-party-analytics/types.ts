// ============================================================================
// First-party Analytics — Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for privacy-friendly event collection, session management,
// and funnel analysis. All user-facing labels are in Dutch.
// ============================================================================

import { AnalyticsEventType, ConsentState } from '@prisma/client';

// ============================================================================
// Event Data Interfaces
// ============================================================================

/**
 * Data for ingesting a single analytics event.
 * Supports page views, custom events, conversions, and revenue tracking.
 * All optional fields default to null/undefined if not provided.
 */
export interface AnalyticsEventData {
  /** Type of analytics event */
  eventType: AnalyticsEventType;
  /** Custom event name (for EVENT type) */
  eventName?: string;
  /** URL of the page where the event occurred */
  pageUrl?: string;
  /** Title of the page */
  pageTitle?: string;
  /** Referrer URL */
  referrer?: string;
  /** Session identifier — if omitted, a cookieless session ID is generated */
  sessionId?: string;
  /** Anonymised user identifier */
  userId?: string;
  /** UTM campaign parameters */
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  /** Custom event data as JSON string */
  eventData?: string;
  /** Revenue associated with this event (for CONVERSION/REVENUE types) */
  revenue?: number;
  /** Currency code (default: EUR) */
  currency?: string;
  /** Consent state for privacy compliance */
  consentState: ConsentState;
  /** Device type: "desktop", "mobile", "tablet" */
  deviceType?: string;
  /** Browser name */
  browser?: string;
  /** Operating system */
  os?: string;
  /** Country code (e.g. "NL") */
  country?: string;
  /** Browser language */
  language?: string;
}

// ============================================================================
// Session Summary
// ============================================================================

/**
 * Aggregated session summary statistics.
 * Used for dashboard display and reporting.
 */
export interface SessionSummary {
  /** Total number of sessions */
  totalSessions: number;
  /** Average session duration in seconds */
  avgDuration: number;
  /** Average page views per session */
  avgPageViews: number;
  /** Bounce rate (0-1) */
  bounceRate: number;
  /** Conversion rate (0-1) */
  conversionRate: number;
  /** Total revenue across all sessions */
  totalRevenue: number;
  /** Top traffic sources with session counts */
  topSources: { source: string; count: number }[];
  /** Top visited pages with view counts */
  topPages: { page: string; count: number }[];
  /** Device type breakdown */
  deviceBreakdown: { device: string; count: number; label: string }[];
}

// ============================================================================
// Funnel Analysis
// ============================================================================

/**
 * A single step in a funnel analysis.
 * Contains Dutch step name and computed metrics.
 */
export interface FunnelStep {
  /** Dutch name for the funnel step */
  name: string;
  /** Number of visitors reaching this step */
  count: number;
  /** Dropoff rate from previous step (0-1, 0 for first step) */
  dropoffRate: number;
}

/**
 * Complete funnel analysis result.
 * Contains all steps and the overall conversion rate.
 */
export interface FunnelAnalysis {
  /** Ordered funnel steps */
  steps: FunnelStep[];
  /** Overall conversion rate from first to last step (0-1) */
  overallConversionRate: number;
}

// ============================================================================
// Dutch Label Maps
// ============================================================================

/** Dutch labels for analytics event types */
export const ANALYTICS_EVENT_TYPE_LABELS: Record<AnalyticsEventType, string> = {
  PAGE_VIEW: 'Paginaweergave',
  SESSION: 'Sessie',
  EVENT: 'Gebeurtenis',
  CONVERSION: 'Conversie',
  REVENUE: 'Omzet',
};

/** Dutch labels for consent states */
export const CONSENT_STATE_LABELS: Record<ConsentState, string> = {
  GRANTED: 'Toestemming gegeven',
  DENIED: 'Toestemming geweigerd',
  UNKNOWN: 'Onbekend',
};

// ============================================================================
// Privacy Disclaimer
// ============================================================================

/**
 * Dutch privacy disclaimer for analytics tracking.
 * Must be displayed to users before activating tracking.
 */
export const PRIVACY_DISCLAIMER =
  'Je bent verantwoordelijk voor het voldoen aan privacywetgeving (AVG/GDPR) bij het verzamelen van gebruikersgegevens. Zorg voor een cookiebanner en toestemmingsmechanisme voordat je tracking activeert.';
