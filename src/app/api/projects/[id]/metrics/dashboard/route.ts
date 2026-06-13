import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getDashboardData } from '@/lib/analytics';

// GET /api/projects/[id]/metrics/dashboard — Get full dashboard data
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
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') ?? '30', 10)));

    const dashboard = await getDashboardData(projectId, days);

    return NextResponse.json({ data: dashboard });
  } catch (error) {
    console.error('Get dashboard error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
