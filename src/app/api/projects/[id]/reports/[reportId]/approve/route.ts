import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { approveReport } from '@/lib/reporting';

// POST /api/projects/[id]/reports/[reportId]/approve — Approve report
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

    if (existing.status === 'APPROVED' || existing.status === 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Rapport is al goedgekeurd' },
        { status: 400 }
      );
    }

    const approved = await approveReport(reportId, user.id);

    return NextResponse.json({ data: approved });
  } catch (error) {
    console.error('Approve report error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
