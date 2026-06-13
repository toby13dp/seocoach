import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { rollbackChange } from '@/lib/content/change-history';

// POST /api/projects/[id]/content-changes/[changeId]/rollback — Rollback a change
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; changeId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, changeId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    // Verify change belongs to project
    const changeCheck = await db.contentChange.findFirst({
      where: { id: changeId, projectId },
      select: { id: true },
    });

    if (!changeCheck) {
      return NextResponse.json(
        { error: 'Wijziging niet gevonden' },
        { status: 404 }
      );
    }

    const result = await rollbackChange(changeId, user.id);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Rollback content change error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
