import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { runLocationHealthChecks, saveHealthChecks, getLocationHealthChecks } from '@/lib/local-seo';
import { logAuditEvent } from '@/lib/audit';

// GET /api/projects/[id]/locations/[locationId]/health — Get health checks for a location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, locationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const healthChecks = await getLocationHealthChecks(locationId);

    return NextResponse.json({
      data: healthChecks,
      meta: {
        total: healthChecks.length,
      },
    });
  } catch (error) {
    console.error('Fout bij ophalen gezondheidscontroles:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen gezondheidscontroles' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/locations/[locationId]/health — Run health checks for a location
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, locationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    // Run health checks
    const results = await runLocationHealthChecks(projectId, locationId);

    // Save the results
    const savedChecks = await saveHealthChecks(projectId, locationId, results);

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'location_health_check_run',
      entity: 'location',
      entityId: locationId,
      changes: {
        checksRun: results.length,
        averageScore: results.length > 0
          ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
          : 0,
      },
    });

    return NextResponse.json({
      data: savedChecks,
      meta: {
        total: savedChecks.length,
      },
    });
  } catch (error) {
    console.error('Fout bij uitvoeren gezondheidscontroles:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout bij uitvoeren gezondheidscontroles';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
