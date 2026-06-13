import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { updatePreLaunchCheck } from '@/lib/migration/migration-manager';
import { db } from '@/lib/db';

// PATCH /api/projects/[id]/migrations/[migrationId]/checks/[checkId] — Update a check
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; migrationId: string; checkId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, migrationId, checkId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    // Verify check belongs to this migration
    const check = await db.migrationPreLaunchCheck.findFirst({
      where: { id: checkId, migrationProjectId: migrationId, deletedAt: null },
    });

    if (!check) {
      return NextResponse.json({ error: 'Controle niet gevonden' }, { status: 404 });
    }

    if (action === 'check') {
      // Run the check — mark as KLAAR (in a real scenario this would do actual checking)
      const updated = await updatePreLaunchCheck(checkId, {
        status: 'KLAAR',
        checkedBy: user.id,
      });

      return NextResponse.json({ check: updated });
    }

    return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 });
  } catch (error) {
    console.error('Update check error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
