import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/pages/[pageId] — Get page details with snapshots and issues
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, pageId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const page = await db.page.findFirst({
      where: { id: pageId, projectId, deletedAt: null },
      include: {
        snapshots: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            source: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
        issues: {
          where: { dismissed: false },
          orderBy: [{ severity: 'desc' }, { priority: 'desc' }],
          select: {
            id: true,
            ruleId: true,
            ruleName: true,
            dutchExplanation: true,
            severity: true,
            priority: true,
            recommendedAction: true,
            createdAt: true,
          },
        },
        renderedComparison: true,
      },
    });

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({ data: page });
  } catch (error) {
    console.error('Get page error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
