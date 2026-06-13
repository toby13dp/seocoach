// ============================================================================
// Forecasting — Forecast Engine
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core forecasting engine with 3-scenario projections (Conservative, Realistic,
// Ambitious). Generates monthly projections with compounding growth, honest
// uncertainty ranges, and Dutch assumptions.
//
// CRITICAL: Never presents forecasts as certainties. All outputs include
// uncertainty ranges and confidence levels.
// ============================================================================

import { db } from '@/lib/db';
import type { ForecastScenario } from '@prisma/client';
import type {
  ForecastInput,
  ForecastOutput,
  ForecastRange,
  MonthlyProjection,
  ForecastFilters,
} from './types';
import { FORECAST_SCENARIO_LABELS } from './types';

// ============================================================================
// Scenario Parameters
// ============================================================================

interface ScenarioParams {
  /** Monthly traffic growth rate */
  trafficGrowth: number;
  /** CTR improvement rate (percentage points per month) */
  ctrImprovement: number;
  /** Conversion rate improvement per month */
  conversionImprovement: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Uncertainty range multiplier (±X%) */
  uncertaintyMultiplier: number;
  /** Dutch label for the scenario */
  label: string;
}

const SCENARIO_PARAMS: Record<ForecastScenario, ScenarioParams> = {
  CONSERVATIVE: {
    trafficGrowth: 0.05,
    ctrImprovement: 0.03,
    conversionImprovement: 0.02,
    confidence: 0.8,
    uncertaintyMultiplier: 0.20,
    label: 'Conservatief',
  },
  REALISTIC: {
    trafficGrowth: 0.15,
    ctrImprovement: 0.08,
    conversionImprovement: 0.05,
    confidence: 0.5,
    uncertaintyMultiplier: 0.30,
    label: 'Realistisch',
  },
  AMBITIOUS: {
    trafficGrowth: 0.30,
    ctrImprovement: 0.15,
    conversionImprovement: 0.10,
    confidence: 0.3,
    uncertaintyMultiplier: 0.50,
    label: 'Ambitieus',
  },
};

// ============================================================================
// Generate Forecast
// ============================================================================

/**
 * Generate a 3-scenario forecast from historical data.
 *
 * Creates monthly projections with compounding growth, calculates
 * uncertainty ranges, and generates Dutch assumptions and effort descriptions.
 *
 * CRITICAL: Never presents forecasts as certainties. Confidence levels and
 * uncertainty ranges are always included.
 *
 * @param projectId - The project to generate a forecast for (tenant isolation)
 * @param scenario - The forecast scenario (Conservative/Realistic/Ambitious)
 * @param inputs - Current performance metrics and targets
 * @returns The created Forecast record
 */
export async function generateForecast(
  projectId: string,
  scenario: ForecastScenario,
  inputs: ForecastInput
) {
  const params = SCENARIO_PARAMS[scenario];

  // Generate monthly projections
  const monthlyTraffic: MonthlyProjection[] = [];
  const monthlyClicks: MonthlyProjection[] = [];
  const monthlyConversions: MonthlyProjection[] = [];
  const monthlyRevenue: MonthlyProjection[] = [];

  let traffic = inputs.currentTraffic;
  let clicks = inputs.currentClicks;
  let ctr = inputs.currentCTR;
  let conversions = inputs.currentConversions;
  let revenue = inputs.currentRevenue;

  for (let month = 1; month <= inputs.targetMonths; month++) {
    // Apply compounding growth
    traffic = traffic * (1 + params.trafficGrowth);
    ctr = Math.min(1, ctr + params.ctrImprovement * ctr); // CTR improvement as % of current
    clicks = traffic * ctr;

    // Conversion improvement
    const convRate = conversions / Math.max(clicks, 1);
    const newConvRate = convRate * (1 + params.conversionImprovement);
    conversions = clicks * newConvRate;

    // Revenue scales with conversions
    const revenuePerConversion = inputs.currentConversions > 0
      ? inputs.currentRevenue / inputs.currentConversions
      : 0;
    revenue = conversions * revenuePerConversion;

    monthlyTraffic.push({ month, traffic, clicks, conversions, revenue });
    monthlyClicks.push({ month, traffic, clicks, conversions, revenue });
    monthlyConversions.push({ month, traffic, clicks, conversions, revenue });
    monthlyRevenue.push({ month, traffic, clicks, conversions, revenue });
  }

  // Final forecast output
  const finalTraffic = traffic;
  const finalClicks = clicks;
  const finalConversions = conversions;
  const finalRevenue = revenue;
  const ctrImprovement = ctr - inputs.currentCTR;
  const rankingImprovement = calculateRankingImprovement(inputs.avgPosition, params.trafficGrowth, inputs.targetMonths);

  // Calculate required effort description
  const requiredEffort = generateEffortDescription(scenario, inputs);

  // Calculate uncertainty ranges
  const midOutput: ForecastOutput = {
    traffic: finalTraffic,
    clicks: finalClicks,
    leads: finalClicks * 0.1, // Approximate 10% of clicks become leads
    conversions: finalConversions,
    revenue: finalRevenue,
    ctrImprovement,
    rankingImprovement,
    contentOutput: inputs.contentOutputPerMonth,
    requiredEffort,
  };

  const ranges = calculateForecastRanges(midOutput, scenario);

  // Generate Dutch assumptions
  const assumptions = generateAssumptions(scenario, inputs);

  // Build the forecast name
  const name = `${FORECAST_SCENARIO_LABELS[scenario]} — ${inputs.targetMonths} maanden prognose`;

  // Store as forecast record
  return db.forecast.create({
    data: {
      projectId,
      scenario,
      name,
      description: `${FORECAST_SCENARIO_LABELS[scenario]} prognose voor de komende ${inputs.targetMonths} maanden.`,
      assumptions: JSON.stringify(assumptions),
      inputs: JSON.stringify(inputs),
      trafficForecast: JSON.stringify(monthlyTraffic),
      clicksForecast: JSON.stringify(monthlyClicks),
      leadsForecast: JSON.stringify(monthlyTraffic.map(m => ({ ...m, leads: m.clicks * 0.1 }))),
      conversionsForecast: JSON.stringify(monthlyConversions),
      revenueForecast: JSON.stringify(monthlyRevenue),
      ctrImprovement,
      rankingImprovement,
      contentOutput: inputs.contentOutputPerMonth,
      requiredEffort: JSON.stringify(requiredEffort),
      confidence: params.confidence,
      uncertaintyRange: JSON.stringify(ranges),
      forecastMonths: inputs.targetMonths,
    },
  });
}

// ============================================================================
// Generate Assumptions (Dutch)
// ============================================================================

/**
 * Generate Dutch assumptions list for a forecast scenario.
 *
 * CRITICAL: Always includes a disclaimer that forecasts are estimates, not guarantees.
 *
 * @param scenario - The forecast scenario
 * @param inputs - The input parameters used
 * @returns Array of Dutch assumption strings
 */
export function generateAssumptions(
  scenario: ForecastScenario,
  inputs: ForecastInput
): string[] {
  const params = SCENARIO_PARAMS[scenario];
  const assumptions: string[] = [];

  // Growth assumptions
  assumptions.push(
    `Verkeersgroei van ${Math.round(params.trafficGrowth * 100)}% per maand wordt aangenomen op basis van historische trends.`
  );

  assumptions.push(
    `CTR-verbetering van ${Math.round(params.ctrImprovement * 100)}% per maand wordt aangenomen door optimalisatie-inspanningen.`
  );

  assumptions.push(
    `Conversieverbetering van ${Math.round(params.conversionImprovement * 100)}% per maand wordt aangenomen door CRO-inspanningen.`
  );

  // Content output
  assumptions.push(
    `Contentproductie van ${inputs.contentOutputPerMonth} stukken per maand wordt aangenomen.`
  );

  // Revenue
  if (inputs.currentConversions > 0) {
    const revPerConv = inputs.currentRevenue / inputs.currentConversions;
    assumptions.push(
      `Omzet per conversie blijft constant op €${revPerConv.toFixed(2)}.`
    );
  }

  // Scenario-specific
  assumptions.push(
    `Dit is een ${params.label.toLowerCase()} scenario met een betrouwbaarheid van ${Math.round(params.confidence * 100)}%.`
  );

  // Uncertainty
  assumptions.push(
    `Onzekerheidsmarge: ±${Math.round(params.uncertaintyMultiplier * 100)}% rondom de prognose.`
  );

  // CRITICAL disclaimer — always included
  assumptions.push(
    'Deze prognose is een schatting, geen garantie. Werkelijke resultaten kunnen afwijken.'
  );

  assumptions.push(
    'Externe factoren zoals algoritmewijzigingen, concurrentie en marktomstandigheden zijn niet meegerekend.'
  );

  return assumptions;
}

// ============================================================================
// Calculate Forecast Ranges
// ============================================================================

/**
 * Calculate low/mid/high uncertainty ranges for forecast outputs.
 *
 * The ranges reflect the inherent uncertainty in projections:
 * - Conservative: ±20%
 * - Realistic: ±30%
 * - Ambitious: ±50%
 *
 * @param output - The mid (central) forecast output
 * @param scenario - The scenario to calculate ranges for
 * @returns Low/mid/high ForecastOutput ranges
 */
export function calculateForecastRanges(
  output: ForecastOutput,
  scenario: ForecastScenario
): ForecastRange {
  const params = SCENARIO_PARAMS[scenario];
  const factor = params.uncertaintyMultiplier;

  const applyRange = (value: number): { low: number; mid: number; high: number } => ({
    low: value * (1 - factor),
    mid: value,
    high: value * (1 + factor),
  });

  const trafficRange = applyRange(output.traffic);
  const clicksRange = applyRange(output.clicks);
  const leadsRange = applyRange(output.leads);
  const conversionsRange = applyRange(output.conversions);
  const revenueRange = applyRange(output.revenue);

  return {
    low: {
      traffic: trafficRange.low,
      clicks: clicksRange.low,
      leads: leadsRange.low,
      conversions: conversionsRange.low,
      revenue: revenueRange.low,
      ctrImprovement: output.ctrImprovement * (1 - factor),
      rankingImprovement: output.rankingImprovement * (1 - factor),
      contentOutput: output.contentOutput,
      requiredEffort: output.requiredEffort,
    },
    mid: {
      ...output,
    },
    high: {
      traffic: trafficRange.high,
      clicks: clicksRange.high,
      leads: leadsRange.high,
      conversions: conversionsRange.high,
      revenue: revenueRange.high,
      ctrImprovement: output.ctrImprovement * (1 + factor),
      rankingImprovement: output.rankingImprovement * (1 + factor),
      contentOutput: output.contentOutput,
      requiredEffort: output.requiredEffort,
    },
  };
}

// ============================================================================
// Query Forecasts
// ============================================================================

/**
 * Get forecasts for a project, optionally filtered by scenario.
 *
 * @param projectId - The project to get forecasts for (tenant isolation)
 * @param filters - Optional filters
 * @returns Array of forecast records
 */
export async function getForecasts(
  projectId: string,
  filters?: ForecastFilters
) {
  const where: Record<string, unknown> = {
    projectId,
    deletedAt: null,
  };

  if (filters?.scenario) {
    where.scenario = filters.scenario;
  }

  return db.forecast.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single forecast by ID, verifying project ownership.
 *
 * @param forecastId - The forecast ID to retrieve
 * @param projectId - The project it must belong to (tenant isolation)
 * @returns The forecast record or null
 */
export async function getForecast(
  forecastId: string,
  projectId: string
) {
  return db.forecast.findFirst({
    where: {
      id: forecastId,
      projectId,
      deletedAt: null,
    },
  });
}

/**
 * Soft-delete a forecast by setting deletedAt.
 *
 * @param forecastId - The forecast to delete
 * @param projectId - The project it belongs to (tenant isolation)
 * @returns The updated forecast record
 * @throws Error if forecast not found
 */
export async function deleteForecast(
  forecastId: string,
  projectId: string
) {
  const existing = await db.forecast.findFirst({
    where: { id: forecastId, projectId, deletedAt: null },
  });

  if (!existing) {
    throw new Error(
      `Prognose met ID "${forecastId}" niet gevonden voor dit project.`
    );
  }

  return db.forecast.update({
    where: { id: forecastId },
    data: { deletedAt: new Date() },
  });
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Estimate ranking improvement based on current position and growth rate.
 * Simplified model: better positions come from sustained SEO effort.
 */
function calculateRankingImprovement(
  currentAvgPosition: number,
  growthRate: number,
  months: number
): number {
  // The higher the current position, the more room for improvement
  // But improvement gets harder as you approach position 1
  const maxImprovable = currentAvgPosition - 1;
  if (maxImprovable <= 0) return 0;

  // Diminishing returns: improvement is proportional to room for improvement
  // and scales with growth rate and time
  const improvementFactor = growthRate * months * 0.5;
  const improvement = maxImprovable * Math.min(improvementFactor, 0.8); // Cap at 80% of possible improvement

  return Math.max(0, improvement);
}

/**
 * Generate a Dutch description of the effort required for a forecast scenario.
 */
function generateEffortDescription(
  scenario: ForecastScenario,
  inputs: ForecastInput
): string {
  const parts: string[] = [];

  switch (scenario) {
    case 'CONSERVATIVE':
      parts.push('Bescheiden inspanning vereist.');
      parts.push(`Regelmatige contentproductie (${inputs.contentOutputPerMonth} per maand).`);
      parts.push('Basis technische SEO-onderhoud.');
      parts.push('Minimaal linkbuilding-inspanningen.');
      break;
    case 'REALISTIC':
      parts.push('Gemiddelde inspanning vereist.');
      parts.push(`Verhoogde contentproductie (${Math.ceil(inputs.contentOutputPerMonth * 1.5)} per maand aanbevolen).`);
      parts.push('Actieve technische SEO-optimalisatie.');
      parts.push('Structurele linkbuilding en autoriteitsopbouw.');
      parts.push('CRO-optimalisatie op key-pagina\'s.');
      break;
    case 'AMBITIOUS':
      parts.push('Aanzienlijke inspanning vereist.');
      parts.push(`Geavanceerde contentstrategie (${Math.ceil(inputs.contentOutputPerMonth * 2)} per maand aanbevolen).`);
      parts.push('Uitgebreide technische SEO-aanpak.');
      parts.push('Agressieve linkbuilding en digitale PR-campagnes.');
      parts.push('Uitgebreide CRO-testen en optimalisatie.');
      parts.push('Lokale SEO en GEO-optimalisatie.');
      break;
  }

  parts.push('Deze inschatting is indicatief — werkelijke inspanning kan variëren.');

  return parts.join(' ');
}
