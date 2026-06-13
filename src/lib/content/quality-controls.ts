// ============================================================================
// Content Quality Controls — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Pre-publication quality checks that create QualityFinding records.
// Covers duplicate detection, brand consistency, prohibited terms/claims,
// search intent verification, readability, internal links, CTAs,
// GEO readiness, unsupported claims, location uniqueness, and product data.
// All user-facing strings are in Dutch.
// ============================================================================

import { db } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

/**
 * Check types for quality findings.
 * Each type corresponds to a specific pre-publication check.
 */
export type CheckType =
  | 'DUPLICATE'
  | 'NEAR_DUPLICATE'
  | 'BRAND_CONSISTENCY'
  | 'PROHIBITED_CLAIM'
  | 'PROHIBITED_TERMINOLOGY'
  | 'INTENT_CHECK'
  | 'READABILITY'
  | 'INTERNAL_LINK'
  | 'CONVERSION'
  | 'GEO_READINESS'
  | 'UNSUPPORTED_CLAIM'
  | 'LOCATION_UNIQUENESS'
  | 'PRODUCT_CONSISTENCY';

/**
 * Severity levels for quality findings.
 * BLOCKING prevents publication; WARNING suggests review; INFO is informational.
 */
export type FindingSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

/**
 * Filters for querying quality findings.
 */
export interface FindingFilters {
  versionId?: string;
  briefId?: string;
  checkType?: CheckType;
  severity?: FindingSeverity;
  dismissed?: boolean;
}

/**
 * Result of running pre-publication checks.
 */
export interface PrePublicationCheckResult {
  /** Total number of checks run */
  totalChecks: number;
  /** Number of findings created */
  findingsCreated: number;
  /** Breakdown by severity */
  bySeverity: {
    BLOCKING: number;
    WARNING: number;
    INFO: number;
  };
  /** Whether the content can be published (no BLOCKING findings) */
  canPublish: boolean;
}

// ============================================================================
// Similarity Helpers
// ============================================================================

/**
 * Tokenize text into lowercase word tokens.
 * Removes punctuation and normalizes whitespace.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Calculate Jaccard similarity between two texts (0-1).
 * Used for duplicate and near-duplicate detection.
 */
function jaccardSimilarity(textA: string, textB: string): number {
  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));

  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ============================================================================
// Flesch Reading Ease (Dutch adaptation)
// ============================================================================

/**
 * Count syllables in a Dutch word using heuristic rules.
 * This is an approximation suitable for automated checking.
 */
function countSyllables(word: string): number {
  const w = word.toLowerCase().trim();
  if (w.length <= 2) return 1;

  // Count vowel groups as syllable indicators
  const vowelPattern = /[aeiouy\u00E9\u00EB\u00EF\u00F3\u00F6\u00FC]+/g;
  const matches = w.match(vowelPattern);
  let count = matches ? matches.length : 1;

  // Subtract for silent endings
  if (w.endsWith('en') && count > 1) count -= 0.5;
  if (w.endsWith('e') && !w.endsWith('ee') && count > 1) count -= 0.5;
  if (w.endsWith('es') && count > 1) count -= 0.5;

  return Math.max(1, Math.round(count));
}

/**
 * Calculate Flesch reading ease score adapted for Dutch.
 *
 * Formula: 206.835 - 77.0 * (syllables/words) - 0.93 * (words/sentences)
 * Dutch uses slightly different coefficients than English.
 *
 * Higher scores indicate easier readability.
 * Score < 40 means difficult to read (WARNING threshold).
 */
function fleschReadingEaseDutch(text: string): number {
  // Split into sentences (rough heuristic)
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) return 100;

  // Split into words
  const words = text
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return 100;

  // Count total syllables
  let totalSyllables = 0;
  for (const word of words) {
    totalSyllables += countSyllables(word);
  }

  const avgSyllablesPerWord = totalSyllables / words.length;
  const avgWordsPerSentence = words.length / sentences.length;

  // Dutch-adapted Flesch formula
  const score = 206.835 - 77.0 * avgSyllablesPerWord - 0.93 * avgWordsPerSentence;

  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

// ============================================================================
// Internal Check Implementations
// ============================================================================

/**
 * Find the ContentVersion and its associated brief for a given version ID.
 * Throws if the version is not found.
 */
async function getVersionAndBrief(versionId: string) {
  const version = await db.contentVersion.findUnique({
    where: { id: versionId },
    include: { brief: true },
  });

  if (!version) {
    throw new Error(`Content versie "${versionId}" niet gevonden`);
  }

  return version;
}

/**
 * Get the brand profile for a project.
 */
async function getBrandProfile(projectId: string) {
  return db.brandProfile.findFirst({
    where: { projectId, deletedAt: null },
  });
}

/**
 * Parse a JSON field safely, returning empty array on failure.
 */
function parseJsonArray(field: string | null | undefined): string[] {
  if (!field) return [];
  try {
    const parsed = JSON.parse(field);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Check 1 & 2: Duplicate and near-duplicate comparison.
 * Compares content against all other content versions in the project.
 */
async function checkDuplicates(
  projectId: string,
  versionId: string,
  content: string
): Promise<Array<{
  checkType: CheckType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}>> {
  const findings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  // Get all other versions in the project
  const otherBriefs = await db.contentBrief.findMany({
    where: { projectId },
    select: { id: true },
  });

  const briefIds = otherBriefs.map((b) => b.id);

  const otherVersions = await db.contentVersion.findMany({
    where: {
      briefId: { in: briefIds },
      id: { not: versionId },
    },
    select: {
      id: true,
      content: true,
      briefId: true,
      version: true,
    },
  });

  let highestSimilarity = 0;
  let mostSimilarVersion: { id: string; briefId: string; version: number; similarity: number } | null = null;

  for (const other of otherVersions) {
    const similarity = jaccardSimilarity(content, other.content);
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      mostSimilarVersion = {
        id: other.id,
        briefId: other.briefId,
        version: other.version,
        similarity: Math.round(similarity * 1000) / 10,
      };
    }
  }

  if (highestSimilarity > 0.9 && mostSimilarVersion) {
    findings.push({
      checkType: 'DUPLICATE',
      severity: 'BLOCKING',
      title: 'Dubbele content gevonden',
      description: `De content is voor meer dan 90% identiek aan versie ${mostSimilarVersion.version} van een andere brief in dit project (${mostSimilarVersion.similarity}% overeenkomst).`,
      evidence: {
        similarity: mostSimilarVersion.similarity,
        matchedVersionId: mostSimilarVersion.id,
        matchedBriefId: mostSimilarVersion.briefId,
        matchedVersion: mostSimilarVersion.version,
        threshold: 90,
      },
      recommendation: 'Herschrijf de content zodat deze voldoende verschilt van de bestaande content, of voeg unieke waarde toe die de andere pagina niet biedt.',
    });
  } else if (highestSimilarity > 0.7 && mostSimilarVersion) {
    findings.push({
      checkType: 'NEAR_DUPLICATE',
      severity: 'WARNING',
      title: 'Bijna-dubbele content gevonden',
      description: `De content is voor ${mostSimilarVersion.similarity}% vergelijkbaar met versie ${mostSimilarVersion.version} van een andere brief. Dit kan leiden tot canibalisatie in zoekresultaten.`,
      evidence: {
        similarity: mostSimilarVersion.similarity,
        matchedVersionId: mostSimilarVersion.id,
        matchedBriefId: mostSimilarVersion.briefId,
        matchedVersion: mostSimilarVersion.version,
        threshold: 70,
      },
      recommendation: 'Differentieer de content verder door een unieke invalshoek, andere voorbeelden of aanvullende informatie toe te voegen.',
    });
  }

  return findings;
}

/**
 * Check 3: Brand consistency.
 * Checks content against toneOfVoice and preferred terminology from BrandProfile.
 * Prohibited terms found → BLOCKING; tone mismatch → WARNING.
 */
async function checkBrandConsistency(
  projectId: string,
  content: string
): Promise<Array<{
  checkType: CheckType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}>> {
  const findings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  const brandProfile = await getBrandProfile(projectId);
  if (!brandProfile) return findings;

  // Check preferred terminology usage
  const preferredTerms = parseJsonArray(brandProfile.preferredTerminology);
  const missingPreferred: string[] = [];
  for (const term of preferredTerms) {
    if (!content.toLowerCase().includes(term.toLowerCase())) {
      missingPreferred.push(term);
    }
  }

  if (missingPreferred.length > 0) {
    findings.push({
      checkType: 'BRAND_CONSISTENCY',
      severity: 'WARNING',
      title: 'Aanbevolen terminologie ontbreekt',
      description: `De volgende aanbevolen merktermen komen niet voor in de content: ${missingPreferred.join(', ')}.`,
      evidence: {
        missingPreferredTerms: missingPreferred,
        allPreferredTerms: preferredTerms,
      },
      recommendation: `Voeg de aanbevolen terminologie toe waar relevant: ${missingPreferred.join(', ')}. Dit versterkt de merkkleur in de content.`,
    });
  }

  // Check tone of voice indicators (heuristic check)
  if (brandProfile.toneOfVoice) {
    const tone = brandProfile.toneOfVoice.toLowerCase();
    const contentLower = content.toLowerCase();

    // Simple heuristic: if tone says formal, check for informal markers; and vice versa
    const informalMarkers = ['leuk', 'gaaf', 'cool', 'super', 'toppie', 'heftig', 'klote'];
    const formalMarkers = ['derhalve', 'aldus', 'bijgevolg', 'aangaande', 'betreffende', 'inzake'];

    if (tone.includes('formeel') || tone.includes('professioneel')) {
      const foundInformal = informalMarkers.filter((m) => contentLower.includes(m));
      if (foundInformal.length > 0) {
        findings.push({
          checkType: 'BRAND_CONSISTENCY',
          severity: 'WARNING',
          title: 'Tone of voice komt niet overeen',
          description: `De tone of voice is "${brandProfile.toneOfVoice}", maar informele taal is gevonden: ${foundInformal.join(', ')}.`,
          evidence: {
            toneOfVoice: brandProfile.toneOfVoice,
            informalMarkersFound: foundInformal,
          },
          recommendation: 'Vervang informele uitdrukkingen door professionelere alternatieven die bij de merkstem passen.',
        });
      }
    }

    if (tone.includes('informeel') || tone.includes('vlot') || tone.includes('vriendelijk')) {
      const foundTooFormal = formalMarkers.filter((m) => contentLower.includes(m));
      if (foundTooFormal.length > 0) {
        findings.push({
          checkType: 'BRAND_CONSISTENCY',
          severity: 'WARNING',
          title: 'Tone of voice komt niet overeen',
          description: `De tone of voice is "${brandProfile.toneOfVoice}", maar te formele taal is gevonden: ${foundTooFormal.join(', ')}.`,
          evidence: {
            toneOfVoice: brandProfile.toneOfVoice,
            formalMarkersFound: foundTooFormal,
          },
          recommendation: 'Vervang te formele uitdrukkingen door vlottere, toegankelijkere alternatieven.',
        });
      }
    }
  }

  return findings;
}

/**
 * Check 4: Prohibited claim detection.
 * BLOCKING if prohibited claims from BrandProfile are found in content.
 */
async function checkProhibitedClaims(
  projectId: string,
  content: string
): Promise<Array<{
  checkType: CheckType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}>> {
  const findings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  const brandProfile = await getBrandProfile(projectId);
  if (!brandProfile) return findings;

  const prohibitedClaims = parseJsonArray(brandProfile.prohibitedClaims);
  const contentLower = content.toLowerCase();
  const foundClaims: string[] = [];

  for (const claim of prohibitedClaims) {
    if (contentLower.includes(claim.toLowerCase())) {
      foundClaims.push(claim);
    }
  }

  if (foundClaims.length > 0) {
    findings.push({
      checkType: 'PROHIBITED_CLAIM',
      severity: 'BLOCKING',
      title: 'Verboden beweringen gevonden',
      description: `De volgende verboden beweringen zijn aangetroffen in de content: ${foundClaims.join('; ')}. Deze mogen niet worden gepubliceerd.`,
      evidence: {
        prohibitedClaimsFound: foundClaims,
        allProhibitedClaims: prohibitedClaims,
      },
      recommendation: 'Verwijder of herschrijf de verboden beweringen. Raadpleeg de merkrichtlijnen voor toegestane alternatieven.',
    });
  }

  return findings;
}

/**
 * Check 5: Prohibited terminology detection.
 * BLOCKING if prohibited terms from BrandProfile are found in content.
 */
async function checkProhibitedTerminology(
  projectId: string,
  content: string
): Promise<Array<{
  checkType: CheckType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}>> {
  const findings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  const brandProfile = await getBrandProfile(projectId);
  if (!brandProfile) return findings;

  const prohibitedTerms = parseJsonArray(brandProfile.prohibitedTerminology);
  const contentLower = content.toLowerCase();
  const foundTerms: string[] = [];

  for (const term of prohibitedTerms) {
    if (contentLower.includes(term.toLowerCase())) {
      foundTerms.push(term);
    }
  }

  if (foundTerms.length > 0) {
    findings.push({
      checkType: 'PROHIBITED_TERMINOLOGY',
      severity: 'BLOCKING',
      title: 'Verboden terminologie gevonden',
      description: `De volgende verboden termen zijn aangetroffen in de content: ${foundTerms.join(', ')}. Deze mogen niet worden gebruikt.`,
      evidence: {
        prohibitedTermsFound: foundTerms,
        allProhibitedTerms: prohibitedTerms,
      },
      recommendation: 'Vervang de verboden termen door de aanbevolen alternatieven uit het merkprofiel.',
    });
  }

  return findings;
}

/**
 * Check 6: Search intent check.
 * Verifies that the content matches the brief's declared search intent.
 * WARNING if mismatch detected.
 */
function checkSearchIntent(
  content: string,
  searchIntent: string
): Array<{
  checkType: CheckType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}> {
  const findings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  if (!searchIntent || searchIntent === 'UNKNOWN') return findings;

  const contentLower = content.toLowerCase();

  // Intent-specific content indicators
  const intentIndicators: Record<string, { present: string[]; absent: string[] }> = {
    INFORMATIONAL: {
      present: ['hoe', 'wat is', 'uitleg', 'gids', 'informatie', 'tips', 'advies', 'leren', 'ontdek'],
      absent: ['koop', 'bestel', 'prijs', 'korting', 'winkelwagen'],
    },
    TRANSACTIONAL: {
      present: ['koop', 'bestel', 'prijs', 'offerte', 'aanvragen', 'bestellen', 'proefperiode', 'korting'],
      absent: ['wat is', 'uitleg', 'geschiedenis'],
    },
    NAVIGATIONAL: {
      present: ['inloggen', 'login', 'dashboard', 'portal', 'account', 'toegang'],
      absent: ['hoe', 'wat is', 'vergelijk'],
    },
    COMMERCIAL_INVESTIGATION: {
      present: ['vergelijk', 'versus', 'vs', 'review', 'beoordeling', 'beste', 'top', 'alternatieven'],
      absent: ['koop nu', 'bestel direct'],
    },
    LOCAL: {
      present: ['bij jou in de buurt', 'lokale', 'vestiging', 'adres', 'route', 'openingstijden', 'in [stad]'],
      absent: ['wereldwijd', 'internationaal'],
    },
    BRANDED: {
      present: [], // Brand names would be checked dynamically
      absent: [],
    },
  };

  const indicators = intentIndicators[searchIntent];
  if (!indicators) return findings;

  // Check for absent indicators (content doesn't match the declared intent)
  const absentFound = indicators.absent.filter((term) => contentLower.includes(term));
  const presentFound = indicators.present.filter((term) => contentLower.includes(term));

  if (absentFound.length > 0 && presentFound.length === 0) {
    findings.push({
      checkType: 'INTENT_CHECK',
      severity: 'WARNING',
      title: 'Zoekintentie komt niet overeen met content',
      description: `De brief is gericht op zoekintentie "${searchIntent}", maar de content bevat signalen die beter bij een andere intentie passen (gevonden: ${absentFound.join(', ')}).`,
      evidence: {
        declaredIntent: searchIntent,
        conflictingTerms: absentFound,
        matchingTerms: presentFound,
      },
      recommendation: `Pas de content aan zodat deze beter aansluit bij de "${searchIntent}" zoekintentie. Verwijder verwarrende signalen en voeg relevante intentie-indicators toe.`,
    });
  }

  return findings;
}

/**
 * Check 7: Readability check.
 * Calculates Flesch reading ease score for Dutch.
 * WARNING if score < 40.
 */
function checkReadability(
  content: string
): Array<{
  checkType: CheckType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}> {
  const findings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  const score = fleschReadingEaseDutch(content);

  if (score < 40) {
    findings.push({
      checkType: 'READABILITY',
      severity: 'WARNING',
      title: 'Leesbaarheidsscore is te laag',
      description: `De Flesch-leesbaarheidsscore is ${score}/100. Dit betekent dat de content moeilijk leesbaar is voor het algemene publiek.`,
      evidence: {
        fleschScore: score,
        threshold: 40,
        interpretation: score < 30 ? 'Zeer moeilijk' : 'Moeilijk',
      },
      recommendation: 'Gebruik kortere zinnen, eenvoudigere woorden en meer witregels. Streef naar een score van minimaal 50 voor algemene content.',
    });
  }

  return findings;
}

/**
 * Check 8: Internal link check.
 * WARNING if content has no internal links.
 */
function checkInternalLinks(
  content: string
): Array<{
  checkType: CheckType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}> {
  const findings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  // Check for internal link patterns: markdown links, HTML links, or placeholders
  const markdownLinkPattern = /\[([^\]]+)\]\((?!https?:\/\/)([^\)]+)\)/g;
  const htmlLinkPattern = /<a[^>]+href=["'](?!https?:\/\/)([^"']+)["']/gi;
  const internalLinkPlaceholder = /\[interne link[:\s]*([^\]]+)\]/gi;

  const markdownMatches = content.match(markdownLinkPattern);
  const htmlMatches = content.match(htmlLinkPattern);
  const placeholderMatches = content.match(internalLinkPlaceholder);

  const totalInternalLinks =
    (markdownMatches?.length ?? 0) +
    (htmlMatches?.length ?? 0) +
    (placeholderMatches?.length ?? 0);

  if (totalInternalLinks === 0) {
    findings.push({
      checkType: 'INTERNAL_LINK',
      severity: 'WARNING',
      title: 'Geen interne links gevonden',
      description: 'De content bevat geen interne links. Interne links helpen zoekmachines om de sitestructuur te begrijpen en bezoekers naar relevante pagina\'s te leiden.',
      evidence: {
        internalLinkCount: 0,
      },
      recommendation: 'Voeg 2-4 interne links toe naar gerelateerde content op de website. Gebruik relevante ankerteksten die de doelpagina beschrijven.',
    });
  }

  return findings;
}

/**
 * Check 9: Conversion check.
 * Check if content has a CTA. INFO if missing.
 */
function checkConversion(
  content: string
): Array<{
  checkType: CheckType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}> {
  const findings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  const contentLower = content.toLowerCase();

  // Common Dutch CTA patterns
  const ctaPatterns = [
    'neem contact op',
    'neem contact',
    'kontakt opnemen',
    'vraag aan',
    'vraag een',
    'offerte aan',
    'offerte aanvragen',
    'proefperiode',
    'gratis proef',
    'start nu',
    'begin nu',
    'schrijf je in',
    'inschrijven',
    'meld je aan',
    'bestel nu',
    'koop nu',
    'direct aanvragen',
    'maak een afspraak',
    'plan een gesprek',
    'ontdek hoe',
    'probeer het',
    'download',
    'lees meer',
    'bekijk onze',
    'ontdek onze',
    'vind meer',
    'cta',
    'call-to-action',
  ];

  const foundCtas = ctaPatterns.filter((cta) => contentLower.includes(cta));

  if (foundCtas.length === 0) {
    findings.push({
      checkType: 'CONVERSION',
      severity: 'INFO',
      title: 'Geen call-to-action gevonden',
      description: 'De content bevat geen herkenbare call-to-action (CTA). Een CTA helpt bezoekers om de volgende stap te zetten.',
      evidence: {
        ctaPatternsChecked: ctaPatterns.length,
        ctasFound: 0,
      },
      recommendation: 'Voeg een duidelijke call-to-action toe aan het einde van de content, zoals "Neem contact op", "Vraag een offerte aan" of "Probeer het gratis".',
    });
  }

  return findings;
}

/**
 * Check 10: GEO readiness check.
 * Check if content has structured data, clear answers, FAQ format.
 * INFO with recommendations.
 */
function checkGeoReadiness(
  content: string
): Array<{
  checkType: CheckType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}> {
  const findings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  const contentLower = content.toLowerCase();
  const recommendations: string[] = [];
  const evidence: Record<string, unknown> = {};

  // Check for structured data indicators
  const hasStructuredData =
    content.includes('application/ld+json') ||
    content.includes('schema.org') ||
    content.includes('"@type"');
  evidence.hasStructuredData = hasStructuredData;
  if (!hasStructuredData) {
    recommendations.push('Voeg gestructureerde data (JSON-LD) toe om zoekmachines te helpen de content te begrijpen.');
  }

  // Check for FAQ format
  const hasFaq =
    contentLower.includes('veelgestelde vragen') ||
    contentLower.includes('faq') ||
    /##.*\?.*\n/.test(content);
  evidence.hasFaq = hasFaq;
  if (!hasFaq) {
    recommendations.push('Voeg een FAQ-sectie toe met veelgestelde vragen en heldere antwoorden.');
  }

  // Check for clear answers (short paragraphs after questions/headings)
  const hasShortAnswers = /(?:^|\n)#{1,3}\s+.*\?(?:\n\n?[^\n]{10,200}){1}/m.test(content);
  evidence.hasShortAnswers = hasShortAnswers;
  if (!hasShortAnswers) {
    recommendations.push('Plaats duidelijke, beknopte antwoorden direct na vraagkoppen voor featured snippet kansen.');
  }

  // Check for lists/tables (good for GEO)
  const hasLists = /^[\s]*[-*]\s/m.test(content) || /^\d+\.\s/m.test(content);
  const hasTables = content.includes('|') && content.includes('---');
  evidence.hasLists = hasLists;
  evidence.hasTables = hasTables;
  if (!hasLists && !hasTables) {
    recommendations.push('Gebruik lijsten of tabellen om informatie gestructureerd weer te geven.');
  }

  if (recommendations.length > 0) {
    findings.push({
      checkType: 'GEO_READINESS',
      severity: 'INFO',
      title: 'GEO-klaarheid kan worden verbeterd',
      description: `De content kan beter worden geoptimaliseerd voor Generatieve Zoekervaring (GEO). ${recommendations.length} verbeterpunten gevonden.`,
      evidence,
      recommendation: recommendations.join(' '),
    });
  }

  return findings;
}

/**
 * Check 11: Unsupported claim check.
 * Check for VERIFICATIE_NODIG markers. WARNING if found.
 */
function checkUnsupportedClaims(
  content: string
): Array<{
  checkType: CheckType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}> {
  const findings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  // Find VERIFICATIE_NODIG markers
  const markerRegex = /\[VERIFICATIE_NODIG\]([\s\S]*?)\[\/VERIFICATIE_NODIG\]/g;
  const claims: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = markerRegex.exec(content)) !== null) {
    claims.push(match[1].trim());
  }

  if (claims.length > 0) {
    findings.push({
      checkType: 'UNSUPPORTED_CLAIM',
      severity: 'WARNING',
      title: 'Onondersteunde beweringen gevonden',
      description: `${claims.length} bewering(en) in de content zijn gemarkeerd voor verificatie maar zijn nog niet gecontroleerd. Publicatie zonder verificatie wordt afgeraden.`,
      evidence: {
        unverifiedClaimCount: claims.length,
        claims: claims.slice(0, 10), // Limit to first 10 for storage
      },
      recommendation: 'Controleer alle gemarkeerde beweringen en voorzie ze van bronnen. Vervang of verwijder beweringen die niet geverifieerd kunnen worden. Verwijder de [VERIFICATIE_NODIG] markers na verificatie.',
    });
  }

  return findings;
}

/**
 * Check 12: Location page uniqueness.
 * For location pages, check uniqueness against other location pages in the project.
 * BLOCKING if too similar.
 */
async function checkLocationUniqueness(
  projectId: string,
  versionId: string,
  content: string
): Promise<Array<{
  checkType: CheckType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}>> {
  const findings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  // Heuristic: detect if this is a location page
  const locationIndicators = [
    /in\s+\p{L}+/iu, // "in [plaatsnaam]"
    /bij\s+jou\s+in\s+de\s+buurt/i,
    /vestiging/i,
    /locatie/i,
    /openingstijden/i,
    /adres/i,
    /routebeschrijving/i,
    /regio/i,
  ];

  const isLocationPage = locationIndicators.some((pattern) => pattern.test(content));
  if (!isLocationPage) return findings;

  // Get all other content versions in the project for comparison
  const otherBriefs = await db.contentBrief.findMany({
    where: { projectId },
    select: { id: true },
  });

  const briefIds = otherBriefs.map((b) => b.id);

  const otherVersions = await db.contentVersion.findMany({
    where: {
      briefId: { in: briefIds },
      id: { not: versionId },
    },
    select: {
      id: true,
      content: true,
      briefId: true,
    },
  });

  // Compare against other versions that also look like location pages
  for (const other of otherVersions) {
    const otherIsLocation = locationIndicators.some((pattern) => pattern.test(other.content));
    if (!otherIsLocation) continue;

    const similarity = jaccardSimilarity(content, other.content);
    if (similarity > 0.75) {
      findings.push({
        checkType: 'LOCATION_UNIQUENESS',
        severity: 'BLOCKING',
        title: 'Locatiepagina is te vergelijkbaar met andere locatiepagina',
        description: `Deze locatiepagina is voor ${Math.round(similarity * 100)}% identiek aan een andere locatiepagina in het project. Locatiepagina's moeten voldoende unieke content bevatten per locatie.`,
        evidence: {
          similarity: Math.round(similarity * 1000) / 10,
          comparedWithVersionId: other.id,
          comparedWithBriefId: other.briefId,
          threshold: 75,
        },
        recommendation: 'Voeg locatie-specifieke informatie toe: unieke openings tijden, lokale teams, regiospecifieke diensten, klantverhalen uit de regio, en lokaal relevante voorbeelden.',
      });

      break; // One finding is enough
    }
  }

  return findings;
}

/**
 * Check 13: Product data consistency.
 * For product content, check against product data from BrandProfile.
 * WARNING if inconsistent.
 */
async function checkProductConsistency(
  projectId: string,
  content: string
): Promise<Array<{
  checkType: CheckType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}>> {
  const findings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  const brandProfile = await getBrandProfile(projectId);
  if (!brandProfile) return findings;

  // Check products data
  const products = parseJsonArray(brandProfile.products);
  if (products.length === 0) return findings;

  // Heuristic: detect if this is product-related content
  const productIndicators = ['product', 'functie', 'feature', 'specificatie', 'eigenschap', 'voordelen', 'oplossing'];
  const contentLower = content.toLowerCase();
  const isProductContent = productIndicators.some((indicator) => contentLower.includes(indicator));
  if (!isProductContent) return findings;

  // Check if any product names from brand profile are mentioned with incorrect context
  const inconsistencies: string[] = [];
  for (const product of products) {
    // Simple check: if product is mentioned, check if it's associated with correct terminology
    if (contentLower.includes(product.toLowerCase())) {
      // This is a basic check - in a real implementation, this would cross-reference
      // with detailed product specifications from a product database
      const contextMatch = true; // Placeholder for more sophisticated checks
      if (!contextMatch) {
        inconsistencies.push(product);
      }
    }
  }

  // Also check services
  const services = parseJsonArray(brandProfile.services);
  for (const service of services) {
    if (contentLower.includes(service.toLowerCase())) {
      // Similar basic check for services
      const contextMatch = true; // Placeholder
      if (!contextMatch) {
        inconsistencies.push(service);
      }
    }
  }

  // INFO-level finding about product data verification
  if (products.length > 0 || services.length > 0) {
    const mentionedProducts = products.filter((p) => contentLower.includes(p.toLowerCase()));
    const mentionedServices = services.filter((s) => contentLower.includes(s.toLowerCase()));

    if (mentionedProducts.length === 0 && mentionedServices.length === 0 && isProductContent) {
      findings.push({
        checkType: 'PRODUCT_CONSISTENCY',
        severity: 'WARNING',
        title: 'Productgegevens komen niet overeen',
        description: 'De content lijkt productgerelateerd te zijn, maar verwijst niet naar de producten of diensten uit het merkprofiel.',
        evidence: {
          availableProducts: products,
          availableServices: services,
          mentionedProducts: [],
          mentionedServices: [],
        },
        recommendation: 'Verwijs naar de juiste producten en diensten uit het merkprofiel. Dit zorgt voor consistentie tussen content en bedrijfsgegevens.',
      });
    }
  }

  if (inconsistencies.length > 0) {
    findings.push({
      checkType: 'PRODUCT_CONSISTENCY',
      severity: 'WARNING',
      title: 'Productgegevens komen niet overeen',
      description: `De volgende producten/diensten worden mogelijk met onjuiste informatie genoemd: ${inconsistencies.join(', ')}.`,
      evidence: {
        inconsistentItems: inconsistencies,
      },
      recommendation: 'Controleer of de product- en dienstgegevens in de content overeenkomen met de officiële gegevens in het merkprofiel.',
    });
  }

  return findings;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run all pre-publication quality checks for a content version.
 *
 * Creates QualityFinding records in the database for each issue detected.
 * Returns a summary of the checks including whether the content can be published.
 *
 * @param projectId - The project ID
 * @param versionId - The content version ID to check
 * @returns Summary of check results
 * @throws Error if the content version is not found
 */
export async function runPrePublicationChecks(
  projectId: string,
  versionId: string
): Promise<PrePublicationCheckResult> {
  // Load the content version and brief
  const version = await getVersionAndBrief(versionId);
  const content = version.content;
  const briefId = version.briefId;

  // Delete any existing findings for this version to avoid duplicates
  await db.qualityFinding.deleteMany({
    where: { versionId },
  });

  // Run all checks and collect findings
  const allFindings: Array<{
    checkType: CheckType;
    severity: FindingSeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    recommendation: string;
  }> = [];

  // 1 & 2. Duplicate and near-duplicate checks
  const duplicateFindings = await checkDuplicates(projectId, versionId, content);
  allFindings.push(...duplicateFindings);

  // 3. Brand consistency
  const brandFindings = await checkBrandConsistency(projectId, content);
  allFindings.push(...brandFindings);

  // 4. Prohibited claims
  const claimFindings = await checkProhibitedClaims(projectId, content);
  allFindings.push(...claimFindings);

  // 5. Prohibited terminology
  const terminologyFindings = await checkProhibitedTerminology(projectId, content);
  allFindings.push(...terminologyFindings);

  // 6. Search intent check
  const intentFindings = checkSearchIntent(content, version.brief.searchIntent);
  allFindings.push(...intentFindings);

  // 7. Readability check
  const readabilityFindings = checkReadability(content);
  allFindings.push(...readabilityFindings);

  // 8. Internal link check
  const linkFindings = checkInternalLinks(content);
  allFindings.push(...linkFindings);

  // 9. Conversion check
  const conversionFindings = checkConversion(content);
  allFindings.push(...conversionFindings);

  // 10. GEO readiness check
  const geoFindings = checkGeoReadiness(content);
  allFindings.push(...geoFindings);

  // 11. Unsupported claim check
  const unsupportedClaimFindings = checkUnsupportedClaims(content);
  allFindings.push(...unsupportedClaimFindings);

  // 12. Location page uniqueness
  const locationFindings = await checkLocationUniqueness(projectId, versionId, content);
  allFindings.push(...locationFindings);

  // 13. Product data consistency
  const productFindings = await checkProductConsistency(projectId, content);
  allFindings.push(...productFindings);

  // Persist all findings to the database
  const bySeverity = { BLOCKING: 0, WARNING: 0, INFO: 0 };

  for (const finding of allFindings) {
    await db.qualityFinding.create({
      data: {
        projectId,
        versionId,
        briefId,
        checkType: finding.checkType,
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        evidence: JSON.stringify(finding.evidence),
        recommendation: finding.recommendation,
      },
    });

    bySeverity[finding.severity]++;
  }

  return {
    totalChecks: 13,
    findingsCreated: allFindings.length,
    bySeverity,
    canPublish: bySeverity.BLOCKING === 0,
  };
}

/**
 * Get quality findings for a project with optional filters.
 *
 * @param projectId - The project ID
 * @param filters - Optional filters for version, brief, check type, severity, or dismissed status
 * @returns Array of quality findings matching the filters
 */
export async function getFindings(
  projectId: string,
  filters?: FindingFilters
) {
  const where: Record<string, unknown> = { projectId };

  if (filters?.versionId) where.versionId = filters.versionId;
  if (filters?.briefId) where.briefId = filters.briefId;
  if (filters?.checkType) where.checkType = filters.checkType;
  if (filters?.severity) where.severity = filters.severity;
  if (filters?.dismissed !== undefined) where.dismissed = filters.dismissed;

  return db.qualityFinding.findMany({
    where,
    orderBy: [
      { severity: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}

/**
 * Dismiss a quality finding.
 *
 * Once dismissed, the finding will no longer block publication,
 * even if its severity is BLOCKING. The dismissal is tracked
 * with the user who dismissed it and when.
 *
 * @param findingId - The finding ID to dismiss
 * @param userId - The user who is dismissing the finding
 * @throws Error if the finding is not found
 */
export async function dismissFinding(
  findingId: string,
  userId: string
): Promise<void> {
  const finding = await db.qualityFinding.findUnique({
    where: { id: findingId },
  });

  if (!finding) {
    throw new Error(`Bevinding "${findingId}" niet gevonden`);
  }

  await db.qualityFinding.update({
    where: { id: findingId },
    data: {
      dismissed: true,
      dismissedBy: userId,
      dismissedAt: new Date(),
    },
  });
}

/**
 * Check if any BLOCKING findings exist for a version.
 *
 * Only non-dismissed BLOCKING findings are considered.
 * If this returns true, the content should not be published.
 *
 * @param versionId - The content version ID to check
 * @returns true if non-dismissed BLOCKING findings exist
 */
export async function hasBlockingFindings(versionId: string): Promise<boolean> {
  const count = await db.qualityFinding.count({
    where: {
      versionId,
      severity: 'BLOCKING',
      dismissed: false,
    },
  });

  return count > 0;
}
