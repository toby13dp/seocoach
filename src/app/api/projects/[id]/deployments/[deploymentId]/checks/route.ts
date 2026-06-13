import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { runDeploymentChecks, updateDeploymentCheck, updateDeploymentSummary } from '@/lib/deployment';
import { db } from '@/lib/db';

// POST /api/projects/[id]/deployments/[deploymentId]/checks — Run deployment checks
export async function POST(
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
    const deployment = await db.deploymentRecord.findFirst({
      where: { id: deploymentId, projectId, deletedAt: null },
    });

    if (!deployment) {
      return NextResponse.json({ error: 'Deployment niet gevonden' }, { status: 404 });
    }

    const body = await request.json();
    const { checkTypes } = body;

    if (!checkTypes || !Array.isArray(checkTypes) || checkTypes.length === 0) {
      return NextResponse.json(
        { error: 'Lijst met checktypes is vereist' },
        { status: 400 }
      );
    }

    const validCheckTypes = [
      'ROBOTS_TXT', 'CANONICALS', 'TITLES', 'META_ROBOTS', 'SITEMAPS',
      'STATUS_CODES', 'STRUCTURED_DATA', 'INTERNAL_LINKS', 'RENDERING',
      'PERFORMANCE', 'CRITICAL_URLS',
    ];

    const invalidTypes = checkTypes.filter((t: string) => !validCheckTypes.includes(t));
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { error: `Ongeldige checktypes: ${invalidTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await runDeploymentChecks(
      deploymentId,
      checkTypes as Array<'ROBOTS_TXT' | 'CANONICALS' | 'TITLES' | 'META_ROBOTS' | 'SITEMAPS' | 'STATUS_CODES' | 'STRUCTURED_DATA' | 'INTERNAL_LINKS' | 'RENDERING' | 'PERFORMANCE' | 'CRITICAL_URLS'>
    );

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error('Deployment-checks uitvoeren fout:', error);
    return NextResponse.json({ error: 'Interne serverfout bij uitvoeren van deployment-checks' }, { status: 500 });
  }
}

// PUT /api/projects/[id]/deployments/[deploymentId]/checks — Update deployment check result
export async function PUT(
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
    const deployment = await db.deploymentRecord.findFirst({
      where: { id: deploymentId, projectId, deletedAt: null },
    });

    if (!deployment) {
      return NextResponse.json({ error: 'Deployment niet gevonden' }, { status: 404 });
    }

    const body = await request.json();
    const { checkId, status, finding, severity, beforeValue, afterValue, diff } = body;

    if (!checkId || typeof checkId !== 'string') {
      return NextResponse.json(
        { error: 'Check-ID is vereist' },
        { status: 400 }
      );
    }

    // Verify check belongs to this deployment
    const existingCheck = await db.deploymentCheck.findFirst({
      where: { id: checkId, deploymentId, deletedAt: null },
    });

    if (!existingCheck) {
      return NextResponse.json(
        { error: 'Deployment-check niet gevonden' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (finding !== undefined) updateData.finding = finding;
    if (severity !== undefined) updateData.severity = severity;
    if (beforeValue !== undefined) updateData.beforeValue = beforeValue;
    if (afterValue !== undefined) updateData.afterValue = afterValue;
    if (diff !== undefined) updateData.diff = diff;

    const check = await updateDeploymentCheck(checkId, updateData);

    // Update deployment summary after check update
    const summary = await updateDeploymentSummary(deploymentId);

    return NextResponse.json({
      data: {
        check,
        summary,
      },
    });
  } catch (error) {
    console.error('Deployment-check bijwerken fout:', error);
    return NextResponse.json({ error: 'Interne serverfout bij bijwerken van deployment-check' }, { status: 500 });
  }
}
