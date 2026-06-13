import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { deletePMIntegration } from '@/lib/pm-integrations';
import { db } from '@/lib/db';

// GET /api/organizations/[id]/pm-integrations/[integrationId] — Get single integration
export async function GET(
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

    const integration = await db.pMIntegration.findFirst({
      where: {
        id: integrationId,
        organizationId,
        deletedAt: null,
      },
      include: {
        project: { select: { id: true, name: true } },
        taskExports: {
          where: { deletedAt: null },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'PM-integratie niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: integration });
  } catch (error) {
    console.error('Get PM integration error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PUT /api/organizations/[id]/pm-integrations/[integrationId] — Update integration config
export async function PUT(
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

    const allowedRoles = ['ORG_OWNER', 'AGENCY_OWNER', 'SEO_MANAGER'];
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json(
        { error: 'Onvoldoende rechten om PM-integratie bij te werken' },
        { status: 403 }
      );
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
    const {
      apiEndpoint,
      apiKeyEncrypted,
      projectId,
      projectMapping,
      ownerMapping,
      fieldMapping,
      status,
    } = body as {
      apiEndpoint?: string;
      apiKeyEncrypted?: string;
      projectId?: string;
      projectMapping?: Record<string, string>;
      ownerMapping?: Record<string, string>;
      fieldMapping?: Record<string, string>;
      status?: string;
    };

    const updateData: Record<string, unknown> = {};
    if (apiEndpoint !== undefined) updateData.apiEndpoint = apiEndpoint;
    if (apiKeyEncrypted !== undefined) updateData.apiKeyEncrypted = apiKeyEncrypted;
    if (projectId !== undefined) updateData.projectId = projectId;
    if (projectMapping !== undefined) updateData.projectMapping = JSON.stringify(projectMapping);
    if (ownerMapping !== undefined) updateData.ownerMapping = JSON.stringify(ownerMapping);
    if (fieldMapping !== undefined) updateData.fieldMapping = JSON.stringify(fieldMapping);
    if (status !== undefined) updateData.status = status;

    const updated = await db.pMIntegration.update({
      where: { id: integrationId },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update PM integration error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/organizations/[id]/pm-integrations/[integrationId] — Soft delete
export async function DELETE(
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

    const allowedRoles = ['ORG_OWNER', 'AGENCY_OWNER', 'SEO_MANAGER'];
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json(
        { error: 'Onvoldoende rechten om PM-integratie te verwijderen' },
        { status: 403 }
      );
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

    await deletePMIntegration(integrationId);

    return NextResponse.json({ data: { id: integrationId, deleted: true } });
  } catch (error) {
    console.error('Delete PM integration error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
