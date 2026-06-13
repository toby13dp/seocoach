// ============================================================================
// Rule: Status Codes — 4xx / 5xx pages
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

export const clientErrorRule: TechnicalRule = {
  id: 'status-4xx',
  name: '4xx Client Error',
  description: 'De pagina retourneert een 4xx-statuscode en kan niet worden gevonden',
  severity: 'ERROR',
  priority: 'HIGH',
  effort: 'LOW',
  category: 'status-codes',
};

export const serverErrorRule: TechnicalRule = {
  id: 'status-5xx',
  name: '5xx Server Error',
  description: 'De pagina retourneert een 5xx-statuscode door een serverfout',
  severity: 'CRITICAL',
  priority: 'CRITICAL',
  effort: 'MEDIUM',
  category: 'status-codes',
};

export function check4xx(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.statusCode === null) return null;
  if (page.statusCode >= 400 && page.statusCode < 500) {
    return {
      ruleId: clientErrorRule.id,
      ruleName: clientErrorRule.name,
      dutchExplanation: `Deze pagina kan niet worden gevonden (fout ${page.statusCode}). Bezoekers zien een foutpagina in plaats van inhoud. Los dit op door de pagina te herstellen of te verwijzen naar de juiste pagina.`,
      technicalDetails: `HTTP ${page.statusCode} for ${page.url}`,
      evidence: [
        { field: 'statusCode', value: page.statusCode, expected: '200' },
      ],
      severity: 'ERROR',
      priority: 'HIGH',
      impact: 'Bezoekers en zoekmachines kunnen deze pagina niet bereiken. Dit verlaagt de kwaliteit van je website.',
      effort: 'LOW',
      affectedUrls: [page.url],
      recommendedAction: 'Herstel de pagina of stuur bezoekers door naar een werkende pagina met een doorverwijzing (301-redirect).',
      autoFixAvailable: false,
      confidence: 1.0,
    };
  }
  return null;
}

export function check5xx(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.statusCode === null) return null;
  if (page.statusCode >= 500) {
    return {
      ruleId: serverErrorRule.id,
      ruleName: serverErrorRule.name,
      dutchExplanation: 'De server geeft een fout bij het laden van deze pagina. Dit kan betekenen dat er een technisch probleem is met je website. Controleer je serverlogs.',
      technicalDetails: `HTTP ${page.statusCode} for ${page.url}`,
      evidence: [
        { field: 'statusCode', value: page.statusCode, expected: '200' },
      ],
      severity: 'CRITICAL',
      priority: 'CRITICAL',
      impact: 'De pagina is volledig onbeschikbaar. Bezoekers zien een foutpagina en zoekmachines kunnen de inhoud niet lezen.',
      effort: 'MEDIUM',
      affectedUrls: [page.url],
      recommendedAction: 'Controleer de serverlogs op fouten en los het technische probleem op. Controleer ook of de server voldoende capaciteit heeft.',
      autoFixAvailable: false,
      confidence: 1.0,
    };
  }
  return null;
}

export const statusCodesRules = [
  { definition: clientErrorRule, check: check4xx },
  { definition: serverErrorRule, check: check5xx },
];
