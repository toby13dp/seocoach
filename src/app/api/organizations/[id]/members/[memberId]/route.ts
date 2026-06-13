import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { validateTenantAccess } from '@/lib/tenant';
import { hasPermission } from '@/lib/permissions';
import { logRoleChange, logMembershipChange } from '@/lib/audit';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, memberId } = await params;
    const membership = await validateTenantAccess(user.id, id);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check MANAGE_USERS permission
    if (!hasPermission(membership.role as Parameters<typeof hasPermission>[0], 'MANAGE_USERS')) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update member role' },
        { status: 403 }
      );
    }

    const targetMembership = await db.organizationMembership.findUnique({
      where: { id: memberId },
    });

    if (!targetMembership || targetMembership.organizationId !== id || targetMembership.deletedAt) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { role } = body;

    if (!role) {
      return NextResponse.json(
        { error: 'Role is required' },
        { status: 400 }
      );
    }

    const previousRole = targetMembership.role;

    const updatedMembership = await db.organizationMembership.update({
      where: { id: memberId },
      data: { role },
    });

    // Log audit event
    await logRoleChange(memberId, {
      previousRole,
      newRole: role,
      organizationId: id,
    }, {
      organizationId: id,
      userId: user.id,
    });

    return NextResponse.json({ membership: updatedMembership });
  } catch (error) {
    console.error('Update member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, memberId } = await params;
    const membership = await validateTenantAccess(user.id, id);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check MANAGE_USERS permission
    if (!hasPermission(membership.role as Parameters<typeof hasPermission>[0], 'MANAGE_USERS')) {
      return NextResponse.json(
        { error: 'Insufficient permissions to remove members' },
        { status: 403 }
      );
    }

    const targetMembership = await db.organizationMembership.findUnique({
      where: { id: memberId },
    });

    if (!targetMembership || targetMembership.organizationId !== id || targetMembership.deletedAt) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Soft-delete membership
    await db.organizationMembership.update({
      where: { id: memberId },
      data: { deletedAt: new Date() },
    });

    // Log audit event
    await logMembershipChange('member_removed', memberId, {
      organizationId: id,
      removedUserId: targetMembership.userId,
    }, {
      organizationId: id,
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
