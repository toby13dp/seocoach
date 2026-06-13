import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getChangeHistory } from '@/lib/content/change-history';
import type { ChangeType } from '@/lib/content/change-history';

// GET /api/projects/[id]/content-changes — List changes with filters
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
    const briefId = searchParams.get('briefId') ?? undefined;
    const pageId = searchParams.get('pageId') ?? undefined;
    const changeType = searchParams.get('changeType') as ChangeType | null;
    const userId = searchParams.get('userId') ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const result = await getChangeHistory(projectId, {
      briefId,
      pageId,
      changeType: changeType ?? undefined,
      userId,
      page,
      pageSize,
      dateRange: dateFrom && dateTo
        ? { from: new Date(dateFrom), to: new Date(dateTo) }
        : undefined,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('List content changes error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
