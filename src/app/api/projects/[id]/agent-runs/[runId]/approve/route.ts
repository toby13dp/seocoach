import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { approveAgentActions, rejectAgentActions, getAgentRunDetails } from '@/lib/agent-framework';

// POST /api/projects/[id]/agent-runs/[runId]/approve — Approve or reject agent actions
export async function POST(
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

    // Verify the run exists and belongs to this project
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

    // Only runs awaiting approval can be approved or rejected
    if (run.status !== 'AWAITING_APPROVAL') {
      return NextResponse.json(
        { error: 'Deze agent-run wacht niet op goedkeuring' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, actionIndices, reason } = body;

    // Validate action
    if (!action || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json(
        { error: 'Actie moet "approve" of "reject" zijn' },
        { status: 400 }
      );
    }

    // Validate actionIndices if provided
    if (actionIndices !== undefined) {
      if (!Array.isArray(actionIndices) || !actionIndices.every((i: unknown) => typeof i === 'number' && i >= 0)) {
        return NextResponse.json(
          { error: 'ActionIndices moet een array van niet-negatieve getallen zijn' },
          { status: 400 }
        );
      }
    }

    // Validate reason for rejection
    if (action === 'reject' && (!reason || typeof reason !== 'string' || reason.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Een reden is vereist bij afwijzing van acties' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      await approveAgentActions(
        runId,
        user.id,
        actionIndices as number[] | undefined
      );

      return NextResponse.json({
        data: {
          runId,
          action: 'approved',
          actionIndices: actionIndices ?? 'all',
        },
        message: actionIndices
          ? `Geselecteerde acties (${actionIndices.join(', ')}) goedgekeurd`
          : 'Alle voorgestelde acties goedgekeurd',
      });
    } else {
      await rejectAgentActions(
        runId,
        user.id,
        reason.trim()
      );

      return NextResponse.json({
        data: {
          runId,
          action: 'rejected',
          reason: reason.trim(),
        },
        message: 'Voorgestelde acties afgewezen',
      });
    }
  } catch (error) {
    console.error('Approve/reject agent actions error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
