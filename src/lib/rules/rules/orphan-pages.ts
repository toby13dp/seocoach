// ============================================================================
// Rule: Orphan Pages
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

export const orphanPageRule: TechnicalRule = {
  id: 'links-orphan-page',
  name: 'Weespagina',
  description: 'De pagina heeft geen interne verwijzingen van andere pagina\'s',
  severity: 'WARNING',
  priority: 'MEDIUM',
  effort: 'MEDIUM',
  category: 'links',
};

export function checkOrphanPage(page: PageAnalysis): TechnicalIssueResult | null {
  if (!page.isOrphan) return null;
  // Skip error pages and non-HTML
  if (page.statusCode !== null && page.statusCode >= 400) return null;
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;

  return {
    ruleId: orphanPageRule.id,
    ruleName: orphanPageRule.name,
    dutchExplanation: 'Deze pagina is een weespagina - geen andere pagina op je website verwijst ernaar. Zoekmachines kunnen deze pagina moeilijk vinden. Voeg verwijzingen toe vanaf andere pagina\'s.',
    technicalDetails: `Orphan page detected: ${page.url} (crawlDepth: ${page.crawlDepth})`,
    evidence: [
      { field: 'isOrphan', value: true },
      { field: 'internalLinkCount', value: 0, expected: 'Minimaal 1 interne verwijzing' },
    ],
    severity: 'WARNING',
    priority: 'MEDIUM',
    impact: 'Zonder interne verwijzingen is het voor zoekmachines moeilijk om deze pagina te ontdekken en te indexeren. De pagina krijgt ook geen waarde door te delen via interne verwijzingen.',
    effort: 'MEDIUM',
    affectedUrls: [page.url],
    recommendedAction: 'Voeg verwijzingen naar deze pagina toe vanuit relevante andere pagina\'s op je website, zoals het menu, broodkruimelpad, of gerelateerde inhoud.',
    autoFixAvailable: false,
    confidence: 0.95,
  };
}

export const orphanPageRules = [
  { definition: orphanPageRule, check: checkOrphanPage },
];
