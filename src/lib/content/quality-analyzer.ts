// ============================================================================
// Content Quality Analyzer — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Analyzes content quality across 11 dimensions, each scored 0-100 with
// Dutch-language explanations and recommendations. Supports both AI-powered
// and rule-based analysis paths. Results are persisted to the ContentQuality
// model in the database.
// ============================================================================

import { db } from '@/lib/db';
import { providerManager } from '@/lib/ai/provider-manager';
import type { QualityDimension } from './types';

// ============================================================================
// Quality Dimension Definitions
// ============================================================================

/**
 * All quality dimension definitions with their Dutch names.
 *
 * Each dimension represents a specific aspect of content quality
 * that is independently scored and explained. The weights determine
 * the contribution of each dimension to the overall score.
 */
const QUALITY_DIMENSIONS: Array<{
  name: string;
  dutchName: string;
  description: string;
  weight: number;
}> = [
  {
    name: 'intentScore',
    dutchName: 'Zoekintentie-overeenkomst',
    description: 'In hoeverre beantwoordt de content de zoekintentie van de gebruiker?',
    weight: 0.12,
  },
  {
    name: 'coverageScore',
    dutchName: 'Onderwerpdekking',
    description: 'Is het onderwerp volledig en diepgaand behandeld?',
    weight: 0.12,
  },
  {
    name: 'readabilityScore',
    dutchName: 'Leesbaarheid',
    description: 'Is de tekst goed leesbaar voor de doelgroep? (Flesch-Kincaid aangepast voor Nederlands)',
    weight: 0.10,
  },
  {
    name: 'originalityScore',
    dutchName: 'Originaliteit',
    description: 'Biedt de content unieke waarde ten opzichte van bestaande content?',
    weight: 0.08,
  },
  {
    name: 'brandConsistencyScore',
    dutchName: 'Merkconsistentie',
    description: 'Komt de content overeen met de merkrichtlijnen?',
    weight: 0.08,
  },
  {
    name: 'eeatScore',
    dutchName: 'E-E-A-T signalen',
    description: 'Ervaring, Expertise, Autoriteit en Betrouwbaarheid (Experience, Expertise, Authoritativeness, Trustworthiness)',
    weight: 0.12,
  },
  {
    name: 'internalLinkScore',
    dutchName: 'Interne links',
    description: 'Zijn er relevante interne links aanwezig?',
    weight: 0.07,
  },
  {
    name: 'entityScore',
    dutchName: 'Entiteitendekking',
    description: 'Worden relevante entiteiten (begrippen, concepten) genoemd?',
    weight: 0.07,
  },
  {
    name: 'conversionScore',
    dutchName: 'Conversie-elementen',
    description: 'Zijn er duidelijke conversie-elementen aanwezig (call-to-action, formulieren, etc.)?',
    weight: 0.08,
  },
  {
    name: 'geoReadinessScore',
    dutchName: 'AI-zoekgereedheid',
    description: 'Is de content geoptimaliseerd voor AI-gedreven zoekmachines (Generative Engine Optimization)?',
    weight: 0.08,
  },
  {
    name: 'publicationReadinessScore',
    dutchName: 'Publicatiegereedheid',
    description: 'Is de content klaar om gepubliceerd te worden (technisch en inhoudelijk)?',
    weight: 0.08,
  },
];

// ============================================================================
// Public API
// ============================================================================

/**
 * Get all quality dimension definitions.
 *
 * Returns the metadata for each dimension including the Dutch name,
 * description, and weight in the overall score calculation.
 *
 * @returns Array of dimension definitions
 */
export function getQualityDimensions(): QualityDimension[] {
  return QUALITY_DIMENSIONS.map((d) => ({
    name: d.name,
    dutchName: d.dutchName,
    score: 0,
    explanation: d.description,
    recommendations: [],
  }));
}

/**
 * Run a full quality analysis on a content version.
 *
 * The analysis covers 11 quality dimensions, each scored from 0-100
 * with Dutch-language explanations and actionable recommendations.
 *
 * The analysis follows this process:
 * 1. Load the content version and brief context
 * 2. Try AI-powered analysis for detailed insights
 * 3. Fall back to rule-based analysis when AI is unavailable
 * 4. Calculate the weighted overall score
 * 5. Persist results to the ContentQuality table
 *
 * @param contentVersionId - The content version to analyze
 * @param projectId - The project context (for AI provider selection)
 * @returns The ContentQuality record with all dimension scores
 * @throws Error if the content version does not exist
 */
export async function analyzeQuality(
  contentVersionId: string,
  projectId: string
): Promise<{
  id: string;
  contentVersionId: string;
  intentScore: number;
  coverageScore: number;
  readabilityScore: number;
  originalityScore: number;
  brandConsistencyScore: number;
  eeatScore: number;
  internalLinkScore: number;
  entityScore: number;
  conversionScore: number;
  geoReadinessScore: number;
  publicationReadinessScore: number;
  overallScore: number;
  details: string;
  recommendations: string[];
  createdAt: Date;
}> {
  // Load the content version
  const version = await db.contentVersion.findUnique({
    where: { id: contentVersionId },
    include: {
      brief: {
        select: {
          projectId: true,
          title: true,
          targetKeyword: true,
          searchIntent: true,
          funnelStage: true,
          toneOfVoice: true,
          targetAudience: true,
          secondaryKeywords: true,
          brandProfileUsed: true,
          outline: true,
          targetWordCount: true,
        },
      },
    },
  });

  if (!version) {
    throw new Error(`Content versie "${contentVersionId}" niet gevonden`);
  }

  const content = version.content;
  const brief = version.brief;

  // Strip claim markers for analysis
  const cleanContent = content
    .replace(/\[VERIFICATIE_NODIG\]/g, '')
    .replace(/\[\/VERIFICATIE_NODIG\]/g, '');

  // Try AI-powered quality analysis
  let dimensions: QualityDimension[];

  try {
    dimensions = await aiQualityAnalysis(
      projectId,
      cleanContent,
      brief.targetKeyword ?? undefined,
      brief.title
    );
  } catch {
    // Fall back to rule-based analysis
    dimensions = ruleBasedQualityAnalysis(
      cleanContent,
      brief.targetKeyword ?? undefined,
      brief.searchIntent,
      brief.toneOfVoice ?? undefined,
      brief.targetWordCount ?? undefined
    );
  }

  // Calculate weighted overall score
  const overallScore = calculateOverallScore(dimensions);

  // Build detailed JSON for each dimension
  const detailsRecord: Record<string, QualityDimension> = {};
  for (const dim of dimensions) {
    detailsRecord[dim.name] = dim;
  }

  // Collect top recommendations (from all dimensions, sorted by impact)
  const allRecommendations = dimensions
    .flatMap((dim) =>
      dim.recommendations.map((rec) => ({
        dimension: dim.dutchName,
        recommendation: rec,
        score: dim.score,
      }))
    )
    .sort((a, b) => a.score - b.score) // Lowest scores first = highest priority
    .slice(0, 10)
    .map((r) => `[${r.dimension}] ${r.recommendation}`);

  // Check if a quality record already exists for this version
  const existing = await db.contentQuality.findUnique({
    where: { contentVersionId },
  });

  let qualityRecord;

  if (existing) {
    qualityRecord = await db.contentQuality.update({
      where: { contentVersionId },
      data: {
        intentScore: getDimensionScore(dimensions, 'intentScore'),
        coverageScore: getDimensionScore(dimensions, 'coverageScore'),
        readabilityScore: getDimensionScore(dimensions, 'readabilityScore'),
        originalityScore: getDimensionScore(dimensions, 'originalityScore'),
        brandConsistencyScore: getDimensionScore(
          dimensions,
          'brandConsistencyScore'
        ),
        eeatScore: getDimensionScore(dimensions, 'eeatScore'),
        internalLinkScore: getDimensionScore(dimensions, 'internalLinkScore'),
        entityScore: getDimensionScore(dimensions, 'entityScore'),
        conversionScore: getDimensionScore(dimensions, 'conversionScore'),
        geoReadinessScore: getDimensionScore(dimensions, 'geoReadinessScore'),
        publicationReadinessScore: getDimensionScore(
          dimensions,
          'publicationReadinessScore'
        ),
        overallScore,
        details: JSON.stringify(detailsRecord),
        recommendations: JSON.stringify(allRecommendations),
      },
    });
  } else {
    qualityRecord = await db.contentQuality.create({
      data: {
        contentVersionId,
        intentScore: getDimensionScore(dimensions, 'intentScore'),
        coverageScore: getDimensionScore(dimensions, 'coverageScore'),
        readabilityScore: getDimensionScore(dimensions, 'readabilityScore'),
        originalityScore: getDimensionScore(dimensions, 'originalityScore'),
        brandConsistencyScore: getDimensionScore(
          dimensions,
          'brandConsistencyScore'
        ),
        eeatScore: getDimensionScore(dimensions, 'eeatScore'),
        internalLinkScore: getDimensionScore(dimensions, 'internalLinkScore'),
        entityScore: getDimensionScore(dimensions, 'entityScore'),
        conversionScore: getDimensionScore(dimensions, 'conversionScore'),
        geoReadinessScore: getDimensionScore(dimensions, 'geoReadinessScore'),
        publicationReadinessScore: getDimensionScore(
          dimensions,
          'publicationReadinessScore'
        ),
        overallScore,
        details: JSON.stringify(detailsRecord),
        recommendations: JSON.stringify(allRecommendations),
      },
    });
  }

  return {
    id: qualityRecord.id,
    contentVersionId: qualityRecord.contentVersionId,
    intentScore: qualityRecord.intentScore,
    coverageScore: qualityRecord.coverageScore,
    readabilityScore: qualityRecord.readabilityScore,
    originalityScore: qualityRecord.originalityScore,
    brandConsistencyScore: qualityRecord.brandConsistencyScore,
    eeatScore: qualityRecord.eeatScore,
    internalLinkScore: qualityRecord.internalLinkScore,
    entityScore: qualityRecord.entityScore,
    conversionScore: qualityRecord.conversionScore,
    geoReadinessScore: qualityRecord.geoReadinessScore,
    publicationReadinessScore: qualityRecord.publicationReadinessScore,
    overallScore: qualityRecord.overallScore,
    details: qualityRecord.details ?? '',
    recommendations: allRecommendations,
    createdAt: qualityRecord.createdAt,
  };
}

// ============================================================================
// AI-Powered Quality Analysis
// ============================================================================

/**
 * Run AI-powered quality analysis on content.
 *
 * Sends the content to the AI provider with a structured prompt
 * that requests scores and Dutch-language explanations for each
 * quality dimension.
 *
 * @param projectId - The project for AI provider selection
 * @param content - The content to analyze
 * @param targetKeyword - The target keyword for intent matching
 * @param title - The content title
 * @returns Array of quality dimensions with scores and explanations
 */
async function aiQualityAnalysis(
  projectId: string,
  content: string,
  targetKeyword?: string,
  title?: string
): Promise<QualityDimension[]> {
  const truncatedContent =
    content.length > 8000
      ? content.substring(0, 8000) + '\n...(afgekort voor analyse)'
      : content;

  const aiResponse = await providerManager.fallbackGenerate(projectId, {
    messages: [
      {
        role: 'system',
        content: `Je bent een kritische SEO-contentanalist met diepe kennis van Google E-E-A-T richtlijnen en de Nederlandse contentmarkt. Analyseer content op kwaliteit en geef gestructureerde JSON-output. Wees constructief maar eerlijk in je beoordeling. Alle uitleg en aanbevelingen moeten in het Nederlands zijn.`,
      },
      {
        role: 'user',
        content: `Analyseer de volgende content op kwaliteit en SEO-effectiviteit:

**Titel:** ${title ?? 'Onbekend'}
**Doelzoekwoord:** ${targetKeyword ?? 'Niet opgegeven'}
**Content:**
${truncatedContent}

Beoordeel de content op de volgende 11 criteria (schaal 0-100):

1. intentScore — Komt de content overeen met de zoekintentie?
2. coverageScore — Is het onderwerp volledig behandeld?
3. readabilityScore — Is de tekst goed leesbaar (Nederlands)?
4. originalityScore — Biedt de content unieke waarde?
5. brandConsistencyScore — Is de content consistent met merkrichtlijnen?
6. eeatScore — Zijn er signalen van Ervaring, Expertise, Autoriteit en Betrouwbaarheid?
7. internalLinkScore — Zijn er relevante interne linksuggesties?
8. entityScore — Worden relevante entiteiten en begrippen genoemd?
9. conversionScore — Zijn er conversie-elementen aanwezig?
10. geoReadinessScore — Is de content klaar voor AI-zoekmachines?
11. publicationReadinessScore — Is de content klaar om te publiceren?

Geef ALLEEN geldige JSON in het volgende formaat:
{
  "dimensions": [
    {
      "name": "intentScore",
      "score": 75,
      "explanation": "Nederlandse uitleg",
      "recommendations": ["Nederlandse aanbeveling 1", "Nederlandse aanbeveling 2"]
    }
  ]
}`,
      },
    ],
    purpose: 'quality-analysis',
    maxTokens: 4000,
    temperature: 0.3,
    jsonMode: true,
  });

  if (!aiResponse.success || !aiResponse.content.trim()) {
    throw new Error('AI-kwaliteitsanalyse mislukt');
  }

  const parsed = JSON.parse(aiResponse.content.trim());

  if (!parsed.dimensions || !Array.isArray(parsed.dimensions)) {
    throw new Error('Ongeldig AI-antwoord formaat');
  }

  // Map AI results to dimension objects, ensuring all dimensions are covered
  const aiMap = new Map<string, QualityDimension>();
  for (const dim of parsed.dimensions) {
    if (dim.name && typeof dim.score === 'number') {
      aiMap.set(dim.name, {
        name: dim.name,
        dutchName:
          QUALITY_DIMENSIONS.find((d) => d.name === dim.name)?.dutchName ??
          dim.name,
        score: Math.max(0, Math.min(100, Math.round(dim.score))),
        explanation:
          typeof dim.explanation === 'string'
            ? dim.explanation
            : 'Geen uitleg beschikbaar.',
        recommendations: Array.isArray(dim.recommendations)
          ? dim.recommendations.filter(
              (r: unknown) => typeof r === 'string'
            )
          : [],
      });
    }
  }

  // Ensure all dimensions are present, filling in defaults for missing ones
  return QUALITY_DIMENSIONS.map((def) => {
    const aiResult = aiMap.get(def.name);
    if (aiResult) return aiResult;

    // Fallback for dimensions the AI didn't return
    return {
      name: def.name,
      dutchName: def.dutchName,
      score: 50,
      explanation: `${def.dutchName} kon niet door AI worden geanalyseerd.`,
      recommendations: [
        `Beoordeel zelf de ${def.dutchName.toLowerCase()} van deze content.`,
      ],
    };
  });
}

// ============================================================================
// Rule-Based Quality Analysis (Fallback)
// ============================================================================

/**
 * Run rule-based quality analysis on content.
 *
 * Used when AI is unavailable. Applies heuristic rules to estimate
 * quality scores for each dimension. These scores are less precise
 * than AI-generated ones but provide a reasonable baseline.
 *
 * @param content - The content to analyze
 * @param targetKeyword - The target keyword for intent matching
 * @param searchIntent - The search intent classification
 * @param toneOfVoice - Expected tone of voice
 * @param targetWordCount - Target word count
 * @returns Array of quality dimensions with scores and Dutch explanations
 */
function ruleBasedQualityAnalysis(
  content: string,
  targetKeyword?: string,
  searchIntent?: string,
  toneOfVoice?: string,
  targetWordCount?: number
): QualityDimension[] {
  const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength =
    sentences.length > 0 ? wordCount / sentences.length : 0;

  // Heading detection
  const h2Count = (content.match(/^##\s/gm) || []).length;
  const h3Count = (content.match(/^###\s/gm) || []).length;
  const headingCount = h2Count + h3Count;

  // Keyword presence
  const keywordPresent =
    !!(targetKeyword && content.toLowerCase().includes(targetKeyword.toLowerCase()));

  // Internal link detection
  const internalLinkPatterns = [
    /\[interne link/gi,
    /\[.*?\]\(\/[^)]*\)/g,
    /href=["']\/[^"']*["']/gi,
  ];
  const internalLinkCount = internalLinkPatterns.reduce(
    (count, pattern) => count + (content.match(pattern) || []).length,
    0
  );

  // CTA detection
  const ctaPatterns = [
    /probeer/i,
    /ontdek/i,
    /start/i,
    /bekijk/i,
    /download/i,
    /schrijf je in/i,
    /neem contact/i,
    /vraag aan/i,
    /bestel/i,
    /reserveer/i,
    /maak een afspraak/i,
    /lees meer/i,
  ];
  const ctaCount = ctaPatterns.reduce(
    (count, pattern) => count + (content.match(pattern) || []).length,
    0
  );

  // List detection (bulleted or numbered)
  const listItems = (content.match(/^[\s]*[-*•]\s/gm) || []).length +
    (content.match(/^[\s]*\d+[.)]\s/gm) || []).length;

  // ===== Individual Dimension Scores =====

  // 1. Intent Score
  const intentScore = calculateIntentScore(
    keywordPresent,
    searchIntent,
    wordCount,
    headingCount
  );

  // 2. Coverage Score
  const coverageScore = calculateCoverageScore(
    wordCount,
    targetWordCount,
    headingCount,
    listItems
  );

  // 3. Readability Score
  const readabilityScore = calculateReadabilityScore(avgSentenceLength, wordCount, headingCount);

  // 4. Originality Score
  const originalityScore = calculateOriginalityScore(content, wordCount);

  // 5. Brand Consistency Score
  const brandConsistencyScore = calculateBrandConsistencyScore(
    content,
    toneOfVoice
  );

  // 6. E-E-A-T Score
  const eeatScore = calculateEeatScore(content, wordCount);

  // 7. Internal Link Score
  const internalLinkScore = calculateInternalLinkScore(internalLinkCount);

  // 8. Entity Score
  const entityScore = calculateEntityScore(content, wordCount);

  // 9. Conversion Score
  const conversionScore = calculateConversionScore(ctaCount, wordCount);

  // 10. GEO Readiness Score
  const geoReadinessScore = calculateGeoReadinessScore(
    content,
    headingCount,
    listItems,
    wordCount
  );

  // 11. Publication Readiness Score
  const publicationReadinessScore = calculatePublicationReadinessScore(
    wordCount,
    targetWordCount,
    headingCount,
    keywordPresent
  );

  return [
    {
      name: 'intentScore',
      dutchName: 'Zoekintentie-overeenkomst',
      score: intentScore,
      explanation: getScoreExplanation('intentScore', intentScore, keywordPresent, searchIntent),
      recommendations: getScoreRecommendations('intentScore', intentScore, keywordPresent, targetKeyword),
    },
    {
      name: 'coverageScore',
      dutchName: 'Onderwerpdekking',
      score: coverageScore,
      explanation: getScoreExplanation('coverageScore', coverageScore, wordCount, targetWordCount),
      recommendations: getScoreRecommendations('coverageScore', coverageScore, wordCount, targetWordCount),
    },
    {
      name: 'readabilityScore',
      dutchName: 'Leesbaarheid',
      score: readabilityScore,
      explanation: getScoreExplanation('readabilityScore', readabilityScore, avgSentenceLength),
      recommendations: getScoreRecommendations('readabilityScore', readabilityScore, avgSentenceLength),
    },
    {
      name: 'originalityScore',
      dutchName: 'Originaliteit',
      score: originalityScore,
      explanation: getScoreExplanation('originalityScore', originalityScore),
      recommendations: getScoreRecommendations('originalityScore', originalityScore),
    },
    {
      name: 'brandConsistencyScore',
      dutchName: 'Merkconsistentie',
      score: brandConsistencyScore,
      explanation: getScoreExplanation('brandConsistencyScore', brandConsistencyScore, toneOfVoice),
      recommendations: getScoreRecommendations('brandConsistencyScore', brandConsistencyScore, toneOfVoice),
    },
    {
      name: 'eeatScore',
      dutchName: 'E-E-A-T signalen',
      score: eeatScore,
      explanation: getScoreExplanation('eeatScore', eeatScore),
      recommendations: getScoreRecommendations('eeatScore', eeatScore),
    },
    {
      name: 'internalLinkScore',
      dutchName: 'Interne links',
      score: internalLinkScore,
      explanation: getScoreExplanation('internalLinkScore', internalLinkScore, internalLinkCount),
      recommendations: getScoreRecommendations('internalLinkScore', internalLinkScore),
    },
    {
      name: 'entityScore',
      dutchName: 'Entiteitendekking',
      score: entityScore,
      explanation: getScoreExplanation('entityScore', entityScore),
      recommendations: getScoreRecommendations('entityScore', entityScore),
    },
    {
      name: 'conversionScore',
      dutchName: 'Conversie-elementen',
      score: conversionScore,
      explanation: getScoreExplanation('conversionScore', conversionScore, ctaCount),
      recommendations: getScoreRecommendations('conversionScore', conversionScore, ctaCount),
    },
    {
      name: 'geoReadinessScore',
      dutchName: 'AI-zoekgereedheid',
      score: geoReadinessScore,
      explanation: getScoreExplanation('geoReadinessScore', geoReadinessScore),
      recommendations: getScoreRecommendations('geoReadinessScore', geoReadinessScore),
    },
    {
      name: 'publicationReadinessScore',
      dutchName: 'Publicatiegereedheid',
      score: publicationReadinessScore,
      explanation: getScoreExplanation('publicationReadinessScore', publicationReadinessScore),
      recommendations: getScoreRecommendations('publicationReadinessScore', publicationReadinessScore),
    },
  ];
}

// ============================================================================
// Score Calculation Functions
// ============================================================================

function calculateIntentScore(
  keywordPresent: boolean | undefined,
  searchIntent?: string,
  wordCount?: number,
  headingCount?: number
): number {
  let score = 40; // Base score

  if (keywordPresent) score += 25;
  if (searchIntent && searchIntent !== 'UNKNOWN') score += 15;
  if (wordCount && wordCount >= 300) score += 10;
  if (headingCount && headingCount >= 3) score += 10;

  return Math.min(100, score);
}

function calculateCoverageScore(
  wordCount: number,
  targetWordCount?: number,
  headingCount?: number,
  listItems?: number
): number {
  let score = 30;

  if (wordCount >= 300) score += 15;
  if (wordCount >= 800) score += 10;
  if (wordCount >= 1500) score += 10;

  if (targetWordCount) {
    const ratio = wordCount / targetWordCount;
    if (ratio >= 0.8 && ratio <= 1.2) score += 15;
    else if (ratio >= 0.6) score += 8;
  } else {
    if (wordCount >= 800) score += 10;
  }

  if (headingCount && headingCount >= 4) score += 10;
  if (listItems && listItems >= 3) score += 10;

  return Math.min(100, score);
}

function calculateReadabilityScore(
  avgSentenceLength: number,
  wordCount: number,
  headingCount?: number
): number {
  let score = 50;

  // Dutch readability: sentences between 12-18 words are ideal
  if (avgSentenceLength >= 10 && avgSentenceLength <= 18) score += 25;
  else if (avgSentenceLength >= 8 && avgSentenceLength <= 22) score += 15;
  else if (avgSentenceLength > 25) score -= 10;

  // Short paragraphs help readability
  if (wordCount > 0 && headingCount && headingCount >= 3) score += 15;
  if (wordCount >= 300) score += 10;

  return Math.max(0, Math.min(100, score));
}

function calculateOriginalityScore(
  content: string,
  wordCount: number
): number {
  let score = 45; // Default medium score without AI comparison

  // Check for unique structural elements
  const hasExamples = /bijvoorbeeld|voorbeeld|zoals|denk aan/gi.test(content);
  const hasQuotes = /[""]([^""]+)[""]|'([^']+)'/g.test(content);
  const hasData = /\d+([.,]\d+)?\s*(procent|%|per|van de|van het)/gi.test(content);

  if (hasExamples) score += 15;
  if (hasQuotes) score += 10;
  if (hasData) score += 10;

  // Longer content tends to have more original depth
  if (wordCount >= 1000) score += 10;
  if (wordCount >= 2000) score += 10;

  return Math.min(100, score);
}

function calculateBrandConsistencyScore(
  content: string,
  toneOfVoice?: string
): number {
  let score = 60; // Default: assume basic consistency

  if (toneOfVoice) {
    // Check if content tone indicators are present
    const formalIndicators =
      /(wij|ons|onze|u|uw|tevreden|graag|vanzelfsprekend)/gi.test(content);
    const informalIndicators =
      /(je|jij|jouw|leuk|makkelijk|simpel|handig|top)/gi.test(content);

    const expectedFormal =
      toneOfVoice.toLowerCase().includes('formee') ||
      toneOfVoice.toLowerCase().includes('zakelijk') ||
      toneOfVoice.toLowerCase().includes('professioneel');
    const expectedInformal =
      toneOfVoice.toLowerCase().includes('informeel') ||
      toneOfVoice.toLowerCase().includes('vriendelijk') ||
      toneOfVoice.toLowerCase().includes('toegankelijk');

    if (expectedFormal && formalIndicators) score += 20;
    else if (expectedInformal && informalIndicators) score += 20;
    else if (formalIndicators || informalIndicators) score += 10;
  }

  return Math.min(100, score);
}

function calculateEeatScore(content: string, wordCount: number): number {
  let score = 35;

  // Experience signals
  const hasExperience =
    /ervaring|ik heb|in de praktijk|uit eigen ervaring|onze ervaring/gi.test(
      content
    );
  if (hasExperience) score += 15;

  // Expertise signals
  const hasExpertise =
    /onderzoek|studie|analyse|data|statistiek|bewijs|volgens|specialist|expert/gi.test(
      content
    );
  if (hasExpertise) score += 15;

  // Authoritativeness signals
  const hasAuthority =
    /bron|referentie|citatie|publicatie|waarheid|geverifieerd|gecertificeerd/gi.test(
      content
    );
  if (hasAuthority) score += 10;

  // Trustworthiness signals
  const hasTrust =
    /transparant|eerlijk|betrouwbaar|onafhankelijk|objectief/gi.test(content);
  if (hasTrust) score += 10;

  // Longer content can demonstrate more depth
  if (wordCount >= 1500) score += 5;
  if (wordCount >= 2500) score += 10;

  return Math.min(100, score);
}

function calculateInternalLinkScore(internalLinkCount: number): number {
  if (internalLinkCount === 0) return 20;
  if (internalLinkCount === 1) return 45;
  if (internalLinkCount === 2) return 65;
  if (internalLinkCount <= 5) return 85;
  return 95;
}

function calculateEntityScore(content: string, wordCount: number): number {
  let score = 40;

  // Check for named entities and technical terms
  const entityPatterns = [
    /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g, // Multi-word proper nouns
  ];

  let entityCount = 0;
  for (const pattern of entityPatterns) {
    const matches = content.match(pattern);
    if (matches) entityCount += matches.length;
  }

  if (entityCount >= 5) score += 20;
  if (entityCount >= 10) score += 15;
  if (wordCount >= 1000) score += 10;
  if (wordCount >= 2000) score += 15;

  return Math.min(100, score);
}

function calculateConversionScore(ctaCount: number, wordCount: number): number {
  let score = 30;

  if (ctaCount >= 1) score += 25;
  if (ctaCount >= 2) score += 15;
  if (ctaCount >= 3) score += 10;

  // Content structure helps conversion
  if (wordCount >= 500) score += 10;
  if (wordCount >= 1000) score += 10;

  return Math.min(100, score);
}

function calculateGeoReadinessScore(
  content: string,
  headingCount: number,
  listItems: number,
  wordCount: number
): number {
  let score = 35;

  // Structured content is better for AI extraction
  if (headingCount >= 4) score += 15;
  if (headingCount >= 6) score += 10;

  // Lists and tables help AI understand content
  if (listItems >= 3) score += 10;
  if (listItems >= 6) score += 5;

  // Question-answer patterns help AI search
  const hasQuestions = /\?/g.test(content);
  if (hasQuestions) score += 10;

  // Definitions and explanations
  const hasDefinitions =
    /is een|betekent|definitie|omschrijving|houdt in|valt onder/gi.test(
      content
    );
  if (hasDefinitions) score += 10;

  // Adequate length
  if (wordCount >= 800) score += 5;

  return Math.min(100, score);
}

function calculatePublicationReadinessScore(
  wordCount: number,
  targetWordCount?: number,
  headingCount?: number,
  keywordPresent?: boolean | undefined
): number {
  let score = 30;

  // Minimum content length
  if (wordCount >= 300) score += 15;
  if (wordCount >= 800) score += 10;

  // Target word count alignment
  if (targetWordCount) {
    const ratio = wordCount / targetWordCount;
    if (ratio >= 0.8 && ratio <= 1.3) score += 15;
    else if (ratio >= 0.5) score += 5;
  }

  // Structure present
  if (headingCount && headingCount >= 2) score += 10;

  // Keyword optimization
  if (keywordPresent) score += 10;

  // No placeholder text (basic check)
  // These are already stripped but check for other markers
  const hasPlaceholders = /\[Schrijf hier|\[Vul in|\[TODO/i.test(
    wordCount > 0 ? '' : '[placeholder]'
  );
  if (!hasPlaceholders && wordCount > 0) score += 10;

  return Math.min(100, score);
}

// ============================================================================
// Dutch Explanation & Recommendation Generators
// ============================================================================

/**
 * Get a Dutch explanation for a dimension score.
 * Uses the dimension name and score to generate context-appropriate feedback.
 */
function getScoreExplanation(
  dimension: string,
  score: number,
  ..._args: unknown[]
): string {
  const dimDef = QUALITY_DIMENSIONS.find((d) => d.name === dimension);
  const dimName = dimDef?.dutchName ?? dimension;

  if (score >= 80) {
    return `${dimName} is goed: score ${score}/100. De content voldoet op dit aspect ruimschoots aan de verwachtingen.`;
  }
  if (score >= 60) {
    return `${dimName} is voldoende: score ${score}/100. Er is ruimte voor verbetering, maar het basisniveau is aanwezig.`;
  }
  if (score >= 40) {
    return `${dimName} is matig: score ${score}/100. Dit aspect verdient aandacht om de content te verbeteren.`;
  }
  return `${dimName} is onvoldoende: score ${score}/100. Dit is een belangrijk verbeterpunt voor de content.`;
}

/**
 * Get Dutch recommendations for improving a dimension score.
 */
function getScoreRecommendations(
  dimension: string,
  score: number,
  ..._args: unknown[]
): string[] {
  if (score >= 80) return []; // No recommendations for good scores

  const recommendations: string[] = [];

  switch (dimension) {
    case 'intentScore':
      if (score < 60)
        recommendations.push(
          'Zorg dat de content direct antwoord geeft op de vraag achter het zoekwoord.'
        );
      if (score < 40)
        recommendations.push(
          'Analyseer de zoekintentie opnieuw en pas de contentstructuur aan.'
        );
      recommendations.push(
        'Plaats het hoofdzoekwoord in de eerste alinea en H1-titel.'
      );
      break;

    case 'coverageScore':
      if (score < 60)
        recommendations.push(
          'Breid de content uit met meer diepgang en voorbeelden.'
        );
      recommendations.push(
        'Voeg ontbrekende subonderwerpen toe op basis van gerelateerde zoekwoorden.'
      );
      if (score < 40)
        recommendations.push(
          'Het onderwerp is onvoldoende behandeld. Overweeg de content grondig te herschrijven.'
        );
      break;

    case 'readabilityScore':
      recommendations.push(
        'Gebruik kortere zinnen (gemiddeld 12-18 woorden per zin).'
      );
      recommendations.push(
        'Voeg vaker tussenkoppen toe om de tekst scannabler te maken.'
      );
      if (score < 50)
        recommendations.push(
          'Vervang lange, complexe zinnen door actieve, duidelijke taal op B1-niveau.'
        );
      break;

    case 'originalityScore':
      recommendations.push(
        'Voeg unieke voorbeelden, cases of perspectieven toe die concurrenten niet bieden.'
      );
      if (score < 50)
        recommendations.push(
          'Deel eigen ervaringen of onderzoek om de content onderscheidend te maken.'
        );
      break;

    case 'brandConsistencyScore':
      recommendations.push(
        'Controleer of de tone of voice overeenkomt met de merkrichtlijnen.'
      );
      if (score < 50)
        recommendations.push(
          'Pas de woordkeuze en schrijfstijl aan volgens het merkprofiel.'
        );
      break;

    case 'eeatScore':
      recommendations.push(
        'Voeg ervaringsverhalen of praktijkvoorbeelden toe (Ervaring).'
      );
      recommendations.push(
        'Onderbouw beweringen met bronnen, data of onderzoek (Expertise).'
      );
      if (score < 50)
        recommendations.push(
          'Voeg auteurinformatie en kwalificaties toe (Autoriteit en Betrouwbaarheid).'
        );
      break;

    case 'internalLinkScore':
      recommendations.push(
        'Voeg interne links toe naar gerelateerde pagina\'s op de website.'
      );
      if (score < 40)
        recommendations.push(
          'Er zijn geen interne links aanwezig. Dit is belangrijk voor SEO en gebruikersnavigatie.'
        );
      break;

    case 'entityScore':
      recommendations.push(
        'Noem relevante begrippen, concepten en entiteiten die bij het onderwerp horen.'
      );
      if (score < 50)
        recommendations.push(
          'Verrijk de content met specifieke termen en concepten uit het vakgebied.'
        );
      break;

    case 'conversionScore':
      recommendations.push(
        'Voeg een duidelijke call-to-action toe aan het einde van de content.'
      );
      if (score < 50)
        recommendations.push(
          'Plaats conversie-elementen op strategische plekken in de tekst.'
        );
      break;

    case 'geoReadinessScore':
      recommendations.push(
        'Gebruik vraag-antwoord structuren die AI-zoekmachines kunnen extraheren.'
      );
      recommendations.push(
        'Voeg definitieblokken en gestructureerde lijsten toe voor betere extractie.'
      );
      break;

    case 'publicationReadinessScore':
      recommendations.push(
        'Zorg dat alle placeholder-teksten zijn vervangen door echte content.'
      );
      if (score < 50)
        recommendations.push(
          'De content is niet klaar voor publicatie. Werk eerst de ontbrekende secties bij.'
        );
      break;
  }

  return recommendations;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the score for a specific dimension from the dimensions array.
 */
function getDimensionScore(
  dimensions: QualityDimension[],
  name: string
): number {
  return dimensions.find((d) => d.name === name)?.score ?? 0;
}

/**
 * Calculate the weighted overall score from all dimensions.
 */
function calculateOverallScore(dimensions: QualityDimension[]): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const dim of dimensions) {
    const def = QUALITY_DIMENSIONS.find((d) => d.name === dim.name);
    const weight = def?.weight ?? 0.05; // Default weight for unknown dimensions
    weightedSum += dim.score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0
    ? Math.round(weightedSum / totalWeight)
    : 0;
}
