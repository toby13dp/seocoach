import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { testPMConnection } from '@/lib/pm-integrations';
import { db } from '@/lib/db';

// POST /api/organizations/[id]/pm-integrations/[integrationId]/test — Test PM integration connection
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

    const result = await testPMConnection(integrationId);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Test PM connection error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
