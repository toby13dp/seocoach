// ============================================================================
// Google OAuth — Authorize Endpoint
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Initiates a Google OAuth flow by generating an authorization URL.
// Returns the URL to the frontend which redirects the user to Google.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { generateAuthURL, GOOGLE_SCOPES } from '@/lib/google';

// GET /api/google/oauth/authorize?projectId=...&service=...
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
    const service = searchParams.get('service') as
      | 'search_console'
      | 'analytics'
      | 'business_profile'
      | 'all'
      | null;

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

    // Select scopes based on requested service
    let scopes: string[];
    switch (service ?? 'all') {
      case 'search_console':
        scopes = [...GOOGLE_SCOPES.SEARCH_CONSOLE];
        break;
      case 'analytics':
        scopes = [...GOOGLE_SCOPES.ANALYTICS];
        break;
      case 'business_profile':
        scopes = [...GOOGLE_SCOPES.BUSINESS_PROFILE];
        break;
      default:
        scopes = [...GOOGLE_SCOPES.ALL];
    }

    const authUrl = await generateAuthURL({
      projectId,
      userId: user.id,
      scopes,
      service: service ?? 'all',
    });

    return NextResponse.json({
      data: {
        authorizationUrl: authUrl,
      },
    });
  } catch (error) {
    console.error('Google OAuth authorize error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
