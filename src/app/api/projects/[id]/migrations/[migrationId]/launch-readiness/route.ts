import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { isLaunchReady } from '@/lib/migration/migration-manager';
import { db } from '@/lib/db';

// GET /api/projects/[id]/migrations/[migrationId]/launch-readiness — Check launch readiness
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

    // Verify migration belongs to project
    const migration = await db.migrationProject.findFirst({
      where: { id: migrationId, projectId, deletedAt: null },
    });

    if (!migration) {
      return NextResponse.json({ error: 'Migratie niet gevonden' }, { status: 404 });
    }

    const result = await isLaunchReady(migrationId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Launch readiness error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
