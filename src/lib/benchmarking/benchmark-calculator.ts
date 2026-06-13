// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Benchmark Calculator — Phase 10
// Berekent benchmarkscores en anonieme peer-vergelijkingen

import { db } from '@/lib/db';
import type { BenchmarkCategory } from '@prisma/client';
import { MIN_PEERS_FOR_ANONYMISATION, ALL_BENCHMARK_CATEGORIES } from './types';
import type { BenchmarkScore, BenchmarkInput } from './types';

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Berekent een benchmarkscore (0-100) op basis van ruwe gegevens
 */
export function calculateBenchmarkScore(
  category: BenchmarkCategory,
  metrics: Record<string, number>
): number {
  switch (category) {
    case 'CTR':
      return calculateCTRScore(metrics);
    case 'TECHNICAL_HEALTH':
      return calculateTechnicalHealthScore(metrics);
    case 'PUBLISHING_FREQUENCY':
      return calculatePublishingFrequencyScore(metrics);
    case 'CONTENT_GROWTH':
      return calculateContentGrowthScore(metrics);
    case 'CONVERSION_RATE':
      return calculateConversionRateScore(metrics);
    case 'ISSUE_RESOLUTION_SPEED':
      return calculateIssueResolutionScore(metrics);
    case 'GEO_READINESS':
      return calculateGEOScore(metrics);
    case 'AI_VISIBILITY':
      return calculateAIVisibilityScore(metrics);
    case 'ORGANIC_GROWTH':
      return calculateOrganicGrowthScore(metrics);
    case 'PUBLICATION_SPEED':
      return calculatePublicationSpeedScore(metrics);
    default:
      return 0;
  }
}

function calculateCTRScore(metrics: Record<string, number>): number {
  // CTR benchmarks: gemiddeld ~3% voor Google, top performers ~7%+
  const ctr = metrics.ctr ?? metrics.clickThroughRate ?? 0;
  if (ctr >= 7) return 100;
  if (ctr >= 5) return 80 + (ctr - 5) * 10;
  if (ctr >= 3) return 50 + (ctr - 3) * 15;
  if (ctr >= 1) return 20 + (ctr - 1) * 15;
  return ctr * 20;
}

function calculateTechnicalHealthScore(metrics: Record<string, number>): number {
  const healthPercent = metrics.healthPercent ?? metrics.technicalHealth ?? 0;
  return Math.min(100, Math.max(0, healthPercent));
}

function calculatePublishingFrequencyScore(metrics: Record<string, number>): number {
  // Artikelen per maand
  const articlesPerMonth = metrics.articlesPerMonth ?? metrics.publishingFrequency ?? 0;
  if (articlesPerMonth >= 12) return 100; // 3+ per week
  if (articlesPerMonth >= 8) return 80 + (articlesPerMonth - 8) * 5;
  if (articlesPerMonth >= 4) return 50 + (articlesPerMonth - 4) * 7.5;
  if (articlesPerMonth >= 1) return 20 + (articlesPerMonth - 1) * 10;
  return 0;
}

function calculateContentGrowthScore(metrics: Record<string, number>): number {
  const growthPercent = metrics.growthPercent ?? metrics.contentGrowth ?? 0;
  if (growthPercent >= 50) return 100;
  if (growthPercent >= 20) return 70 + (growthPercent - 20) * 1;
  if (growthPercent >= 5) return 40 + (growthPercent - 5) * 2;
  if (growthPercent >= 0) return growthPercent * 8;
  return 0; // Negatieve groei
}

function calculateConversionRateScore(metrics: Record<string, number>): number {
  const rate = metrics.conversionRate ?? metrics.cr ?? 0;
  if (rate >= 5) return 100;
  if (rate >= 3) return 70 + (rate - 3) * 15;
  if (rate >= 1.5) return 40 + (rate - 1.5) * 20;
  if (rate >= 0.5) return 15 + (rate - 0.5) * 16.67;
  return rate * 30;
}

function calculateIssueResolutionScore(metrics: Record<string, number>): number {
  const resolutionRate = metrics.resolutionRate ?? metrics.fixRate ?? 0;
  const avgDays = metrics.avgResolutionDays ?? metrics.avgDays ?? 30;
  // Hoge oplossingssnelheid + lage gemiddelde dagen = hoge score
  const rateScore = Math.min(60, resolutionRate * 0.6);
  const speedScore = avgDays <= 3 ? 40 : avgDays <= 7 ? 30 : avgDays <= 14 ? 20 : avgDays <= 30 ? 10 : 0;
  return Math.min(100, rateScore + speedScore);
}

function calculateGEOScore(metrics: Record<string, number>): number {
  const geoPercent = metrics.geoReadiness ?? metrics.geoScore ?? 0;
  return Math.min(100, Math.max(0, geoPercent));
}

function calculateAIVisibilityScore(metrics: Record<string, number>): number {
  const visibility = metrics.aiVisibility ?? metrics.visibilityScore ?? 0;
  if (visibility >= 80) return 100;
  if (visibility >= 50) return 60 + (visibility - 50) * 1.33;
  if (visibility >= 20) return 30 + (visibility - 20) * 1;
  return visibility * 1.5;
}

function calculateOrganicGrowthScore(metrics: Record<string, number>): number {
  const growth = metrics.organicGrowth ?? metrics.trafficGrowth ?? 0;
  if (growth >= 30) return 100;
  if (growth >= 15) return 70 + (growth - 15) * 2;
  if (growth >= 5) return 40 + (growth - 5) * 3;
  if (growth >= 0) return growth * 8;
  return 0; // Negatieve groei
}

function calculatePublicationSpeedScore(metrics: Record<string, number>): number {
  const avgDays = metrics.avgDaysToPublish ?? metrics.daysToPublish ?? 30;
  if (avgDays <= 1) return 100;
  if (avgDays <= 3) return 90 + (3 - avgDays) * 5;
  if (avgDays <= 7) return 70 + (7 - avgDays) * 5;
  if (avgDays <= 14) return 40 + (14 - avgDays) * 4.29;
  if (avgDays <= 30) return 10 + (30 - avgDays) * 1.88;
  return 0;
}

// ============================================================================
// Cross-Client Benchmarking (with anonymisation)
// ============================================================================

/**
 * Berekent anonieme peer-percentielen
 * Vereist expliciete toestemming en minimaal MIN_PEERS_FOR_ANONYMISATION peers
 */
export async function calculateAnonymisedPercentile(
  organizationId: string,
  category: BenchmarkCategory,
  score: number,
  periodStart: Date,
  periodEnd: Date
): Promise<{ percentile: number | null; peerCount: number }> {
  // Controleer of alle betrokken projecten toestemming hebben gegeven
  const consentedProjects = await db.benchmarkConsent.findMany({
    where: {
      organizationId,
      category,
      isConsented: true,
      deletedAt: null,
    },
    select: { projectId: true },
  });

  if (consentedProjects.length < MIN_PEERS_FOR_ANONYMISATION) {
    // Niet genoeg peers — geen percentiel berekenen voor privacy
    return { percentile: null, peerCount: consentedProjects.length };
  }

  const projectIds = consentedProjects.map(c => c.projectId);

  // Haal scores op van alle toestemmende projecten in dezelfde periode
  const peerScores = await db.benchmarkResult.findMany({
    where: {
      organizationId,
      category,
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
      projectId: { in: projectIds },
      deletedAt: null,
    },
    select: { score: true },
  });

  if (peerScores.length < MIN_PEERS_FOR_ANONYMISATION) {
    return { percentile: null, peerCount: peerScores.length };
  }

  // Sorteer scores en bereken percentiel
  const sortedScores = peerScores.map(s => s.score).sort((a, b) => a - b);
  const rank = sortedScores.filter(s => s < score).length;
  const percentile = Math.round((rank / sortedScores.length) * 100);

  return { percentile, peerCount: peerScores.length };
}

/**
 * Slaat een benchmarkresultaat op
 */
export async function saveBenchmarkResult(data: {
  organizationId: string;
  projectId: string;
  category: BenchmarkCategory;
  score: number;
  previousScore?: number;
  periodStart: Date;
  periodEnd: Date;
  details?: Record<string, unknown>;
}) {
  // Bepaal of geanonimiseerde vergelijking mogelijk is
  const { percentile, peerCount } = await calculateAnonymisedPercentile(
    data.organizationId,
    data.category,
    data.score,
    data.periodStart,
    data.periodEnd
  );

  const isAnonymised = peerCount >= MIN_PEERS_FOR_ANONYMISATION;

  return db.benchmarkResult.upsert({
    where: {
      projectId_category_periodStart: {
        projectId: data.projectId,
        category: data.category,
        periodStart: data.periodStart,
      },
    },
    create: {
      ...data,
      details: data.details ? JSON.stringify(data.details) : null,
      percentile,
      peerCount,
      isAnonymised,
    },
    update: {
      score: data.score,
      previousScore: data.previousScore,
      details: data.details ? JSON.stringify(data.details) : null,
      percentile,
      peerCount,
      isAnonymised,
    },
  });
}

/**
 * Haalt benchmarkscores op voor een project
 */
export async function getProjectBenchmarks(
  projectId: string,
  periodStart?: Date,
  periodEnd?: Date
): Promise<BenchmarkScore[]> {
  const where: Record<string, unknown> = {
    projectId,
    deletedAt: null,
  };

  if (periodStart && periodEnd) {
    where.periodStart = { gte: periodStart };
    where.periodEnd = { lte: periodEnd };
  }

  const results = await db.benchmarkResult.findMany({ where });

  return results.map(r => ({
    category: r.category,
    score: r.score,
    previousScore: r.previousScore ?? undefined,
    change: r.previousScore ? r.score - r.previousScore : undefined,
    percentile: r.percentile ?? undefined,
    peerCount: r.peerCount ?? undefined,
  }));
}

/**
 * Stelt goedkeuring in voor geanonimiseerde benchmarkvergelijking
 */
export async function setBenchmarkConsent(
  organizationId: string,
  projectId: string,
  category: BenchmarkCategory,
  isConsented: boolean,
  consentedBy: string
) {
  return db.benchmarkConsent.upsert({
    where: {
      projectId_category: { projectId, category },
    },
    create: {
      organizationId,
      projectId,
      category,
      isConsented,
      consentedBy,
      consentedAt: isConsented ? new Date() : null,
    },
    update: {
      isConsented,
      consentedBy,
      consentedAt: isConsented ? new Date() : null,
    },
  });
}

/**
 * Controleert of een project toestemming heeft gegeven voor benchmarking
 */
export async function hasBenchmarkConsent(
  projectId: string,
  category: BenchmarkCategory
): Promise<boolean> {
  const consent = await db.benchmarkConsent.findUnique({
    where: {
      projectId_category: { projectId, category },
      deletedAt: null,
    },
  });
  return consent?.isConsented ?? false;
}

/**
 * Voert een volledige benchmarkrun uit voor een project
 */
export async function runProjectBenchmark(
  organizationId: string,
  projectId: string,
  inputs: BenchmarkInput[],
  periodStart: Date,
  periodEnd: Date
): Promise<BenchmarkScore[]> {
  const scores: BenchmarkScore[] = [];

  for (const input of inputs) {
    const score = calculateBenchmarkScore(input.category, input.metrics);

    // Haal vorige score op
    const previous = await db.benchmarkResult.findFirst({
      where: {
        projectId,
        category: input.category,
        periodEnd: { lt: periodStart },
        deletedAt: null,
      },
      orderBy: { periodEnd: 'desc' },
    });

    await saveBenchmarkResult({
      organizationId,
      projectId,
      category: input.category,
      score,
      previousScore: previous?.score,
      periodStart,
      periodEnd,
      details: input.metrics,
    });

    scores.push({
      category: input.category,
      score,
      previousScore: previous?.score ?? undefined,
      change: previous?.score ? score - previous.score : undefined,
    });
  }

  return scores;
}
