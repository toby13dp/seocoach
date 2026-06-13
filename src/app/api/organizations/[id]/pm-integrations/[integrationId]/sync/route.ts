import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { syncTaskStatus } from '@/lib/pm-integrations';
import { db } from '@/lib/db';

// POST /api/organizations/[id]/pm-integrations/[integrationId]/sync — Sync status of an exported task
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
    const { exportId } = body as { exportId: string };

    if (!exportId || typeof exportId !== 'string') {
      return NextResponse.json(
        { error: 'Export-ID (exportId) is vereist' },
        { status: 400 }
      );
    }

    // Verifieer dat de export bij deze integratie hoort
    const exportRecord = await db.pMTaskExport.findFirst({
      where: {
        id: exportId,
        integrationId,
        deletedAt: null,
      },
    });

    if (!exportRecord) {
      return NextResponse.json(
        { error: 'Exportrecord niet gevonden of behoort niet tot deze integratie' },
        { status: 404 }
      );
    }

    const result = await syncTaskStatus(exportId);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Sync task status error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
