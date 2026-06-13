/**
 * Health check API endpoint — GET /api/health
 *
 * Returns the full health check result including database, Ollama, disk space,
 * and memory checks. No authentication is required so load balancers can
 * probe this endpoint.
 *
 * Response headers include `Cache-Control: no-store` to prevent caching.
 */

import { NextResponse } from 'next/server';
import { runAllChecks } from '@/lib/observability/health';
import type { OverallHealth } from '@/lib/observability/health';

export async function GET(): Promise<NextResponse<OverallHealth>> {
  const health = await runAllChecks();

  return NextResponse.json(health, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
