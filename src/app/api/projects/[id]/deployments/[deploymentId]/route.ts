import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getDeploymentRecordDetails } from '@/lib/deployment';
import { db } from '@/lib/db';

// GET /api/projects/[id]/deployments/[deploymentId] — Get deployment details with checks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 });
    }

    const { id: projectId, deploymentId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 });
    }

    // Verify deployment belongs to this project
    const existing = await db.deploymentRecord.findFirst({
      where: { id: deploymentId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Deployment niet gevonden' }, { status: 404 });
    }

    const deployment = await getDeploymentRecordDetails(deploymentId);

    if (!deployment) {
      return NextResponse.json({ error: 'Deployment niet gevonden' }, { status: 404 });
    }

    return NextResponse.json({ data: deployment });
  } catch (error) {
    console.error('Deployment ophalen fout:', error);
    return NextResponse.json({ error: 'Interne serverfout bij ophalen van deployment' }, { status: 500 });
  }
}
