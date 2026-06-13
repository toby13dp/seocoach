import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/keywords/[keywordId] — Get keyword details with opportunity score
export async function GET(
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
      include: {
        opportunity: true,
        keywordPages: {
          include: {
            page: {
              select: {
                id: true,
                url: true,
                title: true,
              },
            },
          },
        },
        topicKeywords: {
          include: {
            topic: {
              select: {
                id: true,
                name: true,
                isPillar: true,
              },
            },
          },
        },
      },
    });

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    // Parse JSON fields
    const result = {
      ...keyword,
      tags: keyword.tags ? JSON.parse(keyword.tags) : [],
      seasonality: keyword.seasonality ? JSON.parse(keyword.seasonality) : null,
    };

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Get keyword error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/keywords/[keywordId] — Update keyword
export async function PATCH(
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
    const updateData: Record<string, unknown> = {};

    if (body.searchIntent !== undefined) updateData.searchIntent = body.searchIntent;
    if (body.funnelStage !== undefined) updateData.funnelStage = body.funnelStage;
    if (body.searchVolume !== undefined) updateData.searchVolume = body.searchVolume;
    if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;
    if (body.cpc !== undefined) updateData.cpc = body.cpc;
    if (body.currentRanking !== undefined) updateData.currentRanking = body.currentRanking;
    if (body.currentUrl !== undefined) updateData.currentUrl = body.currentUrl;
    if (body.groupId !== undefined) updateData.groupId = body.groupId;
    if (body.personaMapping !== undefined) updateData.personaMapping = body.personaMapping;
    if (body.productMapping !== undefined) updateData.productMapping = body.productMapping;
    if (body.serviceMapping !== undefined) updateData.serviceMapping = body.serviceMapping;
    if (body.locationMapping !== undefined) updateData.locationMapping = body.locationMapping;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.tags !== undefined) {
      updateData.tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : null;
    }

    const updated = await db.keyword.update({
      where: { id: keywordId },
      data: updateData,
      include: { opportunity: true },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update keyword error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/keywords/[keywordId] — Soft delete keyword
export async function DELETE(
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

    await db.keyword.update({
      where: { id: keywordId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ data: { id: keywordId, deleted: true } });
  } catch (error) {
    console.error('Delete keyword error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
