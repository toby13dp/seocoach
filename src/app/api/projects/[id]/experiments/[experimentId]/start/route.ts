import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { startExperiment } from '@/lib/experiments';

// POST /api/projects/[id]/experiments/[experimentId]/start — Start experiment (DRAFT → RUNNING)
export async function POST(
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

    const experiment = await startExperiment(experimentId, projectId);

    return NextResponse.json({ data: experiment });
  } catch (error) {
    console.error('Start experiment error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
