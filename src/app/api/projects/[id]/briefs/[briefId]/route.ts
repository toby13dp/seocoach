import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getBrief, updateBrief, deleteBrief, approveBrief } from '@/lib/content';
import { db } from '@/lib/db';

// GET /api/projects/[id]/briefs/[briefId] — Get brief with versions
export async function GET(
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

    const brief = await getBrief(briefId);

    return NextResponse.json({ data: brief });
  } catch (error) {
    console.error('Get brief error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/briefs/[briefId] — Update brief (including approve)
export async function PATCH(
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

    // Handle approve action
    if (body.approve === true) {
      const brief = await approveBrief(briefId, user.id);
      return NextResponse.json({ data: brief });
    }

    // Regular update
    const brief = await updateBrief(briefId, {
      title: body.title,
      targetKeyword: body.targetKeyword,
      secondaryKeywords: body.secondaryKeywords,
      searchIntent: body.searchIntent,
      funnelStage: body.funnelStage,
      outline: body.outline,
      sources: body.sources,
      brandProfileUsed: body.brandProfileUsed,
      internalPages: body.internalPages,
      targetWordCount: body.targetWordCount,
      targetAudience: body.targetAudience,
      toneOfVoice: body.toneOfVoice,
    });

    return NextResponse.json({ data: brief });
  } catch (error) {
    console.error('Update brief error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/briefs/[briefId] — Soft delete brief (archive)
export async function DELETE(
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

    await deleteBrief(briefId);

    return NextResponse.json({ data: { id: briefId, deleted: true } });
  } catch (error) {
    console.error('Delete brief error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
