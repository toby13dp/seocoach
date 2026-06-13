import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { classifyIntent, classifyIntentWithAI } from '@/lib/keywords';

// POST /api/projects/[id]/keywords/[keywordId]/classify — Classify search intent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; keywordId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, keywordId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const keyword = await db.keyword.findFirst({
      where: { id: keywordId, projectId, deletedAt: null },
    });

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    const body = await request.json();
    const useAI = body.useAI === true;

    let result;

    if (useAI) {
      result = await classifyIntentWithAI(keyword.keyword, projectId);
    } else {
      result = classifyIntent(keyword.keyword);
    }

    // Update the keyword with the classification
    await db.keyword.update({
      where: { id: keywordId },
      data: {
        searchIntent: result.intent as never,
        funnelStage: result.funnelStage as never,
      },
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Classify keyword error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
