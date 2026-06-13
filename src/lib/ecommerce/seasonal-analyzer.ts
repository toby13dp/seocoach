// ============================================================================
// Seasonal Analyzer — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Seasonal product analysis. Identifies products with seasonal revenue patterns
// and generates timing-based recommendations for:
//   - Pre-season preparation
//   - In-season optimization
//   - Post-season wrap-up
//
// All user-facing messages are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import type { SeasonalProductResult } from './types';

// ---------------------------------------------------------------------------
// Dutch month names
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

// ---------------------------------------------------------------------------
// Seasonal Detection Logic
// ---------------------------------------------------------------------------

/**
 * Determine if a product exhibits seasonal behaviour based on monthly revenue.
 * Uses a simple heuristic: if any month has > 2× the average monthly revenue,
 * and at least one month has < 0.5× the average, the product is seasonal.
 */
function detectSeasonalMonths(monthlyRevenue: number[]): {
  isSeasonal: boolean;
  seasonalMonths: number[];
} {
  const nonZeroMonths = monthlyRevenue.filter((r) => r > 0);
  if (nonZeroMonths.length === 0) {
    return { isSeasonal: false, seasonalMonths: [] };
  }

  const avgRevenue = monthlyRevenue.reduce((sum, r) => sum + r, 0) / 12;
  if (avgRevenue === 0) {
    return { isSeasonal: false, seasonalMonths: [] };
  }

  const seasonalMonths: number[] = [];
  let hasLowMonth = false;

  for (let i = 0; i < 12; i++) {
    const ratio = monthlyRevenue[i] / avgRevenue;
    if (ratio > 2) {
      seasonalMonths.push(i + 1); // 1-based
    }
    if (ratio < 0.5) {
      hasLowMonth = true;
    }
  }

  // A product is seasonal if it has high-revenue months AND low-revenue months
  const isSeasonal = seasonalMonths.length > 0 && hasLowMonth;

  return { isSeasonal, seasonalMonths };
}

// ---------------------------------------------------------------------------
// Generate Seasonal Recommendation
// ---------------------------------------------------------------------------

/**
 * Generate a Dutch recommendation based on the product's seasonal pattern
 * and the current month.
 */
function generateSeasonalRecommendation(
  isSeasonal: boolean,
  seasonalMonths: number[],
): string {
  if (!isSeasonal) {
    return 'Geen seizoensgebonden patroon gedetecteerd. Optimaliseer dit product het hele jaar door.';
  }

  const currentMonth = new Date().getMonth() + 1; // 1-12

  // Check where we are relative to the season
  const nextSeasonalMonth = seasonalMonths.find((m) => m >= currentMonth) ?? seasonalMonths[0];
  const monthsUntilSeason = nextSeasonalMonth >= currentMonth
    ? nextSeasonalMonth - currentMonth
    : (12 - currentMonth) + nextSeasonalMonth;

  const seasonNames = seasonalMonths.map((m) => MONTH_NAMES[m - 1]).join(', ');

  if (monthsUntilSeason <= 2 && monthsUntilSeason > 0) {
    return `Seizoensgebonden product (actief in ${seasonNames}). Het seizoen nadart! Bereid content, voorraad en SEO optimalisatie voor.`;
  }

  if (seasonalMonths.includes(currentMonth)) {
    return `Seizoensgebonden product (actief in ${seasonNames}). Het product is nu in seizoen — maximaliseer zichtbaarheid en conversie.`;
  }

  if (monthsUntilSeason > 6) {
    return `Seizoensgebonden product (actief in ${seasonNames}). Het seizoen is nog ver weg. Bereid content voor en optimaliseer buiten het seizoen.`;
  }

  return `Seizoensgebonden product (actief in ${seasonNames}). Begin op tijd met SEO-optimalisatie, ${monthsUntilSeason} maanden voor het seizoen.`;
}

// ---------------------------------------------------------------------------
// Analyze Seasonal Products
// ---------------------------------------------------------------------------

/**
 * Identify seasonal products in a project based on revenue patterns.
 * Analyses revenue data and marks products as seasonal where appropriate.
 *
 * NOTE: This relies on monthly revenue data stored in the Product model.
 * If no monthly breakdown is available, the analysis falls back to the
 * isSeasonal flag already set on the product.
 */
export async function analyzeSeasonalProducts(
  projectId: string,
): Promise<SeasonalProductResult[]> {
  const products = await db.product.findMany({
    where: {
      projectId,
      deletedAt: null,
      parentProductId: null,
    },
    select: {
      id: true,
      name: true,
      isSeasonal: true,
      seasonalMonths: true,
      revenue30d: true,
      revenue90d: true,
    },
  });

  const results: SeasonalProductResult[] = [];

  for (const product of products) {
    // If the product is already marked seasonal, use its stored data
    if (product.isSeasonal && product.seasonalMonths) {
      try {
        const months = JSON.parse(product.seasonalMonths) as number[];
        results.push({
          productId: product.id,
          productName: product.name,
          isSeasonal: true,
          seasonalMonths: months,
          recommendation: generateSeasonalRecommendation(true, months),
        });
        continue;
      } catch {
        // seasonalMonths is not valid JSON; fall through
      }
    }

    // Try to detect seasonality from revenue patterns
    // Since we only have 30d and 90d revenue, we create a simplified heuristic:
    // If revenue30d is significantly higher than (revenue90d / 3), the product
    // may currently be in a peak period. This is a rough approximation.
    const revenue30d = product.revenue30d ?? 0;
    const revenue90d = product.revenue90d ?? 0;

    if (revenue90d > 0) {
      const avgMonthly = revenue90d / 3;
      const isPeak = revenue30d > avgMonthly * 1.5;

      if (product.isSeasonal || isPeak) {
        // We can't determine specific months from aggregate data alone.
        // If already marked seasonal but months not stored, estimate from current context.
        const currentMonth = new Date().getMonth() + 1;
        const estimatedMonths = isPeak ? [currentMonth] : [];

        results.push({
          productId: product.id,
          productName: product.name,
          isSeasonal: true,
          seasonalMonths: estimatedMonths,
          recommendation: generateSeasonalRecommendation(true, estimatedMonths),
        });
        continue;
      }
    }

    // Not seasonal
    results.push({
      productId: product.id,
      productName: product.name,
      isSeasonal: false,
      seasonalMonths: [],
      recommendation: generateSeasonalRecommendation(false, []),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Mark Product as Seasonal
// ---------------------------------------------------------------------------

/**
 * Manually mark a product as seasonal with specific active months.
 * Verifies projectId for tenant isolation.
 */
export async function markProductSeasonal(
  productId: string,
  projectId: string,
  months: number[],
): Promise<import('@prisma/client').Product> {
  const existing = await db.product.findFirst({
    where: { id: productId, projectId, deletedAt: null },
  });

  if (!existing) {
    throw new Error('Product niet gevonden of geen toegang.');
  }

  // Validate months
  const validMonths = months.filter((m) => m >= 1 && m <= 12);
  if (validMonths.length === 0) {
    throw new Error('Ongeldige maanden. Geef maanden op als nummers 1-12.');
  }

  return db.product.update({
    where: { id: productId },
    data: {
      isSeasonal: true,
      seasonalMonths: JSON.stringify(validMonths),
      stockStatus: 'SEASONAL',
    },
  });
}

// ---------------------------------------------------------------------------
// Get Seasonal Recommendations by Phase
// ---------------------------------------------------------------------------

/**
 * Get seasonal recommendations grouped by phase:
 *   - preSeason: products to prepare now (season starts in 1-2 months)
 *   - inSeason: products currently in season
 *   - postSeason: products whose season recently ended
 */
export async function getSeasonalRecommendations(
  projectId: string,
): Promise<{
  preSeason: SeasonalProductResult[];
  inSeason: SeasonalProductResult[];
  postSeason: SeasonalProductResult[];
}> {
  const allSeasonal = await analyzeSeasonalProducts(projectId);

  const currentMonth = new Date().getMonth() + 1; // 1-12

  const preSeason: SeasonalProductResult[] = [];
  const inSeason: SeasonalProductResult[] = [];
  const postSeason: SeasonalProductResult[] = [];

  for (const product of allSeasonal) {
    if (!product.isSeasonal || product.seasonalMonths.length === 0) {
      continue;
    }

    const isActiveNow = product.seasonalMonths.includes(currentMonth);

    if (isActiveNow) {
      inSeason.push(product);
      continue;
    }

    // Check if season starts within 1-2 months
    const monthsUntilNext = product.seasonalMonths
      .map((m) => (m >= currentMonth ? m - currentMonth : (12 - currentMonth) + m))
      .sort((a, b) => a - b);

    const nearestMonth = monthsUntilNext[0];

    if (nearestMonth !== undefined && nearestMonth <= 2) {
      preSeason.push(product);
      continue;
    }

    // Check if season recently ended (1-2 months ago)
    const monthsSinceLast = product.seasonalMonths
      .map((m) => (m <= currentMonth ? currentMonth - m : currentMonth + (12 - m)))
      .sort((a, b) => a - b);

    const lastMonth = monthsSinceLast[0];
    if (lastMonth !== undefined && lastMonth <= 2) {
      postSeason.push(product);
      continue;
    }

    // Otherwise, it's off-season — still categorize as pre-season for planning
    preSeason.push(product);
  }

  return { preSeason, inSeason, postSeason };
}
