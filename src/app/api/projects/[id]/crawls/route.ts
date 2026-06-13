import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { startCrawl } from '@/lib/crawler';
import { analyzeCrawlSession } from '@/lib/rules';

// GET /api/projects/[id]/crawls — List crawl sessions for a project
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
    const status = searchParams.get('status') ?? undefined;

    const where: Record<string, unknown> = { projectId };
    if (status) where.status = status;

    const [crawls, total] = await Promise.all([
      db.crawlSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          startUrl: true,
          maxPages: true,
          maxDepth: true,
          pagesCrawled: true,
          pagesFound: true,
          issuesFound: true,
          errorCount: true,
          errorMessage: true,
          startedAt: true,
          completedAt: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.crawlSession.count({ where }),
    ]);

    return NextResponse.json({
      data: crawls,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List crawls error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/crawls — Start a new crawl
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
    const {
      startUrl,
      maxPages = 500,
      maxDepth = 10,
      crawlDelayMs = 1000,
      respectRobotsTxt = true,
      followRedirects = true,
      includeSubdomains = false,
      useRendering = false,
    } = body;

    if (!startUrl || typeof startUrl !== 'string') {
      return NextResponse.json(
        { error: 'startUrl is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(startUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid startUrl format' },
        { status: 400 }
      );
    }

    // Create a Job record for tracking
    const job = await db.job.create({
      data: {
        projectId,
        type: 'crawl',
        status: 'PENDING',
        tenantId: access.project.organizationId,
        userId: user.id,
        maxProgress: maxPages,
      },
    });

    // Create the crawl session and crawler instance
    const { crawlSessionId, crawler } = await startCrawl(
      {
        startUrl,
        maxPages,
        maxDepth,
        crawlDelayMs,
        respectRobotsTxt,
        followRedirects,
        includeSubdomains,
        useRendering,
      },
      projectId
    );

    // Update the job with the crawl session reference
    await db.job.update({
      where: { id: job.id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        result: JSON.stringify({ crawlSessionId }),
      },
    });

    // Start the crawl in the background (don't await)
    const crawlPromise = (async () => {
      try {
        await crawler.start();

        // After crawl completes, run rule analysis
        try {
          await analyzeCrawlSession(crawlSessionId);
        } catch (analysisError) {
          console.error('Rule analysis error after crawl:', analysisError);
        }

        // Update job status
        await db.job.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      } catch (crawlError) {
        console.error('Crawl error:', crawlError);
        await db.job.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: crawlError instanceof Error ? crawlError.message : 'Crawl failed',
            completedAt: new Date(),
          },
        });
      }
    })();

    // Prevent unhandled rejection
    crawlPromise.catch(() => {});

    return NextResponse.json(
      {
        data: {
          crawlSessionId,
          jobId: job.id,
          status: 'PENDING',
          startUrl,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Start crawl error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
