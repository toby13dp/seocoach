// ============================================================================
// Google OAuth — Sync All Connections
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Triggers a sync for all connected Google data connections for a project.
// Can be called manually or by a cron job for automatic sync scheduling.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { syncData } from '@/lib/analytics';
import { db } from '@/lib/db';
import { appLogger as logger } from '@/lib/observability/logger';

// POST /api/google/oauth/sync-all?projectId=...
export async function POST(request: NextRequest) {
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

    // Get all connected Google data connections
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
        status: 'CONNECTED',
        deletedAt: null,
      },
    });

    if (connections.length === 0) {
      return NextResponse.json({
        data: {
          synced: 0,
          results: [],
          message: 'Geen actieve Google-verbindingen gevonden.',
        },
      });
    }

    // Sync each connection
    const results = await Promise.allSettled(
      connections.map(async (conn) => {
        const result = await syncData(conn.id);
        return {
          connectionId: conn.id,
          type: conn.type,
          name: conn.name,
          success: result.success,
          message: result.message,
        };
      })
    );

    const successes = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const failures = results.length - successes;

    logger.info('Google sync-all completed', {
      projectId,
      total: connections.length,
      successes,
      failures,
    });

    return NextResponse.json({
      data: {
        synced: successes,
        failed: failures,
        total: connections.length,
        results: results.map((r) =>
          r.status === 'fulfilled' ? r.value : { success: false, message: 'Onbekende fout' }
        ),
        message:
          failures === 0
            ? `${successes} verbindingen succesvol gesynchroniseerd.`
            : `${successes} geslaagd, ${failures} mislukt van ${connections.length} verbindingen.`,
      },
    });
  } catch (error) {
    console.error('Google sync-all error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
