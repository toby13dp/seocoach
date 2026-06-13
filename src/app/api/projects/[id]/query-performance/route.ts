import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getTopQueries } from '@/lib/analytics';

// GET /api/projects/[id]/query-performance — List top queries with filters
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
    const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0];
    const startDateParam = searchParams.get('startDate');
    const startDate = startDateParam ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const device = searchParams.get('device') ?? undefined;
    const country = searchParams.get('country') ?? undefined;
    const sortBy = searchParams.get('sortBy') ?? 'clicks';
    const minClicks = searchParams.get('minClicks') ? parseInt(searchParams.get('minClicks')!, 10) : undefined;

    const queries = await getTopQueries(
      projectId,
      startDate,
      endDate,
      limit
    );

    // Apply additional filters
    let filtered = queries;

    if (device) {
      filtered = filtered.filter((q) => q.device === device);
    }
    if (country) {
      filtered = filtered.filter((q) => q.country === country);
    }
    if (minClicks !== undefined) {
      filtered = filtered.filter((q) => q.clicks >= minClicks);
    }

    // Apply sorting
    const allowedSortFields = ['clicks', 'impressions', 'ctr', 'position'] as const;
    const sortField = allowedSortFields.includes(sortBy as typeof allowedSortFields[number])
      ? (sortBy as keyof (typeof filtered)[number])
      : 'clicks';

    filtered.sort((a, b) => {
      const aVal = a[sortField] as number;
      const bVal = b[sortField] as number;
      // For position, lower is better so sort ascending
      if (sortField === 'position') return aVal - bVal;
      return bVal - aVal;
    });

    return NextResponse.json({
      data: filtered,
      meta: {
        total: filtered.length,
        startDate,
        endDate,
        limit,
        sortBy: sortField,
      },
    });
  } catch (error) {
    console.error('Get query performance error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
