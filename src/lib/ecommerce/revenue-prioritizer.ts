// ============================================================================
// Revenue Prioritizer — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Revenue-based prioritization of products for SEO investment.
// Identifies high-revenue products with low SEO scores that offer the
// biggest ROI opportunity for optimization.
//
// CRITICAL: Never fabricates revenue or margin data.
// Missing numeric values are represented as "— —".
// ============================================================================

import { db } from '@/lib/db';
import type { RevenuePrioritization } from './types';

// ---------------------------------------------------------------------------
// Priority Calculation
// ---------------------------------------------------------------------------

interface PriorityInput {
  revenue30d: number;
  revenue90d: number;
  margin: number | null;
  overallSeoScore: number;
}

/**
 * Calculate the priority level for a single product based on revenue and
 * SEO score. Returns a Dutch-language reason.
 */
function calculatePriority(input: PriorityInput): {
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
} {
  const { revenue30d, revenue90d, margin, overallSeoScore } = input;
  const seoScore = Math.round(overallSeoScore);

  // Margin context string
  const marginContext = margin !== null && margin !== undefined
    ? ` Marge van ${Math.round(margin)}% — hoge winstmarge maakt optimalisatie extra waardevol.`
    : '';

  // No revenue in last 30 days
  if (revenue30d <= 0) {
    // Check if there was 90d revenue — could indicate declining product
    if (revenue90d > 0) {
      return {
        priority: 'medium',
        reason: `Geen omzet in de afgelopen 30 dagen, maar wel omzet in de afgelopen 90 dagen. Onderzoek de daling.${marginContext}`,
      };
    }
    return {
      priority: 'low',
      reason: 'Geen omzet in de afgelopen 30 dagen.',
    };
  }

  // Revenue exists — prioritize by SEO score
  if (seoScore < 40) {
    return {
      priority: 'critical',
      reason: `Hoge omzet maar lage SEO-score (${seoScore}/100). Directe optimalisatie aanbevolen.${marginContext}`,
    };
  }

  if (seoScore < 70) {
    return {
      priority: 'high',
      reason: `Goede omzet met ruimte voor SEO-verbetering (${seoScore}/100).${marginContext}`,
    };
  }

  // Good SEO + revenue
  return {
    priority: 'medium',
    reason: `Goede omzet en SEO-score (${seoScore}/100). Behoud en optimaliseer.${marginContext}`,
  };
}

// ---------------------------------------------------------------------------
// Prioritize Products by Revenue
// ---------------------------------------------------------------------------

/**
 * Prioritize all products in a project based on revenue and SEO score.
 * Products are sorted by priority: critical → high → medium → low,
 * and within the same priority by revenue (descending).
 */
export async function prioritizeProductsByRevenue(
  projectId: string,
): Promise<RevenuePrioritization[]> {
  const products = await db.product.findMany({
    where: {
      projectId,
      deletedAt: null,
      parentProductId: null, // Only parent products
    },
    select: {
      id: true,
      name: true,
      revenue30d: true,
      revenue90d: true,
      margin: true,
      overallSeoScore: true,
    },
  });

  const prioritized: RevenuePrioritization[] = products.map((product) => {
    const revenue30d = product.revenue30d ?? 0;
    const revenue90d = product.revenue90d ?? 0;
    const seoScore = product.overallSeoScore ?? 0;

    const { priority, reason } = calculatePriority({
      revenue30d,
      revenue90d,
      margin: product.margin,
      overallSeoScore: seoScore,
    });

    return {
      productId: product.id,
      productName: product.name,
      revenue30d,
      revenue90d,
      margin: product.margin,
      seoScore: Math.round(seoScore),
      priority,
      priorityReason: reason,
    };
  });

  // Sort: critical first, then high, medium, low; within same priority by revenue
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  prioritized.sort((a, b) => {
    const pA = priorityOrder[a.priority] ?? 99;
    const pB = priorityOrder[b.priority] ?? 99;
    if (pA !== pB) return pA - pB;
    return b.revenue30d - a.revenue30d;
  });

  return prioritized;
}

// ---------------------------------------------------------------------------
// Top Revenue Opportunities
// ---------------------------------------------------------------------------

/**
 * Get the top revenue optimization opportunities.
 * These are products with high revenue but low SEO scores.
 * Sorted by the gap between revenue potential and SEO performance.
 */
export async function getTopRevenueOpportunities(
  projectId: string,
  limit: number = 20,
): Promise<RevenuePrioritization[]> {
  const allPrioritized = await prioritizeProductsByRevenue(projectId);

  // Filter to only critical and high priority items
  const opportunities = allPrioritized.filter(
    (p) => p.priority === 'critical' || p.priority === 'high',
  );

  return opportunities.slice(0, limit);
}
