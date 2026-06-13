import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { getWhiteLabelProfiles, createWhiteLabelProfile } from '@/lib/reporting';
import type { WhiteLabelProfileData } from '@/lib/reporting';

// GET /api/organizations/[id]/white-label-profiles — List profiles
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const profiles = await getWhiteLabelProfiles(organizationId);

    return NextResponse.json({ data: profiles });
  } catch (error) {
    console.error('List white-label profiles error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/organizations/[id]/white-label-profiles — Create profile
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const membership = await validateTenantAccess(user.id, organizationId);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    // Only org owners and managers can create white-label profiles
    const allowedRoles = ['ORG_OWNER', 'AGENCY_OWNER', 'SEO_MANAGER'];
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json(
        { error: 'Onvoldoende rechten om white-label profiel aan te maken' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = body as WhiteLabelProfileData;

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Profielnaam is vereist' },
        { status: 400 }
      );
    }

    const profile = await createWhiteLabelProfile(organizationId, data);

    return NextResponse.json({ data: profile }, { status: 201 });
  } catch (error) {
    console.error('Create white-label profile error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
