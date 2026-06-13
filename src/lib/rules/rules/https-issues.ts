// ============================================================================
// Rule: HTTPS Issues — Mixed content, non-HTTPS pages
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

// ---------------------------------------------------------------------------
// Non-HTTPS page
// ---------------------------------------------------------------------------
export const nonHttpsPageRule: TechnicalRule = {
  id: 'https-not-secure',
  name: 'Onveilige verbinding (geen HTTPS)',
  description: 'De pagina is niet beveiligd met HTTPS',
  severity: 'ERROR',
  priority: 'HIGH',
  effort: 'MEDIUM',
  category: 'technical',
};

export function checkNonHttps(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null;

  try {
    const protocol = new URL(page.url).protocol;
    if (protocol === 'https:') return null;
  } catch {
    // Can't parse URL, skip
    return null;
  }

  return {
    ruleId: nonHttpsPageRule.id,
    ruleName: nonHttpsPageRule.name,
    dutchExplanation: 'Deze pagina is niet beveiligd met HTTPS. Bezoekers zien een waarschuwing dat de verbinding niet veilig is. Zoekmachines geven de voorkeur aan beveiligde pagina\'s. Schakel HTTPS in voor je hele website.',
    technicalDetails: `Non-HTTPS URL: ${page.url}`,
    evidence: [
      { field: 'url', value: page.url, expected: 'HTTPS-URL' },
    ],
    severity: 'ERROR',
    priority: 'HIGH',
    impact: 'Zonder HTTPS zien bezoekers een waarschuwing en zoekmachines ranken je pagina lager. Bezoekers vertrouwen je website minder.',
    effort: 'MEDIUM',
    affectedUrls: [page.url],
    recommendedAction: 'Schakel HTTPS in voor je website en stel een doorverwijzing in van HTTP naar HTTPS. Vraag hiervoor een gratis certificaat aan via Let\'s Encrypt.',
    autoFixAvailable: false,
    confidence: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Mixed content (HTTPS page with HTTP resources)
// ---------------------------------------------------------------------------
export const mixedContentRule: TechnicalRule = {
  id: 'https-mixed-content',
  name: 'Gemengde inhoud (mixed content)',
  description: 'De beveiligde pagina laadt onveilige bronnen via HTTP',
  severity: 'WARNING',
  priority: 'HIGH',
  effort: 'LOW',
  category: 'technical',
};

export function checkMixedContent(page: PageAnalysis): TechnicalIssueResult | null {
  // Only check HTTPS pages for mixed content
  try {
    const protocol = new URL(page.url).protocol;
    if (protocol !== 'https:') return null;
  } catch {
    return null;
  }

  const httpResources: string[] = [];

  // Check images
  if (page.images) {
    for (const img of page.images) {
      try {
        if (new URL(img.src).protocol === 'http:') {
          httpResources.push(img.src);
        }
      } catch {
        // relative URL, skip
      }
    }
  }

  // Check internal links for HTTP
  if (page.internalLinks) {
    for (const link of page.internalLinks) {
      try {
        if (new URL(link.href).protocol === 'http:') {
          httpResources.push(link.href);
        }
      } catch {
        // relative URL, skip
      }
    }
  }

  // Check external links for HTTP
  if (page.externalLinks) {
    for (const link of page.externalLinks) {
      try {
        if (new URL(link.href).protocol === 'http:') {
          httpResources.push(link.href);
        }
      } catch {
        // relative URL, skip
      }
    }
  }

  if (httpResources.length === 0) return null;

  const count = httpResources.length;

  return {
    ruleId: mixedContentRule.id,
    ruleName: mixedContentRule.name,
    dutchExplanation: `Deze beveiligde pagina laadt ${count} onveilige bronnen via HTTP. Bezoekers zien mogelijk een waarschuwing dat de pagina niet volledig beveiligd is. Vervang HTTP-verwijzingen door HTTPS.`,
    technicalDetails: `Mixed content on ${page.url}: ${count} HTTP resources`,
    evidence: httpResources.slice(0, 10).map(r => ({
      field: 'httpResource',
      value: r,
      expected: 'HTTPS-URL',
    })),
    severity: 'WARNING',
    priority: 'HIGH',
    impact: 'Browsers blokkeren onveilige inhoud op beveiligde pagina\'s. Dit kan ervoor zorgen dat delen van je pagina niet goed worden weergegeven.',
    effort: 'LOW',
    affectedUrls: [page.url],
    recommendedAction: 'Vervang alle HTTP-verwijzingen door HTTPS-verwijzingen. Controleer afbeeldingen, scripts en stylesheets.',
    autoFixAvailable: true,
    confidence: 0.95,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const httpsIssueRules = [
  { definition: nonHttpsPageRule, check: checkNonHttps },
  { definition: mixedContentRule, check: checkMixedContent },
];
