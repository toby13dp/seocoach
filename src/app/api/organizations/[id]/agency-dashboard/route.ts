import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateTenantAccess } from '@/lib/tenant';
import { ROLES } from '@/lib/permissions';
import { buildAgencyDashboard } from '@/lib/agency/agency-manager';

// ============================================================================
// GET /api/organizations/[id]/agency-dashboard
// Haalt het agentschapsdashboard op
// Vereist AGENCY_OWNER of ORG_OWNER rol
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id } = await params;

    // Verifieer organisatielidmaatschap
    const membership = await validateTenantAccess(user.id, id);
    if (!membership) {
      return NextResponse.json({ error: 'Geen toegang tot deze organisatie' }, { status: 403 });
    }

    // Controleer rol: alleen AGENCY_OWNER of ORG_OWNER (of PLATFORM_ADMIN)
    const allowedRoles = [ROLES.AGENCY_OWNER, ROLES.ORG_OWNER, ROLES.PLATFORM_ADMIN];
    if (!allowedRoles.includes(membership.role as typeof allowedRoles[number])) {
      return NextResponse.json(
        { error: 'Onvoldoende rechten. Vereist rol: AGENCY_OWNER of ORG_OWNER' },
        { status: 403 }
      );
    }

    // Bouw dashboarddata op
    const dashboardData = await buildAgencyDashboard(id);

    return NextResponse.json({ dashboard: dashboardData });
  } catch (error) {
    console.error('Agentschapsdashboard ophalen fout:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
