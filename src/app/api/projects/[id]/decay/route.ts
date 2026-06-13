import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { detectDecay } from '@/lib/content';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

// GET /api/projects/[id]/decay — List content decay for a project
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
    const pruningAction = searchParams.get('pruningAction') ?? undefined;
    const minDecay = searchParams.get('minDecay') ?? undefined;

    const where: Prisma.ContentDecayWhereInput = { projectId };

    if (pruningAction) {
      where.pruningAction = pruningAction as Prisma.EnumPruningActionFilter;
    }
    if (minDecay) {
      where.decayPercentage = { gte: parseFloat(minDecay) };
    }

    const [decayRecords, total] = await Promise.all([
      db.contentDecay.findMany({
        where,
        orderBy: { decayPercentage: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.contentDecay.count({ where }),
    ]);

    // Compute summary
    const allDecay = await db.contentDecay.findMany({
      where: { projectId },
      select: { pruningAction: true, decayPercentage: true },
    });

    const actionCounts: Record<string, number> = {};
    let totalDecay = 0;
    for (const d of allDecay) {
      actionCounts[d.pruningAction] = (actionCounts[d.pruningAction] ?? 0) + 1;
      totalDecay += d.decayPercentage;
    }
    const avgDecay = allDecay.length > 0 ? totalDecay / allDecay.length : 0;

    return NextResponse.json({
      data: decayRecords,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        summary: {
          actionCounts,
          averageDecay: Math.round(avgDecay * 10) / 10,
        },
      },
    });
  } catch (error) {
    console.error('List decay error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/decay — Run decay detection
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

    const results = await detectDecay(projectId);

    return NextResponse.json({
      data: {
        detected: results.length,
        results,
      },
    });
  } catch (error) {
    console.error('Detect decay error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
