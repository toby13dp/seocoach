import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { updateReportSections, archiveReport } from '@/lib/reporting';

// GET /api/projects/[id]/reports/[reportId] — Get report details with sections
export async function GET(
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

    const [report, comments] = await Promise.all([
      db.report.findFirst({
        where: { id: reportId, projectId, deletedAt: null },
      }),
      db.reportComment.findMany({
        where: { reportId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!report) {
      return NextResponse.json(
        { error: 'Rapport niet gevonden' },
        { status: 404 }
      );
    }

    // Parse sections from JSON string if needed
    const sections = typeof report.sections === 'string'
      ? JSON.parse(report.sections)
      : report.sections;

    return NextResponse.json({
      data: {
        ...report,
        sections,
        comments,
      },
    });
  } catch (error) {
    console.error('Get report error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/reports/[reportId] — Update report
export async function PATCH(
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

    const body = await request.json();

    // Update sections if provided
    if (body.sections) {
      await updateReportSections(reportId, body.sections);
    }

    // Update other fields
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.whiteLabelId !== undefined) updateData.whiteLabelId = body.whiteLabelId;

    if (Object.keys(updateData).length > 0) {
      await db.report.update({
        where: { id: reportId },
        data: updateData,
      });
    }

    const updated = await db.report.findUnique({
      where: { id: reportId },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update report error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/reports/[reportId] — Archive report
export async function DELETE(
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

    await archiveReport(reportId);

    return NextResponse.json({ data: { id: reportId, archived: true } });
  } catch (error) {
    console.error('Archive report error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
