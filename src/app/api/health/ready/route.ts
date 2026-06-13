/**
 * Readiness check API endpoint — GET /api/health/ready
 *
 * Returns **200** if the application is ready to serve traffic (database is
 * reachable), or **503** if it is not. Intended for Kubernetes / container
 * orchestrator readiness probes.
 *
 * Only database connectivity is checked — other dependencies are not
 * required for the app to be considered "ready".
 */

import { NextResponse } from 'next/server';
import { checkDatabase } from '@/lib/observability/health';

export async function GET(): Promise<NextResponse> {
  const dbCheck = await checkDatabase();

  if (dbCheck.status === 'healthy') {
    return NextResponse.json(
      { status: 'ready', database: dbCheck },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
  }

  return NextResponse.json(
    {
      status: 'not_ready',
      database: dbCheck,
      message: 'Database is niet beschikbaar — toepassing is niet gereed',
    },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    },
  );
}
