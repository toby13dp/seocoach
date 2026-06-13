/**
 * Liveness check API endpoint — GET /api/health/live
 *
 * Always returns **200** as long as the Node.js process is running and can
 * respond to HTTP requests. Intended for Kubernetes / container orchestrator
 * liveness probes.
 */

import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
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
