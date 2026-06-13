// ============================================================================
// Rule: Meta Issues — Missing/duplicate title/description, noindex conflicts
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

// ---------------------------------------------------------------------------
// Missing title
// ---------------------------------------------------------------------------
export const missingTitleRule: TechnicalRule = {
  id: 'meta-missing-title',
  name: 'Ontbrekende paginatitel',
  description: 'De pagina heeft geen titel',
  severity: 'ERROR',
  priority: 'HIGH',
  effort: 'MINIMAL',
  category: 'meta',
};

export function checkMissingTitle(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null; // skip error pages
  if (page.title !== null && page.title.trim() !== '') return null;

  return {
    ruleId: missingTitleRule.id,
    ruleName: missingTitleRule.name,
    dutchExplanation: 'Deze pagina heeft geen titel. Zoekmachines tonen dan een willekeurige tekst in de resultaten. Voeg een duidelijke titel toe van 50-60 tekens.',
    technicalDetails: `Empty or missing <title> on ${page.url}`,
    evidence: [
      { field: 'title', value: page.title ?? null, expected: 'Een titel van 50-60 tekens' },
    ],
    severity: 'ERROR',
    priority: 'HIGH',
    impact: 'Zonder titel kunnen zoekmachines de pagina niet goed weergeven in de resultaten. Bezoekers klikken minder snel op je pagina.',
    effort: 'MINIMAL',
    affectedUrls: [page.url],
    recommendedAction: 'Voeg een <title> tag toe in de <head> van de pagina met een beschrijvende titel van 50-60 tekens.',
    autoFixAvailable: true,
    confidence: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Duplicate title (cross-page — checked when all pages are available)
// ---------------------------------------------------------------------------
export const duplicateTitleRule: TechnicalRule = {
  id: 'meta-duplicate-title',
  name: 'Dubbele paginatitel',
  description: 'Meerdere pagina\'s hebben dezelfde titel',
  severity: 'WARNING',
  priority: 'HIGH',
  effort: 'LOW',
  category: 'meta',
};

/**
 * Cross-page check: finds pages that share the same title.
 * Returns one issue per group of duplicates.
 */
export function checkDuplicateTitle(pages: PageAnalysis[]): TechnicalIssueResult[] {
  const titleMap = new Map<string, PageAnalysis[]>();

  for (const page of pages) {
    if (!page.title || page.title.trim() === '') continue;
    if (page.contentType !== 'HTML' && page.contentType !== 'text/html') continue;
    const key = page.title.trim().toLowerCase();
    if (!titleMap.has(key)) titleMap.set(key, []);
    titleMap.get(key)!.push(page);
  }

  const results: TechnicalIssueResult[] = [];

  for (const [, group] of titleMap) {
    if (group.length < 2) continue;
    const count = group.length;
    const urls = group.map(p => p.url);
    const sampleTitle = group[0].title!;

    results.push({
      ruleId: duplicateTitleRule.id,
      ruleName: duplicateTitleRule.name,
      dutchExplanation: `${count} pagina's hebben dezelfde titel. Zoekmachines kunnen niet onderscheiden welke pagina relevant is. Geef elke pagina een unieke titel.`,
      technicalDetails: `Duplicate title "${sampleTitle}" found on ${count} pages`,
      evidence: [
        { field: 'title', value: sampleTitle, urls },
      ],
      severity: 'WARNING',
      priority: 'HIGH',
      impact: 'Zoekmachines kunnen niet bepalen welke pagina het beste bij een zoekopdracht past. Dit verlaagt de zichtbaarheid van alle betrokken pagina\'s.',
      effort: 'LOW',
      affectedUrls: urls,
      recommendedAction: 'Geef elke pagina een unieke titel die de inhoud van die specifieke pagina beschrijft.',
      autoFixAvailable: false,
      confidence: 1.0,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Missing description
// ---------------------------------------------------------------------------
export const missingDescriptionRule: TechnicalRule = {
  id: 'meta-missing-description',
  name: 'Ontbrekende paginabeschrijving',
  description: 'De pagina heeft geen meta-beschrijving',
  severity: 'WARNING',
  priority: 'MEDIUM',
  effort: 'MINIMAL',
  category: 'meta',
};

export function checkMissingDescription(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null;
  if (page.description !== null && page.description.trim() !== '') return null;

  return {
    ruleId: missingDescriptionRule.id,
    ruleName: missingDescriptionRule.name,
    dutchExplanation: 'Deze pagina heeft geen beschrijving. Zoekmachines tonen dan een willekeurig stuk tekst. Voeg een beschrijving toe van 140-160 tekens.',
    technicalDetails: `Empty or missing meta description on ${page.url}`,
    evidence: [
      { field: 'description', value: page.description ?? null, expected: 'Een beschrijving van 140-160 tekens' },
    ],
    severity: 'WARNING',
    priority: 'MEDIUM',
    impact: 'Zonder beschrijving bepalen zoekmachines zelf welke tekst ze tonen. Dit leidt vaak tot een minder aantrekkelijk resultaat waar minder op geklikt wordt.',
    effort: 'MINIMAL',
    affectedUrls: [page.url],
    recommendedAction: 'Voeg een <meta name="description"> tag toe met een heldere beschrijving van 140-160 tekens.',
    autoFixAvailable: true,
    confidence: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Duplicate description (cross-page)
// ---------------------------------------------------------------------------
export const duplicateDescriptionRule: TechnicalRule = {
  id: 'meta-duplicate-description',
  name: 'Dubbele paginabeschrijving',
  description: 'Meerdere pagina\'s hebben dezelfde meta-beschrijving',
  severity: 'WARNING',
  priority: 'MEDIUM',
  effort: 'LOW',
  category: 'meta',
};

export function checkDuplicateDescription(pages: PageAnalysis[]): TechnicalIssueResult[] {
  const descMap = new Map<string, PageAnalysis[]>();

  for (const page of pages) {
    if (!page.description || page.description.trim() === '') continue;
    if (page.contentType !== 'HTML' && page.contentType !== 'text/html') continue;
    const key = page.description.trim().toLowerCase();
    if (!descMap.has(key)) descMap.set(key, []);
    descMap.get(key)!.push(page);
  }

  const results: TechnicalIssueResult[] = [];

  for (const [, group] of descMap) {
    if (group.length < 2) continue;
    const count = group.length;
    const urls = group.map(p => p.url);
    const sampleDesc = group[0].description!;

    results.push({
      ruleId: duplicateDescriptionRule.id,
      ruleName: duplicateDescriptionRule.name,
      dutchExplanation: `${count} pagina's hebben dezelfde beschrijving. Zoekmachines kunnen niet goed onderscheiden welke pagina relevant is. Geef elke pagina een unieke beschrijving.`,
      technicalDetails: `Duplicate meta description found on ${count} pages: "${sampleDesc.substring(0, 80)}..."`,
      evidence: [
        { field: 'description', value: sampleDesc, urls },
      ],
      severity: 'WARNING',
      priority: 'MEDIUM',
      impact: 'Gelijke beschrijvingen maken het voor zoekmachines moeilijker om de juiste pagina te tonen bij een zoekopdracht.',
      effort: 'LOW',
      affectedUrls: urls,
      recommendedAction: 'Schrijf voor elke pagina een unieke beschrijving die de specifieke inhoud van die pagina samenvat.',
      autoFixAvailable: false,
      confidence: 1.0,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Noindex conflict
// ---------------------------------------------------------------------------
export const noindexConflictRule: TechnicalRule = {
  id: 'meta-noindex',
  name: 'Noindex-tag gevonden',
  description: 'De pagina is verborgen voor zoekmachines met een noindex-tag',
  severity: 'INFO',
  priority: 'MEDIUM',
  effort: 'MINIMAL',
  category: 'meta',
};

export function checkNoindex(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.indexability !== 'NON_INDEXABLE') return null;

  const metaRobotsValue = page.metaRobots ?? '';

  return {
    ruleId: noindexConflictRule.id,
    ruleName: noindexConflictRule.name,
    dutchExplanation: 'Deze pagina is verborgen voor zoekmachines met een noindex-tag. Als je wilt dat deze pagina gevonden wordt, verwijder dan de noindex-tag.',
    technicalDetails: `Page ${page.url} has meta robots: "${metaRobotsValue}"`,
    evidence: [
      { field: 'metaRobots', value: metaRobotsValue },
      { field: 'indexability', value: page.indexability },
    ],
    severity: 'INFO',
    priority: 'MEDIUM',
    impact: 'Deze pagina verschijnt niet in de resultaten van zoekmachines. Dit kan opzettelijk zijn, maar controleer of dit de bedoeling is.',
    effort: 'MINIMAL',
    affectedUrls: [page.url],
    recommendedAction: 'Als de pagina in zoekmachines gevonden moet worden, verwijder dan de noindex-tag uit de <head> van de pagina.',
    autoFixAvailable: false,
    confidence: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Per-page rules from this module */
export const metaIssueRules = [
  { definition: missingTitleRule, check: checkMissingTitle },
  { definition: missingDescriptionRule, check: checkMissingDescription },
  { definition: noindexConflictRule, check: checkNoindex },
];

/** Cross-page rules from this module */
export const metaCrossPageRules = [
  { definition: duplicateTitleRule, check: checkDuplicateTitle },
  { definition: duplicateDescriptionRule, check: checkDuplicateDescription },
];
