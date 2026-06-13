// ============================================================================
// Category Analyzer — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Category quality analysis for e-commerce SEO. Evaluates categories on:
//   - Description presence and quality
//   - Product count
//   - Structured data availability
//   - Product description coverage
//
// Scoring breakdown (max 100 points):
//   Has description          → 20 pts
//   Description > 50 words   → 10 pts
//   Has slug                 → 10 pts
//   Has products             → 20 pts
//   Has > 5 products         → 10 pts
//   Has structured data      → 15 pts
//   Products have descs      → 15 pts
//
// All user-facing messages are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import type { CategoryQualityResult } from './types';

// ---------------------------------------------------------------------------
// Input type for the pure analysis function
// ---------------------------------------------------------------------------

interface CategoryAnalysisInput {
  name: string;
  description?: string | null;
  productCount: number;
  hasStructuredData: boolean;
  slug?: string | null;
}

// ---------------------------------------------------------------------------
// Analyze Category Quality (pure function)
// ---------------------------------------------------------------------------

/**
 * Analyze the quality of a single product category.
 * Pure function — no database access, no side effects.
 * Returns a score (0-100) and Dutch-language issue descriptions.
 */
export function analyzeCategoryQuality(category: CategoryAnalysisInput): CategoryQualityResult {
  const issues: string[] = [];
  let score = 0;

  // 1. Has description (20 pts)
  const hasDescription = !!category.description && category.description.trim().length > 0;
  if (hasDescription) {
    score += 20;
  } else {
    issues.push('Categorie heeft geen beschrijving. Een categorietekst helpt zoekmachines de categorie te begrijpen.');
  }

  // 2. Description > 50 words (10 pts)
  if (hasDescription) {
    const wordCount = category.description!.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 50) {
      score += 10;
    } else {
      issues.push(`Categoriebeschrijving is kort (${wordCount} woorden). Streef naar meer dan 50 woorden voor betere SEO.`);
    }
  }

  // 3. Has slug (10 pts)
  if (category.slug && category.slug.trim().length > 0) {
    score += 10;
  } else {
    issues.push('Categorie heeft geen URL-slug. Voeg een SEO-vriendelijke slug toe.');
  }

  // 4. Has products (20 pts)
  if (category.productCount > 0) {
    score += 20;
  } else {
    issues.push('Categorie bevat geen producten. Lege categorieën hebben geen SEO-waarde.');
  }

  // 5. Has > 5 products (10 pts)
  if (category.productCount > 5) {
    score += 10;
  } else if (category.productCount > 0) {
    issues.push('Categorie bevat weinig producten (5 of minder). Overweeg categorieën samen te voegen of meer producten toe te voegen.');
  }

  // 6. Has structured data (15 pts)
  if (category.hasStructuredData) {
    score += 15;
  } else {
    issues.push('Categorie heeft geen gestructureerde data. Voeg Schema.org markup toe voor betere weergave in zoekresultaten.');
  }

  // 7. Products have descriptions (15 pts) — this is a hint; actual
  //    product-level analysis is done separately. For the pure function,
  //    we assume true when there are products and structured data is present.
  //    The database version (analyzeProjectCategories) computes this accurately.
  //    Here we give partial credit as a baseline.
  if (category.productCount > 0) {
    // Partial baseline — real calculation requires DB queries
    score += 8; // Half credit by default; DB version refines this
  } else {
    issues.push('Geen producten met beschrijvingen in deze categorie.');
  }

  return {
    categoryId: '', // Will be set by the caller
    name: category.name,
    qualityScore: Math.min(100, score),
    productCount: category.productCount,
    hasDescription,
    hasStructuredData: category.hasStructuredData,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Analyze All Categories for a Project
// ---------------------------------------------------------------------------

/**
 * Analyze all categories in a project and compute accurate quality scores.
 * Uses database queries to determine product description coverage.
 */
export async function analyzeProjectCategories(
  projectId: string,
): Promise<CategoryQualityResult[]> {
  const categories = await db.productCategory.findMany({
    where: { projectId, deletedAt: null },
    include: {
      _count: {
        select: { products: { where: { deletedAt: null } } },
      },
    },
  });

  const results: CategoryQualityResult[] = [];

  for (const category of categories) {
    const productCount = category._count.products;

    // Check product description coverage
    let productsWithDescCount = 0;
    if (productCount > 0) {
      productsWithDescCount = await db.product.count({
        where: {
          categoryId: category.id,
          deletedAt: null,
          description: { not: null },
        },
      });
    }

    const productsDescRatio = productCount > 0
      ? productsWithDescCount / productCount
      : 0;

    // Run base analysis
    const baseResult = analyzeCategoryQuality({
      name: category.name,
      description: category.description,
      productCount,
      hasStructuredData: category.hasStructuredData,
      slug: category.slug,
    });

    // Correct the "products have descriptions" score (15 pts max)
    // Base analysis gave 8 pts; we replace with accurate calculation
    let descScore = 0;
    if (productCount > 0 && productsDescRatio >= 0.8) {
      descScore = 15;
    } else if (productCount > 0 && productsDescRatio >= 0.5) {
      descScore = 10;
    } else if (productCount > 0 && productsDescRatio > 0) {
      descScore = 5;
    }

    // Recalculate total: subtract the default 8 pts and add actual score
    const adjustedScore = baseResult.qualityScore - 8 + descScore;

    // Add a specific issue if product description coverage is low
    const additionalIssues: string[] = [];
    if (productCount > 0 && productsDescRatio < 0.5) {
      additionalIssues.push(
        `Slechts ${productsWithDescCount} van ${productCount} producten hebben een beschrijving. Verbeter de productbeschrijvingen in deze categorie.`,
      );
    }

    results.push({
      categoryId: category.id,
      name: category.name,
      qualityScore: Math.max(0, Math.min(100, adjustedScore)),
      productCount,
      hasDescription: baseResult.hasDescription,
      hasStructuredData: baseResult.hasStructuredData,
      issues: [...baseResult.issues, ...additionalIssues],
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Save Category Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze all categories in a project and persist the quality scores.
 * Returns the number of categories analyzed.
 */
export async function saveCategoryAnalysis(
  projectId: string,
): Promise<{ analyzed: number }> {
  const results = await analyzeProjectCategories(projectId);

  // Persist each category's quality score and issues
  for (const result of results) {
    await db.productCategory.update({
      where: { id: result.categoryId },
      data: {
        qualityScore: result.qualityScore,
        hasDescription: result.hasDescription,
        hasStructuredData: result.hasStructuredData,
        seoIssues: JSON.stringify(result.issues),
      },
    });
  }

  return { analyzed: results.length };
}
