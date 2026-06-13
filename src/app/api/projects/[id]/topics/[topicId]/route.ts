import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { updateTopic, deleteTopic } from '@/lib/topics/manager';
import { db } from '@/lib/db';

// GET /api/projects/[id]/topics/[topicId] — Get topic details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; topicId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, topicId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const topic = await db.topic.findFirst({
      where: { id: topicId, projectId, deletedAt: null },
      include: {
        cluster: { select: { id: true, name: true } },
        topicKeywords: {
          include: {
            keyword: { select: { id: true, keyword: true, searchVolume: true } },
          },
        },
        outgoingRelations: {
          include: {
            toTopic: { select: { id: true, name: true } },
          },
        },
        incomingRelations: {
          include: {
            fromTopic: { select: { id: true, name: true } },
          },
        },
        contentBriefs: {
          select: {
            id: true,
            title: true,
            approvalStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    return NextResponse.json({ data: topic });
  } catch (error) {
    console.error('Get topic error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/topics/[topicId] — Update topic
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; topicId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, topicId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify topic belongs to this project
    const existing = await db.topic.findFirst({
      where: { id: topicId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    const body = await request.json();
    const topic = await updateTopic(topicId, {
      name: body.name,
      description: body.description,
      clusterId: body.clusterId,
      isPillar: body.isPillar,
      suggestedUrl: body.suggestedUrl,
      searchIntent: body.searchIntent,
      funnelStage: body.funnelStage,
      conversionGoal: body.conversionGoal,
      priority: body.priority,
      impact: body.impact,
      effort: body.effort,
      sortOrder: body.sortOrder,
    });

    return NextResponse.json({ data: topic });
  } catch (error) {
    console.error('Update topic error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/topics/[topicId] — Soft delete topic
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; topicId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, topicId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await db.topic.findFirst({
      where: { id: topicId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    await deleteTopic(topicId);

    return NextResponse.json({ data: { id: topicId, deleted: true } });
  } catch (error) {
    console.error('Delete topic error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
