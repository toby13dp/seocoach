import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getDeploymentRecords, createDeploymentRecord, runDeploymentChecks, updateDeploymentSummary } from '@/lib/deployment/deployment-manager';
import { db } from '@/lib/db';

// GET /api/projects/[id]/deployments — List deployment records
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
    const provider = searchParams.get('provider') ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));

    const deployments = await getDeploymentRecords(projectId, {
      provider: provider as 'GITHUB' | 'GITLAB' | 'GENERIC_CICD' | undefined,
      limit,
    });

    return NextResponse.json({ deployments });
  } catch (error) {
    console.error('List deployments error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/deployments — Create a deployment record
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
    const { provider, commitSha, branch, environment, blockingEnabled } = body;

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is verplicht' },
        { status: 400 }
      );
    }

    // Get the project to find the organizationId
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 });
    }

    const deployment = await createDeploymentRecord({
      organizationId: project.organizationId,
      projectId,
      provider,
      commitSha,
      branch,
      environment,
      deployedBy: user.id,
      blockingEnabled: blockingEnabled ?? false,
    });

    // Run all default deployment checks
    const { ALL_DEPLOYMENT_CHECK_TYPES } = await import('@/lib/deployment/deployment-manager');
    await runDeploymentChecks(deployment.id, ALL_DEPLOYMENT_CHECK_TYPES);

    return NextResponse.json({ deployment }, { status: 201 });
  } catch (error) {
    console.error('Create deployment error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
