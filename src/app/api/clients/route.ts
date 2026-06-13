import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { validateTenantAccess, getTenantFilter } from '@/lib/tenant';
import { logAuditEvent } from '@/lib/audit';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId query parameter is required' },
        { status: 400 }
      );
    }

    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clients = await db.client.findMany({
      where: getTenantFilter(organizationId),
      include: {
        _count: { select: { projects: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('List clients error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, organizationId, description, website, industry, notes } = body;

    if (!name || !organizationId) {
      return NextResponse.json(
        { error: 'Name and organizationId are required' },
        { status: 400 }
      );
    }

    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const slug = generateSlug(name);

    // Check slug uniqueness within organization
    const existing = await db.client.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
    });
    if (existing && !existing.deletedAt) {
      return NextResponse.json(
        { error: 'A client with this slug already exists in this organization' },
        { status: 409 }
      );
    }

    const client = await db.client.create({
      data: {
        name,
        slug,
        organizationId,
        description: description ?? null,
        website: website ?? null,
        industry: industry ?? null,
        notes: notes ?? null,
      },
    });

    // Log audit event
    await logAuditEvent({
      organizationId,
      userId: user.id,
      action: 'client_created',
      entity: 'client',
      entityId: client.id,
      changes: { name, slug },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error('Create client error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
