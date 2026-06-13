// ============================================================================
// Variation Analyzer — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Analysis of product variations for SEO quality. Detects:
//   - Duplicate content across variations
//   - Missing unique descriptions per variation
//   - Missing variation-specific images
//   - Improper structured data for variation attributes
//   - Out-of-stock variations not properly marked
//
// All user-facing messages are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import type { VariationAnalysisResult } from './types';

// ---------------------------------------------------------------------------
// Detect Duplicate Content Across Variations
// ---------------------------------------------------------------------------

/**
 * Detect groups of variations that share identical descriptions.
 * Returns Dutch-language descriptions of each duplicate group.
 */
function detectVariationDuplicates(
  variations: Array<{
    id: string;
    name: string;
    description: string | null;
    variationAttributes: string | null;
  }>,
): string[] {
  const duplicates: string[] = [];

  // Group variations by their normalised description
  const normalise = (s: string | null) =>
    s ? s.trim().toLowerCase().replace(/\s+/g, ' ') : '';

  const descGroups = new Map<string, Array<{ id: string; name: string }>>();

  for (const variation of variations) {
    const key = normalise(variation.description);
    if (!key) continue; // Skip variations with no description
    if (!descGroups.has(key)) {
      descGroups.set(key, []);
    }
    descGroups.get(key)!.push({ id: variation.id, name: variation.name });
  }

  for (const [, group] of descGroups) {
    if (group.length > 1) {
      const names = group.map((v) => `"${v.name}"`).join(', ');
      duplicates.push(
        `Dubbele inhoud gedetecteerd bij variaties: ${names}. Elke variatie moet een unieke beschrijving hebben.`,
      );
    }
  }

  return duplicates;
}

// ---------------------------------------------------------------------------
// Generate Variation Recommendations
// ---------------------------------------------------------------------------

interface VariationAnalysisInput {
  totalVariations: number;
  variationsWithUniqueDescriptions: number;
  variationsWithImages: number;
  duplicateContentGroups: number;
  hasVariationAttributes: boolean;
  outOfStockWithoutMarking: number;
}

/**
 * Generate Dutch-language recommendations based on variation analysis.
 */
function generateVariationRecommendations(analysis: VariationAnalysisInput): string[] {
  const recommendations: string[] = [];

  // Unique descriptions
  if (analysis.totalVariations > 0) {
    const uniqueDescRatio = analysis.variationsWithUniqueDescriptions / analysis.totalVariations;
    if (uniqueDescRatio < 1) {
      recommendations.push(
        'Geef elke variatie een unieke beschrijving die de specifieke eigenschappen benadrukt (bijv. kleur, maat, materiaal).',
      );
    }
  }

  // Duplicate content
  if (analysis.duplicateContentGroups > 0) {
    recommendations.push(
      `Er zijn ${analysis.duplicateContentGroups} groepen met dubbele inhoud. Herschrijf de beschrijvingen zodat elke variatie unieke content heeft.`,
    );
  }

  // Images
  if (analysis.totalVariations > 0 && analysis.variationsWithImages < analysis.totalVariations) {
    recommendations.push(
      `${analysis.totalVariations - analysis.variationsWithImages} variatie(s) hebben geen eigen afbeelding. Voeg variatie-specifieke afbeeldingen toe.`,
    );
  }

  // Structured data for variation attributes
  if (analysis.totalVariations > 0 && !analysis.hasVariationAttributes) {
    recommendations.push(
      'Variaties missen gestructureerde attributen. Voeg variatie-eigenschappen (zoals kleur, maat) toe als gestructureerde data.',
    );
  }

  // Out-of-stock
  if (analysis.outOfStockWithoutMarking > 0) {
    recommendations.push(
      `${analysis.outOfStockWithoutMarking} variatie(s) zijn uit voorraad maar niet correct gemarkeerd. Markeer uit-voorraad variaties als zodanig.`,
    );
  }

  // General best practice
  if (analysis.totalVariations > 5) {
    recommendations.push(
      'Bij veel variaties: overweeg een "kanonieke" URL-strategie om dubbele content te voorkomen.',
    );
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Analyze Product Variations
// ---------------------------------------------------------------------------

/**
 * Analyze the variations of a parent product for SEO quality.
 * Verifies projectId for tenant isolation.
 */
export async function analyzeProductVariations(
  parentProductId: string,
  projectId: string,
): Promise<VariationAnalysisResult> {
  // Verify the parent product exists and belongs to the project
  const parent = await db.product.findFirst({
    where: { id: parentProductId, projectId, deletedAt: null },
  });

  if (!parent) {
    throw new Error('Product niet gevonden of geen toegang.');
  }

  // Fetch all variations
  const variations = await db.product.findMany({
    where: {
      parentProductId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      shortDescription: true,
      imageUrl: true,
      variationAttributes: true,
      stockStatus: true,
      stockQuantity: true,
    },
  });

  if (variations.length === 0) {
    return {
      totalVariations: 0,
      variationsWithUniqueDescriptions: 0,
      variationsWithImages: 0,
      duplicateContentGroups: 0,
      issues: ['Geen variaties gevonden voor dit product.'],
      recommendations: [],
    };
  }

  // Count variations with unique descriptions (not identical to parent)
  const parentDesc = parent.description?.trim().toLowerCase() ?? '';
  const variationsWithUniqueDescriptions = variations.filter((v) => {
    const vDesc = v.description?.trim().toLowerCase() ?? '';
    if (!vDesc) return false;
    return vDesc !== parentDesc;
  }).length;

  // Count variations with their own image
  const variationsWithImages = variations.filter(
    (v) => v.imageUrl && v.imageUrl.trim().length > 0,
  ).length;

  // Detect duplicate content
  const duplicateIssues = detectVariationDuplicates(variations);
  const duplicateContentGroups = duplicateIssues.length;

  // Check variation attributes in structured data
  const hasVariationAttributes = variations.some(
    (v) => v.variationAttributes && v.variationAttributes.trim().length > 0,
  );

  // Check out-of-stock variations
  const outOfStockWithoutMarking = variations.filter((v) => {
    // Has quantity info and it's 0, but status isn't OUT_OF_STOCK
    if (v.stockQuantity !== null && v.stockQuantity <= 0 && v.stockStatus !== 'OUT_OF_STOCK') {
      return true;
    }
    return false;
  }).length;

  // Collect all issues
  const issues: string[] = [];

  if (variationsWithUniqueDescriptions < variations.length) {
    const missing = variations.length - variationsWithUniqueDescriptions;
    issues.push(
      `${missing} variatie(s) hebben geen unieke beschrijving. Elke variatie moet een eigen beschrijving hebben.`,
    );
  }

  if (variationsWithImages < variations.length) {
    const missing = variations.length - variationsWithImages;
    issues.push(
      `${missing} variatie(s) hebben geen eigen afbeelding. Voeg variatie-specifieke afbeeldingen toe.`,
    );
  }

  issues.push(...duplicateIssues);

  if (!hasVariationAttributes) {
    issues.push(
      'Variaties hebben geen gestructureerde attributen. Voeg eigenschappen zoals kleur, maat of materiaal toe.',
    );
  }

  if (outOfStockWithoutMarking > 0) {
    issues.push(
      `${outOfStockWithoutMarking} variatie(s) zijn uit voorraad maar niet correct gemarkeerd.`,
    );
  }

  // Generate recommendations
  const recommendations = generateVariationRecommendations({
    totalVariations: variations.length,
    variationsWithUniqueDescriptions,
    variationsWithImages,
    duplicateContentGroups,
    hasVariationAttributes,
    outOfStockWithoutMarking,
  });

  return {
    totalVariations: variations.length,
    variationsWithUniqueDescriptions,
    variationsWithImages,
    duplicateContentGroups,
    issues,
    recommendations,
  };
}
