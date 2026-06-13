import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { connectGBP, disconnectGBP, getGBPStatus } from '@/lib/local-seo';
import { logAuditEvent } from '@/lib/audit';

// GET /api/projects/[id]/locations/[locationId]/gbp — Get Google Business Profile status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, locationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const gbp = await getGBPStatus(locationId, projectId);

    return NextResponse.json({
      data: gbp,
    });
  } catch (error) {
    console.error('Fout bij ophalen Google Bedrijfsprofiel:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen Google Bedrijfsprofiel' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/locations/[locationId]/gbp — Connect GBP
// Now uses connectionId from the OAuth flow instead of manual tokens
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, locationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { accountId, locationIdGBP, connectionId } = body;

    // Support both old (manual token) and new (OAuth connectionId) flows
    if (connectionId) {
      // New OAuth flow: use the DataConnection's tokens
      if (!accountId || !locationIdGBP) {
        return NextResponse.json(
          { error: 'accountId en locationIdGBP zijn vereist' },
          { status: 400 }
        );
      }

      const gbp = await connectGBP(locationId, projectId, {
        accountId,
        locationIdGBP,
        connectionId,
      });

      await logAuditEvent({
        organizationId: access.project.organizationId,
        projectId,
        userId: user.id,
        action: 'gbp_connected',
        entity: 'google_business_profile',
        entityId: gbp.id,
        changes: { accountId, locationIdGBP, connectionId },
      });

      return NextResponse.json({ data: gbp }, { status: 201 });
    } else {
      // Legacy manual token flow (still supported for backward compatibility)
      const { accessToken, refreshToken } = body;
      if (!accountId || !locationIdGBP) {
        return NextResponse.json(
          { error: 'accountId en locationIdGBP zijn vereist' },
          { status: 400 }
        );
      }

      // For backward compatibility, store tokens directly
      const location = await (await import('@/lib/db')).db.location.findFirst({
        where: { id: locationId, projectId, deletedAt: null },
      });
      if (!location) {
        return NextResponse.json(
          { error: 'Locatie niet gevonden' },
          { status: 404 }
        );
      }

      const existing = await (await import('@/lib/db')).db.googleBusinessProfile.findUnique({
        where: { locationId },
      });

      const tokenData: Record<string, unknown> = {
        accountId,
        locationIdGBP,
      };
      if (accessToken) tokenData.accessToken = accessToken;
      if (refreshToken) tokenData.refreshToken = refreshToken;
      tokenData.syncStatus = 'connected';
      tokenData.syncError = null;

      let gbp;
      if (existing) {
        gbp = await (await import('@/lib/db')).db.googleBusinessProfile.update({
          where: { id: existing.id },
          data: tokenData,
        });
      } else {
        gbp = await (await import('@/lib/db')).db.googleBusinessProfile.create({
          data: {
            projectId,
            locationId,
            ...tokenData,
          },
        });
      }

      return NextResponse.json({ data: gbp }, { status: 201 });
    }
  } catch (error) {
    console.error('Fout bij verbinden Google Bedrijfsprofiel:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout bij verbinden Google Bedrijfsprofiel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/locations/[locationId]/gbp — Disconnect GBP
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, locationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    // Check if GBP exists
    const existing = await getGBPStatus(locationId, projectId);
    if (!existing.connected) {
      return NextResponse.json(
        { error: 'Google Bedrijfsprofiel niet gevonden of niet verbonden' },
        { status: 404 }
      );
    }

    const gbp = await disconnectGBP(locationId, projectId);

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'gbp_disconnected',
      entity: 'google_business_profile',
      entityId: (gbp as { id: string }).id,
      changes: { disconnected: true },
    });

    return NextResponse.json({ data: gbp });
  } catch (error) {
    console.error('Fout bij verbreken Google Bedrijfsprofiel:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij verbreken Google Bedrijfsprofiel' },
      { status: 500 }
    );
  }
}
