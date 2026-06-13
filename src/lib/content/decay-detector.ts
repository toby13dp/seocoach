// ============================================================================
// Content Decay Detector — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Detects content decay by comparing current vs. historical metrics,
// recommends pruning actions (KEEP, IMPROVE, MERGE, REDIRECT, NOINDEX, REMOVE),
// and assesses risks before destructive actions. Handles missing historical
// data gracefully with clear Dutch-language notes.
// ============================================================================

import { db } from '@/lib/db';
import type { PruningActionType, RiskAnalysis, RiskFactor } from './types';

// ============================================================================
// Decay Detection Thresholds
// ============================================================================

/** Percentage decay that triggers IMPROVE recommendation */
const DECAY_MODERATE_THRESHOLD = 15;

/** Percentage decay that triggers REDIRECT recommendation */
const DECAY_SEVERE_THRESHOLD = 40;

/** Percentage decay that triggers REMOVE recommendation */
const DECAY_CRITICAL_THRESHOLD = 70;

/** Minimum impressions before decay analysis is meaningful */
const MIN_IMPRESSIONS_FOR_ANALYSIS = 10;

// ============================================================================
// Public API
// ============================================================================

/**
 * Detect content decay across all pages in a project.
 *
 * Compares current and previous metrics (clicks, impressions, position)
 * to identify pages that are losing performance. When historical data
 * is not available, sets `dataAvailable = false` with a note in Dutch.
 *
 * The detection process:
 * 1. Retrieves all ContentDecay records for the project
 * 2. For each page with historical data, calculates decay percentage
 * 3. Recommends a pruning action based on the decay severity
 * 4. For pages without historical data, marks them as needing more time
 * 5. Persists updated results to the ContentDecay table
 *
 * @param projectId - The project to detect decay for
 * @returns Array of ContentDecay records with recommendations
 */
export async function detectDecay(
  projectId: string
): Promise<
  Array<{
    id: string;
    projectId: string;
    pageId: string | null;
    url: string;
    currentPage: number;
    previousPage: number | null;
    currentClicks: number | null;
    previousClicks: number | null;
    currentImpressions: number | null;
    previousImpressions: number | null;
    decayPercentage: number;
    pruningAction: string;
    riskAnalysis: RiskAnalysis | null;
    recommendations: string[];
    dataAvailable: boolean;
    dataNote: string | null;
    detectedAt: Date;
  }>
> {
  // Get all existing decay records for this project
  const existingDecay = await db.contentDecay.findMany({
    where: { projectId },
    orderBy: { decayPercentage: 'desc' },
  });

  // Get all pages for this project that have content
  const pages = await db.page.findMany({
    where: { projectId, status: 'OK' },
    select: {
      id: true,
      url: true,
      wordCount: true,
      title: true,
      crawlSession: {
        select: { id: true },
      },
    },
  });

  const results: Array<{
    id: string;
    projectId: string;
    pageId: string | null;
    url: string;
    currentPage: number;
    previousPage: number | null;
    currentClicks: number | null;
    previousClicks: number | null;
    currentImpressions: number | null;
    previousImpressions: number | null;
    decayPercentage: number;
    pruningAction: string;
    riskAnalysis: RiskAnalysis | null;
    recommendations: string[];
    dataAvailable: boolean;
    dataNote: string | null;
    detectedAt: Date;
  }> = [];

  for (const page of pages) {
    // Check if we already have a decay record for this page
    const existing = existingDecay.find(
      (d) => d.pageId === page.id || d.url === page.url
    );

    // Determine if historical data is available
    const hasHistoricalData =
      existing !== undefined &&
      (existing.previousClicks !== null ||
        existing.previousImpressions !== null ||
        existing.previousPage !== null);

    if (!hasHistoricalData) {
      // No historical data available - create/update record with note
      const dataNote =
        'Er is nog niet genoeg historische data om een trend te berekenen. Kom later terug voor een analyse.';

      let recordId: string;
      if (existing) {
        await db.contentDecay.update({
          where: { id: existing.id },
          data: {
            dataAvailable: false,
            dataNote,
            pruningAction: 'KEEP' as never,
            riskAnalysis: null,
            recommendations: JSON.stringify([
              'Wacht tot er voldoende historische data is verzameld voordat je actie onderneemt.',
            ]),
          },
        });
        recordId = existing.id;
      } else {
        const created = await db.contentDecay.create({
          data: {
            projectId,
            pageId: page.id,
            url: page.url,
            currentPage: 1,
            previousPage: null,
            currentClicks: null,
            previousClicks: null,
            currentImpressions: null,
            previousImpressions: null,
            decayPercentage: 0,
            pruningAction: 'KEEP' as never,
            riskAnalysis: null,
            recommendations: JSON.stringify([
              'Wacht tot er voldoende historische data is verzameld voordat je actie onderneemt.',
            ]),
            dataAvailable: false,
            dataNote,
          },
        });
        recordId = created.id;
      }

      results.push({
        id: recordId,
        projectId,
        pageId: page.id,
        url: page.url,
        currentPage: 1,
        previousPage: null,
        currentClicks: null,
        previousClicks: null,
        currentImpressions: null,
        previousImpressions: null,
        decayPercentage: 0,
        pruningAction: 'KEEP',
        riskAnalysis: null,
        recommendations: [
          'Wacht tot er voldoende historische data is verzameld voordat je actie onderneemt.',
        ],
        dataAvailable: false,
        dataNote,
        detectedAt: new Date(),
      });

      continue;
    }

    // Historical data available - calculate decay
    const decayPercentage = calculateDecayPercentage(
      existing!.currentClicks,
      existing!.previousClicks,
      existing!.currentImpressions,
      existing!.previousImpressions,
      existing!.currentPage,
      existing!.previousPage
    );

    // Recommend pruning action
    const pruningAction = recommendPruningAction({
      decayPercentage,
      currentClicks: existing!.currentClicks,
      currentPage: existing!.currentPage,
      currentImpressions: existing!.currentImpressions,
    });

    // Assess risk for the recommended action
    const riskAnalysis = assessPruningRisk({
      url: existing!.url,
      currentClicks: existing!.currentClicks,
      currentImpressions: existing!.currentImpressions,
      currentPage: existing!.currentPage,
      decayPercentage,
      pruningAction,
    });

    // Generate recommendations
    const recommendations = generateDecayRecommendations(
      decayPercentage,
      pruningAction,
      existing!.currentPage
    );

    // Update the record
    await db.contentDecay.update({
      where: { id: existing!.id },
      data: {
        decayPercentage,
        pruningAction: pruningAction as never,
        riskAnalysis: JSON.stringify(riskAnalysis),
        recommendations: JSON.stringify(recommendations),
        dataAvailable: true,
        dataNote: null,
      },
    });

    results.push({
      id: existing!.id,
      projectId,
      pageId: existing!.pageId,
      url: existing!.url,
      currentPage: existing!.currentPage,
      previousPage: existing!.previousPage,
      currentClicks: existing!.currentClicks,
      previousClicks: existing!.previousClicks,
      currentImpressions: existing!.currentImpressions,
      previousImpressions: existing!.previousImpressions,
      decayPercentage,
      pruningAction,
      riskAnalysis,
      recommendations,
      dataAvailable: true,
      dataNote: null,
      detectedAt: existing!.detectedAt,
    });
  }

  // Also include decay records that don't have matching pages
  // (e.g., URLs that were removed from the site but still tracked)
  for (const existing of existingDecay) {
    const alreadyIncluded = results.some((r) => r.id === existing.id);
    if (!alreadyIncluded) {
      let riskAnalysisParsed: RiskAnalysis | null = null;
      if (existing.riskAnalysis) {
        try {
          riskAnalysisParsed = JSON.parse(existing.riskAnalysis);
        } catch {
          riskAnalysisParsed = null;
        }
      }

      let recommendationsParsed: string[] = [];
      if (existing.recommendations) {
        try {
          recommendationsParsed = JSON.parse(existing.recommendations);
        } catch {
          recommendationsParsed = [];
        }
      }

      results.push({
        id: existing.id,
        projectId: existing.projectId,
        pageId: existing.pageId,
        url: existing.url,
        currentPage: existing.currentPage,
        previousPage: existing.previousPage,
        currentClicks: existing.currentClicks,
        previousClicks: existing.previousClicks,
        currentImpressions: existing.currentImpressions,
        previousImpressions: existing.previousImpressions,
        decayPercentage: existing.decayPercentage,
        pruningAction: existing.pruningAction,
        riskAnalysis: riskAnalysisParsed,
        recommendations: recommendationsParsed,
        dataAvailable: existing.dataAvailable,
        dataNote: existing.dataNote,
        detectedAt: existing.detectedAt,
      });
    }
  }

  // Sort by decay percentage descending (most decayed first)
  return results.sort((a, b) => b.decayPercentage - a.decayPercentage);
}

/**
 * Recommend a pruning action based on content decay severity.
 *
 * The recommendation logic:
 * - KEEP: No significant decay (< 15%)
 * - IMPROVE: Moderate decay (15-39%), content can be refreshed
 * - MERGE: Moderate decay with similar content that should be combined
 * - REDIRECT: Severe decay (40-69%), redirect to better content
 * - NOINDEX: Low quality, remove from search index
 * - REMOVE: No value (70%+), should be deleted
 *
 * @param decay - The decay data to analyze
 * @returns The recommended pruning action
 */
export function recommendPruningAction(decay: {
  decayPercentage: number;
  currentClicks?: number | null;
  currentPage?: number | null;
  currentImpressions?: number | null;
}): PruningActionType {
  const { decayPercentage, currentClicks, currentPage, currentImpressions } =
    decay;

  // If still getting good traffic, recommend improvement over deletion
  const hasTraffic = (currentClicks ?? 0) > 0;
  const hasVisibility = (currentImpressions ?? 0) > 0;
  const isOnFirstPage = (currentPage ?? 100) <= 10;

  // Critical decay - content is essentially dead
  if (decayPercentage >= DECAY_CRITICAL_THRESHOLD) {
    if (hasTraffic || hasVisibility) {
      return 'REDIRECT'; // Still some value, redirect it
    }
    return 'REMOVE'; // No value at all
  }

  // Severe decay - strong action needed
  if (decayPercentage >= DECAY_SEVERE_THRESHOLD) {
    if (isOnFirstPage && hasTraffic) {
      return 'IMPROVE'; // Still ranking, worth saving
    }
    if (hasVisibility && !hasTraffic) {
      return 'NOINDEX'; // Visible but not clicking through = quality issue
    }
    return 'REDIRECT';
  }

  // Moderate decay - refresh recommended
  if (decayPercentage >= DECAY_MODERATE_THRESHOLD) {
    if (isOnFirstPage) {
      return 'IMPROVE'; // Still ranking, definitely worth refreshing
    }
    return 'MERGE'; // Combine with better-performing content
  }

  // No significant decay
  return 'KEEP';
}

/**
 * Assess the risk of a pruning action before it is executed.
 *
 * Warns about potential negative impacts of destructive actions,
 * considering backlinks, traffic, authority, and redirect targets.
 * The risk assessment helps prevent accidentally removing valuable content.
 *
 * Risk factors considered:
 * - **Backlinks**: Content with backlinks loses link equity if removed
 * - **Traffic**: Content still receiving traffic should not be removed lightly
 * - **Authority**: Content ranking for valuable keywords has authority value
 * - **Redirect target**: Redirects need a valid target to pass equity to
 * - **Content value**: Content with unique value should be preserved
 *
 * @param decay - The decay record with pruning action recommendation
 * @returns A comprehensive risk analysis with factors and precautions
 */
export function assessPruningRisk(decay: {
  url: string;
  currentClicks?: number | null;
  currentImpressions?: number | null;
  currentPage?: number | null;
  decayPercentage: number;
  pruningAction: PruningActionType;
}): RiskAnalysis {
  const factors: RiskFactor[] = [];
  const precautions: string[] = [];

  // KEEP actions have no risk
  if (decay.pruningAction === 'KEEP') {
    return {
      riskLevel: 'low',
      factors: [],
      summary:
        'Geen actie vereist. De content vertoont geen significante achteruitgang.',
      precautions: [],
    };
  }

  // Check traffic risk
  const clicks = decay.currentClicks ?? 0;
  const impressions = decay.currentImpressions ?? 0;

  if (clicks > 50) {
    factors.push({
      type: 'traffic',
      description: `Deze pagina ontvangt nog steeds ${clicks} klikken per periode. Verwijdering kan leiden tot verlies van waardevol verkeer.`,
      severity: 'high',
    });
    precautions.push(
      'Zorg dat er een alternatieve pagina is die dit verkeer kan opvangen.'
    );
  } else if (clicks > 10) {
    factors.push({
      type: 'traffic',
      description: `Deze pagina ontvangt nog ${clicks} klikken per periode. Houd hier rekening mee bij het nemen van actie.`,
      severity: 'medium',
    });
  }

  // Check authority/ranking risk
  const page = decay.currentPage ?? 100;
  if (page <= 10) {
    factors.push({
      type: 'authority',
      description: `Deze pagina staat nog op pagina ${page} in de zoekresultaten. De autoriteit van deze pagina gaat verloren bij verwijdering.`,
      severity: 'high',
    });
    precautions.push(
      'Overweeg de content te vernieuwen in plaats van te verwijderen, om de bestaande autoriteit te behouden.'
    );
  } else if (page <= 20) {
    factors.push({
      type: 'authority',
      description: `Deze pagina staat op pagina ${page}. Er is nog enige zichtbaarheid die verloren gaat.`,
      severity: 'medium',
    });
  }

  // Check impression risk (indicates search visibility)
  if (impressions > 100) {
    factors.push({
      type: 'authority',
      description: `Met ${impressions} impressies per periode heeft deze pagina nog aanzienlijke zichtbaarheid in de zoekresultaten.`,
      severity: 'medium',
    });
    precautions.push(
      'Controleer of de impressies leiden naar klikken. Hoge impressies maar weinig klikken wijzen op een titel- of metabeschrijvingsprobleem.'
    );
  }

  // Action-specific risks
  switch (decay.pruningAction) {
    case 'REMOVE':
      factors.push({
        type: 'backlinks',
        description:
          'Bij verwijdering gaan alle inkomende backlinks naar deze pagina verloren. Controleer de backlinkprofiel voordat je de pagina verwijdert.',
        severity: 'high',
      });
      precautions.push(
        'Controleer het backlinkprofiel van deze pagina in je SEO-tool voordat je deze verwijdert.'
      );
      precautions.push(
        'Overweeg een 301-redirect naar een relevante pagina in plaats van de pagina te verwijderen.'
      );
      break;

    case 'REDIRECT':
      factors.push({
        type: 'redirect_target',
        description:
          'De redirect moet wijzen naar een pagina die dezelfde zoekintentie beantwoordt, anders gaat linkwaarde verloren.',
        severity: 'medium',
      });
      precautions.push(
        'Kies een redirect-doelpagina die topisch verwant is aan de originele pagina.'
      );
      precautions.push(
        'Gebruik een 301-redirect (permanent), geen 302 (tijdelijk), om linkwaarde door te geven.'
      );
      break;

    case 'NOINDEX':
      factors.push({
        type: 'content_value',
        description:
          'Een noindex-instructie verwijdert de pagina uit de zoekresultaten maar behoudt de content. De pagina kan nog steeds verkeer ontvangen via interne links.',
        severity: 'low',
      });
      precautions.push(
        'Controleer regelmatig of de noindex-pagina nog relevant is of verwijderd kan worden.'
      );
      break;

    case 'MERGE':
      factors.push({
        type: 'redirect_target',
        description:
          'Na het samenvoegen moet de oude URL redirecten naar de nieuwe, gecombineerde pagina.',
        severity: 'medium',
      });
      precautions.push(
        'Zorg dat de samengevoegde content alle waardevolle informatie van beide pagina\'s bevat.'
      );
      precautions.push(
        'Stel een 301-redirect in van de oude URL naar de nieuwe pagina.'
      );
      break;

    case 'IMPROVE':
      factors.push({
        type: 'content_value',
        description:
          'De content heeft waarde maar moet worden ververst. De bestaande autoriteit kan worden behouden door de content te verbeteren.',
        severity: 'low',
      });
      precautions.push(
        'Werk de content bij met actuele informatie, nieuwe voorbeelden en verbeterde structuur.'
      );
      break;
  }

  // Determine overall risk level
  const hasHighSeverity = factors.some((f) => f.severity === 'high');
  const hasMediumSeverity = factors.some((f) => f.severity === 'medium');

  let riskLevel: RiskAnalysis['riskLevel'];
  if (hasHighSeverity) {
    riskLevel = 'high';
  } else if (hasMediumSeverity) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  // Critical risk: REMOVE action with high severity factors
  if (decay.pruningAction === 'REMOVE' && hasHighSeverity) {
    riskLevel = 'critical';
  }

  // Build summary
  const summary = buildRiskSummary(decay.pruningAction, riskLevel, factors);

  return {
    riskLevel,
    factors,
    summary,
    precautions,
  };
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Calculate the decay percentage based on current vs. previous metrics.
 *
 * Uses a weighted combination of clicks, impressions, and position changes.
 * Returns 0 if there's insufficient data to calculate a meaningful percentage.
 *
 * Weights:
 * - Clicks: 40% (most important for business value)
 * - Impressions: 30% (indicates visibility)
 * - Position: 30% (indicates ranking health)
 */
function calculateDecayPercentage(
  currentClicks: number | null,
  previousClicks: number | null,
  currentImpressions: number | null,
  previousImpressions: number | null,
  currentPage: number | null,
  previousPage: number | null
): number {
  let clickDecay = 0;
  let impressionDecay = 0;
  let positionDecay = 0;
  let components = 0;

  // Calculate click decay
  if (
    currentClicks !== null &&
    previousClicks !== null &&
    previousClicks > 0
  ) {
    clickDecay = Math.max(
      0,
      ((previousClicks - currentClicks) / previousClicks) * 100
    );
    components++;
  }

  // Calculate impression decay
  if (
    currentImpressions !== null &&
    previousImpressions !== null &&
    previousImpressions > MIN_IMPRESSIONS_FOR_ANALYSIS
  ) {
    impressionDecay = Math.max(
      0,
      ((previousImpressions - currentImpressions) / previousImpressions) * 100
    );
    components++;
  }

  // Calculate position decay (higher page = worse)
  if (currentPage !== null && previousPage !== null) {
    // Position decay: moving from page 1 to page 3 is significant
    const positionChange = currentPage - previousPage;
    if (positionChange > 0) {
      // Got worse - calculate decay based on magnitude
      positionDecay = Math.min(100, positionChange * 20); // Each page drop = 20% decay
    }
    components++;
  }

  if (components === 0) return 0;

  // Weighted average
  const weightedDecay =
    (clickDecay * 0.4 + impressionDecay * 0.3 + positionDecay * 0.3);

  return Math.round(Math.max(0, Math.min(100, weightedDecay)));
}

/**
 * Generate Dutch recommendations for content decay.
 */
function generateDecayRecommendations(
  decayPercentage: number,
  pruningAction: PruningActionType,
  currentPage?: number | null
): string[] {
  const recommendations: string[] = [];

  switch (pruningAction) {
    case 'KEEP':
      recommendations.push(
        'De content vertoont geen significante achteruitgang. Monitor de prestaties regelmatig.'
      );
      if (decayPercentage > 0 && decayPercentage < DECAY_MODERATE_THRESHOLD) {
        recommendations.push(
          'Er is een lichte daling zichtbaar. Overweeg preventief de content actueel te houden.'
        );
      }
      break;

    case 'IMPROVE':
      recommendations.push(
        `De content vertoont ${decayPercentage}% achteruitgang. Vernieuw de content met actuele informatie.`
      );
      recommendations.push(
        'Voeg nieuwe secties toe, werk verouderde data bij en versterk de E-E-A-T signalen.'
      );
      if (currentPage && currentPage > 10) {
        recommendations.push(
          'De pagina is gezakt in de zoekresultaten. Optimaliseer de titel en metabeschrijving om de klikfrequentie te verbeteren.'
        );
      }
      recommendations.push(
        'Controleer of concurrenten nieuwe content hebben gepubliceerd die jouw pagina voorbijstreeft.'
      );
      break;

    case 'MERGE':
      recommendations.push(
        `De content vertoont ${decayPercentage}% achteruitgang en overlapt mogelijk met andere pagina's. Overweeg de content samen te voegen.`
      );
      recommendations.push(
        'Identificeer de best presterende pagina over hetzelfde onderwerp en voeg de waardevolle content daar aan toe.'
      );
      recommendations.push(
        'Stel een 301-redirect in van de oude URL naar de samengevoegde pagina om linkwaarde te behouden.'
      );
      break;

    case 'REDIRECT':
      recommendations.push(
        `De content vertoont ${decayPercentage}% ernstige achteruitgang. Redirect de pagina naar een relevantere pagina.`
      );
      recommendations.push(
        'Kies een doelpagina die dezelfde zoekintentie beantwoordt om linkwaarde door te geven.'
      );
      recommendations.push(
        'Gebruik een 301-redirect en update interne links die naar de oude URL verwijzen.'
      );
      break;

    case 'NOINDEX':
      recommendations.push(
        'De content ontvangt wel impressies maar nauwelijks klikken. Dit wijst op een kwaliteits- of relevantieprobleem.'
      );
      recommendations.push(
        'Voeg een noindex-tag toe om de pagina uit de zoekresultaten te halen, of verbeter de content aanzienlijk.'
      );
      recommendations.push(
        'Controleer of de titel en metabeschrijving aansluiten bij de zoekintentie.'
      );
      break;

    case 'REMOVE':
      recommendations.push(
        `De content vertoont ${decayPercentage}% kritieke achteruitgang en heeft geen meetbare waarde meer. Overweeg de pagina te verwijderen.`
      );
      recommendations.push(
        'Controleer het backlinkprofiel voordat je de pagina verwijdert. Bij backlinks is een redirect veiliger.'
      );
      recommendations.push(
        'Verwijder ook interne links naar deze pagina en update de sitemap.'
      );
      break;
  }

  return recommendations;
}

/**
 * Build a Dutch risk summary based on the pruning action and risk factors.
 */
function buildRiskSummary(
  action: PruningActionType,
  riskLevel: RiskAnalysis['riskLevel'],
  factors: RiskFactor[]
): string {
  const actionLabels: Record<PruningActionType, string> = {
    KEEP: 'Behouden',
    IMPROVE: 'Vernieuwen',
    MERGE: 'Samenvoegen',
    REDIRECT: 'Redirecten',
    NOINDEX: 'Uit index verwijderen',
    REMOVE: 'Verwijderen',
  };

  const riskLabels: Record<RiskAnalysis['riskLevel'], string> = {
    low: 'laag',
    medium: 'gemiddeld',
    high: 'hoog',
    critical: 'kritiek',
  };

  const actionLabel = actionLabels[action];
  const riskLabel = riskLabels[riskLevel];

  if (factors.length === 0) {
    return `Actie "${actionLabel}" heeft een ${riskLabel} risico. Geen specifieke risicofactoren geïdentificeerd.`;
  }

  const highFactors = factors.filter((f) => f.severity === 'high');
  const mediumFactors = factors.filter((f) => f.severity === 'medium');

  const parts: string[] = [];
  parts.push(
    `Actie "${actionLabel}" heeft een ${riskLabel} risico.`
  );

  if (highFactors.length > 0) {
    parts.push(
      `${highFactors.length} hoog-risico factor(en): ${highFactors.map((f) => f.type).join(', ')}.`
    );
  }

  if (mediumFactors.length > 0) {
    parts.push(
      `${mediumFactors.length} gemiddeld-risico factor(en): ${mediumFactors.map((f) => f.type).join(', ')}.`
    );
  }

  return parts.join(' ');
}
