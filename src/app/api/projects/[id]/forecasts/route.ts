import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { generateForecast, getForecasts } from '@/lib/forecasting';
import type { ForecastInput, ForecastFilters, ForecastScenario } from '@/lib/forecasting';

// GET /api/projects/[id]/forecasts — List forecasts
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
    const scenario = searchParams.get('scenario') ?? undefined;

    const filters: ForecastFilters = {};
    if (scenario) filters.scenario = scenario as ForecastFilters['scenario'];

    const forecasts = await getForecasts(projectId, filters);

    return NextResponse.json({
      data: forecasts,
      meta: { total: forecasts.length },
    });
  } catch (error) {
    console.error('List forecasts error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/forecasts — Generate a new forecast
export async function POST(
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

    const body = await request.json();
    const { scenario, inputs } = body as {
      scenario?: string;
      inputs?: ForecastInput;
    };

    if (!scenario) {
      return NextResponse.json(
        { error: 'scenario is vereist (CONSERVATIVE, REALISTIC of AMBITIOUS)' },
        { status: 400 }
      );
    }

    const validScenarios = ['CONSERVATIVE', 'REALISTIC', 'AMBITIOUS'];
    if (!validScenarios.includes(scenario)) {
      return NextResponse.json(
        { error: `Ongeldig scenario. Geldige waarden: ${validScenarios.join(', ')}` },
        { status: 400 }
      );
    }

    if (!inputs) {
      return NextResponse.json(
        { error: 'inputs is vereist' },
        { status: 400 }
      );
    }

    // Validate required input fields
    const requiredFields: (keyof ForecastInput)[] = [
      'currentTraffic', 'currentClicks', 'currentConversions',
      'currentRevenue', 'currentCTR', 'avgPosition',
      'contentOutputPerMonth', 'targetMonths',
    ];

    for (const field of requiredFields) {
      if (inputs[field] === undefined || inputs[field] === null) {
        return NextResponse.json(
          { error: `inputs.${field} is vereist` },
          { status: 400 }
        );
      }
    }

    if (inputs.targetMonths < 1 || inputs.targetMonths > 36) {
      return NextResponse.json(
        { error: 'inputs.targetMonths moet tussen 1 en 36 liggen' },
        { status: 400 }
      );
    }

    const forecast = await generateForecast(
      projectId,
      scenario as ForecastScenario,
      inputs
    );

    return NextResponse.json({ data: forecast }, { status: 201 });
  } catch (error) {
    console.error('Generate forecast error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
