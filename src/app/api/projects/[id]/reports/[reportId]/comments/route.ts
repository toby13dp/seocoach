import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { addReportComment, getReportComments } from '@/lib/reporting';

// GET /api/projects/[id]/reports/[reportId]/comments — List comments
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

    const comments = await getReportComments(reportId);

    return NextResponse.json({ data: comments });
  } catch (error) {
    console.error('Get report comments error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/reports/[reportId]/comments — Add comment
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

    const body = await request.json();
    const { sectionId, comment } = body as {
      sectionId?: string;
      comment?: string;
    };

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return NextResponse.json(
        { error: 'Opmerkingstekst is vereist' },
        { status: 400 }
      );
    }

    if (comment.trim().length > 5000) {
      return NextResponse.json(
        { error: 'Opmerking mag maximaal 5000 tekens bevatten' },
        { status: 400 }
      );
    }

    const created = await addReportComment(
      reportId,
      sectionId ?? null,
      comment.trim(),
      user.id
    );

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error('Add report comment error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
