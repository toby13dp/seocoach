// ============================================================================
// Programmatic SEO Quality Gates — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Runs 8 quality gate checks on generated programmatic content to prevent
// thin/doorway pages, duplicate content, brand violations, and other quality
// issues. All gate names, messages, and rejection reasons are in Dutch.
//
// Blocking gates (failure = page rejected):
//   - Duplicaatcontrole (duplicate check)
//   - Sjabloonvolledigheid (template completeness)
//   - Merkcontrole (brand check)
//
// Non-blocking gates (failure = warning only):
//   - Unieke gegevens (unique data requirement)
//   - Minimale waardedrempel (minimum value threshold)
//   - Kannibalisatiecontrole (cannibalisation check)
//   - Claimcontrole (claim check)
//   - Interne linkcontrole (internal link check)
// ============================================================================

import { db } from '@/lib/db';
import type { QualityGateResult, QualityGatesConfig } from './types';

// ============================================================================
// Quality Gate Identifiers
// ============================================================================

/**
 * All quality gate identifiers with their Dutch names and blocking status.
 */
const QUALITY_GATES = {
  UNIQUE_DATA: { id: 'UNIQUE_DATA', name: 'Unieke gegevens vereist', blocking: false },
  MIN_VALUE: { id: 'MIN_VALUE', name: 'Minimale waardedrempel', blocking: false },
  DUPLICATE: { id: 'DUPLICATE', name: 'Duplicaatcontrole', blocking: true },
  CANNIBALISATION: { id: 'CANNIBALISATION', name: 'Kannibalisatiecontrole', blocking: false },
  TEMPLATE_COMPLETENESS: { id: 'TEMPLATE_COMPLETENESS', name: 'Sjabloonvolledigheid', blocking: true },
  BRAND_CHECK: { id: 'BRAND_CHECK', name: 'Merkcontrole', blocking: true },
  CLAIM_CHECK: { id: 'CLAIM_CHECK', name: 'Claimcontrole', blocking: false },
  INTERNAL_LINK: { id: 'INTERNAL_LINK', name: 'Interne linkcontrole', blocking: false },
} as const;

// ============================================================================
// Helper: Text Similarity
// ============================================================================

/**
 * Calculate a simple n-gram similarity score between two strings.
 * Uses word-level trigrams for comparison. Returns a value between 0 and 1.
 *
 * @param textA - First text
 * @param textB - Second text
 * @returns Similarity score (0 = completely different, 1 = identical)
 */
function calculateSimilarity(textA: string, textB: string): number {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const wordsA = normalize(textA);
  const wordsB = normalize(textB);

  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  if (wordsA.join(' ') === wordsB.join(' ')) return 1;

  // Generate trigrams
  const getTrigrams = (words: string[]): Set<string> => {
    const trigrams = new Set<string>();
    for (let i = 0; i < words.length - 2; i++) {
      trigrams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
    return trigrams;
  };

  const trigramsA = getTrigrams(wordsA);
  const trigramsB = getTrigrams(wordsB);

  if (trigramsA.size === 0 || trigramsB.size === 0) {
    // Fall back to unigram Jaccard similarity
    const setA = new Set(wordsA);
    const setB = new Set(wordsB);
    const intersection = new Set([...setA].filter((w) => setB.has(w)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  const intersection = new Set([...trigramsA].filter((t) => trigramsB.has(t)));
  const union = new Set([...trigramsA, ...trigramsB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Count words in a text string.
 * @param text - The text to count words in
 * @returns Number of words
 */
function countWords(text: string): number {
  return text
    .replace(/[#*_\[\]()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

// ============================================================================
// Quality Gate Implementations
// ============================================================================

/**
 * Gate 1: Unique Data Requirement
 *
 * Each generated page must use distinct data values. Checks that key
 * variables differ between pages by comparing the current row data
 * against previously generated pages for this template.
 */
async function checkUniqueData(
  templateId: string,
  rowData: Record<string, unknown>,
  keyVariables: string[]
): Promise<QualityGateResult> {
  // Get existing pages for this template to compare data
  const existingPages = await db.programmaticPage.findMany({
    where: {
      templateId,
      deletedAt: null,
      status: { in: ['APPROVED', 'PENDING', 'QUALITY_CHECK'] },
    },
    select: { rowData: true },
  });

  if (existingPages.length === 0) {
    return {
      gateName: QUALITY_GATES.UNIQUE_DATA.name,
      passed: true,
      score: 100,
      message: 'Eerste pagina voor dit sjabloon — geen vergelijking nodig.',
    };
  }

  const rowValues = keyVariables.map((v) => String(rowData[v] ?? '')).filter((v) => v.length > 0);

  if (rowValues.length === 0) {
    return {
      gateName: QUALITY_GATES.UNIQUE_DATA.name,
      passed: false,
      score: 0,
      message: 'Geen sleutelwaarden gevonden in de gegevens om uniciteit te controleren.',
    };
  }

  let duplicateCount = 0;
  for (const page of existingPages) {
    try {
      const existingData: Record<string, unknown> = JSON.parse(page.rowData);
      const existingValues = keyVariables.map((v) => String(existingData[v] ?? '')).filter((v) => v.length > 0);
      // Check if all key variable values are the same
      if (rowValues.length === existingValues.length && rowValues.every((v, i) => v === existingValues[i])) {
        duplicateCount++;
      }
    } catch {
      // Skip pages with invalid JSON data
    }
  }

  if (duplicateCount > 0) {
    return {
      gateName: QUALITY_GATES.UNIQUE_DATA.name,
      passed: false,
      score: 0,
      message: `De gegevens van deze pagina komen exact overeen met ${duplicateCount} bestaande pagina('s). Elke pagina moet unieke gegevens bevatten.`,
      details: { duplicateCount, keyVariables },
    };
  }

  // Partial uniqueness score — check how many key variables have at least some variation
  let variationScore = 100;
  for (const page of existingPages) {
    try {
      const existingData: Record<string, unknown> = JSON.parse(page.rowData);
      const similarity = keyVariables.filter(
        (v) => String(rowData[v] ?? '') === String(existingData[v] ?? '')
      ).length / keyVariables.length;
      // Reduce score for partial matches
      variationScore = Math.min(variationScore, Math.round((1 - similarity) * 100));
    } catch {
      // Skip invalid data
    }
  }

  return {
    gateName: QUALITY_GATES.UNIQUE_DATA.name,
    passed: variationScore >= 50,
    score: variationScore,
    message: variationScore >= 50
      ? 'Gegevens zijn voldoende uniek ten opzichte van bestaande pagina\'s.'
      : 'Waarschuwing: gegevens lijken sterk op bestaande pagina\'s. Overweeg meer variatie toe te voegen.',
    details: { keyVariables, variationScore },
  };
}

/**
 * Gate 2: Minimum Value Threshold
 *
 * Page must have at least 300 words, a title, and at least 3 unique data points.
 */
function checkMinValueThreshold(
  generatedContent: string,
  rowData: Record<string, unknown>,
  config: QualityGatesConfig
): QualityGateResult {
  const minWordCount = config.minWordCount ?? 300;
  const minUniquePoints = config.minUniqueDataPoints ?? 3;

  const wordCount = countWords(generatedContent);
  const hasTitle = /^#\s+.+/m.test(generatedContent);
  const uniqueDataPoints = Object.values(rowData).filter(
    (v) => v !== undefined && v !== null && String(v).trim().length > 0
  ).length;

  const wordScore = Math.min(100, Math.round((wordCount / minWordCount) * 100));
  const titleScore = hasTitle ? 100 : 0;
  const dataPointsScore = Math.min(100, Math.round((uniqueDataPoints / minUniquePoints) * 100));

  const overallScore = Math.round((wordScore + titleScore + dataPointsScore) / 3);
  const passed = wordCount >= minWordCount && hasTitle && uniqueDataPoints >= minUniquePoints;

  const issues: string[] = [];
  if (wordCount < minWordCount) {
    issues.push(`Woordenaantal (${wordCount}) is onder het minimum van ${minWordCount}.`);
  }
  if (!hasTitle) {
    issues.push('De pagina heeft geen titel (H1-kop).');
  }
  if (uniqueDataPoints < minUniquePoints) {
    issues.push(`Aantal unieke gegevenspunten (${uniqueDataPoints}) is onder het minimum van ${minUniquePoints}.`);
  }

  return {
    gateName: QUALITY_GATES.MIN_VALUE.name,
    passed,
    score: overallScore,
    message: passed
      ? `Pagina voldoet aan de minimale waardedrempel: ${wordCount} woorden, ${uniqueDataPoints} gegevenspunten.`
      : `Pagina voldoet niet aan de minimale waardedrempel: ${issues.join(' ')}`,
    details: { wordCount, minWordCount, hasTitle, uniqueDataPoints, minUniquePoints, wordScore, titleScore, dataPointsScore },
  };
}

/**
 * Gate 3: Duplicate Check (BLOCKING)
 *
 * Compare generated content against existing pages in the project.
 * Reject if >80% similar.
 */
async function checkDuplicate(
  projectId: string,
  generatedContent: string,
  config: QualityGatesConfig
): Promise<QualityGateResult> {
  const maxSimilarity = config.maxSimilarityThreshold ?? 0.8;

  // Get existing crawled pages from the project
  const existingPages = await db.page.findMany({
    where: {
      projectId,
      deletedAt: null,
      mainContent: { not: null },
    },
    select: {
      url: true,
      title: true,
      mainContent: true,
      similarityScore: true,
    },
    take: 500, // Limit for performance
  });

  if (existingPages.length === 0) {
    return {
      gateName: QUALITY_GATES.DUPLICATE.name,
      passed: true,
      score: 100,
      message: 'Geen bestaande pagina\'s gevonden om mee te vergelijken.',
    };
  }

  let maxFoundSimilarity = 0;
  let mostSimilarUrl = '';

  for (const page of existingPages) {
    if (!page.mainContent) continue;
    const similarity = calculateSimilarity(generatedContent, page.mainContent);
    if (similarity > maxFoundSimilarity) {
      maxFoundSimilarity = similarity;
      mostSimilarUrl = page.url;
    }
  }

  // Also check against other programmatic pages in the project
  const existingProgrammaticPages = await db.programmaticPage.findMany({
    where: {
      projectId,
      deletedAt: null,
      generatedContent: { not: null },
      status: { in: ['APPROVED', 'PUBLISHED'] },
    },
    select: {
      id: true,
      generatedContent: true,
    },
    take: 500,
  });

  for (const page of existingProgrammaticPages) {
    if (!page.generatedContent) continue;
    const similarity = calculateSimilarity(generatedContent, page.generatedContent);
    if (similarity > maxFoundSimilarity) {
      maxFoundSimilarity = similarity;
      mostSimilarUrl = `programmatic://${page.id}`;
    }
  }

  const score = Math.round((1 - maxFoundSimilarity) * 100);
  const passed = maxFoundSimilarity < maxSimilarity;

  return {
    gateName: QUALITY_GATES.DUPLICATE.name,
    passed,
    score,
    message: passed
      ? `Inhoud is voldoende uniek (max gelijkenis: ${Math.round(maxFoundSimilarity * 100)}%).`
      : `Inhoud is te vergelijkbaar met een bestaande pagina (${Math.round(maxFoundSimilarity * 100)}% gelijkenis). Drempel: ${Math.round(maxSimilarity * 100)}%.`,
    details: { maxSimilarity: maxFoundSimilarity, threshold: maxSimilarity, mostSimilarUrl },
  };
}

/**
 * Gate 4: Cannibalisation Check
 *
 * Check if the generated page targets the same keyword as an existing page.
 * Warn if overlap is detected.
 */
async function checkCannibalisation(
  projectId: string,
  targetKeyword: string
): Promise<QualityGateResult> {
  if (!targetKeyword || targetKeyword.trim().length === 0) {
    return {
      gateName: QUALITY_GATES.CANNIBALISATION.name,
      passed: true,
      score: 100,
      message: 'Geen trefwoord opgegeven om kannibalisatie te controleren.',
    };
  }

  const normalizedKeyword = targetKeyword.toLowerCase().trim();

  // Check against keywords in the project
  const existingKeywords = await db.keyword.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      keyword: true,
      currentUrl: true,
    },
  });

  const overlappingKeywords = existingKeywords.filter((k) => {
    const existingNorm = k.keyword.toLowerCase().trim();
    return (
      existingNorm === normalizedKeyword ||
      existingNorm.includes(normalizedKeyword) ||
      normalizedKeyword.includes(existingNorm)
    );
  });

  if (overlappingKeywords.length === 0) {
    return {
      gateName: QUALITY_GATES.CANNIBALISATION.name,
      passed: true,
      score: 100,
      message: `Geen kannibalisatie gedetecteerd voor trefwoord "${targetKeyword}".`,
    };
  }

  // Partial overlap scores lower
  const exactMatches = overlappingKeywords.filter(
    (k) => k.keyword.toLowerCase().trim() === normalizedKeyword
  );

  const score = exactMatches.length > 0 ? 20 : Math.max(50, 100 - overlappingKeywords.length * 15);
  const passed = exactMatches.length === 0;

  return {
    gateName: QUALITY_GATES.CANNIBALISATION.name,
    passed,
    score,
    message: passed
      ? `Waarschuwing: ${overlappingKeywords.length} overlappende trefwoorden gevonden, maar geen exacte match voor "${targetKeyword}".`
      : `Kannibalisatierisico: exacte trefwoordmatch "${targetKeyword}" komt al voor op ${overlappingKeywords.length} pagina('s).`,
    details: {
      targetKeyword,
      overlappingKeywords: overlappingKeywords.map((k) => k.keyword),
      exactMatches: exactMatches.length,
      competingUrls: overlappingKeywords.map((k) => k.currentUrl).filter(Boolean),
    },
  };
}

/**
 * Gate 5: Template Completeness (BLOCKING)
 *
 * All {{variable}} placeholders must be filled. No empty sections.
 */
function checkTemplateCompleteness(
  generatedContent: string,
  rowData: Record<string, unknown>
): QualityGateResult {
  // Check for unfilled placeholders
  const placeholderRegex = /\{\{(\w+)\}\}/g;
  const unfilledPlaceholders: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = placeholderRegex.exec(generatedContent)) !== null) {
    unfilledPlaceholders.push(match[1]);
  }

  // Check for empty sections (## heading followed by no content or only whitespace)
  const emptySectionRegex = /^##\s+.+\n\s*(?=\n#|$)/gm;
  const emptySections: string[] = [];
  const sectionMatches = generatedContent.matchAll(/^##\s+(.+)$/gm);
  for (const sectionMatch of sectionMatches) {
    const sectionName = sectionMatch[1];
    const startPos = sectionMatch.index! + sectionMatch[0].length;
    const nextHeading = generatedContent.indexOf('\n#', startPos);
    const sectionContent = generatedContent.slice(
      startPos,
      nextHeading === -1 ? undefined : nextHeading
    ).trim();

    if (sectionContent.length === 0) {
      emptySections.push(sectionName);
    }
  }

  // Check for empty data values
  const emptyDataKeys = Object.entries(rowData)
    .filter(([, v]) => v === undefined || v === null || String(v).trim().length === 0)
    .map(([k]) => k);

  const totalIssues = unfilledPlaceholders.length + emptySections.length + emptyDataKeys.length;
  const passed = unfilledPlaceholders.length === 0 && emptySections.length === 0;

  let score = 100;
  if (unfilledPlaceholders.length > 0) score -= unfilledPlaceholders.length * 25;
  if (emptySections.length > 0) score -= emptySections.length * 15;
  if (emptyDataKeys.length > 0) score -= emptyDataKeys.length * 5;
  score = Math.max(0, score);

  const issues: string[] = [];
  if (unfilledPlaceholders.length > 0) {
    issues.push(`Niet-ingevulde plaatsaanduidingen: ${unfilledPlaceholders.join(', ')}.`);
  }
  if (emptySections.length > 0) {
    issues.push(`Lege secties: ${emptySections.join(', ')}.`);
  }
  if (emptyDataKeys.length > 0) {
    issues.push(`Lege gegevenswaarden: ${emptyDataKeys.join(', ')}.`);
  }

  return {
    gateName: QUALITY_GATES.TEMPLATE_COMPLETENESS.name,
    passed,
    score,
    message: passed
      ? 'Sjabloon is volledig ingevuld — geen lege secties of ontbrekende waarden.'
      : `Sjabloon is niet volledig: ${issues.join(' ')}`,
    details: { unfilledPlaceholders, emptySections, emptyDataKeys },
  };
}

/**
 * Gate 6: Brand Check (BLOCKING)
 *
 * Content must not violate brand profile prohibited terms/claims.
 */
async function checkBrandCompliance(
  projectId: string,
  generatedContent: string
): Promise<QualityGateResult> {
  const brandProfile = await db.brandProfile.findUnique({
    where: { projectId },
  });

  if (!brandProfile) {
    return {
      gateName: QUALITY_GATES.BRAND_CHECK.name,
      passed: true,
      score: 100,
      message: 'Geen merkprofiel gevonden — merkbewaking overgeslagen.',
    };
  }

  const prohibitedTerms: string[] = brandProfile.prohibitedTerminology
    ? JSON.parse(brandProfile.prohibitedTerminology)
    : [];
  const prohibitedClaims: string[] = brandProfile.prohibitedClaims
    ? JSON.parse(brandProfile.prohibitedClaims)
    : [];

  const contentLower = generatedContent.toLowerCase();

  const foundProhibitedTerms: string[] = [];
  for (const term of prohibitedTerms) {
    if (contentLower.includes(term.toLowerCase())) {
      foundProhibitedTerms.push(term);
    }
  }

  const foundProhibitedClaims: string[] = [];
  for (const claim of prohibitedClaims) {
    if (contentLower.includes(claim.toLowerCase())) {
      foundProhibitedClaims.push(claim);
    }
  }

  const totalViolations = foundProhibitedTerms.length + foundProhibitedClaims.length;
  const passed = totalViolations === 0;

  let score = 100;
  if (foundProhibitedTerms.length > 0) score -= foundProhibitedTerms.length * 20;
  if (foundProhibitedClaims.length > 0) score -= foundProhibitedClaims.length * 30;
  score = Math.max(0, score);

  const issues: string[] = [];
  if (foundProhibitedTerms.length > 0) {
    issues.push(`Verboden terminologie gevonden: ${foundProhibitedTerms.join(', ')}.`);
  }
  if (foundProhibitedClaims.length > 0) {
    issues.push(`Verboden claims gevonden: ${foundProhibitedClaims.join(', ')}.`);
  }

  return {
    gateName: QUALITY_GATES.BRAND_CHECK.name,
    passed,
    score,
    message: passed
      ? 'Inhoud voldoet aan de merkrichtlijnen.'
      : `Inhoud schendt merkrichtlijnen: ${issues.join(' ')}`,
    details: { foundProhibitedTerms, foundProhibitedClaims },
  };
}

/**
 * Gate 7: Claim Check
 *
 * Mark unsupported claims using claim markers from Phase 3.
 * Checks for superlative claims, unsubstantiated statistics, and
 * absolute statements that lack supporting evidence.
 */
function checkClaims(generatedContent: string): QualityGateResult {
  // Patterns that often indicate unsubstantiated claims
  const claimPatterns = [
    { pattern: /de beste/i, label: 'Superlatief: "de beste"' },
    { pattern: /nummer\s*1/i, label: 'Absolute bewering: "nummer 1"' },
    { pattern: /100%/g, label: 'Absoluut percentage: "100%"' },
    { pattern: /altijd/gi, label: 'Absolute bewering: "altijd"' },
    { pattern: /nooit/gi, label: 'Absolute bewering: "nooit"' },
    { pattern: /iedereen/gi, label: 'Algemene bewering: "iedereen"' },
    { pattern: / gegarandeerd/gi, label: 'Garantieclaim: "gegarandeerd"' },
    { pattern: /bewezen/gi, label: 'Bewijsclaim: "bewezen" zonder bron' },
    { pattern: /wetenschappelijk\s+bewezen/gi, label: 'Wetenschappelijke claim zonder bron' },
    { pattern: /enige\s+(oplossing|optie|keuze)/gi, label: 'Exclusiviteitsclaim' },
    { pattern: /onovertroffen/gi, label: 'Superlatief: "onovertroffen"' },
    { pattern: /uniek\s+in\s+de\s+wereld/gi, label: 'Exclusiviteitsclaim: "uniek in de wereld"' },
  ];

  const foundClaims: Array<{ label: string; count: number }> = [];

  for (const { pattern, label } of claimPatterns) {
    const matches = generatedContent.match(pattern);
    if (matches && matches.length > 0) {
      foundClaims.push({ label, count: matches.length });
    }
  }

  const totalClaims = foundClaims.reduce((sum, c) => sum + c.count, 0);
  const passed = totalClaims === 0;

  // Score based on number of claims found
  let score = 100;
  if (totalClaims > 0) score = Math.max(0, 100 - totalClaims * 15);

  return {
    gateName: QUALITY_GATES.CLAIM_CHECK.name,
    passed,
    score,
    message: passed
      ? 'Geen onderbouwde claims gedetecteerd in de inhoud.'
      : `${totalClaims} potentiële ononderbouwde claim(s) gevonden: ${foundClaims.map((c) => c.label).join(', ')}.`,
    details: { foundClaims, totalClaims },
  };
}

/**
 * Gate 8: Internal Link Check
 *
 * Content should include at least one internal link suggestion.
 */
async function checkInternalLinks(
  projectId: string,
  generatedContent: string
): Promise<QualityGateResult> {
  // Check for Markdown links [text](/path) or HTML links <a href="/...">
  const markdownLinks = generatedContent.match(/\[([^\]]+)\]\((\/[^)]+)\)/g) || [];
  const htmlLinks = generatedContent.match(/<a\s+href="\/[^"]*"/gi) || [];
  const totalInternalLinks = markdownLinks.length + htmlLinks.length;

  // Also check if there are existing pages in the project that could be linked to
  const existingPages = await db.page.findMany({
    where: {
      projectId,
      deletedAt: null,
      status: 'OK',
    },
    select: { url: true, title: true },
    take: 20,
  });

  const hasInternalLinks = totalInternalLinks > 0;
  const linkSuggestionAvailable = existingPages.length > 0;

  let score = 0;
  if (hasInternalLinks) {
    score = Math.min(100, 50 + totalInternalLinks * 25);
  } else if (linkSuggestionAvailable) {
    score = 30;
  } else {
    score = 80; // No pages to link to, so not penalized heavily
  }

  const passed = hasInternalLinks || !linkSuggestionAvailable;

  // Build suggestion details
  const suggestions = existingPages.slice(0, 5).map((p) => ({
    url: p.url,
    title: p.title ?? 'Zonder titel',
  }));

  return {
    gateName: QUALITY_GATES.INTERNAL_LINK.name,
    passed,
    score,
    message: hasInternalLinks
      ? `${totalInternalLinks} interne link(s) gevonden in de inhoud.`
      : linkSuggestionAvailable
        ? 'Geen interne links gevonden. Overweeg links toe te voegen naar bestaande pagina\'s.'
        : 'Geen bestaande pagina\'s beschikbaar om naar te linken.',
    details: { totalInternalLinks, suggestions },
  };
}

// ============================================================================
// Main Quality Gate Runner
// ============================================================================

/**
 * Result of running all quality gates on a piece of generated content.
 */
export interface QualityGateRunResult {
  /** Individual results for each gate */
  results: QualityGateResult[];
  /** Average score across all gates (0-100) */
  overallScore: number;
  /** Whether the page passes ALL blocking gates */
  approved: boolean;
  /** List of rejection reasons (Dutch) for blocking gate failures */
  rejectionReasons: string[];
  /** List of warnings (Dutch) for non-blocking gate failures */
  warnings: string[];
}

/**
 * Run all quality gates on generated content.
 *
 * The overall quality score is the average of all gate scores.
 * Pages that fail ANY blocking gate (duplicate, template completeness, brand check)
 * are rejected. Pages that fail non-blocking gates get warnings.
 *
 * @param projectId - The project context
 * @param templateId - The template being used
 * @param generatedContent - The generated content to check
 * @param rowData - The data row used to generate this content
 * @param config - Optional quality gate configuration overrides
 * @returns Comprehensive quality gate results
 */
export async function runQualityGates(
  projectId: string,
  templateId: string,
  generatedContent: string,
  rowData: Record<string, unknown>,
  config?: QualityGatesConfig
): Promise<QualityGateRunResult> {
  const qualityConfig: QualityGatesConfig = config ?? {
    minWordCount: 300,
    minUniqueDataPoints: 3,
    maxSimilarityThreshold: 0.8,
    checkCannibalisation: true,
    checkBrandCompliance: true,
    checkClaims: true,
    requireInternalLinks: true,
  };

  // Get the template to determine key variables
  const template = await db.programmaticTemplate.findUnique({
    where: { id: templateId },
  });

  const variables: Array<{ name: string; required: boolean }> = template?.variables
    ? JSON.parse(template.variables)
    : [];

  const keyVariables = variables.filter((v) => v.required).map((v) => v.name);

  // Determine the target keyword from the rendered content or row data
  const targetKeyword = extractTargetKeyword(rowData, template?.targetKeyword);

  // Run all quality gates
  const results: QualityGateResult[] = [];

  // Gate 1: Unique Data Requirement
  results.push(await checkUniqueData(templateId, rowData, keyVariables));

  // Gate 2: Minimum Value Threshold
  results.push(checkMinValueThreshold(generatedContent, rowData, qualityConfig));

  // Gate 3: Duplicate Check (BLOCKING)
  results.push(await checkDuplicate(projectId, generatedContent, qualityConfig));

  // Gate 4: Cannibalisation Check
  if (qualityConfig.checkCannibalisation !== false) {
    results.push(await checkCannibalisation(projectId, targetKeyword));
  }

  // Gate 5: Template Completeness (BLOCKING)
  results.push(checkTemplateCompleteness(generatedContent, rowData));

  // Gate 6: Brand Check (BLOCKING)
  if (qualityConfig.checkBrandCompliance !== false) {
    results.push(await checkBrandCompliance(projectId, generatedContent));
  }

  // Gate 7: Claim Check
  if (qualityConfig.checkClaims !== false) {
    results.push(checkClaims(generatedContent));
  }

  // Gate 8: Internal Link Check
  if (qualityConfig.requireInternalLinks !== false) {
    results.push(await checkInternalLinks(projectId, generatedContent));
  }

  // Calculate overall score
  const overallScore =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : 0;

  // Determine blocking gate failures
  const blockingGateIds = new Set([
    QUALITY_GATES.DUPLICATE.id,
    QUALITY_GATES.TEMPLATE_COMPLETENESS.id,
    QUALITY_GATES.BRAND_CHECK.id,
  ]);

  const rejectionReasons: string[] = [];
  const warnings: string[] = [];

  for (const result of results) {
    if (!result.passed) {
      // Check if this is a blocking gate by matching the gate name
      const gateEntry = Object.values(QUALITY_GATES).find((g) => g.name === result.gateName);
      if (gateEntry && gateEntry.blocking) {
        rejectionReasons.push(result.message);
      } else {
        warnings.push(result.message);
      }
    }
  }

  const approved = rejectionReasons.length === 0;

  return {
    results,
    overallScore,
    approved,
    rejectionReasons,
    warnings,
  };
}

/**
 * Extract the target keyword from row data by rendering the keyword pattern.
 */
function extractTargetKeyword(
  rowData: Record<string, unknown>,
  keywordPattern?: string | null
): string {
  if (!keywordPattern) return '';

  let keyword = keywordPattern;
  for (const [key, value] of Object.entries(rowData)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    keyword = keyword.replace(placeholder, String(value));
  }
  return keyword;
}
