// ============================================================================
// Anchor Variation Generator — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Generates natural Dutch anchor text variations for internal links.
// Produces 3-5 variations covering exact match, partial match, descriptive,
// action-oriented, and natural language styles.
// ============================================================================

import type { AnchorVariation } from './types';

/**
 * Maximum allowed anchor text length in characters.
 * Anchors longer than this are truncated with an ellipsis approach.
 */
const MAX_ANCHOR_LENGTH = 60;

/**
 * Minimum allowed anchor text length in characters.
 * Anchors shorter than this are considered too brief to be meaningful.
 */
const MIN_ANCHOR_LENGTH = 3;

/**
 * Generate 3-5 natural Dutch anchor text variations for an internal link.
 *
 * Produces variations across five categories:
 * 1. Exact match — the target keyword itself
 * 2. Partial match — keyword + context words
 * 3. Descriptive — what the page is about
 * 4. Action-oriented — "lees meer over [topic]", "ontdek [topic]"
 * 5. Natural language — full sentence fragment
 *
 * All generated anchors respect the length constraints:
 * - No shorter than 3 characters
 * - No longer than 60 characters
 *
 * @param targetTitle - The title of the target page
 * @param targetKeyword - The primary keyword the target page ranks for
 * @param context - Surrounding text where the link would appear (used for natural language generation)
 * @returns Array of 3-5 anchor text variations with confidence scores
 */
export function generateAnchorVariations(
  targetTitle: string,
  targetKeyword: string,
  context: string
): AnchorVariation[] {
  const variations: AnchorVariation[] = [];
  const cleanTitle = targetTitle.trim();
  const cleanKeyword = targetKeyword.trim().toLowerCase();
  const cleanContext = context.trim();

  // 1. Exact match — the target keyword itself (highest confidence for relevance)
  if (cleanKeyword.length >= MIN_ANCHOR_LENGTH) {
    const exactAnchor = enforceLength(cleanKeyword);
    variations.push({
      anchorText: exactAnchor,
      type: 'exact_match',
      typeLabel: 'Exacte overeenkomst',
      confidence: 0.85,
    });
  }

  // 2. Partial match — keyword combined with context words
  const partialAnchors = generatePartialMatchAnchors(cleanKeyword, cleanTitle);
  for (const anchor of partialAnchors) {
    if (anchor.length >= MIN_ANCHOR_LENGTH && anchor.length <= MAX_ANCHOR_LENGTH) {
      variations.push({
        anchorText: anchor,
        type: 'partial_match',
        typeLabel: 'Gedeeltelijke overeenkomst',
        confidence: 0.75,
      });
    }
  }

  // 3. Descriptive — what the page is about
  const descriptiveAnchor = generateDescriptiveAnchor(cleanTitle, cleanKeyword);
  if (descriptiveAnchor.length >= MIN_ANCHOR_LENGTH) {
    variations.push({
      anchorText: enforceLength(descriptiveAnchor),
      type: 'descriptive',
      typeLabel: 'Beschrijvend',
      confidence: 0.70,
    });
  }

  // 4. Action-oriented — "lees meer over [topic]", "ontdek [topic]"
  const actionAnchors = generateActionAnchors(cleanKeyword, cleanTitle);
  for (const anchor of actionAnchors) {
    if (anchor.length >= MIN_ANCHOR_LENGTH && anchor.length <= MAX_ANCHOR_LENGTH) {
      variations.push({
        anchorText: anchor,
        type: 'action_oriented',
        typeLabel: 'Actiegericht',
        confidence: 0.65,
      });
    }
  }

  // 5. Natural language — full sentence fragment using context
  const naturalAnchor = generateNaturalLanguageAnchor(cleanKeyword, cleanTitle, cleanContext);
  if (naturalAnchor.length >= MIN_ANCHOR_LENGTH) {
    variations.push({
      anchorText: enforceLength(naturalAnchor),
      type: 'natural_language',
      typeLabel: 'Natuurlijk taalgebruik',
      confidence: 0.60,
    });
  }

  // Deduplicate by anchor text (case-insensitive), keeping the highest confidence
  const seen = new Map<string, AnchorVariation>();
  for (const v of variations) {
    const key = v.anchorText.toLowerCase();
    const existing = seen.get(key);
    if (!existing || existing.confidence < v.confidence) {
      seen.set(key, v);
    }
  }

  // Sort by confidence descending and return 3-5 results
  const result = Array.from(seen.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  // Ensure at least 3 variations by generating fallbacks if needed
  if (result.length < 3) {
    const fallbacks = generateFallbackAnchors(cleanKeyword, cleanTitle, result);
    for (const fb of fallbacks) {
      if (result.length >= 5) break;
      const key = fb.anchorText.toLowerCase();
      if (!result.some((r) => r.anchorText.toLowerCase() === key)) {
        result.push(fb);
      }
    }
  }

  return result.slice(0, 5);
}

/**
 * Generate partial match anchor variations.
 * Combines the keyword with contextual words from the title.
 */
function generatePartialMatchAnchors(keyword: string, title: string): string[] {
  const anchors: string[] = [];

  // Keyword + significant words from title
  const titleWords = title
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => w.toLowerCase() !== keyword);

  if (titleWords.length > 0) {
    // "keyword + eerste relevante woord"
    const firstRelevant = titleWords.slice(0, 2).join(' ');
    anchors.push(`${keyword} ${firstRelevant}`.toLowerCase());

    // "relevante woorden + keyword"
    if (titleWords.length >= 2) {
      const lastRelevant = titleWords.slice(-2).join(' ');
      anchors.push(`${lastRelevant} ${keyword}`.toLowerCase());
    }
  }

  // "meer over keyword"
  anchors.push(`meer over ${keyword}`);

  return anchors;
}

/**
 * Generate a descriptive anchor based on the page title.
 * Strips common Dutch stop words and creates a concise description.
 */
function generateDescriptiveAnchor(title: string, keyword: string): string {
  // Remove common Dutch stop words from title for a cleaner description
  const dutchStopWords = new Set([
    'de', 'het', 'een', 'van', 'en', 'in', 'is', 'dat', 'op', 'te',
    'voor', 'met', 'zijn', 'aan', 'ook', 'als', 'door', 'maar', 'nog',
    'dit', 'die', 'bij', 'tot', 'uit', 'over', 'naar', 'hoe', 'waar',
    'onze', 'uw', 'je', 'we', 'onze', 'hun', 'kan', 'wel', 'al',
  ]);

  const meaningfulWords = title
    .split(/\s+/)
    .filter((w) => !dutchStopWords.has(w.toLowerCase()))
    .filter((w) => w.length > 1);

  if (meaningfulWords.length === 0) {
    return title;
  }

  // If keyword already in title, create a descriptive phrase
  if (title.toLowerCase().includes(keyword)) {
    return meaningfulWords.join(' ');
  }

  // Otherwise combine keyword with key title words
  const topWords = meaningfulWords.slice(0, 3).join(' ');
  return `${keyword} - ${topWords}`;
}

/**
 * Generate action-oriented Dutch anchor texts.
 * Uses common Dutch CTA-style phrases.
 */
function generateActionAnchors(keyword: string, title: string): string[] {
  const anchors: string[] = [];

  // "lees meer over [topic]"
  anchors.push(`lees meer over ${keyword}`);

  // "ontdek [topic]"
  anchors.push(`ontdek ${keyword}`);

  // "alles over [topic]"
  anchors.push(`alles over ${keyword}`);

  // "meer informatie over [topic]" — only if short enough
  const infoAnchor = `meer informatie over ${keyword}`;
  if (infoAnchor.length <= MAX_ANCHOR_LENGTH) {
    anchors.push(infoAnchor);
  }

  // "bekijk onze [title kort] pagina" — use shortened title
  const shortTitle = title.split(/\s+/).slice(0, 3).join(' ').toLowerCase();
  const bekijkAnchor = `bekijk onze ${shortTitle} pagina`;
  if (bekijkAnchor.length <= MAX_ANCHOR_LENGTH && bekijkAnchor.length >= MIN_ANCHOR_LENGTH) {
    anchors.push(bekijkAnchor);
  }

  return anchors;
}

/**
 * Generate a natural language anchor text using the surrounding context.
 * Attempts to create a sentence fragment that naturally contains the keyword.
 */
function generateNaturalLanguageAnchor(
  keyword: string,
  title: string,
  context: string
): string {
  // If we have context, try to find a natural fragment that includes the keyword or topic
  if (context.length > 10) {
    const sentences = context
      .split(/[.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    // Look for a sentence that already mentions the keyword or a related concept
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(keyword)) {
        // Extract a short fragment around the keyword
        const keywordIndex = sentence.toLowerCase().indexOf(keyword);
        const start = Math.max(0, keywordIndex - 20);
        const end = Math.min(sentence.length, keywordIndex + keyword.length + 20);
        let fragment = sentence.slice(start, end).trim();

        // Clean up fragment boundaries
        if (start > 0) {
          const firstSpace = fragment.indexOf(' ');
          if (firstSpace >= 0) {
            fragment = fragment.slice(firstSpace + 1);
          }
        }
        if (end < sentence.length) {
          const lastSpace = fragment.lastIndexOf(' ');
          if (lastSpace >= 0) {
            fragment = fragment.slice(0, lastSpace);
          }
        }

        if (fragment.length >= MIN_ANCHOR_LENGTH && fragment.length <= MAX_ANCHOR_LENGTH) {
          return fragment;
        }
      }
    }

    // If no keyword match in context, use a sentence fragment with the title topic
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/);
      if (words.length >= 3 && words.length <= 10) {
        const candidate = sentence.toLowerCase();
        if (candidate.length <= MAX_ANCHOR_LENGTH) {
          return candidate;
        }
      }
    }
  }

  // Fallback: create a natural language fragment from the title and keyword
  const shortTitle = title.split(/\s+/).slice(0, 4).join(' ').toLowerCase();
  return `meer weten over ${shortTitle}`;
}

/**
 * Generate fallback anchor variations when not enough unique variations
 * were produced by the main strategies.
 */
function generateFallbackAnchors(
  keyword: string,
  title: string,
  existing: AnchorVariation[]
): AnchorVariation[] {
  const existingTexts = new Set(existing.map((e) => e.anchorText.toLowerCase()));
  const fallbacks: AnchorVariation[] = [];

  const candidates: Array<{ text: string; type: AnchorVariation['type']; typeLabel: string; confidence: number }> = [
    { text: `gedetailleerde gids over ${keyword}`, type: 'descriptive', typeLabel: 'Beschrijvend', confidence: 0.55 },
    { text: `onze ${keyword} gids`, type: 'natural_language', typeLabel: 'Natuurlijk taalgebruik', confidence: 0.50 },
    { text: `vind meer over ${keyword}`, type: 'action_oriented', typeLabel: 'Actiegericht', confidence: 0.50 },
    { text: title.toLowerCase(), type: 'descriptive', typeLabel: 'Beschrijvend', confidence: 0.45 },
    { text: `${keyword} uitleg`, type: 'partial_match', typeLabel: 'Gedeeltelijke overeenkomst', confidence: 0.55 },
    { text: `tips over ${keyword}`, type: 'natural_language', typeLabel: 'Natuurlijk taalgebruik', confidence: 0.50 },
  ];

  for (const c of candidates) {
    const enforced = enforceLength(c.text);
    if (
      enforced.length >= MIN_ANCHOR_LENGTH &&
      enforced.length <= MAX_ANCHOR_LENGTH &&
      !existingTexts.has(enforced.toLowerCase())
    ) {
      fallbacks.push({
        anchorText: enforced,
        type: c.type,
        typeLabel: c.typeLabel,
        confidence: c.confidence,
      });
    }
  }

  return fallbacks;
}

/**
 * Enforce the maximum anchor text length.
 * Truncates at word boundaries when possible.
 */
function enforceLength(text: string): string {
  if (text.length <= MAX_ANCHOR_LENGTH) {
    return text;
  }

  // Try to truncate at a word boundary
  const truncated = text.slice(0, MAX_ANCHOR_LENGTH);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > MIN_ANCHOR_LENGTH) {
    return truncated.slice(0, lastSpace);
  }

  return truncated;
}
