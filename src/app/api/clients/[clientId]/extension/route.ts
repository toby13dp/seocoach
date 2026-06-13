import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { isClientRole } from '@/lib/client-portal/portal-manager';

/**
 * Velden die niet zichtbaar mogen zijn voor CLIENT-rol gebruikers
 * (financiële en interne notities)
 */
const CLIENT_RESTRICTED_EXTENSION_FIELDS = [
  'billingNotes',
  'costRate',
  'profitability',
] as const;

/**
 * Verwijdert beperkte velden uit de extensie-data voor cliëntrol-gebruikers
 */
function filterRestrictedFields(
  data: Record<string, unknown>,
  isRestricted: boolean
): Record<string, unknown> {
  if (!isRestricted) return data;

  const filtered = { ...data };
  for (const field of CLIENT_RESTRICTED_EXTENSION_FIELDS) {
    delete filtered[field];
  }
  return filtered;
}

// ============================================================================
// GET /api/clients/[clientId]/extension
// Haalt de cliëntextensie op (contract, gezondheid, SLA-gegevens)
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { clientId } = await params;

    // Controleer of de cliënt bestaat
    const client = await db.client.findUnique({
      where: { id: clientId, deletedAt: null },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliënt niet gevonden' }, { status: 404 });
    }

    // Verifieer organisatielidmaatschap
    const membership = await db.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: client.organizationId,
        },
      },
    });

    if (!membership || membership.deletedAt || !membership.acceptedAt) {
      return NextResponse.json({ error: 'Geen toegang tot deze organisatie' }, { status: 403 });
    }

    // Haal extensie op
    const extension = await db.clientExtension.findUnique({
      where: { clientId },
    });

    if (!extension) {
      return NextResponse.json({ extension: null });
    }

    // Filter beperkte velden voor CLIENT-rol
    const shouldFilter = isClientRole(membership.role);
    const extensionData = filterRestrictedFields(
      extension as unknown as Record<string, unknown>,
      shouldFilter
    );

    return NextResponse.json({ extension: extensionData });
  } catch (error) {
    console.error('Cliëntextensie ophalen fout:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// ============================================================================
// PUT /api/clients/[clientId]/extension
// Werkt de cliëntextensie bij
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { clientId } = await params;

    // Controleer of de cliënt bestaat
    const client = await db.client.findUnique({
      where: { id: clientId, deletedAt: null },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliënt niet gevonden' }, { status: 404 });
    }

    // Verifieer organisatielidmaatschap
    const membership = await db.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: client.organizationId,
        },
      },
    });

    if (!membership || membership.deletedAt || !membership.acceptedAt) {
      return NextResponse.json({ error: 'Geen toegang tot deze organisatie' }, { status: 403 });
    }

    // CLIENT-rol mag beperkte velden niet bijwerken
    const clientUser = isClientRole(membership.role);

    const body = await request.json();
    const {
      contractStart,
      contractEnd,
      contractType,
      monthlyHours,
      maxProjects,
      maxKeywords,
      maxPages,
      monthlyFee,
      currency,
      costRate,
      billingNotes,
      slaResponseHours,
      slaDeliveryHours,
      healthNotes,
    } = body;

    // Bouw update-data op
    const updateData: Record<string, unknown> = {};
    if (contractStart !== undefined) updateData.contractStart = contractStart ? new Date(contractStart) : null;
    if (contractEnd !== undefined) updateData.contractEnd = contractEnd ? new Date(contractEnd) : null;
    if (contractType !== undefined) updateData.contractType = contractType;
    if (monthlyHours !== undefined) updateData.monthlyHours = monthlyHours;
    if (maxProjects !== undefined) updateData.maxProjects = maxProjects;
    if (maxKeywords !== undefined) updateData.maxKeywords = maxKeywords;
    if (maxPages !== undefined) updateData.maxPages = maxPages;
    if (currency !== undefined) updateData.currency = currency;

    // Beperkte velden: alleen voor niet-CLIENT rollen
    if (!clientUser) {
      if (monthlyFee !== undefined) updateData.monthlyFee = monthlyFee;
      if (costRate !== undefined) updateData.costRate = costRate;
      if (billingNotes !== undefined) updateData.billingNotes = billingNotes;
    }

    if (slaResponseHours !== undefined) updateData.slaResponseHours = slaResponseHours;
    if (slaDeliveryHours !== undefined) updateData.slaDeliveryHours = slaDeliveryHours;
    if (healthNotes !== undefined) updateData.healthNotes = healthNotes;

    // Bereken winstgevendheid automatisch indien financiële velden worden bijgewerkt
    if (updateData.monthlyFee !== undefined || updateData.costRate !== undefined) {
      const existing = await db.clientExtension.findUnique({ where: { clientId } });
      if (existing) {
        const fee = (updateData.monthlyFee as number) ?? existing.monthlyFee ?? 0;
        const cost = (updateData.costRate as number) ?? existing.costRate ?? 0;
        if (fee > 0) {
          updateData.profitability = (fee - cost) / fee;
        }
      }
    }

    // Upsert extensie
    const extension = await db.clientExtension.upsert({
      where: { clientId },
      create: { clientId, ...updateData },
      update: updateData,
    });

    // Audit log
    await logAuditEvent({
      organizationId: client.organizationId,
      userId: user.id,
      action: 'client_extension_updated',
      entity: 'client_extension',
      entityId: extension.id,
      changes: updateData,
    });

    // Filter beperkte velden in response voor CLIENT-rol
    const extensionData = filterRestrictedFields(
      extension as unknown as Record<string, unknown>,
      clientUser
    );

    return NextResponse.json({ extension: extensionData });
  } catch (error) {
    console.error('Cliëntextensie bijwerken fout:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// ============================================================================
// POST /api/clients/[clientId]/extension
// Maakt een cliëntextensie aan als deze nog niet bestaat
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { clientId } = await params;

    // Controleer of de cliënt bestaat
    const client = await db.client.findUnique({
      where: { id: clientId, deletedAt: null },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliënt niet gevonden' }, { status: 404 });
    }

    // Verifieer organisatielidmaatschap
    const membership = await db.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: client.organizationId,
        },
      },
    });

    if (!membership || membership.deletedAt || !membership.acceptedAt) {
      return NextResponse.json({ error: 'Geen toegang tot deze organisatie' }, { status: 403 });
    }

    // Controleer of extensie al bestaat
    const existing = await db.clientExtension.findUnique({
      where: { clientId },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Cliëntextensie bestaat al', extension: existing },
        { status: 409 }
      );
    }

    const body = await request.json();
    const {
      contractStart,
      contractEnd,
      contractType,
      monthlyHours,
      maxProjects,
      maxKeywords,
      maxPages,
      monthlyFee,
      currency,
      costRate,
      billingNotes,
      slaResponseHours,
      slaDeliveryHours,
    } = body;

    // Bouw create-data op
    const createData: Record<string, unknown> = { clientId };
    if (contractStart) createData.contractStart = new Date(contractStart);
    if (contractEnd) createData.contractEnd = new Date(contractEnd);
    if (contractType) createData.contractType = contractType;
    if (monthlyHours !== undefined) createData.monthlyHours = monthlyHours;
    if (maxProjects !== undefined) createData.maxProjects = maxProjects;
    if (maxKeywords !== undefined) createData.maxKeywords = maxKeywords;
    if (maxPages !== undefined) createData.maxPages = maxPages;
    if (monthlyFee !== undefined) createData.monthlyFee = monthlyFee;
    if (currency) createData.currency = currency;
    if (costRate !== undefined) createData.costRate = costRate;
    if (billingNotes) createData.billingNotes = billingNotes;
    if (slaResponseHours !== undefined) createData.slaResponseHours = slaResponseHours;
    if (slaDeliveryHours !== undefined) createData.slaDeliveryHours = slaDeliveryHours;

    // Bereken winstgevendheid
    const fee = (createData.monthlyFee as number) ?? 0;
    const cost = (createData.costRate as number) ?? 0;
    if (fee > 0) {
      createData.profitability = (fee - cost) / fee;
    }

    // Maak extensie aan
    const extension = await db.clientExtension.create({
      data: createData,
    });

    // Audit log
    await logAuditEvent({
      organizationId: client.organizationId,
      userId: user.id,
      action: 'client_extension_created',
      entity: 'client_extension',
      entityId: extension.id,
      changes: createData,
    });

    // Filter beperkte velden in response voor CLIENT-rol
    const clientUser = isClientRole(membership.role);
    const extensionData = filterRestrictedFields(
      extension as unknown as Record<string, unknown>,
      clientUser
    );

    return NextResponse.json({ extension: extensionData }, { status: 201 });
  } catch (error) {
    console.error('Cliëntextensie aanmaken fout:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
