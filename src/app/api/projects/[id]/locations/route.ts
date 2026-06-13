import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { createLocation, listLocations } from '@/lib/local-seo';
import { logAuditEvent } from '@/lib/audit';

// GET /api/projects/[id]/locations — List locations with optional filters
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      city: searchParams.get('city') ?? undefined,
      businessType: searchParams.get('businessType') ?? undefined,
      minHealthScore: searchParams.get('minHealthScore')
        ? parseFloat(searchParams.get('minHealthScore')!)
        : undefined,
      minRating: searchParams.get('minRating')
        ? parseFloat(searchParams.get('minRating')!)
        : undefined,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!, 10)
        : undefined,
      offset: searchParams.get('offset')
        ? parseInt(searchParams.get('offset')!, 10)
        : undefined,
    };

    const result = await listLocations(projectId, filters);

    return NextResponse.json({
      data: result.data,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  } catch (error) {
    console.error('Fout bij ophalen locaties:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen locaties' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/locations — Create a new location
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { name, address, city, postalCode, country, phone, email, website, latitude, longitude, openingHours, businessType, serviceArea, notes } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Locatienaam is verplicht' },
        { status: 400 }
      );
    }

    const location = await createLocation(projectId, {
      name: name.trim(),
      address,
      city,
      postalCode,
      country,
      phone,
      email,
      website,
      latitude,
      longitude,
      openingHours,
      businessType,
      serviceArea,
      notes,
    });

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'location_added',
      entity: 'location',
      entityId: location.id,
      changes: { name, city, country },
    });

    return NextResponse.json({ data: location }, { status: 201 });
  } catch (error) {
    console.error('Fout bij aanmaken locatie:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij aanmaken locatie' },
      { status: 500 }
    );
  }
}
