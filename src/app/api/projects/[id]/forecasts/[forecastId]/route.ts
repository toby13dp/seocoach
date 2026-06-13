import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getForecast, deleteForecast } from '@/lib/forecasting';

// GET /api/projects/[id]/forecasts/[forecastId] — Get forecast details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; forecastId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, forecastId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const forecast = await getForecast(forecastId, projectId);

    if (!forecast) {
      return NextResponse.json(
        { error: 'Prognose niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: forecast });
  } catch (error) {
    console.error('Get forecast error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/forecasts/[forecastId] — Delete forecast
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; forecastId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, forecastId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const deleted = await deleteForecast(forecastId, projectId);

    return NextResponse.json({ data: deleted });
  } catch (error) {
    console.error('Delete forecast error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
