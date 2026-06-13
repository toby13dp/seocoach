// ============================================================================
// Google OAuth — Connection Status Endpoint
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Returns the connection status of all Google data connections for a project.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { verifyConnection, getOAuthTokens, SCOPE_LABELS } from '@/lib/google';
import { db } from '@/lib/db';

// GET /api/google/oauth/status?projectId=...
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Niet geauthenticeerd' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is vereist' },
        { status: 400 }
      );
    }

    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json(
        { error: 'Geen toegang tot dit project' },
        { status: 403 }
      );
    }

    // Get all Google-type data connections
    const connections = await db.dataConnection.findMany({
      where: {
        projectId,
        type: {
          in: [
            'GOOGLE_SEARCH_CONSOLE',
            'GOOGLE_ANALYTICS_4',
            'GOOGLE_BUSINESS_PROFILE',
          ],
        },
        deletedAt: null,
      },
    });

    const statuses = await Promise.all(
      connections.map(async (conn) => {
        const tokens = await getOAuthTokens(conn.id);
        const hasTokens = tokens !== null;

        // Map connection type to Dutch service name
        const serviceNames: Record<string, string> = {
          GOOGLE_SEARCH_CONSOLE: 'Google Search Console',
          GOOGLE_ANALYTICS_4: 'Google Analytics 4',
          GOOGLE_BUSINESS_PROFILE: 'Google Bedrijfsprofiel',
        };

        // Get scope labels
        const scopeLabels = (tokens?.grantedScopes ?? [])
          .map((s) => SCOPE_LABELS[s] ?? s)
          .filter(Boolean);

        return {
          connectionId: conn.id,
          type: conn.type,
          name: conn.name,
          status: conn.status,
          connected: hasTokens,
          lastSyncAt: conn.lastSyncAt,
          lastSyncStatus: conn.lastSyncStatus,
          lastSyncError: conn.lastSyncError,
          nextSyncAt: conn.nextSyncAt,
          serviceName: serviceNames[conn.type] ?? conn.type,
          grantedScopes: scopeLabels,
          isTokenExpired: tokens?.expiryDate
            ? tokens.expiryDate <= Date.now()
            : false,
          propertyId: tokens
            ? (JSON.parse(conn.config ?? '{}')?.propertyId ?? null)
            : null,
        };
      })
    );

    // Also check which Google services are available but not yet connected
    const connectedTypes = connections.map((c) => c.type);
    const availableServices = [
      {
        type: 'GOOGLE_SEARCH_CONSOLE',
        name: 'Google Search Console',
        description: 'Zoekprestaties, kliks en posities',
        requiredScope: 'https://www.googleapis.com/auth/webmasters.readonly',
        connected: connectedTypes.includes('GOOGLE_SEARCH_CONSOLE'),
      },
      {
        type: 'GOOGLE_ANALYTICS_4',
        name: 'Google Analytics 4',
        description: 'Websiteverkeer, gebruikers en conversies',
        requiredScope: 'https://www.googleapis.com/auth/analytics.readonly',
        connected: connectedTypes.includes('GOOGLE_ANALYTICS_4'),
      },
      {
        type: 'GOOGLE_BUSINESS_PROFILE',
        name: 'Google Bedrijfsprofiel',
        description: 'Bedrijfsprofiel, beoordelingen en locaties',
        requiredScope: 'https://www.googleapis.com/auth/business.manage',
        connected: connectedTypes.includes('GOOGLE_BUSINESS_PROFILE'),
      },
    ];

    return NextResponse.json({
      data: {
        connections: statuses,
        availableServices,
        isGoogleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      },
    });
  } catch (error) {
    console.error('Google OAuth status error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
