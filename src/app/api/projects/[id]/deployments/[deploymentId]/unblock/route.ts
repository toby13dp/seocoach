import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { unblockDeployment, isDeploymentBlocking } from '@/lib/deployment/deployment-manager';
import { db } from '@/lib/db';

// POST /api/projects/[id]/deployments/[deploymentId]/unblock — Unblock a deployment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, deploymentId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    // Verify deployment belongs to project
    const deployment = await db.deploymentRecord.findFirst({
      where: { id: deploymentId, projectId, deletedAt: null },
    });

    if (!deployment) {
      return NextResponse.json({ error: 'Deployment niet gevonden' }, { status: 404 });
    }

    const isBlocked = await isDeploymentBlocking(deploymentId);
    if (!isBlocked) {
      return NextResponse.json({ error: 'Deployment is niet geblokkeerd' }, { status: 400 });
    }

    const body = await request.json();
    const { reason } = body;

    await unblockDeployment(deploymentId, reason || 'Ontblokkeerd door gebruiker');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unblock deployment error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
