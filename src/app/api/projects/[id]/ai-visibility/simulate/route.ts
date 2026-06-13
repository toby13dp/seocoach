import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { runLocalSimulation, calculateSummary } from '@/lib/ai-visibility';

// POST /api/projects/[id]/ai-visibility/simulate — Run local simulation
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
    const { promptId, promptText, platform, model } = body;

    if (!promptText) {
      return NextResponse.json({ error: 'promptText is vereist' }, { status: 400 });
    }

    const result = await runLocalSimulation(projectId, {
      promptId,
      promptText,
      platform,
      model,
    });

    // Recalculate summary
    await calculateSummary(projectId);

    return NextResponse.json({
      data: result,
      meta: {
        disclaimer: 'Simulatie – geen bewijs van werkelijke externe AI-zichtbaarheid.',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Run AI simulation error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
