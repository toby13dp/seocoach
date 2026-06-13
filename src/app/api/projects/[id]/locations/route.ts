import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { validateProjectAccess } from '@/lib/tenant';
import { logAuditEvent } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const access = await validateProjectAccess(user.id, id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const locations = await db.location.findMany({
      where: { projectId: id, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ locations });
  } catch (error) {
    console.error('List locations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const access = await validateProjectAccess(user.id, id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, address, city, postalCode, country, phone, email, latitude, longitude } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Location name is required' },
        { status: 400 }
      );
    }

    const location = await db.location.create({
      data: {
        projectId: id,
        name,
        address: address ?? null,
        city: city ?? null,
        postalCode: postalCode ?? null,
        country: country ?? null,
        phone: phone ?? null,
        email: email ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
    });

    // Log audit event
    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId: id,
      userId: user.id,
      action: 'location_added',
      entity: 'location',
      entityId: location.id,
      changes: { name, city, country },
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    console.error('Add location error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
