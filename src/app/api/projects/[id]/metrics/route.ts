import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { calculateTimeSeries } from '@/lib/analytics';
import type { MetricFilters } from '@/lib/analytics';

// GET /api/projects/[id]/metrics — Get metrics for a project
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
    const metric = searchParams.get('metric') ?? 'clicks';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source') ?? undefined;
    const device = searchParams.get('device') ?? undefined;
    const country = searchParams.get('country') ?? undefined;
    const landingPage = searchParams.get('landingPage') ?? undefined;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate en endDate zijn vereiste parameters (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: 'Ongeldig datumformaat. Gebruik YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const filters: MetricFilters = {};
    if (source) filters.source = source;
    if (device) filters.device = device;
    if (country) filters.country = country;
    if (landingPage) filters.landingPage = landingPage;

    const timeSeries = await calculateTimeSeries(
      projectId,
      metric,
      startDate,
      endDate,
      Object.keys(filters).length > 0 ? filters : undefined
    );

    return NextResponse.json({ data: timeSeries });
  } catch (error) {
    console.error('Get metrics error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
