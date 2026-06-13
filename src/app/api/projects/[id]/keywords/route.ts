import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

// GET /api/projects/[id]/keywords — List keywords for a project
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
    const search = searchParams.get('search') ?? undefined;
    const searchIntent = searchParams.get('searchIntent') ?? undefined;
    const funnelStage = searchParams.get('funnelStage') ?? undefined;
    const groupId = searchParams.get('groupId') ?? undefined;
    const sort = searchParams.get('sort') ?? 'createdAt';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const minVolume = searchParams.get('minVolume') ?? undefined;
    const maxDifficulty = searchParams.get('maxDifficulty') ?? undefined;

    // Build where clause
    const where: Prisma.KeywordWhereInput = {
      projectId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { keyword: { contains: search } },
        { notes: { contains: search } },
      ];
    }
    if (searchIntent) {
      where.searchIntent = searchIntent as Prisma.EnumSearchIntentFilter;
    }
    if (funnelStage) {
      where.funnelStage = funnelStage as Prisma.EnumFunnelStageFilter;
    }
    if (groupId) {
      where.groupId = groupId;
    }
    if (minVolume) {
      where.searchVolume = { ...((where.searchVolume as Prisma.IntNullableFilter) ?? {}), gte: parseInt(minVolume, 10) };
    }
    if (maxDifficulty) {
      where.difficulty = { ...((where.difficulty as Prisma.FloatNullableFilter) ?? {}), lte: parseFloat(maxDifficulty) };
    }

    // Build order by
    const allowedSortFields = ['keyword', 'searchVolume', 'difficulty', 'cpc', 'currentRanking', 'createdAt', 'updatedAt'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt';

    const [keywords, total] = await Promise.all([
      db.keyword.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          opportunity: {
            select: {
              totalScore: true,
              volumeScore: true,
              difficultyScore: true,
              relevanceScore: true,
              currentRankScore: true,
              intentScore: true,
              funnelScore: true,
              competitionScore: true,
              calculatedAt: true,
            },
          },
        },
      }),
      db.keyword.count({ where }),
    ]);

    return NextResponse.json({
      data: keywords,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List keywords error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/keywords — Add keywords (manual or bulk)
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

    // Support single keyword or bulk array
    const keywordsInput = Array.isArray(body) ? body : [body];

    if (keywordsInput.length === 0) {
      return NextResponse.json(
        { error: 'At least one keyword is required' },
        { status: 400 }
      );
    }

    if (keywordsInput.length > 1000) {
      return NextResponse.json(
        { error: 'Maximum 1000 keywords per request' },
        { status: 400 }
      );
    }

    const created: Array<{ id: string; keyword: string }> = [];
    const errors: Array<{ keyword: string; error: string }> = [];

    for (const kw of keywordsInput) {
      const keywordText = typeof kw === 'string' ? kw : kw.keyword;

      if (!keywordText || typeof keywordText !== 'string' || keywordText.trim().length === 0) {
        errors.push({ keyword: String(keywordText), error: 'Keyword text is required' });
        continue;
      }

      const trimmed = keywordText.trim();

      try {
        const keywordData: Prisma.KeywordCreateInput = {
          keyword: trimmed,
          project: { connect: { id: projectId } },
          source: 'manual',
        };

        // Map optional fields from the input
        const input = typeof kw === 'object' ? kw : {};
        if (input.searchIntent) keywordData.searchIntent = input.searchIntent as never;
        if (input.funnelStage) keywordData.funnelStage = input.funnelStage as never;
        if (input.searchVolume !== undefined) keywordData.searchVolume = parseInt(input.searchVolume, 10) || null;
        if (input.difficulty !== undefined) keywordData.difficulty = parseFloat(input.difficulty) || null;
        if (input.cpc !== undefined) keywordData.cpc = parseFloat(input.cpc) || null;
        if (input.currentRanking !== undefined) keywordData.currentRanking = parseInt(input.currentRanking, 10) || null;
        if (input.currentUrl) keywordData.currentUrl = input.currentUrl;
        if (input.groupId) keywordData.groupId = input.groupId;
        if (input.tags) keywordData.tags = JSON.stringify(Array.isArray(input.tags) ? input.tags : [input.tags]);
        if (input.notes) keywordData.notes = input.notes;

        const record = await db.keyword.create({
          data: keywordData,
          select: { id: true, keyword: true },
        });
        created.push(record);
      } catch (createError) {
        // Handle duplicate keywords gracefully
        const errorMsg = createError instanceof Error ? createError.message : 'Failed to create keyword';
        errors.push({ keyword: trimmed, error: errorMsg });
      }
    }

    return NextResponse.json(
      {
        data: {
          created,
          errors,
          createdCount: created.length,
          errorCount: errors.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create keywords error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
