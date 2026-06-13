// ============================================================================
// Roadmap Generator — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Generates roadmap recommendations from various data sources within a project:
// technical issues, keyword opportunities, content decay, and internal links.
// Placeholder sources (competitor, GEO, local SEO, e-commerce, CRO, revenue)
// are prepared for future phases.
//
// IMPORTANT: This module never fabricates data. Recommendations are only
// generated when real data exists in the project.
// ============================================================================

import { db } from '@/lib/db';
import type { ActionPriority, ActionEffort } from '@prisma/client';
import type {
  RoadmapRecommendation,
  RoadmapView,
  RoadmapItemType,
} from './types';

// ============================================================================
// Priority / Effort → View Mapping Helpers
// ============================================================================

/**
 * Determine the suggested timeline view based on priority and effort.
 *
 * Rules:
 * - CRITICAL + MINIMAL/LOW effort → TODAY
 * - CRITICAL + MEDIUM/HIGH effort → THIS_WEEK
 * - HIGH + MINIMAL/LOW effort → THIS_WEEK
 * - HIGH + MEDIUM effort → THIS_MONTH
 * - HIGH + HIGH effort → NINETY_DAYS
 * - MEDIUM + any effort → NINETY_DAYS
 * - LOW + any effort → LATER
 */
function suggestView(priority: ActionPriority, effort: ActionEffort): RoadmapView {
  if (priority === 'CRITICAL') {
    return effort === 'MINIMAL' || effort === 'LOW' ? 'TODAY' : 'THIS_WEEK';
  }
  if (priority === 'HIGH') {
    if (effort === 'MINIMAL' || effort === 'LOW') return 'THIS_WEEK';
    if (effort === 'MEDIUM') return 'THIS_MONTH';
    return 'NINETY_DAYS';
  }
  if (priority === 'MEDIUM') {
    return 'NINETY_DAYS';
  }
  return 'LATER';
}

/**
 * Calculate a suggested date based on priority and effort.
 * Used as a rough scheduling guide.
 */
function suggestDate(priority: ActionPriority, effort: ActionEffort): Date {
  const now = new Date();
  const daysToAdd: Record<ActionPriority, Record<ActionEffort, number>> = {
    CRITICAL: { MINIMAL: 0, LOW: 1, MEDIUM: 3, HIGH: 5 },
    HIGH: { MINIMAL: 1, LOW: 2, MEDIUM: 7, HIGH: 14 },
    MEDIUM: { MINIMAL: 7, LOW: 14, MEDIUM: 30, HIGH: 60 },
    LOW: { MINIMAL: 30, LOW: 60, MEDIUM: 60, HIGH: 90 },
  };
  const days = daysToAdd[priority][effort];
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Map TechnicalIssue severity to ActionPriority.
 */
function severityToPriority(severity: string): ActionPriority {
  switch (severity) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'ERROR':
      return 'HIGH';
    case 'WARNING':
      return 'MEDIUM';
    case 'INFO':
      return 'LOW';
    default:
      return 'MEDIUM';
  }
}

/**
 * Map TechnicalIssue auto-fix availability and severity to effort.
 */
function issueToEffort(severity: string, autoFixAvailable: boolean): ActionEffort {
  if (autoFixAvailable) return 'MINIMAL';
  switch (severity) {
    case 'CRITICAL':
    case 'ERROR':
      return 'HIGH';
    case 'WARNING':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

/**
 * Map decay percentage to priority.
 */
function decayToPriority(decayPercentage: number): ActionPriority {
  if (decayPercentage >= 70) return 'CRITICAL';
  if (decayPercentage >= 40) return 'HIGH';
  if (decayPercentage >= 15) return 'MEDIUM';
  return 'LOW';
}

/**
 * Map decay percentage to effort.
 */
function decayToEffort(decayPercentage: number): ActionEffort {
  if (decayPercentage >= 70) return 'HIGH';
  if (decayPercentage >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Map opportunity score to priority.
 */
function opportunityToPriority(score: number): ActionPriority {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Map opportunity score to effort.
 */
function opportunityToEffort(score: number): ActionEffort {
  if (score >= 80) return 'LOW';
  if (score >= 60) return 'MEDIUM';
  return 'HIGH';
}

// ============================================================================
// Source Generators
// ============================================================================

/**
 * Generate recommendations from non-dismissed technical issues.
 * Only produces recommendations when real issues exist in the database.
 */
async function generateFromTechnicalIssues(projectId: string): Promise<RoadmapRecommendation[]> {
  const issues = await db.technicalIssue.findMany({
    where: {
      projectId,
      dismissed: false,
    },
    orderBy: [
      { severity: 'desc' },
      { priority: 'desc' },
    ],
  });

  if (issues.length === 0) return [];

  return issues.map((issue) => {
    const priority = issue.priority ?? severityToPriority(issue.severity);
    const effort = issueToEffort(issue.severity, issue.autoFixAvailable);

    return {
      type: 'TECHNICAL_ISSUE' as RoadmapItemType,
      sourceType: 'technical_issue',
      sourceId: issue.id,
      title: `Technisch probleem: ${issue.dutchExplanation || issue.ruleName}`,
      description: issue.dutchExplanation || issue.ruleName,
      priority,
      effort,
      impact: issue.impact || 'Kan de zoekmachineprestaties negatief beïnvloeden',
      recommendation: issue.recommendedAction || 'Los dit technische probleem op om de SEO-prestaties te verbeteren',
      suggestedView: suggestView(priority, effort),
      suggestedDate: suggestDate(priority, effort),
    };
  });
}

/**
 * Generate recommendations from high-opportunity keywords.
 * Only produces recommendations when keywords with opportunity scores exist.
 */
async function generateFromKeywordOpportunities(projectId: string): Promise<RoadmapRecommendation[]> {
  const keywords = await db.keyword.findMany({
    where: {
      projectId,
      deletedAt: null,
      opportunity: {
        totalScore: { gte: 30 },
      },
    },
    include: {
      opportunity: true,
    },
    orderBy: {
      opportunity: {
        totalScore: 'desc',
      },
    },
    take: 50,
  });

  if (keywords.length === 0) return [];

  return keywords
    .filter((kw) => kw.opportunity !== null)
    .map((kw) => {
      const score = kw.opportunity!.totalScore;
      const priority = opportunityToPriority(score);
      const effort = opportunityToEffort(score);

      let description = `Zoekwoord "${kw.keyword}" heeft een opportunityscore van ${Math.round(score)}/100`;
      if (kw.searchVolume) {
        description += ` met een zoekvolume van ${kw.searchVolume}`;
      }
      if (kw.currentRanking) {
        description += `. Huidige positie: ${kw.currentRanking}`;
      }

      let recommendation = 'Optimaliseer content voor dit zoekwoord om de zichtbaarheid te vergroten';
      if (kw.currentRanking && kw.currentRanking >= 11 && kw.currentRanking <= 20) {
        recommendation = 'Verbond de content om van pagina 2 naar pagina 1 te stijgen — dit levert snel winst op';
      } else if (kw.currentRanking && kw.currentRanking >= 4 && kw.currentRanking <= 10) {
        recommendation = 'Verbond de content om de top-3 positie te bereiken';
      } else if (!kw.currentRanking || kw.currentRanking > 20) {
        recommendation = 'Creëer nieuwe content gericht op dit zoekwoord';
      }

      return {
        type: 'KEYWORD_OPPORTUNITY' as RoadmapItemType,
        sourceType: 'keyword',
        sourceId: kw.id,
        title: `Zoekwoordkans: ${kw.keyword}`,
        description,
        priority,
        effort,
        impact: `Potentiële stijging in zichtbaarheid en organisch verkeer`,
        recommendation,
        suggestedView: suggestView(priority, effort),
        suggestedDate: suggestDate(priority, effort),
      };
    });
}

/**
 * Generate recommendations from content decay detection.
 * Only produces recommendations when decay records exist.
 */
async function generateFromContentDecay(projectId: string): Promise<RoadmapRecommendation[]> {
  const decayRecords = await db.contentDecay.findMany({
    where: {
      projectId,
      dataAvailable: true,
      decayPercentage: { gt: 0 },
    },
    orderBy: {
      decayPercentage: 'desc',
    },
  });

  if (decayRecords.length === 0) return [];

  return decayRecords.map((decay) => {
    const priority = decayToPriority(decay.decayPercentage);
    const effort = decayToEffort(decay.decayPercentage);

    let recommendation = 'Herzie en werk de content bij om het verlies aan prestaties te stoppen';
    if (decay.pruningAction === 'REMOVE') {
      recommendation = 'Overweeg om deze pagina te verwijderen en te redirecten';
    } else if (decay.pruningAction === 'REDIRECT') {
      recommendation = 'Redirect deze pagina naar een relevantere pagina';
    } else if (decay.pruningAction === 'MERGE') {
      recommendation = 'Voeg deze content samen met een gerelateerde pagina';
    } else if (decay.pruningAction === 'IMPROVE') {
      recommendation = 'Werk de content bij met actuele informatie en betere optimalisatie';
    } else if (decay.pruningAction === 'NOINDEX') {
      recommendation = 'Overweeg om deze pagina te no-indexeren als deze geen waarde toevoegt';
    }

    return {
      type: 'DECAY' as RoadmapItemType,
      sourceType: 'content_decay',
      sourceId: decay.id,
      title: `Inhoudveroudering: ${decay.url}`,
      description: `Deze pagina toont ${Math.round(decay.decayPercentage)}% achteruitgang in prestaties`,
      priority,
      effort,
      impact: `Verlies van organisch verkeer en posities als er niet wordt gehandeld`,
      recommendation,
      suggestedView: suggestView(priority, effort),
      suggestedDate: suggestDate(priority, effort),
    };
  });
}

/**
 * Generate recommendations from pending internal link suggestions.
 * Only produces recommendations when pending links exist.
 */
async function generateFromInternalLinks(projectId: string): Promise<RoadmapRecommendation[]> {
  const links = await db.internalLink.findMany({
    where: {
      projectId,
      status: 'PENDING',
      deletedAt: null,
    },
    orderBy: {
      confidence: 'desc',
    },
    take: 30,
  });

  if (links.length === 0) return [];

  // Group by strategy for batch recommendations
  const byStrategy: Record<string, typeof links> = {};
  for (const link of links) {
    const key = link.strategy;
    if (!byStrategy[key]) byStrategy[key] = [];
    byStrategy[key].push(link);
  }

  const recommendations: RoadmapRecommendation[] = [];

  for (const [strategy, strategyLinks] of Object.entries(byStrategy)) {
    const count = strategyLinks.length;
    const avgConfidence = strategyLinks.reduce((sum, l) => sum + l.confidence, 0) / count;

    // Use the highest-confidence link as the representative source
    const topLink = strategyLinks[0];
    const priority: ActionPriority = avgConfidence >= 0.8 ? 'HIGH' : avgConfidence >= 0.5 ? 'MEDIUM' : 'LOW';
    const effort: ActionEffort = count <= 5 ? 'LOW' : count <= 15 ? 'MEDIUM' : 'HIGH';

    const strategyLabels: Record<string, string> = {
      SEMANTIC: 'Semantisch',
      TOPIC_CLUSTER: 'Onderwerpcluster',
      ORPHAN_PAGE: 'Weespagina',
      STRONG_PAGE: 'Sterke pagina',
      BROKEN_REPLACEMENT: 'Vervanging van kapotte link',
    };

    recommendations.push({
      type: 'INTERNAL_LINK' as RoadmapItemType,
      sourceType: 'internal_link',
      sourceId: topLink.id,
      title: `Interne links: ${strategyLabels[strategy] || strategy} (${count} suggesties)`,
      description: `${count} interne linksuggesties met een gemiddelde betrouwbaarheid van ${Math.round(avgConfidence * 100)}%`,
      priority,
      effort,
      impact: 'Betere interne linkstructuur verbetert de crawlbudget-toewijzing en paginacentraliteit',
      recommendation: `Beoordeel en keur de ${count} ${strategyLabels[strategy] || strategy} linksuggesties goed`,
      suggestedView: suggestView(priority, effort),
      suggestedDate: suggestDate(priority, effort),
    });
  }

  return recommendations;
}

// ============================================================================
// Placeholder Generators (for future phases)
// ============================================================================

/**
 * Placeholder for competitor-based recommendations.
 * Will be implemented in a future phase when competitor data is available.
 */
async function generateFromCompetitors(_projectId: string): Promise<RoadmapRecommendation[]> {
  // No competitor data sources yet — return empty array
  return [];
}

/**
 * Placeholder for GEO (Generative Engine Optimization) recommendations.
 */
async function generateFromGEO(_projectId: string): Promise<RoadmapRecommendation[]> {
  return [];
}

/**
 * Placeholder for local SEO recommendations.
 */
async function generateFromLocalSEO(_projectId: string): Promise<RoadmapRecommendation[]> {
  return [];
}

/**
 * Placeholder for e-commerce recommendations.
 */
async function generateFromEcommerce(_projectId: string): Promise<RoadmapRecommendation[]> {
  return [];
}

/**
 * Placeholder for CRO (Conversion Rate Optimization) recommendations.
 */
async function generateFromCRO(_projectId: string): Promise<RoadmapRecommendation[]> {
  return [];
}

/**
 * Placeholder for revenue-based recommendations.
 */
async function generateFromRevenue(_projectId: string): Promise<RoadmapRecommendation[]> {
  return [];
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate roadmap recommendations from all available project data sources.
 *
 * Gathers data from:
 * - Technical issues (severity-based priority)
 * - Keyword opportunities (high-opportunity keywords)
 * - Content decay (declining pages)
 * - Internal link suggestions (pending)
 * - Placeholders for competitor, GEO, local SEO, e-commerce, CRO, revenue
 *
 * IMPORTANT: Never fabricates data — only generates recommendations
 * when real data exists in the project.
 *
 * @param projectId - The project to generate recommendations for
 * @returns Array of RoadmapRecommendation, sorted by priority then effort
 */
export async function generateRoadmapRecommendations(
  projectId: string,
): Promise<RoadmapRecommendation[]> {
  // Run all source generators in parallel for efficiency
  const [
    technicalIssues,
    keywordOpportunities,
    contentDecay,
    internalLinks,
    competitors,
    geo,
    localSeo,
    ecommerce,
    cro,
    revenue,
  ] = await Promise.all([
    generateFromTechnicalIssues(projectId),
    generateFromKeywordOpportunities(projectId),
    generateFromContentDecay(projectId),
    generateFromInternalLinks(projectId),
    generateFromCompetitors(projectId),
    generateFromGEO(projectId),
    generateFromLocalSEO(projectId),
    generateFromEcommerce(projectId),
    generateFromCRO(projectId),
    generateFromRevenue(projectId),
  ]);

  const all = [
    ...technicalIssues,
    ...keywordOpportunities,
    ...contentDecay,
    ...internalLinks,
    ...competitors,
    ...geo,
    ...localSeo,
    ...ecommerce,
    ...cro,
    ...revenue,
  ];

  // Sort by priority (CRITICAL first), then by effort (MINIMAL first)
  const priorityOrder: Record<ActionPriority, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  const effortOrder: Record<ActionEffort, number> = {
    MINIMAL: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
  };

  all.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return effortOrder[a.effort] - effortOrder[b.effort];
  });

  return all;
}

/**
 * Categorize recommendations into timeline views based on their
 * priority and effort. Each recommendation gets a suggestedView
 * and suggestedDate assigned.
 *
 * @param recommendations - The recommendations to categorize
 * @returns The same array with suggestedView and suggestedDate populated
 */
export function categorizeByTimeline(
  recommendations: RoadmapRecommendation[],
): RoadmapRecommendation[] {
  return recommendations.map((rec) => ({
    ...rec,
    suggestedView: suggestView(rec.priority, rec.effort),
    suggestedDate: rec.suggestedDate ?? suggestDate(rec.priority, rec.effort),
  }));
}

/**
 * Save roadmap recommendations to the database as RoadmapItem records.
 * Each recommendation is persisted with its source reference and Dutch text.
 *
 * @param projectId - The project to save recommendations for
 * @param recommendations - The recommendations to persist
 * @returns The number of items saved
 */
export async function saveRoadmapItems(
  projectId: string,
  recommendations: RoadmapRecommendation[],
): Promise<number> {
  if (recommendations.length === 0) return 0;

  const results = await db.$transaction(
    recommendations.map((rec, index) =>
      db.roadmapItem.create({
        data: {
          projectId,
          type: rec.type,
          title: rec.title,
          description: rec.description,
          sourceType: rec.sourceType,
          sourceId: rec.sourceId,
          priority: rec.priority,
          effort: rec.effort,
          impact: rec.impact,
          recommendation: rec.recommendation,
          view: rec.suggestedView,
          scheduledDate: rec.suggestedDate,
          sortOrder: index,
          status: 'PENDING',
          autoGenerated: true,
        },
      }),
    ),
  );

  return results.length;
}

/**
 * Refresh the entire roadmap for a project.
 *
 * 1. Removes all existing auto-generated items (preserves manually created items)
 * 2. Generates new recommendations from all data sources
 * 3. Categorizes them by timeline
 * 4. Saves the new items
 *
 * @param projectId - The project to refresh the roadmap for
 * @returns The newly generated recommendations
 */
export async function refreshRoadmap(
  projectId: string,
): Promise<RoadmapRecommendation[]> {
  // Step 1: Remove existing auto-generated items
  await db.roadmapItem.deleteMany({
    where: {
      projectId,
      autoGenerated: true,
    },
  });

  // Step 2: Generate new recommendations from all sources
  const recommendations = await generateRoadmapRecommendations(projectId);

  // Step 3: Categorize by timeline
  const categorized = categorizeByTimeline(recommendations);

  // Step 4: Save to database
  await saveRoadmapItems(projectId, categorized);

  return categorized;
}
