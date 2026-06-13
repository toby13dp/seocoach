import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getTrends, recordTrend, importInternalSearch } from '@/lib/trends';

// GET /api/projects/[id]/trends — List trends
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('sourceType') ?? undefined;
    const trendDirection = searchParams.get('trendDirection') ?? undefined;
    const keyword = searchParams.get('keyword') ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));

    const result = await getTrends(projectId, {
      sourceType,
      trendDirection,
      keyword,
      limit,
      offset,
    });

    return NextResponse.json({
      data: result.trends,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  } catch (error) {
    console.error('List trends error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/trends — Record a trend or import internal search
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();

    // Check if this is a bulk import of internal search queries
    if (body.queries && Array.isArray(body.queries)) {
      const result = await importInternalSearch(projectId, body);
      return NextResponse.json({
        data: result,
        meta: { importedCount: result.count },
      }, { status: 201 });
    }

    // Single trend record
    const { sourceType, sourceId, keyword, topic, trendDirection, magnitude, description, evidence, observedAt, expiresAt } = body;

    if (!sourceType || !trendDirection || !description) {
      return NextResponse.json({ error: 'sourceType, trendDirection en description zijn vereist' }, { status: 400 });
    }

    const trend = await recordTrend(projectId, {
      sourceType,
      sourceId,
      keyword,
      topic,
      trendDirection,
      magnitude,
      description,
      evidence,
      observedAt,
      expiresAt,
    });

    return NextResponse.json({ data: trend }, { status: 201 });
  } catch (error) {
    console.error('Record trend error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
