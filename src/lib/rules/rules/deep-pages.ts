// ============================================================================
// Rule: Deep Pages — Too many clicks from homepage
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

const DEEP_PAGE_THRESHOLD = 3;

export const deepPageRule: TechnicalRule = {
  id: 'links-deep-page',
  name: 'Pagina te diep in de sitestructuur',
  description: 'De pagina is te veel klikken verwijderd van de homepage',
  severity: 'WARNING',
  priority: 'LOW',
  effort: 'MEDIUM',
  category: 'links',
};

export function checkDeepPage(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.crawlDepth <= DEEP_PAGE_THRESHOLD) return null;
  // Skip non-HTML
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null;

  return {
    ruleId: deepPageRule.id,
    ruleName: deepPageRule.name,
    dutchExplanation: `Deze pagina is ${page.crawlDepth} klikken verwijderd van de homepage. Hoe dieper een pagina, hoe moeilijker zoekmachines hem vinden. Probeer belangrijke pagina's binnen 3 klikken bereikbaar te maken.`,
    technicalDetails: `Crawl depth ${page.crawlDepth} for ${page.url} (threshold: ${DEEP_PAGE_THRESHOLD})`,
    evidence: [
      { field: 'crawlDepth', value: page.crawlDepth, expected: DEEP_PAGE_THRESHOLD },
    ],
    severity: 'WARNING',
    priority: 'LOW',
    impact: 'Diep gelegen pagina\'s worden minder vaak bezocht door zoekmachines en krijgen minder waarde. Ze ranken lager in zoekresultaten.',
    effort: 'MEDIUM',
    affectedUrls: [page.url],
    recommendedAction: 'Breng de pagina dichter bij de homepage door verwijzingen toe te voegen vanaf pagina\'s hoger in de structuur. Overweeg ook een sitemap.',
    autoFixAvailable: false,
    confidence: 0.9,
  };
}

export const deepPageRules = [
  { definition: deepPageRule, check: checkDeepPage },
];
