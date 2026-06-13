import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/organizations/[id]/agency-alerts — List agency alerts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? undefined;
    const severity = searchParams.get('severity') ?? undefined;
    const isReadParam = searchParams.get('isRead');
    const isResolvedParam = searchParams.get('isResolved');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (isReadParam !== null && isReadParam !== undefined) {
      where.isRead = isReadParam === 'true';
    }
    if (isResolvedParam !== null && isResolvedParam !== undefined) {
      where.isResolved = isResolvedParam === 'true';
    }

    const [alerts, total] = await Promise.all([
      db.agencyAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.agencyAlert.count({ where }),
    ]);

    return NextResponse.json({
      data: alerts,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error('List agency alerts error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/organizations/[id]/agency-alerts — Create agency alert
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const {
      type,
      severity,
      title,
      description,
      entityType,
      entityId,
    } = body as {
      type: string;
      severity?: string;
      title: string;
      description?: string;
      entityType?: string;
      entityId?: string;
    };

    if (!type || typeof type !== 'string') {
      return NextResponse.json(
        { error: 'Type is vereist' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Titel is vereist' },
        { status: 400 }
      );
    }

    const validTypes = [
      'client_attention',
      'report_due',
      'pending_approval',
      'capacity_risk',
      'missing_deliverable',
      'seo_alert',
      'integration_failure',
      'growth_opportunity',
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Ongeldig alerttype: ${type}` },
        { status: 400 }
      );
    }

    const validSeverities = ['info', 'low', 'medium', 'high', 'critical'];
    const alertSeverity = severity ?? 'medium';
    if (!validSeverities.includes(alertSeverity)) {
      return NextResponse.json(
        { error: `Ongeldige ernst: ${alertSeverity}` },
        { status: 400 }
      );
    }

    const alert = await db.agencyAlert.create({
      data: {
        organizationId,
        type,
        severity: alertSeverity,
        title,
        description: description ?? null,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
      },
    });

    return NextResponse.json({ data: alert }, { status: 201 });
  } catch (error) {
    console.error('Create agency alert error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/organizations/[id]/agency-alerts — Mark alert as read/resolved
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { alertId, action } = body as {
      alertId: string;
      action: 'read' | 'resolve';
    };

    if (!alertId || typeof alertId !== 'string') {
      return NextResponse.json(
        { error: 'Alert-ID (alertId) is vereist' },
        { status: 400 }
      );
    }

    if (!action || !['read', 'resolve'].includes(action)) {
      return NextResponse.json(
        { error: 'Actie (action) moet "read" of "resolve" zijn' },
        { status: 400 }
      );
    }

    const existing = await db.agencyAlert.findFirst({
      where: { id: alertId, organizationId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Alert niet gevonden' },
        { status: 404 }
      );
    }

    let updated: Record<string, unknown>;

    if (action === 'read') {
      updated = await db.agencyAlert.update({
        where: { id: alertId },
        data: { isRead: true },
      });
    } else {
      updated = await db.agencyAlert.update({
        where: { id: alertId },
        data: {
          isResolved: true,
          resolvedBy: user.id,
          resolvedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update agency alert error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
