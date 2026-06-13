// ============================================================================
// Google OAuth — Callback Endpoint
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Handles the OAuth callback from Google. Exchanges the authorization code
// for tokens, stores them, and redirects to the integrations page.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, storeOAuthTokens } from '@/lib/google';
import { db } from '@/lib/db';
import { appLogger as logger } from '@/lib/observability/logger';

const NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

// GET /api/google/oauth/callback?code=...&state=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle user denying access
    if (error) {
      const errorDesc = searchParams.get('error_description') ?? error;
      logger.warn('Google OAuth user denied access', { error, errorDesc });
      return NextResponse.redirect(
        `${NEXTAUTH_URL}/nl/integrations?google_error=${encodeURIComponent(errorDesc)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${NEXTAUTH_URL}/nl/integrations?google_error=${encodeURIComponent('Ontbrekende autorisatiecode of state. Probeer opnieuw.')}`
      );
    }

    // Exchange code for tokens and verify state
    const result = await exchangeCodeForTokens(code, state);
    const { tokens, projectId, userId, service, requestedScopes } = result;

    // Parse granted scopes from the token response
    const grantedScopes = tokens.scope
      ? tokens.scope.split(' ')
      : requestedScopes;

    // Create or update data connections based on granted scopes
    const hasGSCScope = grantedScopes.some((s) =>
      s.includes('webmasters')
    );
    const hasGA4Scope = grantedScopes.some((s) =>
      s.includes('analytics')
    );
    const hasGBPScope = grantedScopes.some((s) =>
      s.includes('business')
    );

    const connectionIds: string[] = [];

    // GSC Connection
    if (hasGSCScope) {
      const existing = await db.dataConnection.findFirst({
        where: {
          projectId,
          type: 'GOOGLE_SEARCH_CONSOLE',
          deletedAt: null,
        },
      });

      if (existing) {
        await storeOAuthTokens(projectId, existing.id, tokens, grantedScopes);
        connectionIds.push(existing.id);
      } else {
        const connection = await db.dataConnection.create({
          data: {
            projectId,
            name: 'Google Search Console',
            type: 'GOOGLE_SEARCH_CONSOLE',
            status: 'PENDING',
            config: JSON.stringify({}),
          },
        });
        await storeOAuthTokens(projectId, connection.id, tokens, grantedScopes);
        connectionIds.push(connection.id);
      }
    }

    // GA4 Connection
    if (hasGA4Scope) {
      const existing = await db.dataConnection.findFirst({
        where: {
          projectId,
          type: 'GOOGLE_ANALYTICS_4',
          deletedAt: null,
        },
      });

      if (existing) {
        await storeOAuthTokens(projectId, existing.id, tokens, grantedScopes);
        connectionIds.push(existing.id);
      } else {
        const connection = await db.dataConnection.create({
          data: {
            projectId,
            name: 'Google Analytics 4',
            type: 'GOOGLE_ANALYTICS_4',
            status: 'PENDING',
            config: JSON.stringify({}),
          },
        });
        await storeOAuthTokens(projectId, connection.id, tokens, grantedScopes);
        connectionIds.push(connection.id);
      }
    }

    // GBP Connection
    if (hasGBPScope) {
      const existing = await db.dataConnection.findFirst({
        where: {
          projectId,
          type: 'GOOGLE_BUSINESS_PROFILE',
          deletedAt: null,
        },
      });

      if (existing) {
        await storeOAuthTokens(projectId, existing.id, tokens, grantedScopes);
        connectionIds.push(existing.id);
      } else {
        const connection = await db.dataConnection.create({
          data: {
            projectId,
            name: 'Google Bedrijfsprofiel',
            type: 'GOOGLE_BUSINESS_PROFILE',
            status: 'PENDING',
            config: JSON.stringify({}),
          },
        });
        await storeOAuthTokens(projectId, connection.id, tokens, grantedScopes);
        connectionIds.push(connection.id);
      }
    }

    logger.info('Google OAuth callback processed', {
      projectId,
      userId,
      service,
      connectionIds,
      grantedScopes: grantedScopes.length,
    });

    // Redirect back to integrations page with success
    const locale = 'nl';
    return NextResponse.redirect(
      `${NEXTAUTH_URL}/${locale}/integrations?google_connected=${encodeURIComponent(service)}&connections=${connectionIds.join(',')}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Google OAuth callback error', { error: message });

    return NextResponse.redirect(
      `${NEXTAUTH_URL}/nl/integrations?google_error=${encodeURIComponent(message)}`
    );
  }
}
