import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getRoadmapItems, getRoadmapStats, refreshRoadmap } from '@/lib/roadmap';
import type { RoadmapFilters } from '@/lib/roadmap';

// GET /api/projects/[id]/roadmap — List roadmap items
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
    const view = searchParams.get('view') ?? undefined;
    const type = searchParams.get('type') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const priority = searchParams.get('priority') ?? undefined;
    const assignedTo = searchParams.get('assignedTo') ?? undefined;

    const filters: RoadmapFilters = {};
    if (view) filters.view = view as RoadmapFilters['view'];
    if (type) filters.type = type as RoadmapFilters['type'];
    if (status) filters.status = status as RoadmapFilters['status'];
    if (priority) filters.priority = priority as RoadmapFilters['priority'];
    if (assignedTo) filters.assignedTo = assignedTo;

    const [items, stats] = await Promise.all([
      getRoadmapItems(projectId, Object.keys(filters).length > 0 ? filters : undefined),
      getRoadmapStats(projectId),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        total: items.length,
        stats,
      },
    });
  } catch (error) {
    console.error('List roadmap items error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/roadmap — Refresh roadmap
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

    const recommendations = await refreshRoadmap(projectId);
    const stats = await getRoadmapStats(projectId);

    return NextResponse.json({
      data: {
        refreshed: true,
        itemCount: recommendations.length,
      },
      meta: {
        stats,
      },
    });
  } catch (error) {
    console.error('Refresh roadmap error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
