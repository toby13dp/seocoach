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

    const gbp = await getGBPStatus(locationId);

    if (!gbp) {
      return NextResponse.json({
        data: {
          connected: false,
          syncStatus: 'not_connected',
        },
      });
    }

    return NextResponse.json({
      data: {
        connected: gbp.syncStatus === 'connected',
        syncStatus: gbp.syncStatus,
        businessName: gbp.businessName,
        primaryCategory: gbp.primaryCategory,
        avgRating: gbp.avgRating,
        totalReviews: gbp.totalReviews,
        lastSyncAt: gbp.lastSyncAt,
        syncError: gbp.syncError,
      },
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
    const { accountId, locationIdGBP, accessToken, refreshToken } = body;

    if (!accountId || !locationIdGBP || !accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Alle velden zijn verplicht (accountId, locationIdGBP, accessToken, refreshToken)' },
        { status: 400 }
      );
    }

    const gbp = await connectGBP(projectId, locationId, {
      accountId,
      locationIdGBP,
      accessToken,
      refreshToken,
    });

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'gbp_connected',
      entity: 'google_business_profile',
      entityId: gbp.id,
      changes: { accountId, locationIdGBP },
    });

    return NextResponse.json({ data: gbp }, { status: 201 });
  } catch (error) {
    console.error('Fout bij verbinden Google Bedrijfsprofiel:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij verbinden Google Bedrijfsprofiel' },
      { status: 500 }
    );
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
    const existing = await getGBPStatus(locationId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Google Bedrijfsprofiel niet gevonden' },
        { status: 404 }
      );
    }

    const gbp = await disconnectGBP(locationId);

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'gbp_disconnected',
      entity: 'google_business_profile',
      entityId: existing.id,
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
