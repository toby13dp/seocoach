import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getProjectAgentRuns, createAgentRun, ALL_AGENT_TYPES } from '@/lib/agent-framework';
import type { AgentType, AgentRunStatus } from '@prisma/client';

// GET /api/projects/[id]/agent-runs — List agent runs for project
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
      return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const agentType = searchParams.get('agentType') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));

    // Validate agentType if provided
    if (agentType && !ALL_AGENT_TYPES.includes(agentType as AgentType)) {
      return NextResponse.json(
        { error: `Ongeldig agenttype: "${agentType}"` },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses: AgentRunStatus[] = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'AWAITING_APPROVAL'];
    if (status && !validStatuses.includes(status as AgentRunStatus)) {
      return NextResponse.json(
        { error: `Ongeldige status: "${status}"` },
        { status: 400 }
      );
    }

    const runs = await getProjectAgentRuns(projectId, {
      agentType: agentType as AgentType | undefined,
      status: status as AgentRunStatus | undefined,
      limit,
    });

    return NextResponse.json({
      data: runs,
      meta: { total: runs.length, limit },
    });
  } catch (error) {
    console.error('List agent runs error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/agent-runs — Create agent run
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
      return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 });
    }

    const body = await request.json();
    const { agentType, objective, model, maxSteps, inputs } = body;

    // Validate required fields
    if (!agentType || typeof agentType !== 'string') {
      return NextResponse.json(
        { error: 'Agenttype is vereist' },
        { status: 400 }
      );
    }

    if (!ALL_AGENT_TYPES.includes(agentType as AgentType)) {
      return NextResponse.json(
        { error: `Ongeldig agenttype: "${agentType}". Beschikbare types: ${ALL_AGENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!objective || typeof objective !== 'string' || objective.trim().length === 0) {
      return NextResponse.json(
        { error: 'Doelstelling is vereist voor een agent-run' },
        { status: 400 }
      );
    }

    if (objective.length > 2000) {
      return NextResponse.json(
        { error: 'Doelstelling mag maximaal 2000 tekens bevatten' },
        { status: 400 }
      );
    }

    if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
      return NextResponse.json(
        { error: 'Inputs moeten een object zijn' },
        { status: 400 }
      );
    }

    // Validate optional fields
    if (model !== undefined && typeof model !== 'string') {
      return NextResponse.json(
        { error: 'Model moet een tekenreeks zijn' },
        { status: 400 }
      );
    }

    if (maxSteps !== undefined && (typeof maxSteps !== 'number' || maxSteps < 1 || maxSteps > 50)) {
      return NextResponse.json(
        { error: 'MaxSteps moet een getal tussen 1 en 50 zijn' },
        { status: 400 }
      );
    }

    try {
      const run = await createAgentRun({
        organizationId: access.project.organizationId,
        projectId,
        agentType: agentType as AgentType,
        objective: objective.trim(),
        model,
        maxSteps,
        inputs,
      });

      return NextResponse.json({ data: run }, { status: 201 });
    } catch (err) {
      // Handle known business errors from createAgentRun
      const message = err instanceof Error ? err.message : 'Onbekende fout';
      if (message.includes('Te veel actieve agent-runs')) {
        return NextResponse.json({ error: message }, { status: 429 });
      }
      throw err;
    }
  } catch (error) {
    console.error('Create agent run error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
