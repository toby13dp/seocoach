import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { generateDraft, regenerateDraft } from '@/lib/content';
import { db } from '@/lib/db';

// POST /api/projects/[id]/briefs/[briefId]/draft — Generate a content draft using AI
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; briefId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, briefId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify brief belongs to this project
    const briefCheck = await db.contentBrief.findFirst({
      where: { id: briefId, projectId },
      select: { id: true },
    });

    if (!briefCheck) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    const body = await request.json();
    const { outline, feedback } = body;

    // If feedback is provided, this is a regeneration request
    if (feedback) {
      const draft = await regenerateDraft(briefId, feedback);
      return NextResponse.json({ data: draft }, { status: 201 });
    }

    // First-time draft generation
    const draft = await generateDraft({
      briefId,
      projectId,
      outline,
    });

    return NextResponse.json({ data: draft }, { status: 201 });
  } catch (error) {
    console.error('Generate draft error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
