import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/crawls/[crawlId] — Get crawl session details with progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; crawlId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, crawlId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const crawlSession = await db.crawlSession.findFirst({
      where: { id: crawlId, projectId },
      include: {
        _count: { select: { pages: true, issues: true } },
      },
    });

    if (!crawlSession) {
      return NextResponse.json({ error: 'Crawl session not found' }, { status: 404 });
    }

    // Calculate progress percentage
    const progress = crawlSession.maxPages > 0
      ? Math.round((crawlSession.pagesCrawled / crawlSession.maxPages) * 100)
      : 0;

    return NextResponse.json({
      data: {
        ...crawlSession,
        progress,
        pageCount: crawlSession._count.pages,
        issueCount: crawlSession._count.issues,
      },
    });
  } catch (error) {
    console.error('Get crawl session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/crawls/[crawlId] — Cancel a running crawl
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; crawlId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, crawlId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const crawlSession = await db.crawlSession.findFirst({
      where: { id: crawlId, projectId },
    });

    if (!crawlSession) {
      return NextResponse.json({ error: 'Crawl session not found' }, { status: 404 });
    }

    if (crawlSession.status !== 'RUNNING' && crawlSession.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Crawl is not running and cannot be cancelled' },
        { status: 400 }
      );
    }

    // Mark the crawl session as cancelled
    await db.crawlSession.update({
      where: { id: crawlId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // Update any associated jobs
    await db.job.updateMany({
      where: {
        projectId,
        type: 'crawl',
        status: 'RUNNING',
        result: { contains: crawlId },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return NextResponse.json({
      data: { id: crawlId, status: 'CANCELLED' },
    });
  } catch (error) {
    console.error('Cancel crawl error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
