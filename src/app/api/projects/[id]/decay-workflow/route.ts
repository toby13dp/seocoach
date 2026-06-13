import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/decay-workflow — View declining pages
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
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));
    const pruningAction = searchParams.get('pruningAction') ?? undefined;
    const minDecay = searchParams.get('minDecay') ?? undefined;

    const where: Record<string, unknown> = { projectId };
    if (pruningAction) where.pruningAction = pruningAction;
    if (minDecay) where.decayPercentage = { gte: parseFloat(minDecay) };

    const [total, decayRecords] = await Promise.all([
      db.contentDecay.count({ where }),
      db.contentDecay.findMany({
        where,
        orderBy: { decayPercentage: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Compute summary statistics
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
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        summary: {
          actionCounts,
          averageDecay: Math.round(avgDecay * 10) / 10,
        },
      },
    });
  } catch (error) {
    console.error('List decay workflow error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
