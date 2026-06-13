import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { recommendPruningAction, assessPruningRisk } from '@/lib/content/decay-detector';

// POST /api/projects/[id]/decay-workflow/[decayId] — Actions on a decay record
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; decayId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, decayId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const decay = await db.contentDecay.findFirst({
      where: { id: decayId, projectId },
    });

    if (!decay) {
      return NextResponse.json(
        { error: 'Vervalrecord niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!body.action) {
      return NextResponse.json(
        { error: 'Actie is vereist. Geldige acties: generateUpdateBrief, approvePruning, compareContent' },
        { status: 400 }
      );
    }

    switch (body.action) {
      case 'generateUpdateBrief': {
        // Generate a brief for updating the declining page
        const page = decay.pageId
          ? await db.page.findUnique({ where: { id: decay.pageId } })
          : null;

        const briefTitle = page?.title
          ? `Update: ${page.title}`
          : `Update voor pagina met verval: ${decay.url}`;

        const brief = await db.contentBrief.create({
          data: {
            projectId,
            title: briefTitle,
            targetKeyword: page?.title ?? null,
            searchIntent: 'INFORMATIONAL',
            funnelStage: 'AWARENESS',
            sources: JSON.stringify([{ url: decay.url, type: 'existing_page' }]),
            approvalStatus: 'DRAFT',
          },
        });

        return NextResponse.json({
          data: {
            decayId,
            action: 'generateUpdateBrief',
            briefId: brief.id,
            message: `Updatebrief aangemaakt voor pagina met ${decay.decayPercentage}% verval.`,
          },
        });
      }

      case 'approvePruning': {
        // Approve the recommended pruning action
        const newPruningAction = body.data?.pruningAction ?? decay.pruningAction;

        const validActions = ['KEEP', 'IMPROVE', 'MERGE', 'REDIRECT', 'NOINDEX', 'REMOVE'];
        if (!validActions.includes(newPruningAction)) {
          return NextResponse.json(
            { error: `Ongeldige snoeiactions. Geldige acties: ${validActions.join(', ')}` },
            { status: 400 }
          );
        }

        // Run risk assessment for destructive actions
        let riskAssessment: import('@/lib/content/types').RiskAnalysis | null = null;
        if (['REDIRECT', 'NOINDEX', 'REMOVE'].includes(newPruningAction)) {
          try {
            riskAssessment = await assessPruningRisk({
              url: decay.url,
              currentClicks: decay.currentClicks,
              currentImpressions: decay.currentImpressions,
              currentPage: decay.currentPage,
              decayPercentage: decay.decayPercentage,
              pruningAction: newPruningAction as import('@/lib/content/types').PruningActionType,
            });
          } catch {
            riskAssessment = { riskLevel: 'low', factors: [], summary: 'Risicobeoordeling kon niet worden uitgevoerd.', precautions: [] };
          }
        }

        const updated = await db.contentDecay.update({
          where: { id: decayId },
          data: { pruningAction: newPruningAction },
        });

        return NextResponse.json({
          data: {
            decayId,
            action: 'approvePruning',
            pruningAction: updated.pruningAction,
            riskAssessment,
            message: `Snoeiactie "${newPruningAction}" goedgekeurd voor pagina met ${decay.decayPercentage}% verval.`,
          },
        });
      }

      case 'compareContent': {
        // Compare current and previous content for this page
        const page = decay.pageId
          ? await db.page.findUnique({
              where: { id: decay.pageId },
              select: { title: true, mainContent: true, url: true },
            })
          : null;

        // Get content changes for this page
        const changes = decay.pageId
          ? await db.contentChange.findMany({
              where: {
                projectId,
                pageId: decay.pageId,
                changeType: 'UPDATE',
              },
              orderBy: { createdAt: 'desc' },
              take: 2,
              select: {
                id: true,
                previousContent: true,
                newContent: true,
                summary: true,
                createdAt: true,
              },
            })
          : [];

        return NextResponse.json({
          data: {
            decayId,
            action: 'compareContent',
            currentPage: page
              ? { title: page.title, content: page.mainContent, url: page.url }
              : null,
            recentChanges: changes.map(c => ({
              id: c.id,
              summary: c.summary,
              createdAt: c.createdAt,
              hasDiff: !!(c.previousContent && c.newContent),
            })),
            decayPercentage: decay.decayPercentage,
            pruningAction: decay.pruningAction,
            message: changes.length > 0
              ? `${changes.length} recente wijziging(en) gevonden voor deze pagina.`
              : 'Geen recente wijzigingen gevonden voor deze pagina.',
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Onbekende actie "${body.action}". Geldige acties: generateUpdateBrief, approvePruning, compareContent` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Decay workflow action error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
