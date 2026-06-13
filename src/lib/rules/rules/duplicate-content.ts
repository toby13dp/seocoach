// ============================================================================
// Rule: Duplicate Content — Near-duplicate pages
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

const SIMILARITY_THRESHOLD = 0.85; // 85%

export const duplicateContentRule: TechnicalRule = {
  id: 'content-duplicate',
  name: 'Dubbele inhoud',
  description: 'De pagina lijkt sterk op andere pagina\'s op de website',
  severity: 'WARNING',
  priority: 'HIGH',
  effort: 'MEDIUM',
  category: 'content',
};

/**
 * Per-page check: if this page has a duplicateGroup and similarityScore set.
 * Cross-page duplicate detection happens in session-analyzer.
 */
export function checkDuplicateContent(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null;
  if (!page.duplicateGroup) return null;
  if (page.similarityScore === null || page.similarityScore < SIMILARITY_THRESHOLD) return null;

  const similarity = Math.round(page.similarityScore * 100);

  return {
    ruleId: duplicateContentRule.id,
    ruleName: duplicateContentRule.name,
    dutchExplanation: `Deze pagina lijkt sterk op andere pagina's (overeenkomst: ${similarity}%). Zoekmachines kunnen deze pagina's als duplicaten zien. Maak elke pagina uniek of voeg een canonieke link toe.`,
    technicalDetails: `Duplicate group ${page.duplicateGroup}, similarity ${similarity}% for ${page.url}`,
    evidence: [
      { field: 'duplicateGroup', value: page.duplicateGroup },
      { field: 'similarityScore', value: similarity },
    ],
    severity: 'WARNING',
    priority: 'HIGH',
    impact: 'Zoekmachines tonen waarschijnlijk slechts één van de vergelijkbare pagina\'s. De andere pagina\'s krijgen minder bezoekers.',
    effort: 'MEDIUM',
    affectedUrls: [page.url],
    recommendedAction: 'Maak elke pagina uniek met eigen inhoud, of voeg een canonieke link toe om aan te geven welke de hoofdversie is.',
    autoFixAvailable: true,
    confidence: 0.8,
  };
}

/**
 * Cross-page duplicate content check: groups pages by duplicateGroup
 * and creates one issue per group with all affected URLs.
 */
export function checkDuplicateContentCrossPage(pages: PageAnalysis[]): TechnicalIssueResult[] {
  const groups = new Map<string, PageAnalysis[]>();

  for (const page of pages) {
    if (!page.duplicateGroup) continue;
    if (page.similarityScore === null || page.similarityScore < SIMILARITY_THRESHOLD) continue;
    if (!groups.has(page.duplicateGroup)) groups.set(page.duplicateGroup, []);
    groups.get(page.duplicateGroup)!.push(page);
  }

  const results: TechnicalIssueResult[] = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    const count = group.length;
    const urls = group.map(p => p.url);
    const avgSimilarity = Math.round(
      (group.reduce((sum, p) => sum + (p.similarityScore ?? 0), 0) / count) * 100
    );

    results.push({
      ruleId: duplicateContentRule.id,
      ruleName: duplicateContentRule.name,
      dutchExplanation: `Deze pagina lijkt sterk op ${count - 1} andere pagina's (overeenkomst: ${avgSimilarity}%). Zoekmachines kunnen deze pagina's als duplicaten zien. Maak elke pagina uniek of voeg een canonieke link toe.`,
      technicalDetails: `Duplicate group with ${count} pages, avg similarity ${avgSimilarity}%`,
      evidence: [
        { field: 'duplicateGroup', value: group[0].duplicateGroup!, urls },
        { field: 'averageSimilarity', value: avgSimilarity },
      ],
      severity: 'WARNING',
      priority: 'HIGH',
      impact: 'Zoekmachines tonen waarschijnlijk slechts één van de vergelijkbare pagina\'s. De andere pagina\'s krijgen minder bezoekers.',
      effort: 'MEDIUM',
      affectedUrls: urls,
      recommendedAction: 'Maak elke pagina uniek met eigen inhoud, of voeg een canonieke link toe om aan te geven welke de hoofdversie is.',
      autoFixAvailable: true,
      confidence: 0.8,
    });
  }

  return results;
}

export const duplicateContentRules = [
  { definition: duplicateContentRule, check: checkDuplicateContent },
];
