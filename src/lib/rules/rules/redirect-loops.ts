// ============================================================================
// Rule: Redirect Loops
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

export const redirectLoopRule: TechnicalRule = {
  id: 'redirect-loop',
  name: 'Redirectkringloop',
  description: 'De pagina verwijst in een kringloop door naar zichzelf',
  severity: 'CRITICAL',
  priority: 'CRITICAL',
  effort: 'MEDIUM',
  category: 'status-codes',
};

export function checkRedirectLoop(page: PageAnalysis): TechnicalIssueResult | null {
  if (!page.redirectChain || page.redirectChain.length < 2) return null;

  // Detect loop: if the chain contains duplicate URLs
  const seen = new Set<string>();
  let hasLoop = false;
  for (const url of page.redirectChain) {
    if (seen.has(url)) {
      hasLoop = true;
      break;
    }
    seen.add(url);
  }

  // Also detect if the chain ends at the starting URL
  if (!hasLoop && page.redirectChain.length > 1) {
    const first = page.redirectChain[0];
    const last = page.redirectChain[page.redirectChain.length - 1];
    if (first === last) {
      hasLoop = true;
    }
  }

  if (!hasLoop) return null;

  return {
    ruleId: redirectLoopRule.id,
    ruleName: redirectLoopRule.name,
    dutchExplanation: 'Deze pagina verwijst in een kringloop door naar zichzelf. Zoekmachines kunnen deze pagina niet laden. Verwijder de kringloop.',
    technicalDetails: `Redirect loop detected: ${page.redirectChain.join(' → ')}`,
    evidence: [
      { field: 'redirectChain', value: page.redirectChain.join(' → '), expected: 'Geen kringloop' },
    ],
    severity: 'CRITICAL',
    priority: 'CRITICAL',
    impact: 'Zoekmachines en bezoekers kunnen deze pagina helemaal niet bereiken. De pagina blijft oneindig doorverwijzen.',
    effort: 'MEDIUM',
    affectedUrls: [page.url],
    recommendedAction: 'Verwijder de kringloop door de doorverwijzingen te corrigeren. Zorg dat de uiteindelijke pagina zichzelf niet meer doorverwijst.',
    autoFixAvailable: false,
    confidence: 1.0,
  };
}

export const redirectLoopRules = [
  { definition: redirectLoopRule, check: checkRedirectLoop },
];
