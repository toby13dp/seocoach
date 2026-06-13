import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/migrations/[migrationId]/blockers — List launch blockers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; migrationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, migrationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const blockers = await db.migrationLaunchBlocker.findMany({
      where: { migrationProjectId: migrationId, deletedAt: null },
      orderBy: [{ isResolved: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ blockers });
  } catch (error) {
    console.error('List blockers error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
