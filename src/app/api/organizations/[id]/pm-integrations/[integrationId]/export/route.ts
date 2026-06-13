import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { exportTaskToPM } from '@/lib/pm-integrations';
import type { TaskExportData } from '@/lib/pm-integrations';
import { db } from '@/lib/db';

// POST /api/organizations/[id]/pm-integrations/[integrationId]/export — Export a task to the PM system
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, integrationId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.pMIntegration.findFirst({
      where: { id: integrationId, organizationId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'PM-integratie niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { task, taskId, taskType } = body as {
      task: TaskExportData;
      taskId?: string;
      taskType?: string;
    };

    if (!task || typeof task !== 'object') {
      return NextResponse.json(
        { error: 'Taakgegevens (task) zijn vereist' },
        { status: 400 }
      );
    }

    if (!task.plainSummary || typeof task.plainSummary !== 'string' || task.plainSummary.trim().length === 0) {
      return NextResponse.json(
        { error: 'Taaksamenvatting (plainSummary) is vereist' },
        { status: 400 }
      );
    }

    if (!task.priority || !['low', 'medium', 'high', 'critical'].includes(task.priority)) {
      return NextResponse.json(
        { error: 'Ongeldige prioriteit. Gebruik: low, medium, high of critical' },
        { status: 400 }
      );
    }

    const result = await exportTaskToPM(integrationId, task, taskId, taskType);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error('Export task to PM error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
