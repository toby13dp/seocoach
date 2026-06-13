// ============================================================================
// Rule: Broken Links — Internal / External
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

export const brokenLinksRule: TechnicalRule = {
  id: 'links-broken',
  name: 'Kapotte verwijzingen',
  description: 'De pagina bevat verwijzingen die niet werken',
  severity: 'ERROR',
  priority: 'HIGH',
  effort: 'LOW',
  category: 'links',
};

/**
 * Detects broken links on a page.
 * A link is considered broken if it points to a URL that returned a 4xx/5xx status.
 * We check the internalLinks and externalLinks arrays where the href matches
 * any known broken URL from the crawl.
 *
 * For single-page analysis we flag based on:
 * - Internal links pointing to pages that returned errors (if data available)
 * - External links that are in the page's external links list
 *
 * In practice, the session-analyzer enriches this with cross-page data.
 * Here we check for links where the target URL had an error status in the crawl.
 */
export function checkBrokenLinks(page: PageAnalysis): TechnicalIssueResult | null {
  // We look for links that returned 4xx/5xx status codes during the crawl.
  // The PageAnalysis itself only has link data; broken link detection
  // typically needs cross-page context. For single-page checks, we flag
  // based on heuristics (e.g. link text contains error indicators).
  //
  // In session-wide analysis, the session-analyzer maps link hrefs to
  // their status codes and creates issues for broken links.

  // For the per-page check, we simply return null; broken links are
  // detected at the session level via session-analyzer.
  return null;
}

/**
 * Cross-page broken link check: given all pages in a session,
 * find links on pages that point to URLs returning 4xx/5xx.
 */
export function checkBrokenLinksCrossPage(
  pages: PageAnalysis[],
  allPageUrls: Map<string, number> // url → statusCode
): TechnicalIssueResult[] {
  const results: TechnicalIssueResult[] = [];

  // Build a set of broken URLs
  const brokenUrls = new Set<string>();
  for (const [url, status] of allPageUrls) {
    if (status >= 400) {
      brokenUrls.add(url);
    }
  }

  if (brokenUrls.size === 0) return results;

  for (const page of pages) {
    if (page.statusCode !== null && page.statusCode >= 400) continue;

    const brokenOnPage: { href: string; anchor: string; statusCode: number }[] = [];

    // Check internal links
    if (page.internalLinks) {
      for (const link of page.internalLinks) {
        if (brokenUrls.has(link.href)) {
          brokenOnPage.push({
            href: link.href,
            anchor: link.anchor,
            statusCode: allPageUrls.get(link.href) ?? 0,
          });
        }
      }
    }

    // Check external links — we can't verify these from crawl data alone,
    // but if the crawl tried them and got errors, they'd be in the page map.
    // For now, we focus on internal broken links.

    if (brokenOnPage.length === 0) continue;

    const count = brokenOnPage.length;
    const urls = brokenOnPage.map(l => l.href);

    results.push({
      ruleId: brokenLinksRule.id,
      ruleName: brokenLinksRule.name,
      dutchExplanation: `Deze pagina bevat ${count} kapotte verwijzingen. Bezoekers die op deze links klikken krijgen een foutpagina. Werk de verwijzingen bij of verwijder ze.`,
      technicalDetails: `Broken links on ${page.url}: ${brokenOnPage.map(l => `${l.href} (${l.statusCode})`).join(', ')}`,
      evidence: brokenOnPage.map(l => ({
        field: 'brokenLink',
        value: `${l.href} → HTTP ${l.statusCode}`,
      })),
      severity: 'ERROR',
      priority: 'HIGH',
      impact: 'Kapotte verwijzingen leiden bezoekers naar foutpagina\'s. Dit is slecht voor de gebruikservaring en zoekmachines waarderen je website lager.',
      effort: 'LOW',
      affectedUrls: [page.url, ...urls],
      recommendedAction: 'Werk de kapotte verwijzingen bij naar werkende pagina\'s, of verwijder de verwijzingen als de doelpagina niet meer bestaat.',
      autoFixAvailable: false,
      confidence: 1.0,
    });
  }

  return results;
}

export const brokenLinksRules = [
  { definition: brokenLinksRule, check: checkBrokenLinks },
];
