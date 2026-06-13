import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { recordChange } from '@/lib/content/change-history';
import type { ContentWorkflowStep } from '@prisma/client';

// GET /api/projects/[id]/workflow/[briefId] — Get workflow status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; briefId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, briefId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const brief = await db.contentBrief.findFirst({
      where: { id: briefId, projectId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief niet gevonden' },
        { status: 404 }
      );
    }

    // Build workflow status from brief data
    const currentStep = mapStatusToStep(brief.approvalStatus);

    // Get quality findings count
    const findingsCount = await db.qualityFinding.count({
      where: { briefId, dismissed: false },
    });

    // Get content sources count
    const sourcesCount = await db.contentSource.count({
      where: { briefId, deletedAt: null },
    });

    return NextResponse.json({
      data: {
        briefId: brief.id,
        title: brief.title,
        approvalStatus: brief.approvalStatus,
        currentStep,
        latestVersion: brief.versions[0] ?? null,
        findingsCount,
        sourcesCount,
        searchIntent: brief.searchIntent,
        funnelStage: brief.funnelStage,
        targetKeyword: brief.targetKeyword,
        createdAt: brief.createdAt,
        updatedAt: brief.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get workflow status error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/workflow/[briefId] — Update workflow step
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; briefId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, briefId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const brief = await db.contentBrief.findFirst({
      where: { id: briefId, projectId },
    });

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!body.step) {
      return NextResponse.json(
        { error: 'Workflowstap is vereist' },
        { status: 400 }
      );
    }

    const validSteps: ContentWorkflowStep[] = [
      'SELECT_OPPORTUNITY',
      'SELECT_CONTENT_TYPE',
      'GENERATE_BRIEF',
      'EDIT_OUTLINE',
      'SELECT_SOURCES',
      'GENERATE_DRAFT',
      'RUN_QUALITY_CHECKS',
      'REVIEW_CLAIMS',
      'ADD_INTERNAL_LINKS',
      'PREVIEW',
      'APPROVE',
      'SAVE_CMS_DRAFT',
      'SCHEDULE_OR_PUBLISH',
      'MONITOR_STATUS',
    ];

    if (!validSteps.includes(body.step)) {
      return NextResponse.json(
        { error: `Ongeldige workflowstap. Geldige stappen: ${validSteps.join(', ')}` },
        { status: 400 }
      );
    }

    // Map the workflow step to an approval status if applicable
    const newStatus = mapStepToStatus(body.step);

    const updateData: Record<string, unknown> = {};
    if (newStatus && newStatus !== brief.approvalStatus) {
      updateData.approvalStatus = newStatus;
    }

    // Apply any data changes from the body
    if (body.data) {
      if (body.data.title) updateData.title = body.data.title;
      if (body.data.targetKeyword) updateData.targetKeyword = body.data.targetKeyword;
      if (body.data.searchIntent) updateData.searchIntent = body.data.searchIntent;
      if (body.data.funnelStage) updateData.funnelStage = body.data.funnelStage;
      if (body.data.outline) updateData.outline = JSON.stringify(body.data.outline);
      if (body.data.sources) updateData.sources = JSON.stringify(body.data.sources);
      if (body.data.toneOfVoice) updateData.toneOfVoice = body.data.toneOfVoice;
      if (body.data.targetWordCount) updateData.targetWordCount = body.data.targetWordCount;
    }

    if (Object.keys(updateData).length > 0) {
      await db.contentBrief.update({
        where: { id: briefId },
        data: updateData,
      });

      // Record the workflow step change
      await recordChange({
        projectId,
        briefId,
        userId: user.id,
        changeType: 'UPDATE',
        summary: `Workflowstap gewijzigd naar "${body.step}"`,
      });
    }

    return NextResponse.json({
      data: {
        briefId,
        step: body.step,
        approvalStatus: newStatus ?? brief.approvalStatus,
        message: `Workflowstap bijgewerkt naar "${body.step}".`,
      },
    });
  } catch (error) {
    console.error('Update workflow step error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Helper: Map approval status to workflow step
function mapStatusToStep(status: string): string {
  const mapping: Record<string, string> = {
    DRAFT: 'GENERATE_DRAFT',
    IN_REVIEW: 'RUN_QUALITY_CHECKS',
    APPROVED: 'APPROVE',
    PUBLISHED: 'MONITOR_STATUS',
    ARCHIVED: 'MONITOR_STATUS',
  };
  return mapping[status] ?? 'SELECT_OPPORTUNITY';
}

// Helper: Map workflow step to approval status
function mapStepToStatus(step: string): string | null {
  const mapping: Record<string, string> = {
    SELECT_OPPORTUNITY: 'DRAFT',
    SELECT_CONTENT_TYPE: 'DRAFT',
    GENERATE_BRIEF: 'DRAFT',
    EDIT_OUTLINE: 'DRAFT',
    SELECT_SOURCES: 'DRAFT',
    GENERATE_DRAFT: 'DRAFT',
    RUN_QUALITY_CHECKS: 'IN_REVIEW',
    REVIEW_CLAIMS: 'IN_REVIEW',
    ADD_INTERNAL_LINKS: 'IN_REVIEW',
    PREVIEW: 'IN_REVIEW',
    APPROVE: 'APPROVED',
    SAVE_CMS_DRAFT: 'APPROVED',
    SCHEDULE_OR_PUBLISH: 'PUBLISHED',
    MONITOR_STATUS: 'PUBLISHED',
  };
  return mapping[step] ?? null;
}
