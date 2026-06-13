import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/workflow — List workflows
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
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));
    const approvalStatus = searchParams.get('approvalStatus') ?? undefined;

    const where: Record<string, unknown> = { projectId };
    if (approvalStatus) where.approvalStatus = approvalStatus;

    const [total, briefs] = await Promise.all([
      db.contentBrief.count({ where }),
      db.contentBrief.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          targetKeyword: true,
          searchIntent: true,
          funnelStage: true,
          approvalStatus: true,
          createdAt: true,
          updatedAt: true,
          versions: {
            select: { id: true, version: true, createdAt: true },
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    // Map briefs to workflow view
    const workflows = briefs.map((b) => ({
      briefId: b.id,
      title: b.title,
      targetKeyword: b.targetKeyword,
      searchIntent: b.searchIntent,
      funnelStage: b.funnelStage,
      approvalStatus: b.approvalStatus,
      currentStep: mapStatusToStep(b.approvalStatus),
      latestVersion: b.versions[0] ?? null,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    return NextResponse.json({
      data: workflows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('List workflows error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/workflow — Start new workflow
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

    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { error: 'Titel is vereist om een workflow te starten' },
        { status: 400 }
      );
    }

    // Create a brief as the first step of the workflow
    const brief = await db.contentBrief.create({
      data: {
        projectId,
        title: body.title,
        targetKeyword: body.targetKeyword ?? null,
        secondaryKeywords: body.secondaryKeywords ? JSON.stringify(body.secondaryKeywords) : null,
        searchIntent: body.searchIntent ?? 'UNKNOWN',
        funnelStage: body.funnelStage ?? 'UNKNOWN',
        outline: body.outline ? JSON.stringify(body.outline) : null,
        sources: body.sources ? JSON.stringify(body.sources) : null,
        brandProfileUsed: body.brandProfileUsed ?? true,
        internalPages: body.internalPages ? JSON.stringify(body.internalPages) : null,
        targetWordCount: body.targetWordCount ?? null,
        targetAudience: body.targetAudience ?? null,
        toneOfVoice: body.toneOfVoice ?? null,
        approvalStatus: 'DRAFT',
      },
    });

    return NextResponse.json({
      data: {
        briefId: brief.id,
        title: brief.title,
        currentStep: 'SELECT_OPPORTUNITY',
        approvalStatus: brief.approvalStatus,
        message: 'Workflow succesvol gestart.',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Start workflow error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Helper: Map approval status to workflow step
function mapStatusToStep(status: string): string {
  const mapping: Record<string, string> = {
    DRAFT: 'GENERATE_DRAFT',
    IN_REVIEW: 'RUN_QUALITY_CHECKS',
    APPROVED: 'APPROVE',
    PUBLISHED: 'MONITOR_STATUS',
    ARCHIVED: 'MONITOR_STATUS',
  };
  return mapping[status] ?? 'SELECT_OPPORTUNITY';
}
