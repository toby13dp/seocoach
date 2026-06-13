import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { resolveLaunchBlocker } from '@/lib/migration/migration-manager';
import { db } from '@/lib/db';

// PATCH /api/projects/[id]/migrations/[migrationId]/blockers/[blockerId] — Resolve a blocker
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; migrationId: string; blockerId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, migrationId, blockerId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { action, resolutionNotes } = body;

    // Verify blocker belongs to this migration
    const blocker = await db.migrationLaunchBlocker.findFirst({
      where: { id: blockerId, migrationProjectId: migrationId, deletedAt: null },
    });

    if (!blocker) {
      return NextResponse.json({ error: 'Blokkade niet gevonden' }, { status: 404 });
    }

    if (action === 'resolve') {
      const resolved = await resolveLaunchBlocker(
        blockerId,
        user.id,
        resolutionNotes || ''
      );

      return NextResponse.json({ blocker: resolved });
    }

    return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 });
  } catch (error) {
    console.error('Resolve blocker error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
