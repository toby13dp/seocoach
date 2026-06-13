import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { validateTenantAccess } from '@/lib/tenant';
import { hasPermission, ROLES } from '@/lib/permissions';
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
    const membership = await validateTenantAccess(user.id, id);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organization = await db.organization.findFirst({
      where: { id, deletedAt: null },
      include: {
        memberships: {
          where: { deletedAt: null, acceptedAt: { not: null } },
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ organization });
  } catch (error) {
    console.error('Get organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const membership = await validateTenantAccess(user.id, id);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify ORG_OWNER or higher role
    const canManage =
      membership.role === ROLES.ORG_OWNER ||
      membership.role === ROLES.PLATFORM_ADMIN;
    if (!canManage) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, website, logoUrl, locale, settings } = body;

    const organization = await db.organization.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(website !== undefined && { website }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(locale !== undefined && { locale }),
        ...(settings !== undefined && { settings }),
      },
    });

    // Log audit event
    await logAuditEvent({
      organizationId: id,
      userId: user.id,
      action: 'organization_updated',
      entity: 'organization',
      entityId: id,
      changes: { name, description, website, logoUrl, locale },
    });

    return NextResponse.json({ organization });
  } catch (error) {
    console.error('Update organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const membership = await validateTenantAccess(user.id, id);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only ORG_OWNER can delete
    if (membership.role !== ROLES.ORG_OWNER && membership.role !== ROLES.PLATFORM_ADMIN) {
      return NextResponse.json(
        { error: 'Only organization owners can delete organizations' },
        { status: 403 }
      );
    }

    // Soft-delete
    await db.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Log audit event
    await logAuditEvent({
      organizationId: id,
      userId: user.id,
      action: 'organization_deleted',
      entity: 'organization',
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
