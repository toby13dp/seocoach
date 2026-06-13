import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { calculateAndSaveOpportunityScore, getScoreTrace } from '@/lib/keywords';
import { db } from '@/lib/db';

// POST /api/projects/[id]/keywords/[keywordId]/score — Calculate/recalculate opportunity score
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

    // Calculate and save the opportunity score
    const score = await calculateAndSaveOpportunityScore(keywordId, projectId);

    // Get the detailed calculation trace
    const details = await getScoreTrace(keywordId);

    return NextResponse.json({
      data: {
        score,
        details,
      },
    });
  } catch (error) {
    console.error('Score keyword error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
