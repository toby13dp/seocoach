import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getActiveAlerts, getAlertSummary, runAllAlertChecks } from '@/lib/alerts';
import type { AlertFilters } from '@/lib/alerts';

// GET /api/projects/[id]/alerts — List alerts with filters
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? undefined;
    const severity = searchParams.get('severity') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const assignedTo = searchParams.get('assignedTo') ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));

    const filters: AlertFilters = { limit, offset };
    if (type) filters.type = type as AlertFilters['type'];
    if (severity) filters.severity = severity as AlertFilters['severity'];
    if (status) filters.status = status as AlertFilters['status'];
    if (assignedTo) filters.assignedTo = assignedTo;

    const [alerts, summary] = await Promise.all([
      getActiveAlerts(projectId, filters),
      getAlertSummary(projectId),
    ]);

    return NextResponse.json({
      data: alerts,
      meta: {
        total: alerts.length,
        limit,
        offset,
        summary,
      },
    });
  } catch (error) {
    console.error('List alerts error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/alerts — Run alert checks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const createdAlertIds = await runAllAlertChecks(projectId);
    const summary = await getAlertSummary(projectId);

    return NextResponse.json({
      data: {
        checked: true,
        newAlertCount: createdAlertIds.length,
        newAlertIds: createdAlertIds,
      },
      meta: {
        summary,
      },
    });
  } catch (error) {
    console.error('Run alert checks error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
