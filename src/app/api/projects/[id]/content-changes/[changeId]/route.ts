import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { getChangeDetail, getContentDiff } from '@/lib/content/change-history';

// GET /api/projects/[id]/content-changes/[changeId] — Get change detail with diff
export async function GET(
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

    const [detail, diff] = await Promise.all([
      getChangeDetail(changeId),
      getContentDiff(changeId),
    ]);

    return NextResponse.json({ data: { ...detail, diff } });
  } catch (error) {
    console.error('Get content change detail error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
