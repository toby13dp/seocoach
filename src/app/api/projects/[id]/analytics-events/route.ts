import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/analytics-events — List analytics events with filters
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
    const eventType = searchParams.get('eventType') ?? undefined;
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;
    const sessionId = searchParams.get('sessionId') ?? undefined;
    const pageUrl = searchParams.get('pageUrl') ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));

    const where: Record<string, unknown> = { projectId };

    if (eventType) where.eventType = eventType;
    if (sessionId) where.sessionId = sessionId;
    if (pageUrl) where.pageUrl = pageUrl;

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      where.createdAt = createdAt;
    }

    const [events, total] = await Promise.all([
      db.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.analyticsEvent.count({ where }),
    ]);

    return NextResponse.json({
      data: events,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error('List analytics events error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
