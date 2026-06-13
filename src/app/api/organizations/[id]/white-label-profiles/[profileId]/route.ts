import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { updateWhiteLabelProfile } from '@/lib/reporting';
import type { WhiteLabelProfileData } from '@/lib/reporting';

// GET /api/organizations/[id]/white-label-profiles/[profileId] — Get profile details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; profileId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, profileId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const profile = await db.whiteLabelProfile.findFirst({
      where: {
        id: profileId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'White-label profiel niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: profile });
  } catch (error) {
    console.error('Get white-label profile error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/organizations/[id]/white-label-profiles/[profileId] — Update profile
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; profileId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, profileId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    // Only org owners and managers can update white-label profiles
    const allowedRoles = ['ORG_OWNER', 'AGENCY_OWNER', 'SEO_MANAGER'];
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json(
        { error: 'Onvoldoende rechten om white-label profiel bij te werken' },
        { status: 403 }
      );
    }

    const existing = await db.whiteLabelProfile.findFirst({
      where: { id: profileId, organizationId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'White-label profiel niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates = body as Partial<WhiteLabelProfileData>;

    const updated = await updateWhiteLabelProfile(profileId, updates);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update white-label profile error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/organizations/[id]/white-label-profiles/[profileId] — Soft delete profile
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; profileId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId, profileId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    // Only org owners and managers can delete white-label profiles
    const allowedRoles = ['ORG_OWNER', 'AGENCY_OWNER', 'SEO_MANAGER'];
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json(
        { error: 'Onvoldoende rechten om white-label profiel te verwijderen' },
        { status: 403 }
      );
    }

    const existing = await db.whiteLabelProfile.findFirst({
      where: { id: profileId, organizationId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'White-label profiel niet gevonden' },
        { status: 404 }
      );
    }

    await db.whiteLabelProfile.update({
      where: { id: profileId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ data: { id: profileId, deleted: true } });
  } catch (error) {
    console.error('Delete white-label profile error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
