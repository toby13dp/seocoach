import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { analyzeQuality, getQualityDimensions } from '@/lib/content';
import { db } from '@/lib/db';

// POST /api/projects/[id]/briefs/[briefId]/quality — Run quality analysis on latest version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; briefId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, briefId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify brief belongs to this project
    const briefCheck = await db.contentBrief.findFirst({
      where: { id: briefId, projectId },
      select: { id: true },
    });

    if (!briefCheck) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    // Get the latest content version for this brief
    const latestVersion = await db.contentVersion.findFirst({
      where: { briefId },
      orderBy: { version: 'desc' },
    });

    if (!latestVersion) {
      return NextResponse.json(
        { error: 'No content version found for this brief. Generate a draft first.' },
        { status: 400 }
      );
    }

    // Run quality analysis
    const result = await analyzeQuality(latestVersion.id, projectId);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Quality analysis error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
