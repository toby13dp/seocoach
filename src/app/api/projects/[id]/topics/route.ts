import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { createTopic, getTopicGraph } from '@/lib/topics/manager';
import type { Prisma } from '@prisma/client';

// GET /api/projects/[id]/topics — List topics for a project (optionally as graph)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const asGraph = searchParams.get('graph') === 'true';
    const clusterId = searchParams.get('clusterId') ?? undefined;

    if (asGraph) {
      const graph = await getTopicGraph(projectId);
      return NextResponse.json({ data: graph });
    }

    // Regular list mode
    const where: Prisma.TopicWhereInput = {
      projectId,
      deletedAt: null,
    };

    if (clusterId) {
      where.clusterId = clusterId;
    }

    const topics = await db.topic.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        cluster: { select: { id: true, name: true } },
        topicKeywords: {
          include: {
            keyword: { select: { id: true, keyword: true } },
          },
        },
        _count: { select: { contentBriefs: true } },
      },
    });

    return NextResponse.json({ data: topics });
  } catch (error) {
    console.error('List topics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/topics — Create a new topic
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Topic name is required' },
        { status: 400 }
      );
    }

    const topic = await createTopic(projectId, {
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

    return NextResponse.json({ data: topic }, { status: 201 });
  } catch (error) {
    console.error('Create topic error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
