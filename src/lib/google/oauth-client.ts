// ============================================================================
// Google OAuth Client
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages Google OAuth 2.0 flow: authorization URL generation, token exchange,
// token refresh, and token encryption/decryption for secure storage.
// ============================================================================

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { encrypt, decrypt } from './token-encryption';
import { db } from '@/lib/db';
import { appLogger as logger } from '@/lib/observability/logger';

// ============================================================================
// Configuration
// ============================================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

/** OAuth callback URL for SEOCoach Google integrations */
const REDIRECT_URI = `${NEXTAUTH_URL}/api/google/oauth/callback`;

/**
 * Google OAuth scopes for SEOCoach integrations.
 * Requested incrementally — only when user connects a specific service.
 */
export const GOOGLE_SCOPES = {
  /** Google Search Console — read search analytics data */
  SEARCH_CONSOLE: [
    'https://www.googleapis.com/auth/webmasters.readonly',
  ],
  /** Google Analytics 4 — read analytics data */
  ANALYTICS: [
    'https://www.googleapis.com/auth/analytics.readonly',
  ],
  /** Google Business Profile — read business info and reviews */
  BUSINESS_PROFILE: [
    'https://www.googleapis.com/auth/business.manage',
  ],
  /** All scopes combined — for initial connection or full access */
  ALL: [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/business.manage',
  ],
} as const;

/** Scope labels in Dutch for UI display */
export const SCOPE_LABELS: Record<string, string> = {
  'https://www.googleapis.com/auth/webmasters.readonly': 'Google Search Console (alleen lezen)',
  'https://www.googleapis.com/auth/analytics.readonly': 'Google Analytics (alleen lezen)',
  'https://www.googleapis.com/auth/business.manage': 'Google Bedrijfsprofiel (beheren)',
};

// ============================================================================
// OAuth Client Factory
// ============================================================================

/**
 * Create a configured OAuth2 client instance.
 * Uses the GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from environment.
 */
export function createOAuth2Client(): OAuth2Client {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'Google OAuth is niet geconfigureerd. Stel GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET in je .env bestand in.'
    );
  }

  return new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
  });
}

// ============================================================================
// Authorization URL Generation
// ============================================================================

interface GenerateAuthURLOptions {
  /** Project ID to associate the OAuth flow with */
  projectId: string;
  /** User ID initiating the OAuth flow */
  userId: string;
  /** Scopes to request — defaults to ALL */
  scopes?: string[];
  /** Specific service being connected (for state tracking) */
  service?: 'search_console' | 'analytics' | 'business_profile' | 'all';
}

/**
 * Generate a Google OAuth authorization URL.
 * Stores state in the database to prevent CSRF and track the flow.
 *
 * @returns The authorization URL to redirect the user to
 */
export async function generateAuthURL(options: GenerateAuthURLOptions): Promise<string> {
  const {
    projectId,
    userId,
    scopes = [...GOOGLE_SCOPES.ALL],
    service = 'all',
  } = options;

  const oauth2Client = createOAuth2Client();

  // Generate a secure state token
  const state = crypto.randomUUID();

  // Store state in database for CSRF verification
  await db.oAuthState.create({
    data: {
      state,
      projectId,
      userId,
      scopes: JSON.stringify(scopes),
      service,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [...scopes],
    state,
    prompt: 'consent', // Always prompt to ensure we get a refresh token
    include_granted_scopes: true, // Incremental auth
  });

  logger.info('Google OAuth authorization URL generated', {
    projectId,
    userId,
    service,
    scopes: scopes.length,
  });

  return authUrl;
}

// ============================================================================
// Token Exchange (OAuth Callback)
// ============================================================================

interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
  scope: string;
  tokenType: string;
}

/**
 * Exchange an authorization code for OAuth tokens.
 * Verifies state, exchanges code, and returns encrypted tokens.
 *
 * @param code - The authorization code from Google
 * @param state - The state parameter for CSRF verification
 * @returns The token exchange result with encrypted tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  state: string
): Promise<{
  tokens: TokenExchangeResult;
  projectId: string;
  userId: string;
  service: string;
  requestedScopes: string[];
}> {
  // Verify state token
  const stateRecord = await db.oAuthState.findUnique({
    where: { state },
  });

  if (!stateRecord) {
    throw new Error('Ongeldige OAuth-state. Het verzoek is mogelijk verlopen. Probeer opnieuw.');
  }

  if (stateRecord.expiresAt < new Date()) {
    // Clean up expired state
    await db.oAuthState.delete({ where: { state } });
    throw new Error('OAuth-verzoek is verlopen. Probeer opnieuw.');
  }

  const projectId = stateRecord.projectId;
  const userId = stateRecord.userId;
  const service = stateRecord.service;
  const requestedScopes = JSON.parse(stateRecord.scopes);

  // Clean up the used state
  await db.oAuthState.delete({ where: { state } });

  // Exchange code for tokens
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token) {
    throw new Error('Google heeft geen access token geretourneerd. Probeer opnieuw.');
  }

  logger.info('Google OAuth tokens exchanged successfully', {
    projectId,
    userId,
    service,
    hasRefreshToken: !!tokens.refresh_token,
    scope: tokens.scope,
  });

  return {
    tokens: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date ?? null,
      scope: tokens.scope ?? '',
      tokenType: tokens.token_type ?? 'Bearer',
    },
    projectId,
    userId,
    service,
    requestedScopes,
  };
}

// ============================================================================
// Token Storage
// ============================================================================

/**
 * Store OAuth tokens for a project's data connection.
 * Encrypts sensitive tokens before storage.
 */
export async function storeOAuthTokens(
  projectId: string,
  connectionId: string,
  tokens: TokenExchangeResult,
  grantedScopes: string[]
): Promise<void> {
  const config = {
    accessToken: encrypt(tokens.accessToken),
    refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    tokenExpiry: tokens.expiryDate,
    grantedScopes,
    tokenType: tokens.tokenType,
  };

  await db.dataConnection.update({
    where: { id: connectionId },
    data: {
      config: JSON.stringify(config),
      status: 'CONNECTED',
      metadata: JSON.stringify({
        scope: tokens.scope,
        connectedAt: new Date().toISOString(),
        connectedBy: 'oauth',
      }),
    },
  });

  logger.info('OAuth tokens stored for data connection', {
    projectId,
    connectionId,
    grantedScopes: grantedScopes.length,
  });
}

/**
 * Retrieve and decrypt OAuth tokens for a data connection.
 * Returns null if no valid tokens are stored.
 */
export async function getOAuthTokens(
  connectionId: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
  grantedScopes: string[];
} | null> {
  const connection = await db.dataConnection.findFirst({
    where: { id: connectionId, deletedAt: null },
  });

  if (!connection || !connection.config) {
    return null;
  }

  try {
    const config = JSON.parse(connection.config);

    if (!config.accessToken) {
      return null;
    }

    return {
      accessToken: decrypt(config.accessToken),
      refreshToken: config.refreshToken ? decrypt(config.refreshToken) : null,
      expiryDate: config.tokenExpiry ?? null,
      grantedScopes: config.grantedScopes ?? [],
    };
  } catch {
    logger.error('Failed to decrypt OAuth tokens', { connectionId });
    return null;
  }
}

// ============================================================================
// Token Refresh
// ============================================================================

/**
 * Refresh an expired access token using the stored refresh token.
 * Updates the stored tokens automatically.
 *
 * @returns The new access token, or throws if refresh fails
 */
export async function refreshAccessToken(connectionId: string): Promise<string> {
  const tokens = await getOAuthTokens(connectionId);

  if (!tokens?.refreshToken) {
    throw new Error(
      'Geen refresh token beschikbaar. Koppel je Google-account opnieuw via de instellingen.'
    );
  }

  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    refresh_token: tokens.refreshToken,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Google heeft geen nieuw access token geretourneerd.');
    }

    // Store updated tokens
    const connection = await db.dataConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('Gegevensverbinding niet gevonden');
    }

    const existingConfig = connection.config ? JSON.parse(connection.config) : {};

    const updatedConfig = {
      ...existingConfig,
      accessToken: encrypt(credentials.access_token),
      refreshToken: credentials.refresh_token
        ? encrypt(credentials.refresh_token)
        : existingConfig.refreshToken,
      tokenExpiry: credentials.expiry_date ?? null,
    };

    await db.dataConnection.update({
      where: { id: connectionId },
      data: {
        config: JSON.stringify(updatedConfig),
        lastSyncError: null,
      },
    });

    logger.info('Google OAuth access token refreshed', { connectionId });

    return credentials.access_token;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Mark connection as needing re-authorization
    await db.dataConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncStatus: 'failed',
        lastSyncError: `Token vernieuwen mislukt: ${message}. Koppel je Google-account opnieuw.`,
      },
    });

    logger.error('Failed to refresh Google OAuth token', {
      connectionId,
      error: message,
    });

    throw new Error(
      `Token vernieuwen mislukt: ${message}. Koppel je Google-account opnieuw via de instellingen.`
    );
  }
}

// ============================================================================
// Authenticated Client Helper
// ============================================================================

/**
 * Get an authenticated OAuth2 client for making Google API calls.
 * Handles token refresh automatically if the access token is expired.
 *
 * @param connectionId - The data connection ID to get credentials for
 * @returns An authenticated OAuth2Client ready for API calls
 */
export async function getAuthenticatedClient(connectionId: string): Promise<OAuth2Client> {
  const tokens = await getOAuthTokens(connectionId);

  if (!tokens) {
    throw new Error('Geen OAuth-tokens gevonden. Koppel eerst je Google-account.');
  }

  // Check if token is expired and refresh if needed
  let accessToken = tokens.accessToken;
  const isExpired = tokens.expiryDate
    ? tokens.expiryDate <= Date.now() + 60_000 // 1 minute buffer
    : false;

  if (isExpired) {
    accessToken = await refreshAccessToken(connectionId);
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: tokens.refreshToken,
  });

  return oauth2Client;
}

// ============================================================================
// Connection Verification
// ============================================================================

/**
 * Verify that a Google OAuth connection is still valid by making a test API call.
 * Updates the connection status accordingly.
 */
export async function verifyConnection(connectionId: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    const client = await getAuthenticatedClient(connectionId);

    // Test with a simple tokeninfo call
    const tokenInfo = await client.getTokenInfo(client.credentials.access_token ?? '');

    if (!tokenInfo) {
      return {
        valid: false,
        error: 'Token is ongeldig of verlopen. Koppel je Google-account opnieuw.',
      };
    }

    await db.dataConnection.update({
      where: { id: connectionId },
      data: {
        status: 'CONNECTED',
        lastSyncError: null,
      },
    });

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await db.dataConnection.update({
      where: { id: connectionId },
      data: {
        status: 'ERROR',
        lastSyncError: `Verbinding controle mislukt: ${message}`,
      },
    });

    return {
      valid: false,
      error: message,
    };
  }
}

/**
 * Disconnect a Google OAuth connection by revoking tokens and clearing stored credentials.
 */
export async function disconnectOAuth(connectionId: string): Promise<void> {
  try {
    const tokens = await getOAuthTokens(connectionId);

    if (tokens?.accessToken) {
      // Revoke the token with Google
      const oauth2Client = createOAuth2Client();
      await oauth2Client.revokeToken(tokens.accessToken);
    }
  } catch (error) {
    // Log but don't fail — the token might already be revoked
    logger.warn('Failed to revoke Google OAuth token during disconnect', {
      connectionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Clear stored tokens
  await db.dataConnection.update({
    where: { id: connectionId },
    data: {
      config: JSON.stringify({}),
      status: 'DISCONNECTED',
      lastSyncStatus: null,
      lastSyncError: null,
      metadata: JSON.stringify({
        disconnectedAt: new Date().toISOString(),
      }),
    },
  });

  logger.info('Google OAuth connection disconnected', { connectionId });
}
