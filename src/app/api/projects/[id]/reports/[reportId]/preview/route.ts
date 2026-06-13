import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { previewReport, generateSnapshot } from '@/lib/reporting';

// POST /api/projects/[id]/reports/[reportId]/preview — Generate preview
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, reportId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await db.report.findFirst({
      where: { id: reportId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Rapport niet gevonden' },
        { status: 404 }
      );
    }

    // Generate preview with snapshot data
    const preview = await previewReport(reportId);

    // Save snapshot data
    await generateSnapshot(reportId);

    return NextResponse.json({ data: preview });
  } catch (error) {
    console.error('Preview report error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
