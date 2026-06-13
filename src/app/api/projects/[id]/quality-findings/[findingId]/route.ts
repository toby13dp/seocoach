import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { dismissFinding } from '@/lib/content/quality-controls';

// PATCH /api/projects/[id]/quality-findings/[findingId] — Dismiss finding
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, findingId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const finding = await db.qualityFinding.findFirst({
      where: { id: findingId, projectId },
    });

    if (!finding) {
      return NextResponse.json(
        { error: 'Bevinding niet gevonden' },
        { status: 404 }
      );
    }

    await dismissFinding(findingId, user.id);

    return NextResponse.json({ data: { id: findingId, dismissed: true } });
  } catch (error) {
    console.error('Dismiss finding error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
