import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { updateCROFinding } from '@/lib/cro';
import { db } from '@/lib/db';

// PATCH /api/projects/[id]/cro-findings/[findingId] — Update CRO finding
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

    // Verify the finding belongs to the project
    const existing = await db.cROFinding.findFirst({
      where: { id: findingId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'CRO-bevinding niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status, dismissedReason } = body as {
      status?: string;
      dismissedReason?: string;
    };

    const updateData: { status?: string; dismissedReason?: string } = {};
    if (status !== undefined) updateData.status = status;
    if (dismissedReason !== undefined) updateData.dismissedReason = dismissedReason;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Geen geldige velden om bij te werken. Gebruik status en/of dismissedReason.' },
        { status: 400 }
      );
    }

    const updated = await updateCROFinding(findingId, projectId, updateData);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update CRO finding error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
