import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { exportMetricsToCSV, exportDashboardToCSV } from '@/lib/analytics';
import type { MetricFilters } from '@/lib/analytics';

// GET /api/projects/[id]/metrics/export — Export metrics as CSV
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
    const format = searchParams.get('format') ?? 'csv';
    const source = searchParams.get('source') ?? undefined;
    const device = searchParams.get('device') ?? undefined;
    const country = searchParams.get('country') ?? undefined;
    const landingPage = searchParams.get('landingPage') ?? undefined;

    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Alleen CSV-formaat wordt ondersteund.' },
        { status: 400 }
      );
    }

    let csvContent: string;

    if (startDate && endDate) {
      const filters: MetricFilters = {};
      if (source) filters.source = source;
      if (device) filters.device = device;
      if (country) filters.country = country;
      if (landingPage) filters.landingPage = landingPage;

      csvContent = await exportMetricsToCSV(
        projectId,
        metric,
        startDate,
        endDate,
        Object.keys(filters).length > 0 ? filters : undefined
      );
    } else {
      // Export dashboard data when no specific date range provided
      csvContent = await exportDashboardToCSV(projectId, 30);
    }

    if (!csvContent) {
      return NextResponse.json(
        { error: 'Geen gegevens beschikbaar voor export.' },
        { status: 404 }
      );
    }

    // Return as downloadable CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="seo-${metric}-${startDate ?? 'dashboard'}-${endDate ?? 'export'}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export metrics error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
