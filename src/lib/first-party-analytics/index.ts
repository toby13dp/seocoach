// ============================================================================
// First-party Analytics — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Re-exports all first-party analytics modules from a single entry point.
// Import from '@/lib/first-party-analytics' to access the full functionality.
// ============================================================================

// Types
export type {
  AnalyticsEventData,
  SessionSummary,
  FunnelStep,
  FunnelAnalysis,
} from './types';

export {
  ANALYTICS_EVENT_TYPE_LABELS,
  CONSENT_STATE_LABELS,
  PRIVACY_DISCLAIMER,
} from './types';

// Event Collector
export {
  trackEvent,
  trackPageView,
  trackConversion,
  bulkTrackEvents,
} from './event-collector';

// Session Manager
export {
  createOrUpdateSession,
  getSession,
  getSessionSummary,
  endSession,
} from './session-manager';

// Funnel Analyzer
export {
  analyzeFunnel,
  getTopFunnelDropoffs,
} from './funnel-analyzer';
