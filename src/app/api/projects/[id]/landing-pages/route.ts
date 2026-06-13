import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getTopLandingPages } from '@/lib/analytics';

// GET /api/projects/[id]/landing-pages — List top landing pages
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

    const pages = await getTopLandingPages(
      projectId,
      startDate,
      endDate,
      limit
    );

    // Apply additional filters — landing pages may not have device/country,
    // but we include the parameters for forward compatibility
    let filtered = pages;

    // These filters are informational placeholders since landing page
    // performance data typically comes aggregated; when segmentation
    // becomes available, these will filter properly.
    void device;
    void country;

    return NextResponse.json({
      data: filtered,
      meta: {
        total: filtered.length,
        startDate,
        endDate,
        limit,
      },
    });
  } catch (error) {
    console.error('Get landing pages error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
