// ============================================================================
// Rule: Structured Data Issues — Parsing errors, invalid schema
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

export const structuredDataErrorRule: TechnicalRule = {
  id: 'structured-data-error',
  name: 'Fout in gestructureerde gegevens',
  description: 'De gestructureerde gegevens op de pagina bevatten fouten',
  severity: 'WARNING',
  priority: 'MEDIUM',
  effort: 'MEDIUM',
  category: 'structured-data',
};

export const missingStructuredDataRule: TechnicalRule = {
  id: 'structured-data-missing',
  name: 'Geen gestructureerde gegevens',
  description: 'De pagina bevat geen gestructureerde gegevens',
  severity: 'INFO',
  priority: 'LOW',
  effort: 'MEDIUM',
  category: 'structured-data',
};

/**
 * Check for structured data errors.
 * The structuredData field on PageAnalysis is an array of parsed JSON-LD objects.
 * We look for common issues: missing @type, invalid @context, parsing errors.
 */
export function checkStructuredDataErrors(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null;

  if (!page.structuredData || !Array.isArray(page.structuredData) || page.structuredData.length === 0) {
    return null;
  }

  const errors: string[] = [];

  for (let i = 0; i < page.structuredData.length; i++) {
    const item = page.structuredData[i];

    // Check for missing @type
    if (!item['@type']) {
      errors.push(`Gestructureerde gegevens #${i + 1}: ontbreekt @type`);
    }

    // Check for missing @context
    if (!item['@context']) {
      errors.push(`Gestructureerde gegevens #${i + 1}: ontbreekt @context`);
    }

    // Check for common typo: @context should be a schema.org URL
    if (item['@context'] && typeof item['@context'] === 'string' && !item['@context'].includes('schema.org')) {
      errors.push(`Gestructureerde gegevens #${i + 1}: @context verwijst niet naar schema.org`);
    }
  }

  if (errors.length === 0) return null;

  return {
    ruleId: structuredDataErrorRule.id,
    ruleName: structuredDataErrorRule.name,
    dutchExplanation: `De gestructureerde gegevens op deze pagina bevatten ${errors.length} fout${errors.length > 1 ? 'en' : ''}. Gestructureerde gegevens helpen zoekmachines om je inhoud beter te begrijpen en kunnen leiden tot uitgebreide resultaten in zoekmachines.`,
    technicalDetails: `Structured data errors on ${page.url}: ${errors.join('; ')}`,
    evidence: errors.map(e => ({
      field: 'structuredDataError',
      value: e,
    })),
    severity: 'WARNING',
    priority: 'MEDIUM',
    impact: 'Foutieve gestructureerde gegevens worden niet door zoekmachines verwerkt. Je mist daardoor de voordelen van uitgebreide zoekresultaten, zoals sterrenbeoordelingen en informatieblokken.',
    effort: 'MEDIUM',
    affectedUrls: [page.url],
    recommendedAction: 'Corrigeer de fouten in de gestructureerde gegevens. Gebruik de testtool van Google om je gestructureerde gegevens te controleren.',
    autoFixAvailable: false,
    confidence: 0.9,
  };
}

/**
 * Check for missing structured data.
 * This is an INFO-level suggestion — not every page needs structured data,
 * but it's helpful to know which pages don't have it.
 */
export function checkMissingStructuredData(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null;
  // Skip non-indexable pages
  if (page.indexability === 'NON_INDEXABLE') return null;

  if (page.structuredData && Array.isArray(page.structuredData) && page.structuredData.length > 0) {
    return null;
  }

  return {
    ruleId: missingStructuredDataRule.id,
    ruleName: missingStructuredDataRule.name,
    dutchExplanation: 'Deze pagina bevat geen gestructureerde gegevens. Gestructureerde gegevens helpen zoekmachines om je inhoud beter te begrijpen en kunnen leiden tot uitgebreide zoekresultaten, zoals sterrenbeoordelingen en informatieblokken.',
    technicalDetails: `No structured data found on ${page.url}`,
    evidence: [
      { field: 'structuredData', value: null },
    ],
    severity: 'INFO',
    priority: 'LOW',
    impact: 'Zonder gestructureerde gegevens kan je pagina niet verschijnen met uitgebreide zoekresultaten. Dit kan leiden tot minder klikken vanuit zoekmachines.',
    effort: 'MEDIUM',
    affectedUrls: [page.url],
    recommendedAction: 'Voeg gestructureerde gegevens (JSON-LD) toe aan je pagina. Kies het juiste schema-type bij de inhoud van je pagina, zoals Article, Product of FAQ.',
    autoFixAvailable: false,
    confidence: 0.7,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const structuredDataIssueRules = [
  { definition: structuredDataErrorRule, check: checkStructuredDataErrors },
  { definition: missingStructuredDataRule, check: checkMissingStructuredData },
];
