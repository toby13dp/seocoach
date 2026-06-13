import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { createBrief, listBriefs } from '@/lib/content';

// GET /api/projects/[id]/briefs — List content briefs
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
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));
    const approvalStatus = searchParams.get('approvalStatus') ?? undefined;
    const searchIntent = searchParams.get('searchIntent') ?? undefined;
    const funnelStage = searchParams.get('funnelStage') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const sortBy = (searchParams.get('sortBy') as 'title' | 'createdAt' | 'updatedAt') ?? 'createdAt';
    const sortDirection = (searchParams.get('sortDirection') as 'asc' | 'desc') ?? 'desc';

    const result = await listBriefs(projectId, {
      page,
      pageSize,
      approvalStatus,
      searchIntent,
      funnelStage,
      search,
      sortBy,
      sortDirection,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('List briefs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/briefs — Create a content brief
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

    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { error: 'Brief title is required' },
        { status: 400 }
      );
    }

    const brief = await createBrief(projectId, {
      title: body.title,
      targetKeyword: body.targetKeyword,
      secondaryKeywords: body.secondaryKeywords,
      searchIntent: body.searchIntent,
      funnelStage: body.funnelStage,
      outline: body.outline,
      sources: body.sources,
      brandProfileUsed: body.brandProfileUsed,
      internalPages: body.internalPages,
      targetWordCount: body.targetWordCount,
      targetAudience: body.targetAudience,
      toneOfVoice: body.toneOfVoice,
    });

    return NextResponse.json({ data: brief }, { status: 201 });
  } catch (error) {
    console.error('Create brief error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
