// ============================================================================
// AI Visibility — Test Manager
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages AI visibility tests: manual entries, local simulations via AI
// provider layer, result querying, and summary calculation.
//
// CRITICAL: Local simulations ALWAYS carry the simulation disclaimer.
// Simulations are NOT evidence of actual external AI visibility.
// ============================================================================

import { db } from '@/lib/db';
import { providerManager } from '@/lib/ai/provider-manager';
import { SIMULATION_DISCLAIMER, SENTIMENT_NUMERIC_MAP } from './types';
import type { AIVisibilityMetrics, AIVisibilityFilters } from './types';
import type { AIVisibilityMethod } from '@prisma/client';

// ============================================================================
// Manual Test Entry
// ============================================================================

/**
 * Create a manual AI visibility test entry.
 * Used when a user manually records results from testing an AI platform.
 *
 * @param projectId - The project to add the test for
 * @param data - The test data
 * @returns The created AIVisibilityResult record
 */
export async function createManualTest(
  projectId: string,
  data: {
    promptId?: string;
    promptText: string;
    response?: string;
    platform?: string;
    model?: string;
    testDate?: Date;
    country?: string;
    language?: string;
    isMentioned: boolean;
    mentionedUrls?: string[];
    mentionedSources?: string[];
    competitorMentions?: string[];
    sentiment?: string;
    accuracy?: number;
    confidence?: number;
  }
) {
  return db.aIVisibilityResult.create({
    data: {
      projectId,
      promptId: data.promptId ?? null,
      method: 'MANUAL_TEST',
      platform: data.platform ?? null,
      model: data.model ?? null,
      promptText: data.promptText,
      response: data.response ?? null,
      testDate: data.testDate ?? new Date(),
      country: data.country ?? 'NL',
      language: data.language ?? 'nl-NL',
      isMentioned: data.isMentioned,
      mentionedUrls: data.mentionedUrls
        ? JSON.stringify(data.mentionedUrls)
        : null,
      mentionedSources: data.mentionedSources
        ? JSON.stringify(data.mentionedSources)
        : null,
      competitorMentions: data.competitorMentions
        ? JSON.stringify(data.competitorMentions)
        : null,
      sentiment: data.sentiment?.toLowerCase() ?? null,
      accuracy:
        data.accuracy !== undefined
          ? Math.min(1, Math.max(0, data.accuracy))
          : null,
      confidence:
        data.confidence !== undefined
          ? Math.min(1, Math.max(0, data.confidence))
          : null,
      isSimulation: false,
      simulationNote: null,
    },
  });
}

// ============================================================================
// Local Simulation
// ============================================================================

/**
 * Run a local simulation to check if the project's brand/domain is mentioned
 * by an AI model.
 *
 * ALWAYS sets isSimulation=true and simulationNote=SIMULATION_DISCLAIMER.
 * Uses the AI provider layer (ProviderManager) to generate a response.
 * Analyzes if the project's brand/domain is mentioned in the response.
 *
 * @param projectId - The project to simulate for
 * @param prompt - The prompt to send to the AI
 * @param aiProvider - Optional AI provider configuration override
 * @returns The created AIVisibilityResult with simulation flag
 */
export async function createLocalSimulation(
  projectId: string,
  prompt: string,
  aiProvider?: {
    providerId?: string;
    model?: string;
  }
) {
  // Get project info for brand/domain matching
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      websiteUrl: true,
      brandProfile: { select: { brandName: true } },
    },
  });

  const brandName = project?.brandProfile?.brandName;
  const websiteUrl = project?.websiteUrl;

  // Call AI provider
  let response = '';
  let usedModel = aiProvider?.model ?? '';
  let providerName = '';

  try {
    const adapter = aiProvider?.providerId
      ? await providerManager.getProvider(projectId, aiProvider.providerId)
      : await providerManager.getDefaultProvider(projectId);

    const aiResponse = await adapter.generate({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: aiProvider?.model,
      purpose: 'ai-visibility-simulation',
    });

    response = aiResponse.content;
    usedModel = aiResponse.model;
    providerName = aiResponse.providerName;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    response = `Fout bij simulatie: ${msg}`;
  }

  // Analyze if brand/domain is mentioned in the response
  const responseLower = response.toLowerCase();
  let isMentioned = false;
  const mentionedUrls: string[] = [];
  const mentionedSources: string[] = [];

  if (brandName && responseLower.includes(brandName.toLowerCase())) {
    isMentioned = true;
    mentionedSources.push(brandName);
  }

  if (websiteUrl) {
    try {
      const domain = new URL(websiteUrl).hostname.toLowerCase();
      if (responseLower.includes(domain)) {
        isMentioned = true;
        mentionedUrls.push(websiteUrl);
      }
      // Also check without www.
      const domainNoWww = domain.replace(/^www\./, '');
      if (domainNoWww !== domain && responseLower.includes(domainNoWww)) {
        isMentioned = true;
      }
    } catch {
      // Invalid URL, skip domain check
    }
  }

  // Detect competitor mentions (basic: look for common Dutch business patterns)
  // This is intentionally simple — detailed analysis requires actual competitor data
  const competitorMentions: string[] = [];

  // Create result with simulation flag
  const result = await db.aIVisibilityResult.create({
    data: {
      projectId,
      promptId: null,
      method: 'LOCAL_SIMULATION',
      platform: providerName || 'local',
      model: usedModel || null,
      promptText: prompt,
      response,
      testDate: new Date(),
      country: 'NL',
      language: 'nl-NL',
      isMentioned,
      mentionedUrls:
        mentionedUrls.length > 0 ? JSON.stringify(mentionedUrls) : null,
      mentionedSources:
        mentionedSources.length > 0 ? JSON.stringify(mentionedSources) : null,
      competitorMentions:
        competitorMentions.length > 0
          ? JSON.stringify(competitorMentions)
          : null,
      sentiment: null,
      accuracy: null,
      confidence: isMentioned ? 0.5 : 0, // Low confidence for simulated results
      isSimulation: true,
      simulationNote: SIMULATION_DISCLAIMER,
    },
  });

  return result;
}

// ============================================================================
// Summary Calculation
// ============================================================================

/**
 * Calculate AI visibility summary metrics for a project.
 *
 * Metrics calculated:
 * - Share of AI Voice (percentage of tests where brand is mentioned)
 * - Brand mention rate
 * - Source mention rate
 * - Competitor mention rate
 * - Average accuracy
 * - Average sentiment (mapped to numeric)
 * - Prompt coverage
 * - Funnel coverage
 *
 * @param projectId - The project to calculate metrics for
 * @returns The calculated AIVisibilityMetrics
 */
export async function calculateSummary(
  projectId: string
): Promise<AIVisibilityMetrics> {
  const [results, totalPrompts] = await Promise.all([
    db.aIVisibilityResult.findMany({
      where: { projectId },
      select: {
        isMentioned: true,
        mentionedSources: true,
        competitorMentions: true,
        sentiment: true,
        accuracy: true,
        isSimulation: true,
        promptId: true,
      },
    }),
    db.aIPromptLibrary.count({
      where: { projectId, isActive: true },
    }),
  ]);

  const totalTests = results.length;
  const mentionedTests = results.filter((r) => r.isMentioned).length;
  const simulationTests = results.filter((r) => r.isSimulation).length;

  // Share of AI Voice = brand mention rate
  const brandMentionRate = totalTests > 0 ? mentionedTests / totalTests : 0;
  const shareOfAIVoice = brandMentionRate;

  // Source mention rate
  const resultsWithSources = results.filter(
    (r) => r.mentionedSources !== null
  );
  const sourceMentionRate =
    totalTests > 0 ? resultsWithSources.length / totalTests : 0;

  // Competitor mention rate
  const resultsWithCompetitors = results.filter(
    (r) => r.competitorMentions !== null
  );
  const competitorMentionRate =
    totalTests > 0 ? resultsWithCompetitors.length / totalTests : 0;

  // Average accuracy
  const resultsWithAccuracy = results.filter((r) => r.accuracy !== null);
  const avgAccuracy =
    resultsWithAccuracy.length > 0
      ? resultsWithAccuracy.reduce((sum, r) => sum + (r.accuracy ?? 0), 0) /
        resultsWithAccuracy.length
      : 0;

  // Average sentiment (mapped to numeric)
  const resultsWithSentiment = results.filter((r) => r.sentiment !== null);
  const avgSentiment =
    resultsWithSentiment.length > 0
      ? resultsWithSentiment.reduce((sum, r) => {
          const numeric = SENTIMENT_NUMERIC_MAP[r.sentiment?.toLowerCase() ?? ''] ?? 0;
          return sum + numeric;
        }, 0) / resultsWithSentiment.length
      : 0;

  // Prompt coverage: percentage of active prompts that have at least one test
  const testedPromptIds = new Set(
    results
      .map((r) => r.promptId)
      .filter((id): id is string => id !== null)
  );
  const promptCoverage =
    totalPrompts > 0 ? testedPromptIds.size / totalPrompts : 0;

  // Funnel coverage: count distinct funnel stages covered
  const funnelStages = await db.aIPromptLibrary.findMany({
    where: { projectId, isActive: true },
    select: { funnelStage: true },
    distinct: ['funnelStage'],
  });
  const totalFunnelStages = 5; // AWARENESS, CONSIDERATION, DECISION, RETENTION, UNKNOWN
  const activeFunnelStages = funnelStages.filter(
    (f) => f.funnelStage !== 'UNKNOWN'
  ).length;
  const funnelCoverage = activeFunnelStages / (totalFunnelStages - 1); // Exclude UNKNOWN

  // Update summary in database
  await db.aIVisibilitySummary.upsert({
    where: { projectId },
    create: {
      projectId,
      shareOfAIVoice,
      brandMentionRate,
      sourceMentionRate,
      competitorMentionRate,
      avgAccuracy,
      avgSentiment,
      promptCoverage,
      funnelCoverage,
      totalTests,
      mentionedTests,
      simulationTests,
      calculatedAt: new Date(),
    },
    update: {
      shareOfAIVoice,
      brandMentionRate,
      sourceMentionRate,
      competitorMentionRate,
      avgAccuracy,
      avgSentiment,
      promptCoverage,
      funnelCoverage,
      totalTests,
      mentionedTests,
      simulationTests,
      calculatedAt: new Date(),
    },
  });

  return {
    shareOfAIVoice,
    brandMentionRate,
    sourceMentionRate,
    competitorMentionRate,
    avgAccuracy,
    avgSentiment,
    promptCoverage,
    funnelCoverage,
    totalTests,
    mentionedTests,
    simulationTests,
  };
}

// ============================================================================
// Query Results
// ============================================================================

/**
 * Get AI visibility results for a project with optional filters.
 *
 * @param projectId - The project to get results for
 * @param filters - Optional filters
 * @returns Array of AI visibility results
 */
export async function getResults(
  projectId: string,
  filters?: AIVisibilityFilters
) {
  const where: Record<string, unknown> = { projectId };

  if (filters?.method) where.method = filters.method;
  if (filters?.platform) where.platform = filters.platform;
  if (filters?.isMentioned !== undefined) where.isMentioned = filters.isMentioned;
  if (filters?.isSimulation !== undefined) where.isSimulation = filters.isSimulation;
  if (filters?.promptId) where.promptId = filters.promptId;

  if (filters?.dateFrom || filters?.dateTo) {
    const testDateFilter: Record<string, Date> = {};
    if (filters.dateFrom) testDateFilter.gte = filters.dateFrom;
    if (filters.dateTo) testDateFilter.lte = filters.dateTo;
    where.testDate = testDateFilter;
  }

  // Cluster filter requires a subquery
  if (filters?.clusterId) {
    const clusterPrompts = await db.aIPromptLibrary.findMany({
      where: { projectId, clusterId: filters.clusterId },
      select: { id: true },
    });
    where.promptId = { in: clusterPrompts.map((p) => p.id) };
  }

  return db.aIVisibilityResult.findMany({
    where,
    include: {
      prompt: {
        select: {
          id: true,
          name: true,
          prompt: true,
          funnelStage: true,
          searchIntent: true,
        },
      },
    },
    orderBy: { testDate: 'desc' },
    take: filters?.limit ?? 50,
    skip: filters?.offset ?? 0,
  });
}

/**
 * Get the cached AI visibility summary for a project.
 * If no summary exists, calculates it first.
 *
 * @param projectId - The project to get the summary for
 * @returns The AI visibility summary
 */
export async function getSummary(projectId: string) {
  const existing = await db.aIVisibilitySummary.findUnique({
    where: { projectId },
  });

  if (existing) return existing;

  // Calculate if no summary exists
  return calculateSummary(projectId);
}
