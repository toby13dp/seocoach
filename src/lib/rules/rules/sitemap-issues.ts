// ============================================================================
// Rule: Sitemap Issues — Pages in sitemap but noindex, pages not in sitemap
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

export const noindexInSitemapRule: TechnicalRule = {
  id: 'sitemap-noindex-conflict',
  name: 'Noindex-pagina in sitemap',
  description: 'Een pagina met noindex-tag staat in de sitemap',
  severity: 'ERROR',
  priority: 'HIGH',
  effort: 'MINIMAL',
  category: 'technical',
};

export const notInSitemapRule: TechnicalRule = {
  id: 'sitemap-missing-page',
  name: 'Pagina ontbreekt in sitemap',
  description: 'De pagina staat niet in de sitemap',
  severity: 'INFO',
  priority: 'LOW',
  effort: 'LOW',
  category: 'technical',
};

/**
 * The PageAnalysis model doesn't directly have an "inSitemap" field.
 * We use a convention: the evidence can carry this info.
 * For now, we check the metaRobots noindex + a hypothetical inSitemap flag.
 *
 * In practice, the session-analyzer will enrich PageAnalysis with sitemap
 * information before running these checks.
 */
interface SitemapPageAnalysis extends PageAnalysis {
  inSitemap?: boolean;
}

/**
 * Check: page with noindex that appears in sitemap.
 * This is a conflict — you're telling search engines both "index this" (sitemap)
 * and "don't index this" (noindex). Search engines will respect noindex,
 * so the sitemap entry is misleading.
 */
export function checkNoindexInSitemap(page: SitemapPageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;

  const isNoindex = page.indexability === 'NON_INDEXABLE' ||
    (page.metaRobots?.toLowerCase().includes('noindex') ?? false);

  // We need to know if the page is in the sitemap
  // If inSitemap is not set, we can't determine this
  if (!page.inSitemap) return null;
  if (!isNoindex) return null;

  return {
    ruleId: noindexInSitemapRule.id,
    ruleName: noindexInSitemapRule.name,
    dutchExplanation: 'Deze pagina is verborgen voor zoekmachines (noindex), maar staat wel in je sitemap. Dit is tegenstrijdig: je vraagt zoekmachines om de pagina te vinden, maar tegelijkertijd om hem niet te tonen. Verwijder de pagina uit de sitemap of haal de noindex-tag weg.',
    technicalDetails: `Noindex page in sitemap: ${page.url}`,
    evidence: [
      { field: 'indexability', value: page.indexability },
      { field: 'metaRobots', value: page.metaRobots ?? 'niet ingesteld' },
      { field: 'inSitemap', value: true },
    ],
    severity: 'ERROR',
    priority: 'HIGH',
    impact: 'Zoekmachines krijgen tegenstrijdige signalen. Ze respecteren de noindex-tag en negeren de sitemap-verwijzing. Dit vermindert het vertrouwen van zoekmachines in je sitemap.',
    effort: 'MINIMAL',
    affectedUrls: [page.url],
    recommendedAction: 'Verwijder de pagina uit de sitemap als deze niet in zoekmachines hoeft te verschijnen. Of verwijder de noindex-tag als de pagina wel gevonden moet worden.',
    autoFixAvailable: true,
    confidence: 1.0,
  };
}

/**
 * Check: indexable page that is NOT in the sitemap.
 * This is informational — not all pages need to be in the sitemap,
 * but it's a best practice.
 */
export function checkNotInSitemap(page: SitemapPageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null;
  if (page.indexability === 'NON_INDEXABLE') return null;

  // If inSitemap is not set, we can't determine this
  if (page.inSitemap === undefined || page.inSitemap === true) return null;

  return {
    ruleId: notInSitemapRule.id,
    ruleName: notInSitemapRule.name,
    dutchExplanation: 'Deze pagina staat niet in je sitemap. Hoewel zoekmachines de pagina ook zonder sitemap kunnen vinden, helpt een sitemap ze om sneller alle pagina\'s te ontdekken.',
    technicalDetails: `Page not in sitemap: ${page.url}`,
    evidence: [
      { field: 'inSitemap', value: false, expected: 'true' },
    ],
    severity: 'INFO',
    priority: 'LOW',
    impact: 'Zonder vermelding in de sitemap kan het langer duren voordat zoekmachines deze pagina ontdekken en indexeren.',
    effort: 'LOW',
    affectedUrls: [page.url],
    recommendedAction: 'Voeg de pagina toe aan je sitemap. Dit helpt zoekmachines om de pagina sneller te vinden.',
    autoFixAvailable: true,
    confidence: 0.8,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const sitemapIssueRules = [
  { definition: noindexInSitemapRule, check: checkNoindexInSitemap },
  { definition: notInSitemapRule, check: checkNotInSitemap },
];
