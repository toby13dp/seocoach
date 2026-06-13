import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getProjectBenchmarks, runProjectBenchmark } from '@/lib/benchmarking';
import type { BenchmarkInput } from '@/lib/benchmarking';

// GET /api/projects/[id]/benchmarks — Get benchmark scores for project
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
    const periodStartParam = searchParams.get('periodStart');
    const periodEndParam = searchParams.get('periodEnd');

    const periodStart = periodStartParam ? new Date(periodStartParam) : undefined;
    const periodEnd = periodEndParam ? new Date(periodEndParam) : undefined;

    const benchmarks = await getProjectBenchmarks(projectId, periodStart, periodEnd);

    return NextResponse.json({ data: benchmarks });
  } catch (error) {
    console.error('Get benchmarks error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/benchmarks — Run benchmark calculation
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
    const { inputs, periodStart, periodEnd } = body as {
      inputs: BenchmarkInput[];
      periodStart: string;
      periodEnd: string;
    };

    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      return NextResponse.json(
        { error: 'Invoergegevens (inputs) zijn vereist' },
        { status: 400 }
      );
    }

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Periode (periodStart en periodEnd) is vereist' },
        { status: 400 }
      );
    }

    const parsedStart = new Date(periodStart);
    const parsedEnd = new Date(periodEnd);

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return NextResponse.json(
        { error: 'Ongeldige periode opgegeven' },
        { status: 400 }
      );
    }

    if (parsedStart >= parsedEnd) {
      return NextResponse.json(
        { error: 'De startdatum moet voor de einddatum liggen' },
        { status: 400 }
      );
    }

    const organizationId = access.project.organizationId;
    const scores = await runProjectBenchmark(
      organizationId,
      projectId,
      inputs,
      parsedStart,
      parsedEnd
    );

    return NextResponse.json({ data: scores }, { status: 201 });
  } catch (error) {
    console.error('Run benchmark error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
