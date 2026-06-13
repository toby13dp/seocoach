import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getAgentRunDetails, cancelAgentRun } from '@/lib/agent-framework';

// GET /api/projects/[id]/agent-runs/[runId] — Get agent run details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, runId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 });
    }

    const run = await getAgentRunDetails(runId);

    if (!run || run.projectId !== projectId || run.deletedAt) {
      return NextResponse.json(
        { error: 'Agent-run niet gevonden' },
        { status: 404 }
      );
    }

    // Verify the run belongs to the user's organization
    if (run.organizationId !== access.project.organizationId) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    return NextResponse.json({ data: run });
  } catch (error) {
    console.error('Get agent run details error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/agent-runs/[runId] — Cancel agent run
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, runId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 });
    }

    const run = await getAgentRunDetails(runId);

    if (!run || run.projectId !== projectId || run.deletedAt) {
      return NextResponse.json(
        { error: 'Agent-run niet gevonden' },
        { status: 404 }
      );
    }

    // Verify the run belongs to the user's organization
    if (run.organizationId !== access.project.organizationId) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    // Only pending or running runs can be cancelled
    if (run.status !== 'PENDING' && run.status !== 'RUNNING' && run.status !== 'AWAITING_APPROVAL') {
      return NextResponse.json(
        { error: 'Alleen runs in afwachting, actief of wachtend op goedkeuring kunnen worden geannuleerd' },
        { status: 400 }
      );
    }

    await cancelAgentRun(runId);

    return NextResponse.json({
      data: { runId, status: 'CANCELLED' },
      message: 'Agent-run is geannuleerd',
    });
  } catch (error) {
    console.error('Cancel agent run error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
