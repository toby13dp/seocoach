import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import type { ClientPortalAccessType } from '@prisma/client';
import { PORTAL_ACCESS_TYPES } from '@/lib/client-portal/types';

// ============================================================================
// GET /api/clients/[clientId]/portal-access
// Haalt alle portaaltoegangsrechten op voor een cliënt
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
    const client = await db.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliënt niet gevonden' }, { status: 404 });
    }

    // Verifieer organisatielidmaatschap
    const membership = await db.organizationMembership.findFirst({
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

    // Haal alle portaaltoegangsrechten op
    const accessRecords = await db.clientPortalAccess.findMany({
      where: {
        clientId,
        deletedAt: null,
      },
      orderBy: { accessType: 'asc' },
    });

    // Parse restrictions JSON voor elke record
    const formattedRecords = accessRecords.map((record) => ({
      ...record,
      restrictions: record.restrictions
        ? (() => {
            try {
              return JSON.parse(record.restrictions);
            } catch {
              return null;
            }
          })()
        : null,
    }));

    return NextResponse.json({ portalAccess: formattedRecords });
  } catch (error) {
    console.error('Portaltoegang ophalen fout:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// ============================================================================
// PUT /api/clients/[clientId]/portal-access
// Bulk bijwerken van portaaltoegangsrechten
// Body: { accessType: string, granted: boolean, restrictions?: object }[]
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
    const client = await db.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliënt niet gevonden' }, { status: 404 });
    }

    // Verifieer organisatielidmaatschap
    const membership = await db.organizationMembership.findFirst({
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

    const body = await request.json();
    const { updates } = body as {
      updates: { accessType: string; granted: boolean; restrictions?: object }[];
    };

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Ongeldige invoer: "updates" moet een niet-lege array zijn' },
        { status: 400 }
      );
    }

    // Valideer elk accessType
    for (const update of updates) {
      if (!update.accessType || typeof update.granted !== 'boolean') {
        return NextResponse.json(
          { error: 'Ongeldige invoer: elk item moet accessType en granted bevatten' },
          { status: 400 }
        );
      }

      if (!PORTAL_ACCESS_TYPES.includes(update.accessType as ClientPortalAccessType)) {
        return NextResponse.json(
          { error: `Ongeldig toegangstype: "${update.accessType}"` },
          { status: 400 }
        );
      }
    }

    // Voer bulk-updates uit met upsert
    const results = [];
    for (const update of updates) {
      const accessType = update.accessType as ClientPortalAccessType;
      const restrictions = update.restrictions
        ? JSON.stringify(update.restrictions)
        : null;

      const result = await db.clientPortalAccess.upsert({
        where: {
          clientId_accessType: { clientId, accessType },
        },
        create: {
          clientId,
          accessType,
          granted: update.granted,
          grantedBy: user.id,
          grantedAt: new Date(),
          restrictions,
        },
        update: {
          granted: update.granted,
          grantedBy: user.id,
          grantedAt: new Date(),
          restrictions,
        },
      });

      results.push(result);
    }

    // Audit log
    await logAuditEvent({
      organizationId: client.organizationId,
      userId: user.id,
      action: 'client_portal_access_bulk_updated',
      entity: 'client_portal_access',
      entityId: clientId,
      changes: {
        updatedCount: results.length,
        updates: updates.map((u) => ({
          accessType: u.accessType,
          granted: u.granted,
        })),
      },
    });

    // Parse restrictions in response
    const formattedResults = results.map((record) => ({
      ...record,
      restrictions: record.restrictions
        ? (() => {
            try {
              return JSON.parse(record.restrictions);
            } catch {
              return null;
            }
          })()
        : null,
    }));

    return NextResponse.json({ portalAccess: formattedResults });
  } catch (error) {
    console.error('Portaltoegang bijwerken fout:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
