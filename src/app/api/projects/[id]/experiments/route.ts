import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { createExperiment, listExperiments } from '@/lib/experiments';
import type { ExperimentData, ExperimentFilters } from '@/lib/experiments';

// GET /api/projects/[id]/experiments — List experiments
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
    const status = searchParams.get('status') ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));

    const filters: ExperimentFilters = { limit, offset };
    if (status) filters.status = status as ExperimentFilters['status'];

    const { experiments, total } = await listExperiments(projectId, filters);

    return NextResponse.json({
      data: experiments,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error('List experiments error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/experiments — Create experiment
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
    const { name, description, hypothesis, testGroupName, controlGroupName,
            testGroupSize, controlGroupSize, kpiName, kpiBaseline, kpiTarget,
            startDate, endDate } = body as Partial<ExperimentData>;

    if (!name || !hypothesis || !kpiName) {
      return NextResponse.json(
        { error: 'name, hypothesis en kpiName zijn vereist' },
        { status: 400 }
      );
    }

    const data: ExperimentData = {
      name,
      hypothesis,
      kpiName,
    };

    if (description) data.description = description;
    if (testGroupName) data.testGroupName = testGroupName;
    if (controlGroupName) data.controlGroupName = controlGroupName;
    if (testGroupSize !== undefined) data.testGroupSize = testGroupSize;
    if (controlGroupSize !== undefined) data.controlGroupSize = controlGroupSize;
    if (kpiBaseline !== undefined) data.kpiBaseline = kpiBaseline;
    if (kpiTarget !== undefined) data.kpiTarget = kpiTarget;
    if (startDate) data.startDate = new Date(startDate);
    if (endDate) data.endDate = new Date(endDate);

    const experiment = await createExperiment(projectId, data);

    return NextResponse.json({ data: experiment }, { status: 201 });
  } catch (error) {
    console.error('Create experiment error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
