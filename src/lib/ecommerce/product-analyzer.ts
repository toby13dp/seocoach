// ============================================================================
// Product Analyzer — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core product SEO analyzer. Scores products across 4 dimensions:
//   1. Title quality      (0-100)
//   2. Description quality (0-100)
//   3. Structured data     (0-100)
//   4. Image quality       (0-100)
//
// All user-facing messages are in Dutch. Never fabricates scores.
// ============================================================================

import { db } from '@/lib/db';
import type {
  ProductSEOAnalysis,
  ProductSEOIssue,
} from './types';
import { PRODUCT_SEO_WEIGHTS } from './types';

// ---------------------------------------------------------------------------
// Input type for the pure analysis function
// ---------------------------------------------------------------------------

interface ProductAnalysisInput {
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  additionalImages?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  productType?: string | null;
  brand?: string | null;
  productUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Generic Dutch words that indicate a non-descriptive product title
// ---------------------------------------------------------------------------

const GENERIC_TITLE_WORDS = [
  'product', 'artikel', 'item', 'ding', 'object', 'goed', 'waar',
];

// ---------------------------------------------------------------------------
// Non-descriptive alt-text words
// ---------------------------------------------------------------------------

const GENERIC_ALT_WORDS = [
  'image', 'foto', 'afbeelding', 'plaatje', 'img', 'photo', 'picture',
];

// ---------------------------------------------------------------------------
// Score Title Quality (0-100)
// ---------------------------------------------------------------------------

function scoreTitle(name: string): { score: number; issues: ProductSEOIssue[] } {
  const issues: ProductSEOIssue[] = [];
  let score = 0;

  if (!name || name.trim().length === 0) {
    issues.push({
      field: 'title',
      severity: 'error',
      message: 'Geen producttitel aanwezig.',
      recommendation: 'Voeg een beschrijvende producttitel toe die het product duidelijk identificeert.',
    });
    return { score: 0, issues };
  }

  const trimmed = name.trim();

  // Start with a base score and deduct for issues
  score = 100;

  // Length checks
  if (trimmed.length < 20) {
    score -= 30;
    issues.push({
      field: 'title',
      severity: 'warning',
      message: `Titel is te kort (${trimmed.length} tekens, minder dan 20). Voeg meer beschrijvende woorden toe.`,
      recommendation: 'Breid de titel uit met belangrijke kenmerken zoals merk, model, kleur of materiaal.',
    });
  } else if (trimmed.length > 150) {
    score -= 15;
    issues.push({
      field: 'title',
      severity: 'warning',
      message: `Titel is te lang (${trimmed.length} tekens, meer dan 150). Kort de titel in voor betere leesbaarheid.`,
      recommendation: 'Houd de titel beknopt en plaats de belangrijkste keywords vooraan.',
    });
  }

  // Generic title check
  const lowerName = trimmed.toLowerCase();
  const isGeneric = GENERIC_TITLE_WORDS.some((w) => lowerName === w);
  if (isGeneric) {
    score -= 40;
    issues.push({
      field: 'title',
      severity: 'error',
      message: 'De producttitel is te algemeen. Gebruik een specifieke, beschrijvende titel.',
      recommendation: 'Vervang de algemene term door een specifieke productnaam met merk, model en kenmerken.',
    });
  }

  // Check for numbers (often indicates specific model/version — positive signal)
  const hasNumber = /\d/.test(trimmed);
  if (!hasNumber && trimmed.length < 40) {
    score -= 5;
    issues.push({
      field: 'title',
      severity: 'info',
      message: 'Overweeg een specifiek modelnummer of maat in de titel op te nemen.',
      recommendation: 'Producttitels met modelnummers of maten presteren beter in zoekresultaten.',
    });
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

// ---------------------------------------------------------------------------
// Score Description Quality (0-100)
// ---------------------------------------------------------------------------

function scoreDescription(
  description: string | null,
  shortDescription: string | null,
): { score: number; issues: ProductSEOIssue[] } {
  const issues: ProductSEOIssue[] = [];
  let score = 0;

  // No description at all
  if (!description || description.trim().length === 0) {
    if (shortDescription && shortDescription.trim().length > 0) {
      // Only short description — partial credit
      score = 25;
      issues.push({
        field: 'description',
        severity: 'error',
        message: 'Geen volledige beschrijving aanwezig, alleen een korte beschrijving.',
        recommendation: 'Een uitgebreide productbeschrijving is essentieel voor SEO. Voeg een beschrijving toe van minimaal 100 woorden.',
      });
    } else {
      score = 0;
      issues.push({
        field: 'description',
        severity: 'error',
        message: 'Geen beschrijving aanwezig. Een productbeschrijving is essentieel voor SEO.',
        recommendation: 'Voeg een uitgebreide productbeschrijving toe die kenmerken, voordelen en gebruik beschrijft.',
      });
    }
    return { score, issues };
  }

  // Has description — base score
  score = 40;

  const descTrimmed = description.trim();
  const wordCount = descTrimmed.split(/\s+/).filter(Boolean).length;

  // Word count checks
  if (wordCount >= 300) {
    score += 30;
  } else if (wordCount >= 100) {
    score += 20;
  } else {
    issues.push({
      field: 'description',
      severity: 'warning',
      message: `Beschrijving bevat slechts ${wordCount} woorden. Streef naar minimaal 100 woorden.`,
      recommendation: 'Breid de beschrijving uit met productdetails, specificaties en gebruiksinstructies.',
    });
    score += 5;
  }

  // Long descriptions get bonus
  if (wordCount >= 300) {
    score += 10;
  } else if (wordCount >= 100) {
    issues.push({
      field: 'description',
      severity: 'info',
      message: 'Beschrijving is goed, maar kan langer. Beschrijvingen van 300+ woorden scoren beter.',
      recommendation: 'Overweeg uitgebreidere productinformatie toe te voegen voor betere SEO-resultaten.',
    });
  }

  // Duplicate check — short description should not be identical to description
  if (shortDescription && shortDescription.trim().length > 0) {
    const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalise(shortDescription) === normalise(descTrimmed)) {
      score -= 15;
      issues.push({
        field: 'description',
        severity: 'warning',
        message: 'Korte beschrijving is identiek aan de volledige beschrijving. Dit is dubbele inhoud.',
        recommendation: 'Gebruik de korte beschrijving als samenvatting en schrijf een unieke, uitgebreide beschrijving.',
      });
    }
  }

  // Check for product detail signals (numbers, specs, features)
  const hasDetails = /\d+\s*(cm|mm|ml|cl|l|kg|g|watt|volt|inch|gb|mb|mp|px)/i.test(descTrimmed);
  if (hasDetails) {
    score += 10;
  } else {
    issues.push({
      field: 'description',
      severity: 'info',
      message: 'Beschrijving bevat geen specifieke maten of technische details.',
      recommendation: 'Voeg concrete specificaties, maten of technische details toe aan de beschrijving.',
    });
    score += 5;
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

// ---------------------------------------------------------------------------
// Score Structured Data (0-100)
// ---------------------------------------------------------------------------

function scoreStructuredData(product: ProductAnalysisInput): { score: number; issues: ProductSEOIssue[] } {
  const issues: ProductSEOIssue[] = [];
  let score = 0;

  // Has GTIN or MPN — most important for structured data
  const hasGtin = !!product.gtin && product.gtin.trim().length > 0;
  const hasMpn = !!product.mpn && product.mpn.trim().length > 0;

  if (hasGtin || hasMpn) {
    score += 35;
  } else {
    issues.push({
      field: 'structured_data',
      severity: 'error',
      message: 'Geen GTIN of MPN gevonden. Deze identificaties helpen zoekmachines je product te vinden.',
      recommendation: 'Voeg een GTIN (EAN/UPC/ISBN) of MPN toe aan het product voor betere vindbaarheid.',
    });
  }

  // Has brand
  if (product.brand && product.brand.trim().length > 0) {
    score += 25;
  } else {
    issues.push({
      field: 'structured_data',
      severity: 'warning',
      message: 'Geen merk opgegeven. Merkinformatie is belangrijk voor gestructureerde data.',
      recommendation: 'Voeg het merk toe aan het product. Dit helpt bij merkgerelateerde zoekopdrachten.',
    });
  }

  // Has product type
  if (product.productType && product.productType.trim().length > 0) {
    score += 20;
  } else {
    issues.push({
      field: 'structured_data',
      severity: 'warning',
      message: 'Geen producttype opgegeven. Google Product Category verbetert de categorisering.',
      recommendation: 'Voeg een Google Product Category toe om de categorisering in zoekmachines te verbeteren.',
    });
  }

  // Has image (part of structured data requirements)
  if (product.imageUrl && product.imageUrl.trim().length > 0) {
    score += 20;
  } else {
    issues.push({
      field: 'structured_data',
      severity: 'error',
      message: 'Geen afbeelding gekoppeld aan het product. Een afbeelding is vereist voor gestructureerde data.',
      recommendation: 'Voeg een productafbeelding toe. Dit is een vereiste voor Google Product rich results.',
    });
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

// ---------------------------------------------------------------------------
// Score Images (0-100)
// ---------------------------------------------------------------------------

function scoreImages(
  imageUrl: string | null,
  imageAlt: string | null,
  additionalImages: string | null,
): { score: number; issues: ProductSEOIssue[] } {
  const issues: ProductSEOIssue[] = [];
  let score = 0;

  // Has primary image
  if (imageUrl && imageUrl.trim().length > 0) {
    score += 35;
  } else {
    issues.push({
      field: 'image',
      severity: 'error',
      message: 'Geen primaire afbeelding. Een productafbeelding is essentieel.',
      recommendation: 'Voeg een hoofdafbeelding toe aan het product. Producten met afbeeldingen converteren beter.',
    });
  }

  // Has image alt text
  if (imageAlt && imageAlt.trim().length > 0) {
    const altLower = imageAlt.trim().toLowerCase();

    // Check if alt text is descriptive
    const isGenericAlt = GENERIC_ALT_WORDS.some((w) => altLower === w);
    if (isGenericAlt) {
      score += 10;
      issues.push({
        field: 'image',
        severity: 'warning',
        message: 'Alt-tekst is niet beschrijvend. Vermijd algemene termen zoals "afbeelding" of "foto".',
        recommendation: 'Beschrijf het product in de alt-tekst, bijv. "Rode leren herenschoen - Merk X model Y".',
      });
    } else {
      score += 30;
    }
  } else {
    issues.push({
      field: 'image',
      severity: 'error',
      message: 'Geen alt-tekst voor de afbeelding. Voeg een beschrijvende alt-tekst toe.',
      recommendation: 'Voeg een beschrijvende alt-tekst toe die het product, merk en kenmerken vermeldt.',
    });
  }

  // Has additional images
  if (additionalImages && additionalImages.trim().length > 0) {
    try {
      const parsed = JSON.parse(additionalImages) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        score += 25;
        // Bonus for multiple additional images
        if (parsed.length >= 3) {
          score += 10;
        }
      } else {
        issues.push({
          field: 'image',
          severity: 'info',
          message: 'Geen extra afbeeldingen. Meerdere afbeeldingen verbeteren de gebruikerservaring.',
          recommendation: 'Voeg meerdere afbeeldingen toe vanuit verschillende hoeken of gebruikssituaties.',
        });
      }
    } catch {
      // additionalImages is not valid JSON — treat as missing
      issues.push({
        field: 'image',
        severity: 'info',
        message: 'Geen extra afbeeldingen. Meerdere afbeeldingen verbeteren de gebruikerservaring.',
        recommendation: 'Voeg meerdere afbeeldingen toe vanuit verschillende hoeken of gebruikssituaties.',
      });
    }
  } else {
    issues.push({
      field: 'image',
      severity: 'info',
      message: 'Geen extra afbeeldingen. Meerdere afbeeldingen verbeteren de gebruikerservaring.',
      recommendation: 'Voeg meerdere afbeeldingen toe vanuit verschillende hoeken of gebruikssituaties.',
    });
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

// ---------------------------------------------------------------------------
// Analyze Product SEO (pure function)
// ---------------------------------------------------------------------------

/**
 * Analyze a product's SEO quality across 4 dimensions.
 * This is a pure function — no database access, no side effects.
 * All messages and recommendations are in Dutch.
 */
export function analyzeProductSEO(product: ProductAnalysisInput): ProductSEOAnalysis {
  const titleResult = scoreTitle(product.name);
  const descriptionResult = scoreDescription(product.description ?? null, product.shortDescription ?? null);
  const structuredDataResult = scoreStructuredData(product);
  const imageResult = scoreImages(product.imageUrl ?? null, product.imageAlt ?? null, product.additionalImages ?? null);

  // Weighted overall score
  const overallSeoScore =
    (titleResult.score * PRODUCT_SEO_WEIGHTS.titleQuality +
      descriptionResult.score * PRODUCT_SEO_WEIGHTS.descriptionQuality +
      structuredDataResult.score * PRODUCT_SEO_WEIGHTS.structuredDataScore +
      imageResult.score * PRODUCT_SEO_WEIGHTS.imageScore) / 100;

  const allIssues: ProductSEOIssue[] = [
    ...titleResult.issues,
    ...descriptionResult.issues,
    ...structuredDataResult.issues,
    ...imageResult.issues,
  ];

  return {
    productId: '', // Will be set by the caller
    titleQuality: Math.round(titleResult.score),
    descriptionQuality: Math.round(descriptionResult.score),
    structuredDataScore: Math.round(structuredDataResult.score),
    imageScore: Math.round(imageResult.score),
    overallSeoScore: Math.round(overallSeoScore),
    issues: allIssues,
  };
}

// ---------------------------------------------------------------------------
// Analyze and Save Product SEO
// ---------------------------------------------------------------------------

/**
 * Analyze a single product and persist the scores to the database.
 * Verifies projectId for tenant isolation.
 */
export async function analyzeAndSaveProductSEO(
  productId: string,
  projectId: string,
): Promise<ProductSEOAnalysis> {
  // Fetch product with tenant verification
  const product = await db.product.findFirst({
    where: { id: productId, projectId, deletedAt: null },
  });

  if (!product) {
    throw new Error('Product niet gevonden of geen toegang.');
  }

  // Run analysis
  const analysis = analyzeProductSEO({
    name: product.name,
    description: product.description,
    shortDescription: product.shortDescription,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    additionalImages: product.additionalImages,
    gtin: product.gtin,
    mpn: product.mpn,
    productType: product.productType,
    brand: product.brand,
    productUrl: product.productUrl,
  });

  analysis.productId = productId;

  // Persist scores
  await db.product.update({
    where: { id: productId },
    data: {
      titleQuality: analysis.titleQuality,
      descriptionQuality: analysis.descriptionQuality,
      structuredDataScore: analysis.structuredDataScore,
      imageScore: analysis.imageScore,
      overallSeoScore: analysis.overallSeoScore,
      seoIssues: JSON.stringify(analysis.issues),
    },
  });

  return analysis;
}

// ---------------------------------------------------------------------------
// Batch Analyze All Products
// ---------------------------------------------------------------------------

/**
 * Analyze all products in a project and persist their scores.
 * Returns the number of products analyzed and any errors encountered.
 */
export async function analyzeAllProducts(
  projectId: string,
): Promise<{ analyzed: number; errors: string[] }> {
  const products = await db.product.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true },
  });

  let analyzed = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      await analyzeAndSaveProductSEO(product.id, projectId);
      analyzed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout';
      errors.push(`Product ${product.id}: ${message}`);
    }
  }

  return { analyzed, errors };
}
