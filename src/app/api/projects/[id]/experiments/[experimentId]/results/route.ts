import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { recordExperimentResult } from '@/lib/experiments';

// POST /api/projects/[id]/experiments/[experimentId]/results — Record experiment results
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

    const body = await request.json();
    const { testGroupResult, controlGroupResult } = body as {
      testGroupResult?: number;
      controlGroupResult?: number;
    };

    if (testGroupResult === undefined || controlGroupResult === undefined) {
      return NextResponse.json(
        { error: 'testGroupResult en controlGroupResult zijn vereist' },
        { status: 400 }
      );
    }

    if (typeof testGroupResult !== 'number' || typeof controlGroupResult !== 'number') {
      return NextResponse.json(
        { error: 'testGroupResult en controlGroupResult moeten numerieke waarden zijn' },
        { status: 400 }
      );
    }

    // Records results and runs statistical analysis automatically
    const experiment = await recordExperimentResult(experimentId, projectId, {
      testGroupResult,
      controlGroupResult,
    });

    return NextResponse.json({ data: experiment });
  } catch (error) {
    console.error('Record experiment result error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
