import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { runPrePublicationChecks, hasBlockingFindings } from '@/lib/content/quality-controls';

// POST /api/projects/[id]/briefs/[briefId]/pre-publish — Run pre-publication checks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; briefId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, briefId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const brief = await db.contentBrief.findFirst({
      where: { id: briefId, projectId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief niet gevonden' },
        { status: 404 }
      );
    }

    const latestVersion = brief.versions[0];
    if (!latestVersion) {
      return NextResponse.json(
        { error: 'Geen contentversie beschikbaar voor pre-publicatiecontrole' },
        { status: 400 }
      );
    }

    // Run pre-publication quality checks
    const checkResult = await runPrePublicationChecks(projectId, latestVersion.id);

    // Check if there are blocking findings
    const hasBlocking = await hasBlockingFindings(latestVersion.id);

    return NextResponse.json({
      data: {
        briefId,
        versionId: latestVersion.id,
        totalChecks: checkResult.totalChecks,
        findingsCreated: checkResult.findingsCreated,
        bySeverity: checkResult.bySeverity,
        canPublish: checkResult.canPublish,
        hasBlockingFindings: hasBlocking,
      },
    });
  } catch (error) {
    console.error('Pre-publish check error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
