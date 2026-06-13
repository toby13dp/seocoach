import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { updateCluster, deleteCluster } from '@/lib/topics/manager';
import { db } from '@/lib/db';

// GET /api/projects/[id]/clusters/[clusterId] — Get cluster with topics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clusterId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, clusterId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cluster = await db.topicCluster.findFirst({
      where: { id: clusterId, projectId, deletedAt: null },
      include: {
        topics: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          include: {
            topicKeywords: {
              include: {
                keyword: { select: { id: true, keyword: true } },
              },
            },
            _count: { select: { contentBriefs: true } },
          },
        },
      },
    });

    if (!cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    const pillarTopic = cluster.topics.find((t) => t.isPillar) ?? null;

    return NextResponse.json({
      data: {
        ...cluster,
        pillarTopic,
      },
    });
  } catch (error) {
    console.error('Get cluster error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/clusters/[clusterId] — Update cluster
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clusterId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, clusterId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await db.topicCluster.findFirst({
      where: { id: clusterId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    const body = await request.json();
    const cluster = await updateCluster(clusterId, {
      name: body.name,
      description: body.description,
    });

    return NextResponse.json({ data: cluster });
  } catch (error) {
    console.error('Update cluster error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/clusters/[clusterId] — Soft delete cluster
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clusterId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, clusterId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await db.topicCluster.findFirst({
      where: { id: clusterId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    await deleteCluster(clusterId);

    return NextResponse.json({ data: { id: clusterId, deleted: true } });
  } catch (error) {
    console.error('Delete cluster error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
