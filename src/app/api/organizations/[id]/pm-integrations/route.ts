import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { createPMIntegration, getOrganizationIntegrations } from '@/lib/pm-integrations';
import type { PMIntegrationProvider } from '@prisma/client';
import { ALL_PM_PROVIDERS } from '@/lib/pm-integrations';

// GET /api/organizations/[id]/pm-integrations — List PM integrations for organization
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

    const integrations = await getOrganizationIntegrations(organizationId);

    return NextResponse.json({ data: integrations });
  } catch (error) {
    console.error('List PM integrations error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/organizations/[id]/pm-integrations — Create a new PM integration
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

    const allowedRoles = ['ORG_OWNER', 'AGENCY_OWNER', 'SEO_MANAGER'];
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json(
        { error: 'Onvoldoende rechten om PM-integratie aan te maken' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      provider,
      apiEndpoint,
      apiKeyEncrypted,
      projectId,
      projectMapping,
      ownerMapping,
      fieldMapping,
    } = body as {
      provider: string;
      apiEndpoint?: string;
      apiKeyEncrypted?: string;
      projectId?: string;
      projectMapping?: Record<string, string>;
      ownerMapping?: Record<string, string>;
      fieldMapping?: Record<string, string>;
    };

    if (!provider || typeof provider !== 'string') {
      return NextResponse.json(
        { error: 'Provider is vereist' },
        { status: 400 }
      );
    }

    if (!ALL_PM_PROVIDERS.includes(provider as PMIntegrationProvider)) {
      return NextResponse.json(
        { error: `Ongeldige PM-provider: ${provider}` },
        { status: 400 }
      );
    }

    const integration = await createPMIntegration({
      organizationId,
      provider: provider as PMIntegrationProvider,
      apiEndpoint,
      apiKeyEncrypted,
      projectId,
      projectMapping,
      ownerMapping,
      fieldMapping,
    });

    return NextResponse.json({ data: integration }, { status: 201 });
  } catch (error) {
    console.error('Create PM integration error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
