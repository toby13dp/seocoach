import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { createCluster, getClusterGroups } from '@/lib/topics/manager';

// GET /api/projects/[id]/clusters — List clusters
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
    const withTopics = searchParams.get('withTopics') === 'true';

    if (withTopics) {
      const groups = await getClusterGroups(projectId);
      return NextResponse.json({ data: groups });
    }

    const clusters = await db.topicCluster.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { topics: { where: { deletedAt: null } } } },
      },
    });

    return NextResponse.json({ data: clusters });
  } catch (error) {
    console.error('List clusters error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/clusters — Create a cluster
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
        { error: 'Cluster name is required' },
        { status: 400 }
      );
    }

    const cluster = await createCluster(projectId, body.name, body.description);

    return NextResponse.json({ data: cluster }, { status: 201 });
  } catch (error) {
    console.error('Create cluster error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
