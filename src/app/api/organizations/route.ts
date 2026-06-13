import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberships = await db.organizationMembership.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        acceptedAt: { not: null },
      },
      include: {
        organization: {
          where: { deletedAt: null },
        },
      },
    });

    const organizations = memberships
      .map((m) => m.organization)
      .filter(Boolean);

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('List organizations error:', error);
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
    const { name, description, website, locale } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    const slug = generateSlug(name);

    // Check slug uniqueness
    const existing = await db.organization.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: 'An organization with this slug already exists' },
        { status: 409 }
      );
    }

    // Create organization + membership as ORG_OWNER
    const organization = await db.organization.create({
      data: {
        name,
        slug,
        description: description ?? null,
        website: website ?? null,
        locale: locale ?? 'nl-NL',
        memberships: {
          create: {
            userId: user.id,
            role: 'ORG_OWNER',
            invitedAt: new Date(),
            acceptedAt: new Date(),
          },
        },
      },
      include: {
        memberships: true,
      },
    });

    // Log audit event
    await logAuditEvent({
      organizationId: organization.id,
      userId: user.id,
      action: 'organization_created',
      entity: 'organization',
      entityId: organization.id,
      changes: { name, slug },
    });

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    console.error('Create organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
