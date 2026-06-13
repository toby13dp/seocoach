import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

// GET /api/projects/[id]/issues — List technical issues for a project
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
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const severity = searchParams.get('severity') ?? undefined;
    const priority = searchParams.get('priority') ?? undefined;
    const category = searchParams.get('category') ?? undefined;
    const ruleId = searchParams.get('ruleId') ?? undefined;
    const dismissed = searchParams.get('dismissed') ?? undefined;
    const crawlSessionId = searchParams.get('crawlSessionId') ?? undefined;

    // Build where clause
    const where: Prisma.TechnicalIssueWhereInput = {
      projectId,
    };

    if (severity) {
      where.severity = severity as Prisma.EnumIssueSeverityFilter;
    }
    if (priority) {
      where.priority = priority as Prisma.EnumActionPriorityFilter;
    }
    if (category) {
      where.ruleId = { startsWith: category };
    }
    if (ruleId) {
      where.ruleId = ruleId;
    }
    if (dismissed === 'true') {
      where.dismissed = true;
    } else if (dismissed === 'false') {
      where.dismissed = false;
    }
    if (crawlSessionId) {
      where.crawlSessionId = crawlSessionId;
    }

    const [issues, total] = await Promise.all([
      db.technicalIssue.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          page: {
            select: {
              id: true,
              url: true,
              title: true,
            },
          },
        },
      }),
      db.technicalIssue.count({ where }),
    ]);

    // Compute summary stats
    const summaryQuery = await db.technicalIssue.findMany({
      where: { ...where, dismissed: false },
      select: { severity: true },
    });

    const severityCounts: Record<string, number> = {};
    for (const issue of summaryQuery) {
      severityCounts[issue.severity] = (severityCounts[issue.severity] ?? 0) + 1;
    }

    return NextResponse.json({
      data: issues,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        severityCounts,
      },
    });
  } catch (error) {
    console.error('List issues error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
