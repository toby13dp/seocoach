// ============================================================================
// Google OAuth — Disconnect Endpoint
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Disconnects a Google OAuth connection: revokes tokens and clears stored data.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { disconnectOAuth } from '@/lib/google';

// POST /api/google/oauth/disconnect
// Body: { connectionId, projectId }
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Niet geauthenticeerd' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { connectionId, projectId } = body as {
      connectionId?: string;
      projectId?: string;
    };

    if (!connectionId || !projectId) {
      return NextResponse.json(
        { error: 'connectionId en projectId zijn vereist' },
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

    await disconnectOAuth(connectionId);

    return NextResponse.json({
      data: {
        success: true,
        message: 'Google-verbinding succesvol verbroken.',
      },
    });
  } catch (error) {
    console.error('Google OAuth disconnect error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
