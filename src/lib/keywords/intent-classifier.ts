// ============================================================================
// Keyword Management — Search Intent Classifier
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Classifies search intent for keywords using two approaches:
// 1. Rule-based classification (non-AI) using Dutch language patterns
// 2. AI-assisted classification using the AI provider layer (with fallback)
//
// All explanations and reasoning are in Dutch.
// ============================================================================

import type { IntentClassificationResult, SearchIntent, FunnelStage } from './types';
import { providerManager } from '@/lib/ai';

// ============================================================================
// Dutch Language Patterns for Rule-Based Classification
// ============================================================================

/** Transactional intent patterns — keywords indicating purchase intent */
const TRANSACTIONAL_PATTERNS: RegExp[] = [
  /\bkopen\b/i,
  /\bbestellen\b/i,
  /\bprijs\b/i,
  /\bkosten\b/i,
  /\baanbieding\b/i,
  /\bkorting\b/i,
  /\bbestel\b/i,
  /\bkoop\b/i,
  /\bprijzen\b/i,
  /\bgoedkoop\b/i,
  /\bdeal\b/i,
  /\bdiscount\b/i,
  /\boffer\b/i,
  /\bshop\b/i,
  /\bwebshop\b/i,
  /\bbetalen\b/i,
  /\bafrekenen\b/i,
  /\bwinkel\b/i,
  /\bbestelling\b/i,
  /\blevering\b/i,
  /\bbezorging\b/i,
  /\bverzendkosten\b/i,
  /\bgratis verzending\b/i,
  /\bactie\b/i,
  /\buitverkoop\b/i,
  /\bsale\b/i,
  /\bcoupon\b/i,
  /\bvoordeel\b/i,
];

/** Commercial investigation patterns — keywords indicating comparison/research before purchase */
const COMMERCIAL_INVESTIGATION_PATTERNS: RegExp[] = [
  /\bvergelijk\b/i,
  /\breview\b/i,
  /\btest\b/i,
  /\bbeste\b/i,
  /\btop\b/i,
  /\bversus\b/i,
  /\bvs\b/i,
  /\bvergelijking\b/i,
  /\bvergelijkt\b/i,
  /\btop\b\s*\d/i,
  /\b vergelijkt?\b/i,
  /\balternatief\b/i,
  /\balternatieven\b/i,
  /\bconcurrent\b/i,
  /\bkeuze\b/i,
  /\bkeuzehulp\b/i,
  /\bwaarom\b.*\bbeter\b/i,
  /\bvoordeel\b.*\bnadeel\b/i,
  /\bpros\b.*\bcons\b/i,
  /\bvoors\b.*\btegens\b/i,
  /\bervaring\b/i,
  /\bervaringen\b/i,
  /\bbeoordeling\b/i,
  /\bwaardering\b/i,
  /\baanbevolen\b/i,
  /\baanbeveling\b/i,
];

/** Navigational intent patterns — keywords looking for a specific website or page */
const NAVIGATIONAL_PATTERNS: RegExp[] = [
  /\blogin\b/i,
  /\binloggen\b/i,
  /\bwebsite\b/i,
  /\bhomepage\b/i,
  /\bportaal\b/i,
  /\bportal\b/i,
  /\bdashboard\b/i,
  /\bapp\b/i,
  /\bapplicatie\b/i,
  /\baccount\b/i,
  /\bprofiel\b/i,
  /\bofficial\b/i,
  /\bofficieel\b/i,
];

/** Informational intent patterns — keywords seeking knowledge or answers */
const INFORMATIONAL_PATTERNS: RegExp[] = [
  /\bhoe\b/i,
  /\bwat is\b/i,
  /\bwaarom\b/i,
  /\buitleg\b/i,
  /\btips\b/i,
  /\bgids\b/i,
  /\bwat zijn\b/i,
  /\bwat doet\b/i,
  /\bwat betekent\b/i,
  /\bdefinitie\b/i,
  /\bbetekenis\b/i,
  /\buiteg\b/i,
  /\bvoorbeelden?\b/i,
  /\bhandleiding\b/i,
  /\btutorial\b/i,
  /\bcursus\b/i,
  /\bleer\b/i,
  /\binformatie\b/i,
  /\binfo\b/i,
  /\bweetjes?\b/i,
  /\bwikipedia\b/i,
  /\bhoe werkt\b/i,
  /\bhoe kan\b/i,
  /\bhoe doe\b/i,
  /\bmanier\b/i,
  /\bmethoden?\b/i,
  /\bstrategie\b/i,
  /\bchecklist\b/i,
  /\bveelgestelde vragen\b/i,
  /\bfaq\b/i,
  /\bvraag\b/i,
  /\bantwoord\b/i,
];

/** Local intent patterns — keywords with geographic intent */
const LOCAL_PATTERNS: RegExp[] = [
  /\bin de buurt\b/i,
  /\bdichtbij\b/i,
  /\bbuurt\b/i,
  /\bnabij\b/i,
  /\bomgeving\b/i,
  /\bplaats\b/i,
  /\blocatie\b/i,
  /\badres\b/i,
  /\broute\b/i,
  /\bopeningstijd\b/i,
  /\bgesloten\b/i,
  /\bopen\b.*\bzondag\b/i,
  /\bopen\b.*\bmaandag\b/i,
  /\bopen\b.*\bdinsdag\b/i,
  /\bopen\b.*\bwoensdag\b/i,
  /\bopen\b.*\bdonderdag\b/i,
  /\bopen\b.*\bvrijdag\b/i,
  /\bopen\b.*\bzaterdag\b/i,
  /\btelefoonnummer\b/i,
  /\bcontact\b/i,
  /\bafhalen\b/i,
];

/** Dutch city names and geographic suffixes for local intent detection */
const GEOGRAPHIC_PATTERNS: RegExp[] = [
  /\b(amsterdam|rotterdam|den haag|utrecht|eindhoven|groningen|tilburg|almere|breda|nijmegen|haarlem|arnhem|enschede|amersfoort|apeldoorn|zaanstad|haarlemmermeer|zoetermeer|zwolle|leiden|dordrecht|alkmaar|venlo|deventer|leidschendam|den bosch|sittard|hellevoetsluis|maastricht|heerlen|delft|purmerend|heerhugowaard|schiedam|spijkenisse|hilversum|gouda|hoofddorp|capelle|veenendaal|katwijk|wijnandsrade|waalwijk|oss|valkenswaard|helmond|heesch|barge|best|beuningen|boxmeer|buren|cuijk|druten|maasdriel|nijkerk|overbetuwe|putten|tiel|wageningen|west maas en waal|zaltbommel|zevenaar|nijmegen)\b/i,
  /\b(in|bij|naar|vanuit|rond)\s+(amsterdam|rotterdam|den haag|utrecht|eindhoven|groningen|tilburg|almere|breda|nijmegen)/i,
  /\b(noord-holland|zuid-holland|utrecht|gelderland|noord-brabant|limburg|overijssel|flevoland|friesland|groningen|drenthe|zeeland|flevoland)\b/i,
];

/**
 * Well-known Dutch brand names for branded intent detection.
 * This is a representative list; in production, brands from the
 * project's BrandProfile would also be used.
 */
const DUTCH_BRANDS: string[] = [
  'bol.com',
  'coolblue',
  'ah',
  'albert heijn',
  'jumbo',
  'kruidvat',
  'etos',
  'blokker',
  'action',
  'HEMA',
  'ziggo',
  'kpn',
  't-mobile',
  'vodafone',
  'rabobank',
  'ing',
  'abn amro',
  'sns bank',
  'asr',
  'nuon',
  'eneco',
  'essent',
  'greenchoice',
  'marktplaats',
  'tweakers',
  'nu.nl',
  'ad',
  'telegraaf',
  'volkskrant',
  'nos',
  'rtl',
  'sbs',
  'wehkamp',
  'zalando',
  'amazon',
  'google',
  'facebook',
  'instagram',
  'linkedin',
  'whatsapp',
  'microsoft',
  'apple',
  'samsung',
  'philips',
];

// ============================================================================
// Rule-Based Classification
// ============================================================================

/**
 * Classify the search intent of a keyword using rule-based pattern matching.
 *
 * This is a deterministic, non-AI approach that uses Dutch language patterns
 * to detect the most likely search intent. The classification follows a
 * priority order: Transactional > Commercial Investigation > Local > Branded >
 * Navigational > Informational > Unknown.
 *
 * Each pattern match contributes to a score, and the intent with the highest
 * score wins. Confidence is calculated based on how many patterns matched
 * relative to the total patterns for that category.
 *
 * @param keyword - The keyword phrase to classify
 * @returns Intent classification result with Dutch reasoning
 *
 * @example
 * ```typescript
 * classifyIntent('seo tools kopen');
 * // { intent: 'TRANSACTIONAL', confidence: 0.85, reasoning: 'Bevat koop-gerelateerde termen', funnelStage: 'DECISION' }
 *
 * classifyIntent('wat is seo');
 * // { intent: 'INFORMATIONAL', confidence: 0.9, reasoning: 'Bevat informatieve vraagwoorden', funnelStage: 'AWARENESS' }
 * ```
 */
export function classifyIntent(keyword: string): IntentClassificationResult {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (normalizedKeyword.length === 0) {
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      reasoning: 'Leeg zoekwoord, kan geen intentie classificeren.',
      funnelStage: 'UNKNOWN',
    };
  }

  // Score each intent category
  const scores: Record<SearchIntent, number> = {
    TRANSACTIONAL: 0,
    COMMERCIAL_INVESTIGATION: 0,
    NAVIGATIONAL: 0,
    INFORMATIONAL: 0,
    LOCAL: 0,
    BRANDED: 0,
    UNKNOWN: 0,
  };

  const matchDetails: Record<SearchIntent, string[]> = {
    TRANSACTIONAL: [],
    COMMERCIAL_INVESTIGATION: [],
    NAVIGATIONAL: [],
    INFORMATIONAL: [],
    LOCAL: [],
    BRANDED: [],
    UNKNOWN: [],
  };

  // Check transactional patterns
  for (const pattern of TRANSACTIONAL_PATTERNS) {
    if (pattern.test(normalizedKeyword)) {
      scores.TRANSACTIONAL += 1;
      matchDetails.TRANSACTIONAL.push(pattern.source.replace(/\\b/g, ''));
    }
  }

  // Check commercial investigation patterns
  for (const pattern of COMMERCIAL_INVESTIGATION_PATTERNS) {
    if (pattern.test(normalizedKeyword)) {
      scores.COMMERCIAL_INVESTIGATION += 1;
      matchDetails.COMMERCIAL_INVESTIGATION.push(
        pattern.source.replace(/\\b/g, '')
      );
    }
  }

  // Check navigational patterns
  for (const pattern of NAVIGATIONAL_PATTERNS) {
    if (pattern.test(normalizedKeyword)) {
      scores.NAVIGATIONAL += 1;
      matchDetails.NAVIGATIONAL.push(pattern.source.replace(/\\b/g, ''));
    }
  }

  // Check informational patterns
  for (const pattern of INFORMATIONAL_PATTERNS) {
    if (pattern.test(normalizedKeyword)) {
      scores.INFORMATIONAL += 1;
      matchDetails.INFORMATIONAL.push(pattern.source.replace(/\\b/g, ''));
    }
  }

  // Check local patterns
  for (const pattern of LOCAL_PATTERNS) {
    if (pattern.test(normalizedKeyword)) {
      scores.LOCAL += 1.5; // Extra weight for explicit local terms
      matchDetails.LOCAL.push(pattern.source.replace(/\\b/g, ''));
    }
  }

  // Check geographic patterns (city names, provinces)
  for (const pattern of GEOGRAPHIC_PATTERNS) {
    if (pattern.test(normalizedKeyword)) {
      scores.LOCAL += 1;
      matchDetails.LOCAL.push(pattern.source.replace(/\\b/g, ''));
    }
  }

  // Check branded patterns
  for (const brand of DUTCH_BRANDS) {
    if (normalizedKeyword.includes(brand.toLowerCase())) {
      scores.BRANDED += 2; // Strong signal for branded searches
      matchDetails.BRANDED.push(brand);
    }
  }

  // Find the highest scoring intent
  let bestIntent: SearchIntent = 'UNKNOWN';
  let bestScore = 0;

  const intentOrder: SearchIntent[] = [
    'TRANSACTIONAL',
    'COMMERCIAL_INVESTIGATION',
    'LOCAL',
    'BRANDED',
    'NAVIGATIONAL',
    'INFORMATIONAL',
    'UNKNOWN',
  ];

  for (const intent of intentOrder) {
    if (scores[intent] > bestScore) {
      bestScore = scores[intent];
      bestIntent = intent;
    }
  }

  // If no patterns matched at all, default to informational
  if (bestScore === 0) {
    bestIntent = 'INFORMATIONAL';
    bestScore = 0.5; // Low confidence default
  }

  // Calculate confidence (0-1)
  const maxPossibleScore = 3; // A typical strong match has 2-3 pattern hits
  const confidence = Math.min(1, bestScore / maxPossibleScore);

  // Determine funnel stage based on intent
  const funnelStage = intentToFunnelStage(bestIntent);

  // Generate Dutch reasoning
  const reasoning = generateReasoning(bestIntent, matchDetails[bestIntent], keyword);

  return {
    intent: bestIntent,
    confidence: Math.round(confidence * 100) / 100,
    reasoning,
    funnelStage,
  };
}

/**
 * Map a search intent to the most appropriate funnel stage.
 *
 * @param intent - The classified search intent
 * @returns The corresponding funnel stage
 */
function intentToFunnelStage(intent: SearchIntent): FunnelStage {
  switch (intent) {
    case 'TRANSACTIONAL':
      return 'DECISION';
    case 'COMMERCIAL_INVESTIGATION':
      return 'CONSIDERATION';
    case 'INFORMATIONAL':
      return 'AWARENESS';
    case 'NAVIGATIONAL':
      return 'RETENTION';
    case 'LOCAL':
      return 'CONSIDERATION';
    case 'BRANDED':
      return 'CONSIDERATION';
    case 'UNKNOWN':
    default:
      return 'UNKNOWN';
  }
}

/**
 * Generate a Dutch-language explanation for the intent classification.
 *
 * @param intent - The classified intent
 * @param matchedPatterns - The patterns that matched for this intent
 * @param keyword - The original keyword
 * @returns A Dutch explanation string
 */
function generateReasoning(
  intent: SearchIntent,
  matchedPatterns: string[],
  keyword: string
): string {
  const patternList =
    matchedPatterns.length > 0
      ? ` Gevonden signalen: ${matchedPatterns.join(', ')}.`
      : '';

  switch (intent) {
    case 'TRANSACTIONAL':
      return `Het zoekwoord "${keyword}" wijst op koopintentie.${patternList} De gebruiker is waarschijnlijk klaar om een aankoop te doen.`;
    case 'COMMERCIAL_INVESTIGATION':
      return `Het zoekwoord "${keyword}" wijst op vergelijkend onderzoek.${patternList} De gebruiker overweegt opties voordat een keuze wordt gemaakt.`;
    case 'NAVIGATIONAL':
      return `Het zoekwoord "${keyword}" wijst op navigatie-intentie.${patternList} De gebruiker zoekt een specifieke website of pagina.`;
    case 'INFORMATIONAL':
      return `Het zoekwoord "${keyword}" wijst op informatiezoekgedrag.${patternList} De gebruiker zoekt antwoord op een vraag of wil iets leren.`;
    case 'LOCAL':
      return `Het zoekwoord "${keyword}" wijst op lokale zoekintentie.${patternList} De gebruiker zoekt iets in de buurt of een specifieke locatie.`;
    case 'BRANDED':
      return `Het zoekwoord "${keyword}" wijst op merk-gerelateerde zoekintentie.${patternList} De gebruiker zoekt naar een specifiek merk of bedrijf.`;
    case 'UNKNOWN':
    default:
      return `De zoekintentie voor "${keyword}" kon niet worden bepaald. Geen duidelijke signalen gevonden.`;
  }
}

// ============================================================================
// AI-Assisted Classification
// ============================================================================

/**
 * Classify the search intent of a keyword using AI, with fallback to rule-based.
 *
 * Uses the AI provider layer to classify the keyword with higher accuracy.
 * Falls back to rule-based classification when AI is unavailable or returns
 * invalid results.
 *
 * The AI is prompted with a structured request that asks for intent,
 * confidence, reasoning (in Dutch), and funnel stage in JSON format.
 *
 * @param keyword - The keyword phrase to classify
 * @param projectId - The project ID for AI provider selection
 * @returns Intent classification result with Dutch reasoning
 *
 * @example
 * ```typescript
 * const result = await classifyIntentWithAI('beste seo tools 2024', 'project-123');
 * // Uses AI provider with fallback to rule-based classification
 * ```
 */
export async function classifyIntentWithAI(
  keyword: string,
  projectId: string
): Promise<IntentClassificationResult> {
  try {
    const response = await providerManager.fallbackGenerate(projectId, {
      messages: [
        {
          role: 'system',
          content:
            'Je bent een SEO-analist gespecialiseerd in zoekintentie-classificatie voor de Nederlandse markt. Analyseer zoekwoorden nauwkeurig en geef gestructureerde output in JSON-formaat. Je uitleg is altijd in het Nederlands.',
        },
        {
          role: 'user',
          content: `Classificeer de zoekintentie voor het volgende zoekwoord:

"${keyword}"

Geef het resultaat als geldige JSON met precies deze velden:
{
  "intent": "INFORMATIONAL" | "NAVIGATIONAL" | "TRANSACTIONAL" | "COMMERCIAL_INVESTIGATION" | "LOCAL" | "BRANDED" | "UNKNOWN",
  "confidence": 0.0-1.0,
  "reasoning": "Uitleg in het Nederlands waarom deze classificatie",
  "funnelStage": "AWARENESS" | "CONSIDERATION" | "DECISION" | "RETENTION" | "UNKNOWN"
}

Geef ALLEEN de JSON, geen andere tekst.`,
        },
      ],
      purpose: 'intent-classification',
      jsonMode: true,
      temperature: 0.2, // Low temperature for consistent classification
      maxTokens: 500,
    });

    if (!response.success || !response.content) {
      // Fallback to rule-based
      return classifyIntent(keyword);
    }

    // Parse the AI response
    const parsed = parseAIResponse(response.content);

    if (!parsed) {
      // Fallback to rule-based
      return classifyIntent(keyword);
    }

    // Validate the parsed result
    if (!isValidIntent(parsed.intent) || !isValidFunnelStage(parsed.funnelStage)) {
      return classifyIntent(keyword);
    }

    return {
      intent: parsed.intent,
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
      reasoning: parsed.reasoning || classifyIntent(keyword).reasoning,
      funnelStage: parsed.funnelStage,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(
      `[IntentClassifier] AI classification failed, falling back to rule-based: ${msg}`
    );
    return classifyIntent(keyword);
  }
}

/**
 * Parse the AI response content as a JSON object.
 *
 * Handles cases where the AI wraps JSON in markdown code blocks
 * or includes extra text around the JSON.
 *
 * @param content - Raw AI response content
 * @returns Parsed object or null if parsing fails
 */
function parseAIResponse(
  content: string
): {
  intent: string;
  confidence: number;
  reasoning: string;
  funnelStage: string;
} | null {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    const parsed = JSON.parse(jsonStr);

    return {
      intent: String(parsed.intent ?? ''),
      confidence: Number(parsed.confidence ?? 0),
      reasoning: String(parsed.reasoning ?? ''),
      funnelStage: String(parsed.funnelStage ?? ''),
    };
  } catch {
    // Try to find any JSON object in the content
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0]);
        return {
          intent: String(parsed.intent ?? ''),
          confidence: Number(parsed.confidence ?? 0),
          reasoning: String(parsed.reasoning ?? ''),
          funnelStage: String(parsed.funnelStage ?? ''),
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Validate that a string is a valid SearchIntent enum value.
 *
 * @param intent - The intent string to validate
 * @returns true if valid
 */
function isValidIntent(intent: string): intent is SearchIntent {
  return [
    'INFORMATIONAL',
    'NAVIGATIONAL',
    'TRANSACTIONAL',
    'COMMERCIAL_INVESTIGATION',
    'LOCAL',
    'BRANDED',
    'UNKNOWN',
  ].includes(intent);
}

/**
 * Validate that a string is a valid FunnelStage enum value.
 *
 * @param stage - The funnel stage string to validate
 * @returns true if valid
 */
function isValidFunnelStage(stage: string): stage is FunnelStage {
  return [
    'AWARENESS',
    'CONSIDERATION',
    'DECISION',
    'RETENTION',
    'UNKNOWN',
  ].includes(stage);
}

// ============================================================================
// Batch Classification
// ============================================================================

/**
 * Classify the search intent for multiple keywords using the rule-based approach.
 *
 * @param keywords - Array of keyword strings to classify
 * @returns Array of classification results in the same order
 *
 * @example
 * ```typescript
 * const results = classifyIntentBatch(['seo tools kopen', 'wat is seo', 'coolblue']);
 * // Returns an array of IntentClassificationResult objects
 * ```
 */
export function classifyIntentBatch(
  keywords: string[]
): IntentClassificationResult[] {
  return keywords.map(classifyIntent);
}

/**
 * Classify the search intent for multiple keywords using AI with fallback.
 *
 * Processes keywords in batches to avoid overwhelming the AI provider.
 * Falls back to rule-based classification for any keywords where AI fails.
 *
 * @param keywords - Array of keyword strings to classify
 * @param projectId - The project ID for AI provider selection
 * @returns Array of classification results in the same order
 */
export async function classifyIntentBatchWithAI(
  keywords: string[],
  projectId: string
): Promise<IntentClassificationResult[]> {
  const results: IntentClassificationResult[] = [];

  // Process in batches of 10 to avoid overwhelming the AI provider
  const BATCH_SIZE = 10;

  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    const batch = keywords.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map((kw) =>
      classifyIntentWithAI(kw, projectId)
    );
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}
