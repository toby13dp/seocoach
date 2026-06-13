// ============================================================================
// Rule: Canonical Errors — Missing / Conflicting canonical
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

export const missingCanonicalRule: TechnicalRule = {
  id: 'canonical-missing',
  name: 'Ontbrekende canonieke URL',
  description: 'De pagina heeft geen canonieke URL ingesteld',
  severity: 'WARNING',
  priority: 'MEDIUM',
  effort: 'MINIMAL',
  category: 'canonical',
};

export const conflictingCanonicalRule: TechnicalRule = {
  id: 'canonical-conflicting',
  name: 'Strijdige canonieke URL',
  description: 'De canonieke URL verwijst naar een andere pagina',
  severity: 'WARNING',
  priority: 'HIGH',
  effort: 'LOW',
  category: 'canonical',
};

export function checkMissingCanonical(page: PageAnalysis): TechnicalIssueResult | null {
  // Only flag HTML pages that are indexable
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.indexability === 'NON_INDEXABLE') return null;
  if (page.canonicalUrl !== null && page.canonicalUrl !== '') return null;

  return {
    ruleId: missingCanonicalRule.id,
    ruleName: missingCanonicalRule.name,
    dutchExplanation: 'Deze pagina heeft geen canonieke URL ingesteld. Zoekmachines weten niet welke versie van de pagina de hoofdversie is. Voeg een canonieke link toe.',
    technicalDetails: `No canonical URL found for ${page.url}`,
    evidence: [
      { field: 'canonicalUrl', value: null, expected: 'Een geldige URL' },
    ],
    severity: 'WARNING',
    priority: 'MEDIUM',
    impact: 'Zonder canonieke URL kunnen zoekmachines dubbele versies van je pagina indexeren, wat de waarde van je pagina verlaagt.',
    effort: 'MINIMAL',
    affectedUrls: [page.url],
    recommendedAction: 'Voeg een <link rel="canonical"> tag toe aan de <head> van de pagina die verwijst naar de hoofdversie van de pagina.',
    autoFixAvailable: true,
    confidence: 0.9,
  };
}

export function checkConflictingCanonical(page: PageAnalysis): TechnicalIssueResult | null {
  if (!page.canonicalUrl) return null;
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;

  // Normalize URLs for comparison (remove trailing slashes, fragments)
  const normalizeUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
    } catch {
      return url.replace(/\/+$/, '');
    }
  };

  const normalizedCanonical = normalizeUrl(page.canonicalUrl);
  const normalizedPage = normalizeUrl(page.url);

  // If canonical points to a different URL, it's conflicting
  if (normalizedCanonical !== normalizedPage) {
    return {
      ruleId: conflictingCanonicalRule.id,
      ruleName: conflictingCanonicalRule.name,
      dutchExplanation: 'De canonieke URL van deze pagina verwijst naar een andere pagina. Zoekmachines kunnen de verkeerde pagina in de resultaten tonen.',
      technicalDetails: `Page URL: ${page.url}, Canonical: ${page.canonicalUrl}`,
      evidence: [
        { field: 'canonicalUrl', value: page.canonicalUrl, expected: page.url },
      ],
      severity: 'WARNING',
      priority: 'HIGH',
      impact: 'Zoekmachines kunnen de verkeerde pagina in hun resultaten tonen, waardoor bezoekers niet op de juiste pagina uitkomen.',
      effort: 'LOW',
      affectedUrls: [page.url],
      recommendedAction: 'Controleer of de canonieke URL bewust naar een andere pagina wijst. Als dit niet de bedoeling is, pas de canonieke URL dan aan zodat deze naar de huidige pagina verwijst.',
      autoFixAvailable: true,
      confidence: 0.7,
    };
  }

  return null;
}

export const canonicalErrorRules = [
  { definition: missingCanonicalRule, check: checkMissingCanonical },
  { definition: conflictingCanonicalRule, check: checkConflictingCanonical },
];
