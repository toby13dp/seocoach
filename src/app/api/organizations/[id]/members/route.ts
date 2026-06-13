import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { validateTenantAccess } from '@/lib/tenant';
import { hasPermission } from '@/lib/permissions';
import { logMembershipChange } from '@/lib/audit';
import { randomUUID } from 'crypto';

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

    const members = await db.organizationMembership.findMany({
      where: {
        organizationId: id,
        deletedAt: null,
        acceptedAt: { not: null },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { role: 'asc' },
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('List members error:', error);
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
    const membership = await validateTenantAccess(user.id, id);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check MANAGE_USERS permission
    if (!hasPermission(membership.role as Parameters<typeof hasPermission>[0], 'MANAGE_USERS')) {
      return NextResponse.json(
        { error: 'Insufficient permissions to invite members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if the user is already a member
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await db.organizationMembership.findUnique({
        where: {
          userId_organizationId: { userId: existingUser.id, organizationId: id },
        },
      });
      if (existingMembership && !existingMembership.deletedAt) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 409 }
        );
      }
    }

    // Create invitation
    const token = randomUUID();
    const invitation = await db.invitation.create({
      data: {
        organizationId: id,
        email,
        role: role ?? 'READ_ONLY',
        token,
        invitedBy: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Log audit event
    await logMembershipChange('member_invited', invitation.id, {
      email,
      role: role ?? 'READ_ONLY',
      organizationId: id,
    }, {
      organizationId: id,
      userId: user.id,
    });

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    console.error('Invite member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
