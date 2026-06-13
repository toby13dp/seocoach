// ============================================================================
// Rule: Hreflang Issues — Missing, incorrect, or conflicting hreflang tags
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

export const missingHreflangRule: TechnicalRule = {
  id: 'hreflang-missing',
  name: 'Ontbrekende hreflang-tags',
  description: 'De pagina heeft geen hreflang-tags voor meertalige ondersteuning',
  severity: 'INFO',
  priority: 'LOW',
  effort: 'MEDIUM',
  category: 'technical',
};

export const invalidHreflangRule: TechnicalRule = {
  id: 'hreflang-invalid',
  name: 'Ongeldige hreflang-tags',
  description: 'De hreflang-tags op de pagina bevatten fouten',
  severity: 'WARNING',
  priority: 'MEDIUM',
  effort: 'LOW',
  category: 'technical',
};

export const conflictingHreflangRule: TechnicalRule = {
  id: 'hreflang-conflicting',
  name: 'Strijdige hreflang-tags',
  description: 'De hreflang-tags zijn niet consistent met elkaar',
  severity: 'WARNING',
  priority: 'HIGH',
  effort: 'MEDIUM',
  category: 'technical',
};

// Valid hreflang language codes (common ones — not exhaustive)
const VALID_LANG_CODES = new Set([
  'x-default', 'nl', 'nl-be', 'nl-nl', 'en', 'en-us', 'en-gb', 'en-au', 'en-ca',
  'de', 'de-de', 'de-at', 'de-ch', 'fr', 'fr-fr', 'fr-be', 'fr-ch',
  'es', 'es-es', 'es-mx', 'it', 'it-it', 'pt', 'pt-pt', 'pt-br',
  'da', 'da-dk', 'sv', 'sv-se', 'no', 'nb', 'nn', 'fi', 'fi-fi',
  'pl', 'pl-pl', 'ru', 'ru-ru', 'tr', 'tr-tr', 'ar', 'ja', 'ko', 'zh', 'zh-cn', 'zh-tw',
]);

/**
 * Check for missing hreflang on a page that has a language set.
 * Only relevant for multi-lingual sites.
 */
export function checkMissingHreflang(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null;
  if (page.indexability === 'NON_INDEXABLE') return null;

  // If the page already has hreflang, skip
  if (page.hreflang && Array.isArray(page.hreflang) && page.hreflang.length > 0) return null;

  // If no language is set on the page, we can't determine if hreflang is needed
  // We skip this check unless the page has a language
  if (!page.language) return null;

  return {
    ruleId: missingHreflangRule.id,
    ruleName: missingHreflangRule.name,
    dutchExplanation: 'Deze pagina heeft geen hreflang-tags. Als je website meerdere talen ondersteunt, helpen hreflang-tags zoekmachines om de juiste taalversie te tonen aan bezoekers.',
    technicalDetails: `No hreflang tags on ${page.url} (language: ${page.language})`,
    evidence: [
      { field: 'hreflang', value: null },
      { field: 'language', value: page.language },
    ],
    severity: 'INFO',
    priority: 'LOW',
    impact: 'Zonder hreflang-tags kunnen zoekmachines de verkeerde taalversie tonen aan bezoekers. Dit leidt tot een slechtere gebruikservaring.',
    effort: 'MEDIUM',
    affectedUrls: [page.url],
    recommendedAction: 'Voeg hreflang-tags toe aan je pagina als je website in meerdere talen beschikbaar is. Voeg ook een x-default tag toe voor bezoekers met een andere taal.',
    autoFixAvailable: false,
    confidence: 0.6,
  };
}

/**
 * Check for invalid hreflang tags — invalid language codes, missing self-referencing,
 * or missing return tags.
 */
export function checkInvalidHreflang(page: PageAnalysis): TechnicalIssueResult | null {
  if (!page.hreflang || !Array.isArray(page.hreflang) || page.hreflang.length === 0) return null;

  const errors: string[] = [];

  for (const tag of page.hreflang) {
    // Check for valid language code
    if (tag.hreflang && !VALID_LANG_CODES.has(tag.hreflang.toLowerCase())) {
      errors.push(`Ongeldige taalcode: "${tag.hreflang}"`);
    }

    // Check for missing URL
    if (!tag.href) {
      errors.push(`Hreflang-tag voor "${tag.hreflang}" heeft geen URL`);
    }
  }

  // Check for missing self-referencing hreflang
  const langCodes = page.hreflang.map(t => t.hreflang?.toLowerCase());
  if (page.language && !langCodes.includes(page.language.toLowerCase())) {
    errors.push(`De pagina verwijst niet naar zichzelf in de hreflang-tags (taal: ${page.language})`);
  }

  if (errors.length === 0) return null;

  return {
    ruleId: invalidHreflangRule.id,
    ruleName: invalidHreflangRule.name,
    dutchExplanation: `De hreflang-tags op deze pagina bevatten ${errors.length} fout${errors.length > 1 ? 'en' : ''}. Hierdoor kunnen zoekmachines de juiste taalversie niet goed bepalen.`,
    technicalDetails: `Invalid hreflang on ${page.url}: ${errors.join('; ')}`,
    evidence: errors.map(e => ({
      field: 'hreflangError',
      value: e,
    })),
    severity: 'WARNING',
    priority: 'MEDIUM',
    impact: 'Foutieve hreflang-tags leiden ertoe dat zoekmachines de verkeerde taalversie tonen, of de tags helemaal negeren.',
    effort: 'LOW',
    affectedUrls: [page.url],
    recommendedAction: 'Corrigeer de hreflang-tags. Zorg dat elke tag een geldige taalcode en een werkende URL heeft, en dat de pagina naar zichzelf verwijst.',
    autoFixAvailable: false,
    confidence: 0.9,
  };
}

/**
 * Check for conflicting hreflang — pages that reference each other
 * inconsistently. This is a cross-page check.
 */
export function checkConflictingHreflang(pages: PageAnalysis[]): TechnicalIssueResult[] {
  const results: TechnicalIssueResult[] = [];
  // Build a map of hreflang references: url → { lang → targetUrl }
  const hreflangMap = new Map<string, Map<string, string>>();

  for (const page of pages) {
    if (!page.hreflang || !Array.isArray(page.hreflang)) continue;
    const langMap = new Map<string, string>();
    for (const tag of page.hreflang) {
      if (tag.hreflang && tag.href) {
        langMap.set(tag.hreflang.toLowerCase(), tag.href);
      }
    }
    if (langMap.size > 0) {
      hreflangMap.set(page.url, langMap);
    }
  }

  // Check bidirectional references
  for (const [sourceUrl, langMap] of hreflangMap) {
    for (const [lang, targetUrl] of langMap) {
      if (lang === 'x-default') continue;
      const targetLangs = hreflangMap.get(targetUrl);
      if (!targetLangs) continue;

      // The target page should reference back to the source page
      const sourceLang = [...langMap.entries()].find(([l, u]) => u === sourceUrl)?.[0];
      if (sourceLang && targetLangs.get(sourceLang) !== sourceUrl) {
        results.push({
          ruleId: conflictingHreflangRule.id,
          ruleName: conflictingHreflangRule.name,
          dutchExplanation: 'De hreflang-tags op deze pagina zijn niet consistent met de pagina\'s waarnaar wordt verwezen. Elke pagina moet wederzijds naar de andere taalversies verwijzen.',
          technicalDetails: `Non-bidirectional hreflang: ${sourceUrl} → ${lang} → ${targetUrl} (no return tag)`,
          evidence: [
            { field: 'sourceUrl', value: sourceUrl },
            { field: 'targetUrl', value: targetUrl },
            { field: 'language', value: lang },
          ],
          severity: 'WARNING',
          priority: 'HIGH',
          impact: 'Als hreflang-tags niet wederkerig zijn, negeren zoekmachines ze. Bezoekers krijgen dan mogelijk de verkeerde taalversie te zien.',
          effort: 'MEDIUM',
          affectedUrls: [sourceUrl, targetUrl],
          recommendedAction: 'Zorg dat elke taalversie verwijst naar alle andere taalversies, en dat elke verwijzing terugverwijst. Controleer alle hreflang-tags op consistentie.',
          autoFixAvailable: false,
          confidence: 0.85,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const hreflangIssueRules = [
  { definition: missingHreflangRule, check: checkMissingHreflang },
  { definition: invalidHreflangRule, check: checkInvalidHreflang },
];

export const hreflangCrossPageRules = [
  { definition: conflictingHreflangRule, check: checkConflictingHreflang },
];
