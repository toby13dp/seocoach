import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getExperiment, updateExperiment, deleteExperiment } from '@/lib/experiments';
import type { ExperimentData } from '@/lib/experiments';

// GET /api/projects/[id]/experiments/[experimentId] — Get experiment details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; experimentId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, experimentId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const experiment = await getExperiment(experimentId, projectId);

    if (!experiment) {
      return NextResponse.json(
        { error: 'Experiment niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: experiment });
  } catch (error) {
    console.error('Get experiment error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/experiments/[experimentId] — Update experiment (only DRAFT status)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; experimentId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, experimentId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, hypothesis, testGroupName, controlGroupName,
            testGroupSize, controlGroupSize, kpiName, kpiBaseline, kpiTarget,
            startDate, endDate } = body as Partial<ExperimentData>;

    const data: Partial<ExperimentData> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (hypothesis !== undefined) data.hypothesis = hypothesis;
    if (testGroupName !== undefined) data.testGroupName = testGroupName;
    if (controlGroupName !== undefined) data.controlGroupName = controlGroupName;
    if (testGroupSize !== undefined) data.testGroupSize = testGroupSize;
    if (controlGroupSize !== undefined) data.controlGroupSize = controlGroupSize;
    if (kpiName !== undefined) data.kpiName = kpiName;
    if (kpiBaseline !== undefined) data.kpiBaseline = kpiBaseline;
    if (kpiTarget !== undefined) data.kpiTarget = kpiTarget;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);

    const updated = await updateExperiment(experimentId, projectId, data);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update experiment error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/experiments/[experimentId] — Soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; experimentId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, experimentId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const deleted = await deleteExperiment(experimentId, projectId);

    return NextResponse.json({ data: deleted });
  } catch (error) {
    console.error('Delete experiment error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
