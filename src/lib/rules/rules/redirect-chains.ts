// ============================================================================
// Rule: Redirect Chains — 3+ hops
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

export const redirectChainRule: TechnicalRule = {
  id: 'redirect-chain',
  name: 'Redirectketen',
  description: 'De pagina wordt via meerdere stappen doorgestuurd',
  severity: 'WARNING',
  priority: 'MEDIUM',
  effort: 'LOW',
  category: 'status-codes',
};

export function checkRedirectChain(page: PageAnalysis): TechnicalIssueResult | null {
  if (!page.redirectChain || page.redirectChain.length < 3) return null;

  const count = page.redirectChain.length;

  return {
    ruleId: redirectChainRule.id,
    ruleName: redirectChainRule.name,
    dutchExplanation: `Deze pagina wordt via meerdere stappen doorgestuurd (${count} keer). Dit maakt je website trager en zoekmachines kunnen de uiteindelijke pagina niet goed vinden. Stuur direct door naar de uiteindelijke pagina.`,
    technicalDetails: `Redirect chain of ${count} hops: ${page.redirectChain.join(' → ')}`,
    evidence: [
      { field: 'redirectChain', value: page.redirectChain.join(' → '), expected: 'Maximaal 1 doorverwijzing' },
      { field: 'hopCount', value: count, expected: 1 },
    ],
    severity: 'WARNING',
    priority: 'MEDIUM',
    impact: 'Elke extra doorverwijzing vertraagt het laden van de pagina. Zoekmachines besteden minder aandacht aan pagina\'s met lange redirectketens.',
    effort: 'LOW',
    affectedUrls: [page.url],
    recommendedAction: 'Vervang de redirectketen door een enkele doorverwijzing van de eerste naar de laatste URL.',
    autoFixAvailable: false,
    confidence: 1.0,
  };
}

export const redirectChainRules = [
  { definition: redirectChainRule, check: checkRedirectChain },
];
