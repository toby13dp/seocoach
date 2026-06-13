import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getLocation, updateLocation, deleteLocation } from '@/lib/local-seo';
import { logAuditEvent } from '@/lib/audit';

// GET /api/projects/[id]/locations/[locationId] — Get location details with related data
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

    const location = await getLocation(locationId);

    if (!location || location.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Locatie niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: location });
  } catch (error) {
    console.error('Fout bij ophalen locatie:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen locatie' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/locations/[locationId] — Update location fields
export async function PATCH(
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

    // Verify location belongs to project
    const existing = await getLocation(locationId);
    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Locatie niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();

    const allowedFields = [
      'name', 'address', 'city', 'postalCode', 'country', 'phone', 'email',
      'website', 'latitude', 'longitude', 'openingHours', 'businessType',
      'serviceArea', 'notes', 'napConsistency', 'localHealthScore',
      'avgRating', 'reviewCount', 'localStructuredData',
      'gbpAccountId', 'gbpLocationId', 'gbpStatus',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Geen velden om bij te werken' },
        { status: 400 }
      );
    }

    const location = await updateLocation(locationId, updateData);

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'location_updated',
      entity: 'location',
      entityId: locationId,
      changes: updateData,
    });

    return NextResponse.json({ data: location });
  } catch (error) {
    console.error('Fout bij bijwerken locatie:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij bijwerken locatie' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/locations/[locationId] — Soft delete location
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

    // Verify location belongs to project
    const existing = await getLocation(locationId);
    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Locatie niet gevonden' },
        { status: 404 }
      );
    }

    const location = await deleteLocation(locationId);

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'location_deleted',
      entity: 'location',
      entityId: locationId,
      changes: { deletedAt: new Date().toISOString() },
    });

    return NextResponse.json({ data: location });
  } catch (error) {
    console.error('Fout bij verwijderen locatie:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij verwijderen locatie' },
      { status: 500 }
    );
  }
}
