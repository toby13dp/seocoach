import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { createReport } from '@/lib/reporting';
import type { ReportCreateConfig } from '@/lib/reporting';

// GET /api/projects/[id]/reports — List reports
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
    const type = searchParams.get('type') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

    const where: Record<string, unknown> = {
      projectId,
      deletedAt: null,
    };

    if (type) where.type = type;
    if (status) where.status = status;

    const [reports, total] = await Promise.all([
      db.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
          shareToken: true,
          shareExpiresAt: true,
        },
      }),
      db.report.count({ where }),
    ]);

    return NextResponse.json({
      data: reports,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List reports error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/reports — Create new report
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
    const { type, title, description, startDate, endDate, comparisonStartDate, comparisonEndDate, whiteLabelId } = body as {
      type: string;
      title?: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      comparisonStartDate?: string;
      comparisonEndDate?: string;
      whiteLabelId?: string;
    };

    if (!type) {
      return NextResponse.json(
        { error: 'Rapporttype is vereist' },
        { status: 400 }
      );
    }

    const allowedTypes = [
      'MONTHLY', 'QUARTERLY', 'TECHNICAL_AUDIT', 'CONTENT',
      'KEYWORDS', 'COMPETITORS', 'LOCAL_SEO', 'GEO',
      'WOOCOMMERCE', 'CRO', 'REVENUE', 'EXECUTIVE',
      'HOLISTIC', 'CUSTOM',
    ];

    if (!allowedTypes.includes(type)) {
      return NextResponse.json(
        { error: `Ongeldig rapporttype. Toegestane types: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const config: ReportCreateConfig = {
      type: type as ReportCreateConfig['type'],
      title,
      description,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      comparisonStartDate: comparisonStartDate ? new Date(comparisonStartDate) : undefined,
      comparisonEndDate: comparisonEndDate ? new Date(comparisonEndDate) : undefined,
      whiteLabelId,
      createdById: user.id,
    };

    const report = await createReport(projectId, type as ReportCreateConfig['type'], config);

    return NextResponse.json({ data: report }, { status: 201 });
  } catch (error) {
    console.error('Create report error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
