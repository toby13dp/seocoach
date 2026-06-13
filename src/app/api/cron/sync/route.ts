// ============================================================================
// Cron Sync — Scheduled Data Synchronization Endpoint
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// This endpoint is called by an external cron service (e.g. cron-job.org,
// Vercel Cron, or GitHub Actions) to trigger automatic data synchronization
// for all connections that are due for sync.
//
// Security: Requires a CRON_SECRET header to prevent unauthorized access.
// Call with: curl -H "Authorization: Bearer YOUR_CRON_SECRET" /api/cron/sync
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncData, scheduleNextSync } from '@/lib/analytics/sync-manager';
import { appLogger as logger } from '@/lib/observability/logger';

// POST /api/cron/sync
export async function POST(request: NextRequest) {
  // ---- Security: Verify cron secret ----
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (cronSecret) {
    const providedSecret = authHeader?.replace('Bearer ', '') ?? '';
    if (providedSecret !== cronSecret) {
      return NextResponse.json(
        { error: 'Ongeldige autorisatie' },
        { status: 401 }
      );
    }
  } else {
    // If no CRON_SECRET is set, only allow in development
    if (process.env.NODE_ENV === 'production') {
      logger.error('CRON_SECRET not set in production — refusing cron sync');
      return NextResponse.json(
        { error: 'Cron synchronisatie is niet geconfigureerd. Stel CRON_SECRET in.' },
        { status: 500 }
      );
    }
  }

  try {
    // Find all connections that are due for sync
    const now = new Date();
    const dueConnections = await db.dataConnection.findMany({
      where: {
        status: 'CONNECTED',
        deletedAt: null,
        nextSyncAt: { lte: now },
        // Only sync Google OAuth and auto-sync enabled connections
        type: {
          in: [
            'GOOGLE_SEARCH_CONSOLE',
            'GOOGLE_ANALYTICS_4',
            'GOOGLE_BUSINESS_PROFILE',
          ],
        },
      },
      select: {
        id: true,
        type: true,
        projectId: true,
        name: true,
        config: true,
        syncIntervalMinutes: true,
      },
      take: 20, // Process max 20 connections per run to avoid timeout
    });

    if (dueConnections.length === 0) {
      return NextResponse.json({
        message: 'Geen verbindingen die synchronisatie nodig hebben.',
        synced: 0,
      });
    }

    logger.info('Cron sync starting', {
      connectionsToSync: dueConnections.length,
    });

    const results = [];

    for (const connection of dueConnections) {
      try {
        // Check if auto-sync is disabled in config
        const config = connection.config ? JSON.parse(connection.config) : {};
        if (config.autoSync === false) {
          results.push({
            connectionId: connection.id,
            type: connection.type,
            success: false,
            message: 'Automatische synchronisatie uitgeschakeld',
          });
          continue;
        }

        const syncResult = await syncData(connection.id);

        // Schedule the next sync
        await scheduleNextSync(connection.id);

        results.push({
          connectionId: connection.id,
          type: connection.type,
          name: connection.name,
          success: syncResult.success,
          message: syncResult.message,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push({
          connectionId: connection.id,
          type: connection.type,
          success: false,
          message: `Synchronisatie mislukt: ${msg}`,
        });

        logger.error('Cron sync failed for connection', {
          connectionId: connection.id,
          error: msg,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    logger.info('Cron sync completed', {
      total: results.length,
      success: successCount,
      failed: failCount,
    });

    return NextResponse.json({
      message: `Synchronisatie voltooid: ${successCount} geslaagd, ${failCount} mislukt.`,
      synced: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Interne serverfout';
    logger.error('Cron sync error', { error: msg });

    return NextResponse.json(
      { error: `Cron synchronisatie mislukt: ${msg}` },
      { status: 500 }
    );
  }
}

// GET /api/cron/sync — Health check for cron endpoint
export async function GET(request: NextRequest) {
  // Verify cron secret for GET too
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (cronSecret) {
    const providedSecret = authHeader?.replace('Bearer ', '') ?? '';
    if (providedSecret !== cronSecret) {
      return NextResponse.json({ error: 'Ongeldige autorisatie' }, { status: 401 });
    }
  }

  // Count connections due for sync
  const now = new Date();
  const dueCount = await db.dataConnection.count({
    where: {
      status: 'CONNECTED',
      deletedAt: null,
      nextSyncAt: { lte: now },
      type: {
        in: [
          'GOOGLE_SEARCH_CONSOLE',
          'GOOGLE_ANALYTICS_4',
          'GOOGLE_BUSINESS_PROFILE',
        ],
      },
    },
  });

  const totalConnected = await db.dataConnection.count({
    where: {
      status: 'CONNECTED',
      deletedAt: null,
      type: {
        in: [
          'GOOGLE_SEARCH_CONSOLE',
          'GOOGLE_ANALYTICS_4',
          'GOOGLE_BUSINESS_PROFILE',
        ],
      },
    },
  });

  return NextResponse.json({
    status: 'ok',
    connectedGoogleConnections: totalConnected,
    connectionsDueForSync: dueCount,
    nextSyncWindow: dueCount > 0 ? 'now' : 'none pending',
  });
}
