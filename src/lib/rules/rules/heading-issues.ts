// ============================================================================
// Rule: Heading Issues — Missing/multiple H1, heading structure
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

// ---------------------------------------------------------------------------
// Missing H1
// ---------------------------------------------------------------------------
export const missingH1Rule: TechnicalRule = {
  id: 'heading-missing-h1',
  name: 'Ontbrekend hoofdopschrift (H1)',
  description: 'De pagina heeft geen H1-tag',
  severity: 'WARNING',
  priority: 'MEDIUM',
  effort: 'MINIMAL',
  category: 'meta',
};

export function checkMissingH1(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null;

  const h1FromField = page.h1 !== null && page.h1.trim() !== '';
  const h1FromHeadings = page.headings?.some(h => h.level === 1) ?? false;

  if (h1FromField || h1FromHeadings) return null;

  return {
    ruleId: missingH1Rule.id,
    ruleName: missingH1Rule.name,
    dutchExplanation: 'Deze pagina heeft geen hoofdopschrift (H1). Dit helpt zowel bezoekers als zoekmachines om te begrijpen waar de pagina over gaat. Voeg één duidelijke H1 toe.',
    technicalDetails: `No H1 tag found on ${page.url}`,
    evidence: [
      { field: 'h1', value: page.h1 ?? null, expected: 'Een H1-tag' },
    ],
    severity: 'WARNING',
    priority: 'MEDIUM',
    impact: 'Zonder H1 is het voor zoekmachines en bezoekers minder duidelijk wat de pagina het belangrijkste onderwerp is.',
    effort: 'MINIMAL',
    affectedUrls: [page.url],
    recommendedAction: 'Voeg één <h1> tag toe aan de pagina met de belangrijkste titel die het onderwerp van de pagina beschrijft.',
    autoFixAvailable: false,
    confidence: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Multiple H1
// ---------------------------------------------------------------------------
export const multipleH1Rule: TechnicalRule = {
  id: 'heading-multiple-h1',
  name: 'Meerdere hoofdopschriften (H1)',
  description: 'De pagina heeft meer dan één H1-tag',
  severity: 'WARNING',
  priority: 'LOW',
  effort: 'MINIMAL',
  category: 'meta',
};

export function checkMultipleH1(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (!page.headings || page.headings.length === 0) return null;

  const h1Count = page.headings.filter(h => h.level === 1).length;
  if (h1Count <= 1) return null;

  const h1Texts = page.headings
    .filter(h => h.level === 1)
    .map(h => h.text);

  return {
    ruleId: multipleH1Rule.id,
    ruleName: multipleH1Rule.name,
    dutchExplanation: `Deze pagina heeft ${h1Count} hoofdopschriften (H1). Gebruik slechts één H1 per pagina voor de belangrijkste titel.`,
    technicalDetails: `Found ${h1Count} H1 tags on ${page.url}: ${h1Texts.join(' | ')}`,
    evidence: [
      { field: 'h1Count', value: h1Count, expected: 1 },
      { field: 'h1Texts', value: h1Texts.join(', ') },
    ],
    severity: 'WARNING',
    priority: 'LOW',
    impact: 'Meerdere H1-tags maken het voor zoekmachines onduidelijk wat het hoofdonderwerp van de pagina is.',
    effort: 'MINIMAL',
    affectedUrls: [page.url],
    recommendedAction: 'Behoud alleen de belangrijkste H1 en wijzig de andere H1-tags in H2-tags.',
    autoFixAvailable: false,
    confidence: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Heading hierarchy skip (e.g. H1 → H3 without H2)
// ---------------------------------------------------------------------------
export const headingHierarchyRule: TechnicalRule = {
  id: 'heading-hierarchy',
  name: 'Ongeldige opschrifthiërarchie',
  description: 'De opschriften op de pagina slaan een niveau over',
  severity: 'INFO',
  priority: 'LOW',
  effort: 'LOW',
  category: 'meta',
};

export function checkHeadingHierarchy(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (!page.headings || page.headings.length < 2) return null;

  const skippedLevels: { from: number; to: number }[] = [];
  for (let i = 1; i < page.headings.length; i++) {
    const prev = page.headings[i - 1].level;
    const curr = page.headings[i].level;
    // A skip is when you jump more than 1 level (e.g. H1 → H3)
    if (curr > prev + 1) {
      skippedLevels.push({ from: prev, to: curr });
    }
  }

  if (skippedLevels.length === 0) return null;

  return {
    ruleId: headingHierarchyRule.id,
    ruleName: headingHierarchyRule.name,
    dutchExplanation: 'De opschriften op deze pagina slaan een niveau over (bijvoorbeeld van H1 naar H3). Gebruik een logische volgorde: H1, dan H2, dan H3, enzovoort. Dit helpt zoekmachines de structuur van je pagina te begrijpen.',
    technicalDetails: `Heading hierarchy skips on ${page.url}: ${skippedLevels.map(s => `H${s.from} → H${s.to}`).join(', ')}`,
    evidence: skippedLevels.map(s => ({
      field: `headingSkip`,
      value: `H${s.from} → H${s.to}`,
      expected: `H${s.from} → H${s.from + 1}`,
    })),
    severity: 'INFO',
    priority: 'LOW',
    impact: 'Een onjuiste opschrifthiërarchie maakt het voor zoekmachines moeilijker om de structuur en hiërarchie van je inhoud te begrijpen.',
    effort: 'LOW',
    affectedUrls: [page.url],
    recommendedAction: 'Zorg dat opschriften in een logische volgorde staan: na een H1 komt een H2, na een H2 komt een H3, enzovoort.',
    autoFixAvailable: false,
    confidence: 0.9,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const headingIssueRules = [
  { definition: missingH1Rule, check: checkMissingH1 },
  { definition: multipleH1Rule, check: checkMultipleH1 },
  { definition: headingHierarchyRule, check: checkHeadingHierarchy },
];
