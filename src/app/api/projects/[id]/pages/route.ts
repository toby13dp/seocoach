import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

// GET /api/projects/[id]/pages — List pages from latest crawl
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
    const sort = searchParams.get('sort') ?? 'createdAt';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const statusCode = searchParams.get('statusCode') ?? undefined;
    const indexability = searchParams.get('indexability') ?? undefined;
    const contentType = searchParams.get('contentType') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const minWordCount = searchParams.get('minWordCount') ?? undefined;
    const maxWordCount = searchParams.get('maxWordCount') ?? undefined;
    const isOrphan = searchParams.get('isOrphan') ?? undefined;
    const duplicateGroup = searchParams.get('duplicateGroup') ?? undefined;
    const crawlSessionId = searchParams.get('crawlSessionId') ?? undefined;

    // Determine the crawl session to use
    let effectiveSessionId = crawlSessionId;
    if (!effectiveSessionId) {
      const latestSession = await db.crawlSession.findFirst({
        where: { projectId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { id: true },
      });
      if (!latestSession) {
        return NextResponse.json({
          data: [],
          meta: { page, limit, total: 0, totalPages: 0 },
        });
      }
      effectiveSessionId = latestSession.id;
    }

    // Build where clause
    const where: Prisma.PageWhereInput = {
      projectId,
      crawlSessionId: effectiveSessionId,
      deletedAt: null,
    };

    if (statusCode) {
      where.statusCode = parseInt(statusCode, 10);
    }
    if (indexability) {
      where.indexability = indexability as Prisma.EnumIndexabilityFilter;
    }
    if (contentType) {
      where.contentType = contentType as Prisma.EnumContentTypeFilter;
    }
    if (search) {
      where.OR = [
        { url: { contains: search } },
        { title: { contains: search } },
        { description: { contains: search } },
        { h1: { contains: search } },
      ];
    }
    if (minWordCount) {
      where.wordCount = { ...((where.wordCount as Prisma.IntFilter) ?? {}), gte: parseInt(minWordCount, 10) };
    }
    if (maxWordCount) {
      where.wordCount = { ...((where.wordCount as Prisma.IntFilter) ?? {}), lte: parseInt(maxWordCount, 10) };
    }
    if (isOrphan === 'true') {
      where.isOrphan = true;
    } else if (isOrphan === 'false') {
      where.isOrphan = false;
    }
    if (duplicateGroup) {
      where.duplicateGroup = duplicateGroup;
    }

    // Build order by
    const allowedSortFields = ['url', 'title', 'statusCode', 'wordCount', 'crawlDepth', 'createdAt', 'loadTimeMs'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt';

    const [pages, total] = await Promise.all([
      db.page.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          url: true,
          normalizedUrl: true,
          statusCode: true,
          status: true,
          contentType: true,
          title: true,
          description: true,
          h1: true,
          wordCount: true,
          canonicalUrl: true,
          indexability: true,
          language: true,
          internalLinkCount: true,
          externalLinkCount: true,
          imageCount: true,
          imagesWithoutAlt: true,
          crawlDepth: true,
          isOrphan: true,
          duplicateGroup: true,
          similarityScore: true,
          loadTimeMs: true,
          htmlSizeBytes: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.page.count({ where }),
    ]);

    return NextResponse.json({
      data: pages,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        crawlSessionId: effectiveSessionId,
      },
    });
  } catch (error) {
    console.error('List pages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
