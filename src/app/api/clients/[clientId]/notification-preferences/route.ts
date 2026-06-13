import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

// ============================================================================
// GET /api/clients/[clientId]/notification-preferences
// Haalt de notificatievoorkeuren op voor een cliënt
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

    // Haal notificatievoorkeuren op (maak aan als ze niet bestaan)
    const preferences = await db.clientNotificationPreference.upsert({
      where: { clientId },
      create: { clientId },
      update: {},
    });

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Notificatievoorkeuren ophalen fout:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// ============================================================================
// PUT /api/clients/[clientId]/notification-preferences
// Werkt de notificatievoorkeuren bij voor een cliënt
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

    const body = await request.json();
    const {
      emailEnabled,
      portalEnabled,
      reportPublished,
      contentApproval,
      taskAssigned,
      commentAdded,
      slaWarning,
      digestFrequency,
    } = body;

    // Valideer digestFrequency indien opgegeven
    const validFrequencies = ['daily', 'weekly', 'monthly', 'none'];
    if (digestFrequency !== undefined && !validFrequencies.includes(digestFrequency)) {
      return NextResponse.json(
        {
          error: `Ongeldige samenvattingsfrequentie. Geldige waarden: ${validFrequencies.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Bouw update-data op met alleen opgegeven velden
    const updateData: Record<string, unknown> = {};
    if (emailEnabled !== undefined) updateData.emailEnabled = emailEnabled;
    if (portalEnabled !== undefined) updateData.portalEnabled = portalEnabled;
    if (reportPublished !== undefined) updateData.reportPublished = reportPublished;
    if (contentApproval !== undefined) updateData.contentApproval = contentApproval;
    if (taskAssigned !== undefined) updateData.taskAssigned = taskAssigned;
    if (commentAdded !== undefined) updateData.commentAdded = commentAdded;
    if (slaWarning !== undefined) updateData.slaWarning = slaWarning;
    if (digestFrequency !== undefined) updateData.digestFrequency = digestFrequency;

    // Upsert notificatievoorkeuren
    const preferences = await db.clientNotificationPreference.upsert({
      where: { clientId },
      create: { clientId, ...updateData },
      update: updateData,
    });

    // Audit log
    await logAuditEvent({
      organizationId: client.organizationId,
      userId: user.id,
      action: 'client_notification_preferences_updated',
      entity: 'client_notification_preferences',
      entityId: preferences.id,
      changes: updateData,
    });

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Notificatievoorkeuren bijwerken fout:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
