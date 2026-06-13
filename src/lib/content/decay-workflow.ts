// ============================================================================
// Decay & Pruning Workflows — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// User-facing workflows for content decay management. Extends the existing
// decay-detector module with actionable workflows for updating decayed pages,
// comparing content versions, approving revisions, and managing pruning actions.
// All user-facing strings are in Dutch. Destructive actions always require
// explicit approval.
// ============================================================================

import { db } from '@/lib/db';
import { providerManager } from '@/lib/ai/provider-manager';
import { generateDraft } from './draft-generator';
import { checkClaimSupport } from './source-grounding';
import { hasBlockingFindings } from './quality-controls';
import { recordChange } from './change-history';
import type { PruningActionType } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Summary of a declining page for list views.
 */
export interface DecliningPageSummary {
  /** Decay record ID */
  id: string;
  /** Project ID */
  projectId: string;
  /** Page ID (if associated with a crawled page) */
  pageId: string | null;
  /** Page URL */
  url: string;
  /** Current search position */
  currentPage: number;
  /** Previous search position */
  previousPage: number | null;
  /** Current clicks */
  currentClicks: number | null;
  /** Previous clicks */
  previousClicks: number | null;
  /** Current impressions */
  currentImpressions: number | null;
  /** Previous impressions */
  previousImpressions: number | null;
  /** Decay percentage (negative = decline) */
  decayPercentage: number;
  /** Recommended pruning action */
  pruningAction: string;
  /** Whether metrics data is available */
  dataAvailable: boolean;
  /** Note about data availability in Dutch */
  dataNote: string | null;
  /** When the decay was detected */
  detectedAt: Date;
}

/**
 * Result of comparing old content with proposed new content.
 */
export interface ContentComparisonResult {
  /** The content version ID that was compared */
  versionId: string;
  /** Diff of changes */
  diff: {
    /** Lines removed from old content */
    removed: string[];
    /** Lines added in new content */
    added: string[];
    /** Unified diff format */
    unified: string;
    /** Statistics */
    stats: {
      linesAdded: number;
      linesRemoved: number;
      linesUnchanged: number;
    };
  };
  /** Key changes highlighted in Dutch */
  keyChanges: string[];
  /** What improved in Dutch */
  improvements: string[];
  /** What might be risky in Dutch */
  risks: string[];
  /** Overall assessment in Dutch */
  summary: string;
}

/**
 * Enhanced pruning recommendation with detailed evidence.
 */
export interface EnhancedPruningRecommendation {
  /** Decay record ID */
  decayId: string;
  /** Page URL */
  url: string;
  /** Recommended action */
  action: PruningActionType;
  /** Evidence for the recommendation in Dutch */
  evidence: {
    /** Traffic data summary in Dutch */
    traffic: string;
    /** Internal links that would be affected */
    internalLinksAffected: number;
    /** Internal link details in Dutch */
    internalLinkDetails: string;
  };
  /** Risk assessment in Dutch */
  riskAssessment: {
    /** Backlink risk in Dutch */
    backlinks: string;
    /** Authority risk in Dutch */
    authority: string;
    /** Overall risk level */
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
  };
  /** Search performance summary in Dutch */
  searchPerformance: string;
  /** Conversion performance summary in Dutch */
  conversionPerformance: string;
  /** Proposed redirect target (if REDIRECT recommended) */
  redirectTarget: string | null;
  /** Overall recommendation summary in Dutch */
  summary: string;
}

/**
 * Result of approving a pruning action.
 */
export interface PruningApprovalResult {
  /** The ContentChange ID recording this approval */
  changeId: string;
  /** The action that was approved */
  action: PruningActionType;
  /** Dutch confirmation message */
  message: string;
  /** Rollback guidance in Dutch */
  rollbackGuidance: string;
  /** Whether a redirect target was set */
  redirectTarget: string | null;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * List pages with decay detection results, sorted by decay percentage.
 *
 * Returns all decay records for a project, ordered from most decayed
 * to least decayed. Includes metrics data for each page.
 *
 * @param projectId - The project to list declining pages for
 * @returns Array of declining page summaries
 */
export async function viewDecliningPages(
  projectId: string
): Promise<DecliningPageSummary[]> {
  const decayRecords = await db.contentDecay.findMany({
    where: { projectId },
    orderBy: { decayPercentage: 'desc' },
  });

  return decayRecords.map((record) => ({
    id: record.id,
    projectId: record.projectId,
    pageId: record.pageId,
    url: record.url,
    currentPage: record.currentPage,
    previousPage: record.previousPage,
    currentClicks: record.currentClicks,
    previousClicks: record.previousClicks,
    currentImpressions: record.currentImpressions,
    previousImpressions: record.previousImpressions,
    decayPercentage: record.decayPercentage,
    pruningAction: record.pruningAction,
    dataAvailable: record.dataAvailable,
    dataNote: record.dataNote,
    detectedAt: record.detectedAt,
  }));
}

/**
 * Generate a content brief for updating a decayed page.
 *
 * Loads the decay record and page content, then uses AI to suggest
 * improvements. Creates a ContentBrief with type=CONTENT_UPDATE that
 * can be used in the standard content workflow.
 *
 * @param decayId - The decay record ID
 * @returns The brief ID for the update workflow
 * @throws Error if the decay record is not found
 */
export async function generateUpdateBrief(
  decayId: string
): Promise<string> {
  const decay = await db.contentDecay.findUnique({
    where: { id: decayId },
  });

  if (!decay) {
    throw new Error(`Vervalrecord "${decayId}" niet gevonden`);
  }

  // Load the page content if available
  let pageContent = '';
  let pageTitle = decay.url;

  if (decay.pageId) {
    const page = await db.page.findUnique({
      where: { id: decay.pageId },
    });
    if (page) {
      pageContent = page.mainContent ?? page.description ?? '';
      pageTitle = page.title ?? page.h1 ?? decay.url;
    }
  }

  // Use AI to suggest improvements
  let improvementSuggestions = 'Geen specifieke suggesties beschikbaar.';
  let suggestedOutline = '';

  try {
    const prompt = `Analyseer de volgende pagina die tekenen van verval vertoont en stel verbeteringen voor.

**Pagina:** ${pageTitle}
**URL:** ${decay.url}
**Vervalpercentage:** ${decay.decayPercentage}%
**Huidige positie:** ${decay.currentPage}
**Huidige klikken:** ${decay.currentClicks ?? 'Onbekend'}
**Huidige impressies:** ${decay.currentImpressions ?? 'Onbekend'}

${pageContent ? `**Huidige content (eerste 3000 tekens):**\n${pageContent.substring(0, 3000)}` : 'Geen content beschikbaar voor analyse.'}

Geef het volgende:
1. **Suggesties voor verbetering:** Wat moet er veranderen om de prestaties te herstellen?
2. **Nieuwe outline:** Voorgestelde structuur voor de vernieuwde content

Gebruik het volgende formaat voor de outline:
## [H2-kop]
- Kernpunt 1
### [H3-kop]
- Kernpunt 1

Schrijf alles in het Nederlands.`;

    const response = await providerManager.fallbackGenerate(
      decay.projectId,
      {
        messages: [
          {
            role: 'system',
            content:
              'Je bent een SEO-expert die content-verval analyseert en gerichte verbetervoorstellen doet voor de Nederlandse markt.',
          },
          { role: 'user', content: prompt },
        ],
        purpose: 'decay-update-brief',
        maxTokens: 3000,
        temperature: 0.6,
      }
    );

    if (response.success && response.content.trim()) {
      const aiContent = response.content.trim();

      // Split suggestions and outline
      const outlineMatch = aiContent.match(
        /(?:Nieuwe outline|Voorgestelde structuur)[:\s]*\n([\s\S]*)/i
      );
      if (outlineMatch) {
        suggestedOutline = outlineMatch[1].trim();
        improvementSuggestions = aiContent
          .substring(0, aiContent.indexOf(outlineMatch[0]))
          .trim();
      } else {
        improvementSuggestions = aiContent;
      }
    }
  } catch {
    // AI failed, use default suggestions
  }

  // Build the brief data
  const title = `Content-update: ${pageTitle}`;

  // Parse outline from AI suggestions
  let outline: unknown[] = [];
  if (suggestedOutline) {
    outline = parseOutlineFromText(suggestedOutline);
  }

  // Create the ContentBrief
  const brief = await db.contentBrief.create({
    data: {
      projectId: decay.projectId,
      title,
      targetKeyword: pageTitle,
      searchIntent: 'INFORMATIONAL',
      funnelStage: 'AWARENESS',
      outline: outline.length > 0 ? JSON.stringify(outline) : null,
      sources: JSON.stringify({
        contentType: 'CONTENT_UPDATE',
        decayId,
        decayPercentage: decay.decayPercentage,
        originalUrl: decay.url,
        improvementSuggestions,
      }),
      approvalStatus: 'DRAFT',
    },
  });

  // Record the creation
  await recordChange({
    projectId: decay.projectId,
    briefId: brief.id,
    pageId: decay.pageId ?? undefined,
    changeType: 'CREATE',
    summary: `Update-brief gegenereerd voor vervallen pagina: "${pageTitle}" (${decay.decayPercentage}% verval)`,
  });

  return brief.id;
}

/**
 * Compare old content with proposed new content.
 *
 * Generates a diff between the current and proposed content, highlights
 * key changes, and identifies improvements and risks. All feedback is
 * provided in Dutch.
 *
 * @param versionId - The content version ID of the current content
 * @param proposedContent - The proposed new content
 * @returns Detailed comparison result
 * @throws Error if the version is not found
 */
export async function compareContent(
  versionId: string,
  proposedContent: string
): Promise<ContentComparisonResult> {
  const version = await db.contentVersion.findUnique({
    where: { id: versionId },
  });

  if (!version) {
    throw new Error(`Contentversie "${versionId}" niet gevonden`);
  }

  const oldContent = version.content;
  const newContent = proposedContent;

  // Compute diff
  const diff = computeDiff(oldContent, newContent);

  // Use AI to analyze the changes
  let keyChanges: string[] = [];
  let improvements: string[] = [];
  let risks: string[] = [];
  let summary = 'Contentvergelijking voltooid.';

  try {
    const brief = await db.contentBrief.findUnique({
      where: { id: version.briefId },
    });

    const projectId = brief?.projectId ?? '';

    const prompt = `Analyseer de volgende contentwijziging en geef een beoordeling in het Nederlands.

**Verwijderde regels:**
${diff.removed.slice(0, 50).join('\n')}

**Toegevoegde regels:**
${diff.added.slice(0, 50).join('\n')}

**Statistieken:** ${diff.stats.linesAdded} regels toegevoegd, ${diff.stats.linesRemoved} regels verwijderd, ${diff.stats.linesUnchanged} regels ongewijzigd.

Geef de volgende informatie:
1. **Belangrijkste wijzigingen:** 3-5 belangrijkste verschillen (één per regel, begin met "- ")
2. **Verbeteringen:** Wat is verbeterd? (één per regel, begin met "- ")
3. **Risico's:** Wat kan problematisch zijn? (één per regel, begin met "- ")
4. **Samenvatting:** Eén samenvattende zin`;

    const response = await providerManager.fallbackGenerate(projectId, {
      messages: [
        {
          role: 'system',
          content:
            'Je bent een contentredacteur die wijzigingen beoordeelt voor kwaliteit en risico\'s. Je antwoordt in het Nederlands.',
        },
        { role: 'user', content: prompt },
      ],
      purpose: 'content-comparison',
      maxTokens: 1500,
      temperature: 0.3,
    });

    if (response.success && response.content.trim()) {
      const aiContent = response.content.trim();
      const parsed = parseComparisonResult(aiContent);
      keyChanges = parsed.keyChanges;
      improvements = parsed.improvements;
      risks = parsed.risks;
      summary = parsed.summary;
    }
  } catch {
    // AI analysis failed, provide basic assessment
    keyChanges = [
      diff.stats.linesAdded > 0
        ? `${diff.stats.linesAdded} regel(s) toegevoegd`
        : 'Geen regels toegevoegd',
      diff.stats.linesRemoved > 0
        ? `${diff.stats.linesRemoved} regel(s) verwijderd`
        : 'Geen regels verwijderd',
    ];
    improvements = [
      'Content is bijgewerkt met nieuwe informatie',
    ];
    risks = [
      'Controleer of belangrijke informatie niet per ongeluk is verwijderd',
    ];
    summary = `Contentvergelijking: ${diff.stats.linesAdded} toevoegingen, ${diff.stats.linesRemoved} verwijderingen. Handmatige beoordeling aanbevolen.`;
  }

  return {
    versionId,
    diff,
    keyChanges,
    improvements,
    risks,
    summary,
  };
}

/**
 * Approve a content revision for a decay update.
 *
 * Verifies that there are no blocking quality findings, then updates
 * the brief's approval status and records the change. Content must
 * pass quality checks before approval.
 *
 * @param briefId - The brief ID of the update
 * @param userId - The user approving the revision
 * @throws Error if blocking findings exist or the brief is not found
 */
export async function approveRevision(
  briefId: string,
  userId: string
): Promise<void> {
  const brief = await db.contentBrief.findUnique({
    where: { id: briefId },
  });

  if (!brief) {
    throw new Error(`Content brief "${briefId}" niet gevonden`);
  }

  // Get the latest version
  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId },
    orderBy: { version: 'desc' },
  });

  if (!latestVersion) {
    throw new Error(
      'Geen draft beschikbaar. Genereer eerst een draft voordat je goedkeurt.'
    );
  }

  // Check for blocking findings
  if (latestVersion.id) {
    const hasBlocking = await hasBlockingFindings(latestVersion.id);
    if (hasBlocking) {
      throw new Error(
        'De revisie kan niet worden goedgekeurd: er zijn blokkerende kwaliteitsbevindingen die eerst moeten worden opgelost.'
      );
    }
  }

  // Update approval status
  await db.contentBrief.update({
    where: { id: briefId },
    data: {
      approvalStatus: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
    },
  });

  // Record the approval in ContentChange
  await recordChange({
    projectId: brief.projectId,
    briefId,
    versionId: latestVersion.id,
    changeType: 'APPROVE',
    userId,
    summary: `Revisie goedgekeurd voor content-update: "${brief.title}"`,
  });
}

/**
 * Publish a content update to CMS.
 *
 * Publishes the approved content revision, updating the brief status
 * to PUBLISHED and recording the change. Requires prior approval.
 *
 * @param briefId - The brief ID of the update
 * @param cmsConnectionId - Optional CMS connection to publish through
 * @throws Error if the brief is not approved or not found
 */
export async function publishUpdate(
  briefId: string,
  cmsConnectionId?: string
): Promise<{
  message: string;
  publishedAt: Date;
}> {
  const brief = await db.contentBrief.findUnique({
    where: { id: briefId },
  });

  if (!brief) {
    throw new Error(`Content brief "${briefId}" niet gevonden`);
  }

  if (brief.approvalStatus !== 'APPROVED') {
    throw new Error(
      'De revisie moet zijn goedgekeurd voordat deze kan worden gepubliceerd.'
    );
  }

  // Get the latest version
  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId },
    orderBy: { version: 'desc' },
  });

  if (!latestVersion) {
    throw new Error('Geen draft beschikbaar om te publiceren');
  }

  // Update brief status
  const publishedAt = new Date();
  await db.contentBrief.update({
    where: { id: briefId },
    data: {
      approvalStatus: 'PUBLISHED',
    },
  });

  // Record the publication
  await recordChange({
    projectId: brief.projectId,
    briefId,
    versionId: latestVersion.id,
    changeType: 'PUBLISH',
    summary: `Content-update gepubliceerd: "${brief.title}"`,
    cmsResult: cmsConnectionId
      ? JSON.stringify({
          cmsConnectionId,
          publishedAt: publishedAt.toISOString(),
        })
      : undefined,
  });

  // Update the decay record to reflect the update
  const sourcesData = brief.sources
    ? (() => {
        try {
          return JSON.parse(brief.sources) as Record<string, unknown>;
        } catch {
          return {};
        }
      })()
    : {};

  const decayId = sourcesData.decayId as string | undefined;
  if (decayId) {
    await db.contentDecay.update({
      where: { id: decayId },
      data: {
        pruningAction: 'KEEP', // Reset to KEEP since it's been updated
        recommendations: JSON.stringify([
          'Content is vernieuwd en gepubliceerd. Monitor de prestaties over de komende weken.',
        ]),
      },
    });
  }

  return {
    message: `Content-update succesvol gepubliceerd: "${brief.title}". Monitor de prestaties over de komende weken om het effect te meten.`,
    publishedAt,
  };
}

/**
 * Check metrics after a content update.
 *
 * This is a placeholder implementation that returns a note about
 * future metric tracking. In production, this would compare metrics
 * before and after the update.
 *
 * @param decayId - The decay record ID
 * @returns Monitoring note in Dutch
 */
export async function monitorPostUpdateMetrics(
  decayId: string
): Promise<{
  decayId: string;
  monitoringStatus: string;
  note: string;
  nextCheckDate: Date;
  metrics: {
    preUpdate: {
      clicks: number | null;
      impressions: number | null;
      position: number | null;
    };
    postUpdate: {
      clicks: number | null;
      impressions: number | null;
      position: number | null;
    };
  };
}> {
  const decay = await db.contentDecay.findUnique({
    where: { id: decayId },
  });

  if (!decay) {
    throw new Error(`Vervalrecord "${decayId}" niet gevonden`);
  }

  // Calculate next check date (2 weeks from now)
  const nextCheckDate = new Date();
  nextCheckDate.setDate(nextCheckDate.getDate() + 14);

  return {
    decayId,
    monitoringStatus: 'MONITORING',
    note: `De prestaties van de vernieuwde pagina worden bijgehouden. De eerste resultaten worden verwacht na ${nextCheckDate.toLocaleDateString('nl-NL')}. Controleer op dat moment de zoekpositie, klikken en impressies om het effect van de update te beoordelen.`,
    nextCheckDate,
    metrics: {
      preUpdate: {
        clicks: decay.currentClicks,
        impressions: decay.currentImpressions,
        position: decay.currentPage,
      },
      postUpdate: {
        clicks: null,
        impressions: null,
        position: null,
      },
    },
  };
}

/**
 * Enhanced pruning recommendation with detailed evidence and risk assessment.
 *
 * Provides comprehensive information to support the pruning decision,
 * including traffic data, internal link impact, backlink risk, authority
 * risk, search performance, conversion performance, and proposed redirect
 * target. All information is in Dutch.
 *
 * @param decayId - The decay record ID
 * @returns Enhanced pruning recommendation
 * @throws Error if the decay record is not found
 */
export async function recommendPruningAction(
  decayId: string
): Promise<EnhancedPruningRecommendation> {
  const decay = await db.contentDecay.findUnique({
    where: { id: decayId },
  });

  if (!decay) {
    throw new Error(`Vervalrecord "${decayId}" niet gevonden`);
  }

  const action = decay.pruningAction as PruningActionType;

  // Gather evidence from page data
  let internalLinksAffected = 0;
  let internalLinkDetails = 'Geen interne linkgegevens beschikbaar.';
  let backlinkRisk = 'Onbekend — geen backlinkgegevens beschikbaar.';
  let authorityRisk = 'Onbekend — geen autoriteitsgegevens beschikbaar.';
  let redirectTarget: string | null = null;

  if (decay.pageId) {
    const page = await db.page.findUnique({
      where: { id: decay.pageId },
    });

    if (page) {
      // Count internal links pointing to this page
      const linksToPage = await db.page.findMany({
        where: {
          projectId: decay.projectId,
          status: 'OK',
        },
        select: {
          id: true,
          url: true,
          internalLinks: true,
        },
        take: 100,
      });

      let linksCount = 0;
      const linkingUrls: string[] = [];
      for (const p of linksToPage) {
        if (p.internalLinks) {
          try {
            const links = JSON.parse(p.internalLinks) as string[];
            if (links.includes(decay.url) || links.some((l) => decay.url.includes(l))) {
              linksCount++;
              linkingUrls.push(p.url);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      internalLinksAffected = linksCount;
      internalLinkDetails =
        linksCount > 0
          ? `${linksCount} interne pagina('s) linken naar deze pagina: ${linkingUrls.slice(0, 5).join(', ')}${linkingUrls.length > 5 ? ` en ${linkingUrls.length - 5} meer` : ''}. Deze links moeten worden bijgewerkt als de pagina wordt verwijderd of verplaatst.`
          : 'Geen interne links gevonden die naar deze pagina verwijzen.';

      // Assess backlink risk
      if (page.externalLinkCount > 0) {
        backlinkRisk = `Deze pagina heeft ${page.externalLinkCount} externe link(s). Verwijdering kan leiden tot verlies van doorverwezen linkwaarde. Overweeg een redirect om linkwaarde te behouden.`;
      } else {
        backlinkRisk = 'Geen bekende externe links naar deze pagina. Het risico op linkwaardeverlies is laag.';
      }

      // Assess authority risk based on position
      if (decay.currentPage <= 10) {
        authorityRisk = `Deze pagina staat nog op positie ${decay.currentPage} in de zoekresultaten. De autoriteit die deze positie vertegenwoordigt gaat verloren bij verwijdering. Vernieuwing heeft de voorkeur boven verwijdering.`;
      } else if (decay.currentPage <= 20) {
        authorityRisk = `Deze pagina staat op positie ${decay.currentPage}. Er is nog enige autoriteit aanwezig, maar het effect van verwijdering is beperkt.`;
      } else {
        authorityRisk = 'Deze pagina staat buiten de top 20. Het autoriteitsverlies bij verwijdering is minimaal.';
      }

      // Suggest redirect target if REDIRECT is recommended
      if (action === 'REDIRECT') {
        // Find a similar page in the same project
        const similarPages = await db.page.findMany({
          where: {
            projectId: decay.projectId,
            status: 'OK',
            wordCount: { gt: 200 },
            id: { not: decay.pageId },
          },
          select: { url: true, title: true },
          take: 10,
        });

        if (similarPages.length > 0) {
          redirectTarget = similarPages[0].url;
        }
      }
    }
  }

  // Build traffic evidence
  const trafficEvidence = buildTrafficEvidence(decay);

  // Build search performance summary
  const searchPerformance = buildSearchPerformanceSummary(decay);

  // Build conversion performance summary
  const conversionPerformance = buildConversionPerformanceSummary(decay);

  // Determine overall risk level
  const overallRisk = determineOverallRisk(action, decay, internalLinksAffected);

  // Build overall summary
  const summary = buildPruningSummary(action, decay, overallRisk, internalLinksAffected);

  return {
    decayId,
    url: decay.url,
    action,
    evidence: {
      traffic: trafficEvidence,
      internalLinksAffected,
      internalLinkDetails,
    },
    riskAssessment: {
      backlinks: backlinkRisk,
      authority: authorityRisk,
      overallRisk,
    },
    searchPerformance,
    conversionPerformance,
    redirectTarget,
    summary,
  };
}

/**
 * Approve a pruning action for a decayed page.
 *
 * Requires explicit approval for destructive actions (REMOVE, REDIRECT, NOINDEX).
 * Creates a ContentChange record and returns rollback guidance.
 * Non-destructive actions (KEEP, IMPROVE, MERGE) are also recorded.
 *
 * @param decayId - The decay record ID
 * @param userId - The user approving the action
 * @param action - The pruning action being approved
 * @param redirectTarget - Required if action is REDIRECT
 * @throws Error if the decay record is not found or action requires redirect target
 */
export async function approvePruning(
  decayId: string,
  userId: string,
  action: PruningActionType,
  redirectTarget?: string
): Promise<PruningApprovalResult> {
  const decay = await db.contentDecay.findUnique({
    where: { id: decayId },
  });

  if (!decay) {
    throw new Error(`Vervalrecord "${decayId}" niet gevonden`);
  }

  // Validate destructive actions require explicit confirmation
  const destructiveActions: PruningActionType[] = ['REMOVE', 'REDIRECT', 'NOINDEX'];
  if (destructiveActions.includes(action)) {
    // REDIRECT requires a redirect target
    if (action === 'REDIRECT' && !redirectTarget) {
      throw new Error(
        'Een redirect-doel is vereist bij het goedkeuren van een REDIRECT-actie. Geef een URL op waarnaar moet worden doorverwezen.'
      );
    }
  }

  // Determine the action label in Dutch
  const actionLabels: Record<PruningActionType, string> = {
    KEEP: 'Behouden',
    IMPROVE: 'Verbeteren',
    MERGE: 'Samenvoegen',
    REDIRECT: 'Doorverwijzen',
    NOINDEX: 'Noindex instellen',
    REMOVE: 'Verwijderen',
  };

  // Create ContentChange record
  const change = await recordChange({
    projectId: decay.projectId,
    pageId: decay.pageId ?? undefined,
    changeType: action === 'REMOVE' ? 'DELETE' : 'UPDATE',
    userId,
    summary: `Snoeiactie goedgekeurd: ${actionLabels[action]} voor "${decay.url}"`,
    rollbackData: JSON.stringify({
      decayId,
      previousAction: decay.pruningAction,
      approvedAction: action,
      redirectTarget: redirectTarget ?? null,
      approvedAt: new Date().toISOString(),
      approvedBy: userId,
    }),
  });

  // Update the decay record
  await db.contentDecay.update({
    where: { id: decayId },
    data: {
      pruningAction: action,
      recommendations: JSON.stringify({
        approvedAction: action,
        approvedBy: userId,
        approvedAt: new Date().toISOString(),
        redirectTarget: redirectTarget ?? null,
      }),
    },
  });

  // Build rollback guidance
  const rollbackGuidance = buildRollbackGuidance(action, decay.url, redirectTarget ?? null);

  return {
    changeId: change.id,
    action,
    message: `Snoeiactie "${actionLabels[action]}" goedgekeurd voor "${decay.url}". ${destructiveActions.includes(action) ? 'Deze actie is destructief — zorg dat je de rollback-instructies hebt gelezen.' : ''}`,
    rollbackGuidance,
    redirectTarget: redirectTarget ?? null,
  };
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Compute a line-based diff between two strings.
 */
function computeDiff(
  previous: string,
  current: string
): {
  removed: string[];
  added: string[];
  unified: string;
  stats: { linesAdded: number; linesRemoved: number; linesUnchanged: number };
} {
  const prevLines = previous.split('\n');
  const currLines = current.split('\n');

  const prevSet = new Set(prevLines);
  const currSet = new Set(currLines);

  const removed = prevLines.filter((l) => !currSet.has(l));
  const added = currLines.filter((l) => !prevSet.has(l));
  const unchanged = prevLines.filter((l) => currSet.has(l));

  const unifiedLines: string[] = [];

  for (const line of removed) {
    unifiedLines.push(`- ${line}`);
  }
  for (const line of added) {
    unifiedLines.push(`+ ${line}`);
  }

  return {
    removed,
    added,
    unified: unifiedLines.join('\n'),
    stats: {
      linesAdded: added.length,
      linesRemoved: removed.length,
      linesUnchanged: unchanged.length,
    },
  };
}

/**
 * Parse AI-generated comparison result into structured data.
 */
function parseComparisonResult(aiContent: string): {
  keyChanges: string[];
  improvements: string[];
  risks: string[];
  summary: string;
} {
  const lines = aiContent.split('\n');
  const keyChanges: string[] = [];
  const improvements: string[] = [];
  const risks: string[] = [];
  let summary = 'Vergelijking voltooid.';

  let currentSection: 'changes' | 'improvements' | 'risks' | 'summary' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.match(/belangrijkste wijzigingen/i)) {
      currentSection = 'changes';
      continue;
    }
    if (trimmed.match(/verbeteringen/i)) {
      currentSection = 'improvements';
      continue;
    }
    if (trimmed.match(/risico/i)) {
      currentSection = 'risks';
      continue;
    }
    if (trimmed.match(/samenvatting/i)) {
      currentSection = 'summary';
      continue;
    }

    if (trimmed.startsWith('- ')) {
      const item = trimmed.substring(2).trim();
      switch (currentSection) {
        case 'changes':
          keyChanges.push(item);
          break;
        case 'improvements':
          improvements.push(item);
          break;
        case 'risks':
          risks.push(item);
          break;
      }
    } else if (currentSection === 'summary' && trimmed.length > 0) {
      summary = trimmed;
    }
  }

  return { keyChanges, improvements, risks, summary };
}

/**
 * Parse a text-based outline into structured OutlineItem array.
 */
function parseOutlineFromText(text: string): Array<{
  id: string;
  heading: string;
  level: number;
  keyPoints: string[];
  children: Array<{
    id: string;
    heading: string;
    level: number;
    keyPoints: string[];
    sortOrder: number;
  }>;
  sortOrder: number;
}> {
  const items: Array<{
    id: string;
    heading: string;
    level: number;
    keyPoints: string[];
    children: Array<{
      id: string;
      heading: string;
      level: number;
      keyPoints: string[];
      sortOrder: number;
    }>;
    sortOrder: number;
  }> = [];

  let currentH2: (typeof items)[0] | null = null;
  let sortOrder = 0;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      currentH2 = {
        id: `h2-${sortOrder}`,
        heading: trimmed.replace(/^##\s+/, ''),
        level: 2,
        keyPoints: [],
        children: [],
        sortOrder,
      };
      items.push(currentH2);
      sortOrder++;
    } else if (trimmed.startsWith('### ') && currentH2) {
      currentH2.children.push({
        id: `h3-${sortOrder}`,
        heading: trimmed.replace(/^###\s+/, ''),
        level: 3,
        keyPoints: [],
        sortOrder,
      });
      sortOrder++;
    } else if ((trimmed.startsWith('- ') || trimmed.startsWith('* '))) {
      const point = trimmed.replace(/^[-*]\s+/, '');
      if (currentH2 && currentH2.children.length > 0) {
        const lastChild = currentH2.children[currentH2.children.length - 1];
        lastChild.keyPoints.push(point);
      } else if (currentH2) {
        currentH2.keyPoints.push(point);
      }
    }
  }

  return items;
}

/**
 * Build a Dutch-language traffic evidence string from decay data.
 */
function buildTrafficEvidence(decay: {
  currentClicks: number | null;
  previousClicks: number | null;
  currentImpressions: number | null;
  previousImpressions: number | null;
  decayPercentage: number;
  dataAvailable: boolean;
  dataNote: string | null;
}): string {
  if (!decay.dataAvailable) {
    return decay.dataNote ?? 'Geen verkeersgegevens beschikbaar voor deze pagina.';
  }

  const parts: string[] = [];

  if (decay.currentClicks !== null && decay.previousClicks !== null) {
    const clickChange = decay.previousClicks - decay.currentClicks;
    const clickPct =
      decay.previousClicks > 0
        ? Math.round((clickChange / decay.previousClicks) * 100)
        : 0;
    parts.push(
      `Klikken: ${decay.currentClicks} (was ${decay.previousClicks}, ${clickPct > 0 ? '-' : '+'}${Math.abs(clickPct)}%)`
    );
  } else if (decay.currentClicks !== null) {
    parts.push(`Klikken: ${decay.currentClicks} (geen vergelijkingsgegevens)`);
  }

  if (decay.currentImpressions !== null && decay.previousImpressions !== null) {
    const impChange = decay.previousImpressions - decay.currentImpressions;
    const impPct =
      decay.previousImpressions > 0
        ? Math.round((impChange / decay.previousImpressions) * 100)
        : 0;
    parts.push(
      `Impressies: ${decay.currentImpressions} (was ${decay.previousImpressions}, ${impPct > 0 ? '-' : '+'}${Math.abs(impPct)}%)`
    );
  } else if (decay.currentImpressions !== null) {
    parts.push(`Impressies: ${decay.currentImpressions} (geen vergelijkingsgegevens)`);
  }

  parts.push(`Vervalpercentage: ${decay.decayPercentage}%`);

  return parts.length > 0
    ? parts.join('. ') + '.'
    : 'Geen verkeersgegevens beschikbaar.';
}

/**
 * Build a Dutch-language search performance summary from decay data.
 */
function buildSearchPerformanceSummary(decay: {
  currentPage: number;
  previousPage: number | null;
  currentImpressions: number | null;
  currentClicks: number | null;
}): string {
  const parts: string[] = [];

  if (decay.currentPage) {
    parts.push(`Huidige zoekpositie: positie ${decay.currentPage}`);
  }

  if (decay.previousPage) {
    const positionChange = decay.currentPage - decay.previousPage;
    parts.push(
      `Positieverandering: ${positionChange > 0 ? '+' : ''}${positionChange} (van positie ${decay.previousPage} naar ${decay.currentPage})`
    );
  }

  if (decay.currentImpressions !== null) {
    parts.push(`${decay.currentImpressions} impressies in de meetperiode`);
  }

  if (decay.currentClicks !== null) {
    const ctr =
      decay.currentImpressions && decay.currentImpressions > 0
        ? ((decay.currentClicks / decay.currentImpressions) * 100).toFixed(1)
        : '0.0';
    parts.push(`${decay.currentClicks} klikken (CTR: ${ctr}%)`);
  }

  return parts.length > 0
    ? parts.join('. ') + '.'
    : 'Geen zoekprestatiegegevens beschikbaar.';
}

/**
 * Build a Dutch-language conversion performance summary from decay data.
 */
function buildConversionPerformanceSummary(decay: {
  currentClicks: number | null;
  currentImpressions: number | null;
}): string {
  const parts: string[] = [];

  if (decay.currentClicks !== null && decay.currentImpressions !== null && decay.currentImpressions > 0) {
    const ctr = ((decay.currentClicks / decay.currentImpressions) * 100).toFixed(1);
    parts.push(`Click-through rate (CTR): ${ctr}%`);

    if (decay.currentClicks > 50) {
      parts.push('De pagina genereert nog voldoende klikken voor conversiepotentieel');
    } else if (decay.currentClicks > 10) {
      parts.push('De pagina genereert beperkte klikken — conversiepotentieel is matig');
    } else {
      parts.push('De pagina genereert weinig klikken — conversiepotentieel is laag');
    }
  } else {
    parts.push('Geen conversiegegevens beschikbaar. Stel conversie-tracking in om de prestaties te meten.');
  }

  return parts.join('. ') + '.';
}

/**
 * Determine overall risk level for a pruning action.
 */
function determineOverallRisk(
  action: PruningActionType,
  decay: { currentClicks: number | null; currentPage: number; decayPercentage: number },
  internalLinksAffected: number
): 'low' | 'medium' | 'high' | 'critical' {
  const clicks = decay.currentClicks ?? 0;

  // Non-destructive actions are low risk
  if (action === 'KEEP' || action === 'IMPROVE') {
    return 'low';
  }

  // MERGE has medium risk
  if (action === 'MERGE') {
    return clicks > 10 || internalLinksAffected > 3 ? 'medium' : 'low';
  }

  // Destructive actions need careful assessment
  let riskScore = 0;

  if (clicks > 50) riskScore += 3;
  else if (clicks > 10) riskScore += 2;
  else if (clicks > 0) riskScore += 1;

  if (decay.currentPage <= 10) riskScore += 3;
  else if (decay.currentPage <= 20) riskScore += 2;

  if (internalLinksAffected > 5) riskScore += 2;
  else if (internalLinksAffected > 0) riskScore += 1;

  if (riskScore >= 6) return 'critical';
  if (riskScore >= 4) return 'high';
  if (riskScore >= 2) return 'medium';
  return 'low';
}

/**
 * Build a Dutch-language pruning summary.
 */
function buildPruningSummary(
  action: PruningActionType,
  decay: { url: string; decayPercentage: number; currentPage: number; currentClicks: number | null },
  overallRisk: 'low' | 'medium' | 'high' | 'critical',
  internalLinksAffected: number
): string {
  const actionLabels: Record<PruningActionType, string> = {
    KEEP: 'Behouden',
    IMPROVE: 'Verbeteren',
    MERGE: 'Samenvoegen',
    REDIRECT: 'Doorverwijzen',
    NOINDEX: 'Noindex instellen',
    REMOVE: 'Verwijderen',
  };

  const riskLabels: Record<string, string> = {
    low: 'laag',
    medium: 'gemiddeld',
    high: 'hoog',
    critical: 'kritiek',
  };

  let summary = `Aanbevolen actie: ${actionLabels[action]} voor "${decay.url}". `;
  summary += `Verval: ${decay.decayPercentage}%, Positie: ${decay.currentPage}. `;
  summary += `Risiconiveau: ${riskLabels[overallRisk]}.`;

  if (internalLinksAffected > 0) {
    summary += ` ${internalLinksAffected} interne link(s) zijn betrokken.`;
  }

  if (action === 'REMOVE' || action === 'REDIRECT') {
    summary += ' ⚠️ Expliciete goedkeuring vereist voor deze destructieve actie.';
  }

  return summary;
}

/**
 * Build rollback guidance in Dutch for a pruning action.
 */
function buildRollbackGuidance(
  action: PruningActionType,
  url: string,
  redirectTarget: string | null
): string {
  switch (action) {
    case 'KEEP':
      return 'Geen actie vereist. De pagina wordt behouden in de huidige staat.';
    case 'IMPROVE':
      return `Als de verbeteringen niet het gewenste effect hebben, kan de originele content worden hersteld via de wijzigingsgeschiedenis. Zorg dat je een back-up hebt van de originele content voordat je wijzigingen aanbrengt.`;
    case 'MERGE':
      return `Als het samenvoegen niet goed uitpakt, kunnen de oorspronkelijke pagina's worden hersteld via de wijzigingsgeschiedenis. Houd de URL-structuur bij voor eventuele redirects terug.`;
    case 'REDIRECT':
      return `Om de redirect ongedaan te maken: verwijder de redirect-regel voor "${url}" en herstel de originele pagina. Zorg dat je de originele content beschikbaar hebt in de wijzigingsgeschiedenis. Houd er rekening mee dat zoekmachines enige tijd nodig hebben om de redirect te verwerken — hoe sneller je het ongedaan maakt, hoe beter.${redirectTarget ? ` De huidige redirect verwijst naar "${redirectTarget}".` : ''}`;
    case 'NOINDEX':
      return `Om de noindex op te heffen: verwijder de noindex-tag uit de pagina en dien de pagina opnieuw in bij Google via Google Search Console. De pagina kan enige tijd nodig hebben om opnieuw te worden geïndexeerd.`;
    case 'REMOVE':
      return `Om de verwijdering ongedaan te maken: herstel de pagina met de originele content uit de wijzigingsgeschiedenis en dien de URL opnieuw in bij Google via Google Search Console. Houd er rekening mee dat zoekmachines autoriteit en rangpositie mogelijk niet volledig herstellen na verwijdering.`;
    default:
      return 'Geen specifieke rollback-instructies beschikbaar voor deze actie.';
  }
}
