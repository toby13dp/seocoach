// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Automation Rules Types — Phase 11

import type { AutomationTriggerType, AutomationActionType, AutomationRuleStatus } from '@prisma/client';

export const TRIGGER_TYPE_LABELS: Record<AutomationTriggerType, string> = {
  NEW_TECHNICAL_ISSUE: 'Nieuw technisch probleem',
  METRIC_DROP: 'Metrische daling',
  NEW_CONTENT_OPPORTUNITY: 'Nieuwe contentkans',
  CONTENT_DECAY: 'Contentverval',
  NEW_COMPETITOR_PAGE: 'Nieuwe concurrentiepagina',
  NEW_NEGATIVE_REVIEW: 'Nieuwe negatieve beoordeling',
  SCHEDULED_DATE: 'Geplande datum',
  NEW_AI_VISIBILITY_RESULT: 'Nieuw AI-zichtbaarheidsresultaat',
  NEW_WORDPRESS_DRAFT: 'Nieuw WordPress-concept',
  PRODUCT_FEED_ERROR: 'Productfeed-fout',
  DEPLOYMENT_EVENT: 'Deployment-gebeurtenis',
};

export const ACTION_TYPE_LABELS: Record<AutomationActionType, string> = {
  CREATE_TASK: 'Taak aanmaken',
  CREATE_ALERT: 'Waarschuwing aanmaken',
  GENERATE_BRIEF: 'Brief genereren',
  GENERATE_CONTENT_DRAFT: 'Contentconcept genereren',
  GENERATE_REPORT: 'Rapport genereren',
  NOTIFY_USER: 'Gebruiker informeren',
  PREPARE_CMS_UPDATE: 'CMS-update voorbereiden',
  RUN_CRAWL: 'Crawl uitvoeren',
  RUN_QUALITY_CHECK: 'Kwaliteitscontrole uitvoeren',
  CREATE_APPROVAL_REQUEST: 'Goedkeuringsverzoek aanmaken',
  CALL_WEBHOOK: 'Webhook aanroepen',
};

export const RULE_STATUS_LABELS: Record<AutomationRuleStatus, string> = {
  ACTIVE: 'Actief',
  PAUSED: 'Gepauzeerd',
  DRAFT: 'Concept',
  DISABLED: 'Uitgeschakeld',
};

/**
 * Hoogrisico-acties die expliciete configuratie en goedkeuringsregels vereisen
 */
export const HIGH_RISK_ACTIONS: AutomationActionType[] = [
  'GENERATE_CONTENT_DRAFT',
  'PREPARE_CMS_UPDATE',
  'RUN_CRAWL',
  'CALL_WEBHOOK',
];

/**
 * Controleert of een actie als hoogrisico wordt beschouwd
 */
export function isHighRiskAction(action: AutomationActionType): boolean {
  return HIGH_RISK_ACTIONS.includes(action);
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains';
  value: string | number | boolean;
}

export interface AutomationAction {
  type: AutomationActionType;
  config: Record<string, unknown>;
}
