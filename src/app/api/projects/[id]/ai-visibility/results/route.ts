import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getResults, createManualTest, calculateSummary } from '@/lib/ai-visibility';

// GET /api/projects/[id]/ai-visibility/results — List results with filters
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
    const method = searchParams.get('method') ?? undefined;
    const platform = searchParams.get('platform') ?? undefined;
    const isMentionedStr = searchParams.get('isMentioned');
    const isMentioned = isMentionedStr !== null ? isMentionedStr === 'true' : undefined;
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));

    const result = await getResults(projectId, {
      method,
      platform,
      isMentioned,
      startDate,
      endDate,
      limit,
      offset,
    });

    return NextResponse.json({
      data: result.results,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  } catch (error) {
    console.error('List AI visibility results error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/ai-visibility/results — Create manual test result
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
    const {
      promptId,
      platform,
      model,
      promptText,
      response,
      isMentioned,
      mentionedUrls,
      mentionedSources,
      competitorMentions,
      sentiment,
      accuracy,
      confidence,
      country,
      language,
    } = body;

    if (!promptText) {
      return NextResponse.json({ error: 'promptText is vereist' }, { status: 400 });
    }

    const result = await createManualTest(projectId, {
      promptId,
      platform,
      model,
      promptText,
      response,
      isMentioned: isMentioned ?? false,
      mentionedUrls,
      mentionedSources,
      competitorMentions,
      sentiment,
      accuracy,
      confidence,
      country,
      language,
    });

    // Recalculate summary
    await calculateSummary(projectId);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error('Create AI visibility result error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
