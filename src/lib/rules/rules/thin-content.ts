// ============================================================================
// Rule: Thin Content — Pages with very few words
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

const THIN_CONTENT_THRESHOLD = 300;

export const thinContentRule: TechnicalRule = {
  id: 'content-thin',
  name: 'Weinig inhoud',
  description: 'De pagina heeft te weinig tekstinhoud',
  severity: 'WARNING',
  priority: 'MEDIUM',
  effort: 'MEDIUM',
  category: 'content',
};

export function checkThinContent(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null;
  if (page.wordCount >= THIN_CONTENT_THRESHOLD) return null;

  return {
    ruleId: thinContentRule.id,
    ruleName: thinContentRule.name,
    dutchExplanation: `Deze pagina heeft weinig inhoud (${page.wordCount} woorden). Zoekmachines hebben niet genoeg tekst om te begrijpen waar de pagina over gaat. Voeg meer relevante inhoud toe, minstens 300 woorden.`,
    technicalDetails: `Word count ${page.wordCount} on ${page.url} (threshold: ${THIN_CONTENT_THRESHOLD})`,
    evidence: [
      { field: 'wordCount', value: page.wordCount, expected: THIN_CONTENT_THRESHOLD },
    ],
    severity: 'WARNING',
    priority: 'MEDIUM',
    impact: 'Pagina\'s met weinig inhoud scoren lager in zoekmachines omdat er niet genoeg tekst is om het onderwerp te begrijpen.',
    effort: 'MEDIUM',
    affectedUrls: [page.url],
    recommendedAction: 'Voeg meer relevante tekst toe aan de pagina. Probeer minstens 300 woorden te schrijven die het onderwerp goed uitleggen.',
    autoFixAvailable: false,
    confidence: 0.85,
  };
}

export const thinContentRules = [
  { definition: thinContentRule, check: checkThinContent },
];
