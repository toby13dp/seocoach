import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { executeCopilotTool, COPILOT_TOOLS } from '@/lib/copilot';
import type { CopilotTool } from '@/lib/copilot';

// POST /api/projects/[id]/copilot/tools — Execute a copilot tool
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
    const { tool, input } = body;

    // Validate tool
    if (!tool || typeof tool !== 'string') {
      return NextResponse.json(
        { error: 'Toolnaam is vereist' },
        { status: 400 }
      );
    }

    if (!COPILOT_TOOLS.includes(tool as CopilotTool)) {
      return NextResponse.json(
        { error: `Onbekende tool: "${tool}". Beschikbare tools: ${COPILOT_TOOLS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate input
    if (input !== undefined && typeof input !== 'object') {
      return NextResponse.json(
        { error: 'Tool-input moet een object zijn' },
        { status: 400 }
      );
    }

    const result = await executeCopilotTool(
      tool as CopilotTool,
      input ?? {},
      access.project.organizationId,
      projectId,
      user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Tool-uitvoering mislukt', data: result },
        { status: 422 }
      );
    }

    return NextResponse.json({
      data: result,
      meta: {
        tool,
        requiresApproval: result.requiresApproval,
      },
    });
  } catch (error) {
    console.error('Execute copilot tool error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
