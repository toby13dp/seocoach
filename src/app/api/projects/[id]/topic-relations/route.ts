import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { addRelation, removeRelation } from '@/lib/topics/manager';

// POST /api/projects/[id]/topic-relations — Create a relation between topics
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

    if (!body.fromTopicId || !body.toTopicId) {
      return NextResponse.json(
        { error: 'fromTopicId and toTopicId are required' },
        { status: 400 }
      );
    }

    if (!body.relationType || typeof body.relationType !== 'string') {
      return NextResponse.json(
        { error: 'relationType is required' },
        { status: 400 }
      );
    }

    // Verify both topics belong to this project
    const { db } = await import('@/lib/db');
    const topics = await db.topic.findMany({
      where: {
        id: { in: [body.fromTopicId, body.toTopicId] },
        projectId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (topics.length !== 2) {
      return NextResponse.json(
        { error: 'Both topics must exist in this project' },
        { status: 400 }
      );
    }

    const relation = await addRelation(
      body.fromTopicId,
      body.toTopicId,
      body.relationType,
      body.label
    );

    return NextResponse.json({ data: relation }, { status: 201 });
  } catch (error) {
    console.error('Create topic relation error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/topic-relations — Remove a relation
export async function DELETE(
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
    const relationId = searchParams.get('relationId');

    if (!relationId) {
      return NextResponse.json(
        { error: 'relationId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify the relation belongs to topics in this project
    const { db } = await import('@/lib/db');
    const relation = await db.topicRelation.findUnique({
      where: { id: relationId },
      include: {
        fromTopic: { select: { projectId: true } },
      },
    });

    if (!relation || relation.fromTopic.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Relation not found in this project' },
        { status: 404 }
      );
    }

    await removeRelation(relationId);

    return NextResponse.json({ data: { id: relationId, deleted: true } });
  } catch (error) {
    console.error('Delete topic relation error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
