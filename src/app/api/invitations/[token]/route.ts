import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { db } from '@/lib/db';
import { logMembershipChange, logAuthEvent } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invitation = await db.invitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        inviter: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: 'Invitation already accepted' },
        { status: 410 }
      );
    }

    if (invitation.deletedAt) {
      return NextResponse.json(
        { error: 'Invitation has been revoked' },
        { status: 410 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      );
    }

    return NextResponse.json({ invitation });
  } catch (error) {
    console.error('Get invitation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await params;

    const invitation = await db.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: 'Invitation already accepted' },
        { status: 410 }
      );
    }

    if (invitation.deletedAt) {
      return NextResponse.json(
        { error: 'Invitation has been revoked' },
        { status: 410 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      );
    }

    // Verify the authenticated user matches the invitation email
    if (invitation.email !== user.email) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address' },
        { status: 403 }
      );
    }

    // Check for existing membership
    const existingMembership = await db.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: invitation.organizationId,
        },
      },
    });

    if (existingMembership && !existingMembership.deletedAt) {
      return NextResponse.json(
        { error: 'You are already a member of this organization' },
        { status: 409 }
      );
    }

    // Create or restore membership
    if (existingMembership?.deletedAt) {
      // Restore soft-deleted membership
      await db.organizationMembership.update({
        where: { id: existingMembership.id },
        data: {
          role: invitation.role,
          deletedAt: null,
          acceptedAt: new Date(),
        },
      });
    } else {
      await db.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
          invitedAt: invitation.createdAt,
          acceptedAt: new Date(),
        },
      });
    }

    // Mark invitation as accepted
    await db.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    // Log audit events
    await logMembershipChange('invitation_accepted', invitation.id, {
      email: invitation.email,
      role: invitation.role,
      organizationId: invitation.organizationId,
    }, {
      organizationId: invitation.organizationId,
      userId: user.id,
    });

    return NextResponse.json({ success: true, organizationId: invitation.organizationId });
  } catch (error) {
    console.error('Accept invitation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
