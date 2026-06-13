// ============================================================================
// Google Integration — Barrel Exports
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================

// OAuth client
export {
  createOAuth2Client,
  generateAuthURL,
  exchangeCodeForTokens,
  storeOAuthTokens,
  getOAuthTokens,
  refreshAccessToken,
  getAuthenticatedClient,
  verifyConnection,
  disconnectOAuth,
  GOOGLE_SCOPES,
  SCOPE_LABELS,
} from './oauth-client';

// Token encryption (internal use, but exported for testing)
export { encrypt, decrypt } from './token-encryption';

// Google API clients
export {
  fetchGSCSearchAnalytics,
  listGSCProperties,
  syncGSCData,
  fetchGA4Analytics,
  listGA4Properties,
  syncGA4Data,
  fetchGBPProfile,
  fetchGBPReviews,
  listGBPSccounts,
  listGBPLocations,
  syncGBPDataToDb,
} from './google-api';

// Types
export type {
  GSCSearchAnalyticsRow,
  GSCSyncResult,
  GA4MetricsRow,
  GBPLocationInfo,
  GBPReview,
} from './google-api';
