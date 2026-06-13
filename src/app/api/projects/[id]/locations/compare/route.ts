import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { compareLocations } from '@/lib/local-seo';
import { logAuditEvent } from '@/lib/audit';

// POST /api/projects/[id]/locations/compare — Compare multiple locations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { locationIds } = body;

    if (!Array.isArray(locationIds) || locationIds.length < 2) {
      return NextResponse.json(
        { error: 'Minimaal twee locatie-ID\'s zijn vereist' },
        { status: 400 }
      );
    }

    if (locationIds.length > 20) {
      return NextResponse.json(
        { error: 'Maximaal 20 locaties kunnen tegelijk vergeleken worden' },
        { status: 400 }
      );
    }

    // Validate all IDs are strings
    for (const id of locationIds) {
      if (typeof id !== 'string' || !id.trim()) {
        return NextResponse.json(
          { error: 'Alle locatie-ID\'s moeten geldige tekenreeksen zijn' },
          { status: 400 }
        );
      }
    }

    const result = await compareLocations(projectId, locationIds);

    if (result.locations.length === 0) {
      return NextResponse.json(
        { error: 'Geen geldige locaties gevonden' },
        { status: 404 }
      );
    }

    await logAuditEvent({
      organizationId: access.project.organizationId,
      projectId,
      userId: user.id,
      action: 'locations_compared',
      entity: 'location',
      entityId: locationIds.join(','),
      changes: { locationIds, locationCount: result.locations.length },
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Fout bij vergelijken locaties:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij vergelijken locaties' },
      { status: 500 }
    );
  }
}
