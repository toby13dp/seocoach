import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { generateLocalStructuredData } from '@/lib/local-seo';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

// GET /api/projects/[id]/locations/[locationId]/structured-data — Get local structured data (JSON-LD)
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

    const location = await db.location.findFirst({
      where: { id: locationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        localStructuredData: true,
        businessType: true,
        projectId: true,
      },
    });

    if (!location || location.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Locatie niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        locationId: location.id,
        businessType: location.businessType,
        jsonLd: location.localStructuredData,
      },
    });
  } catch (error) {
    console.error('Fout bij ophalen gestructureerde gegevens:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen gestructureerde gegevens' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/locations/[locationId]/structured-data — Generate and save local structured data
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

    const location = await db.location.findFirst({
      where: { id: locationId, deletedAt: null },
    });

    if (!location || location.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Locatie niet gevonden' },
        { status: 404 }
      );
    }

    // Generate structured data
    const result = await generateLocalStructuredData({
      name: location.name,
      address: location.address,
      city: location.city,
      postalCode: location.postalCode,
      country: location.country,
      phone: location.phone,
      email: location.email,
      website: location.website,
      latitude: location.latitude,
      longitude: location.longitude,
      openingHours: location.openingHours,
      businessType: location.businessType,
    });

    // Save to location
    await db.location.update({
      where: { id: locationId },
      data: { localStructuredData: result.jsonLd },
    });

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'local_structured_data_generated',
      entity: 'location',
      entityId: locationId,
      changes: { generated: true },
    });

    return NextResponse.json({
      data: {
        locationId,
        jsonLd: result.jsonLd,
      },
    });
  } catch (error) {
    console.error('Fout bij genereren gestructureerde gegevens:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij genereren gestructureerde gegevens' },
      { status: 500 }
    );
  }
}
