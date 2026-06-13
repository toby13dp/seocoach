// ============================================================================
// SEOCoach Alert Engine — Alert Rule Definitions
// ============================================================================
//
// All 16 alert types with Dutch labels and descriptions.
// Each rule defines the threshold, minimum data points, metric key,
// and direction that triggers the alert.
// ---------------------------------------------------------------------------

import type { AlertRule, AlertType } from './types';

/**
 * Complete mapping of all AlertType enum values to their rule definitions.
 * Every user-facing string is in Dutch (nl-NL).
 */
export const ALERT_RULES: Record<AlertType, AlertRule> = {
  RANKING_DROP: {
    type: 'RANKING_DROP',
    dutchLabel: 'Positiedaling',
    dutchDescription:
      'De gemiddelde positie van je website in de zoekresultaten is gedaald. Een hoger positienummer betekent een lagere zichtbaarheid.',
    defaultSeverity: 'HIGH',
    defaultThreshold: 10,
    minimumDataPoints: 14,
    metricKey: 'averagePosition',
    direction: 'increase', // position number going up = worse ranking
  },

  CLICK_DROP: {
    type: 'CLICK_DROP',
    dutchLabel: 'Klikdaling',
    dutchDescription:
      'Het aantal kliks op je website in de zoekresultaten is gedaald. Dit kan wijzen op een daling in zichtbaarheid of relevantie.',
    defaultSeverity: 'HIGH',
    defaultThreshold: 20,
    minimumDataPoints: 14,
    metricKey: 'clicks',
    direction: 'drop',
  },

  IMPRESSION_DROP: {
    type: 'IMPRESSION_DROP',
    dutchLabel: 'Impressiedaling',
    dutchDescription:
      'Het aantal keer dat je website in de zoekresultaten wordt getoond is gedaald. Dit kan duiden op een daling in rankings of zoekvolume.',
    defaultSeverity: 'MEDIUM',
    defaultThreshold: 15,
    minimumDataPoints: 14,
    metricKey: 'impressions',
    direction: 'drop',
  },

  CTR_DROP: {
    type: 'CTR_DROP',
    dutchLabel: 'CTR-daling',
    dutchDescription:
      'De doorklikratio (CTR) van je website in de zoekresultaten is gedaald. Je titel of beschrijving trekt minder kliks aan.',
    defaultSeverity: 'MEDIUM',
    defaultThreshold: 15,
    minimumDataPoints: 14,
    metricKey: 'ctr',
    direction: 'drop',
  },

  CONVERSION_DROP: {
    type: 'CONVERSION_DROP',
    dutchLabel: 'Conversiedaling',
    dutchDescription:
      'Het aantal conversies op je website is gedaald. Bezoekers nemen minder vaak de gewenste actie.',
    defaultSeverity: 'HIGH',
    defaultThreshold: 20,
    minimumDataPoints: 14,
    metricKey: 'conversions',
    direction: 'drop',
  },

  REVENUE_DROP: {
    type: 'REVENUE_DROP',
    dutchLabel: 'Omzetdaling',
    dutchDescription:
      'De omzet via je website is gedaald. Dit vereist directe aandacht om inkomstenverlies te beperken.',
    defaultSeverity: 'CRITICAL',
    defaultThreshold: 15,
    minimumDataPoints: 14,
    metricKey: 'revenue',
    direction: 'drop',
  },

  INDEXING_ISSUE: {
    type: 'INDEXING_ISSUE',
    dutchLabel: 'Indexeringsprobleem',
    dutchDescription:
      'Er is een afname gedetecteerd in het aantal geïndexeerde pagina\'s. Pagina\'s worden mogelijk niet meer door zoekmachines gevonden.',
    defaultSeverity: 'CRITICAL',
    defaultThreshold: 10,
    minimumDataPoints: 7,
    metricKey: 'impressions', // proxy: impression drops can indicate indexing issues
    direction: 'drop',
  },

  NEW_404: {
    type: 'NEW_404',
    dutchLabel: 'Nieuwe 404-pagina',
    dutchDescription:
      'Er zijn nieuwe 404-fouten gedetecteerd. Pagina\'s die eerder bereikbaar waren, geven nu een "niet gevonden"-fout.',
    defaultSeverity: 'HIGH',
    defaultThreshold: 5,
    minimumDataPoints: 3,
    metricKey: 'sessions', // proxy metric; 404s reduce sessions
    direction: 'drop',
  },

  UNEXPECTED_NOINDEX: {
    type: 'UNEXPECTED_NOINDEX',
    dutchLabel: 'Onverwachte noindex',
    dutchDescription:
      'Pagina\'s die geïndexeerd zouden moeten worden, bevatten een noindex-tag. Deze pagina\'s worden uit de zoekresultaten verwijderd.',
    defaultSeverity: 'CRITICAL',
    defaultThreshold: 5,
    minimumDataPoints: 3,
    metricKey: 'impressions', // proxy: noindex leads to impression drop
    direction: 'drop',
  },

  BROKEN_INTEGRATION: {
    type: 'BROKEN_INTEGRATION',
    dutchLabel: 'Koppeling verbroken',
    dutchDescription:
      'Een externe koppeling (zoals Google Search Console of Analytics) werkt niet meer. Gegevens worden mogelijk niet meer bijgewerkt.',
    defaultSeverity: 'HIGH',
    defaultThreshold: 10,
    minimumDataPoints: 3,
    metricKey: 'sessions', // proxy: broken integration = missing data
    direction: 'drop',
  },

  PUBLISHING_FAILURE: {
    type: 'PUBLISHING_FAILURE',
    dutchLabel: 'Publicatiefout',
    dutchDescription:
      'Het automatisch publiceren van inhoud is mislukt. Geplande content is niet online gezet.',
    defaultSeverity: 'HIGH',
    defaultThreshold: 5,
    minimumDataPoints: 3,
    metricKey: 'pageViews', // proxy: published content drives page views
    direction: 'drop',
  },

  CONTENT_DECAY: {
    type: 'CONTENT_DECAY',
    dutchLabel: 'Inhoudveroudering',
    dutchDescription:
      'De prestaties van je content nemen langzaam af. Dit is een natuurlijk proces dat actie vereist om zichtbaarheid te behouden.',
    defaultSeverity: 'MEDIUM',
    defaultThreshold: 10,
    minimumDataPoints: 30,
    metricKey: 'clicks',
    direction: 'drop',
  },

  COMPETITOR_CHANGE: {
    type: 'COMPETITOR_CHANGE',
    dutchLabel: 'Concurrentiewijziging',
    dutchDescription:
      'Er is een significante verandering in het concurrentielandschap gedetecteerd. Concurrenten stijgen of dalen in de zoekresultaten.',
    defaultSeverity: 'MEDIUM',
    defaultThreshold: 15,
    minimumDataPoints: 14,
    metricKey: 'averagePosition',
    direction: 'any', // competitor movement can go either way
  },

  LOST_AI_MENTION: {
    type: 'LOST_AI_MENTION',
    dutchLabel: 'AI-vermelding verloren',
    dutchDescription:
      'Je website wordt minder vaak genoemd in AI-gegenereerde antwoorden. Dit kan leiden tot minder verkeer uit AI-zoekresultaten.',
    defaultSeverity: 'LOW',
    defaultThreshold: 20,
    minimumDataPoints: 7,
    metricKey: 'sessions', // proxy: AI mentions drive sessions
    direction: 'drop',
  },

  NEGATIVE_REVIEW_TREND: {
    type: 'NEGATIVE_REVIEW_TREND',
    dutchLabel: 'Negatieve beoordelingtrend',
    dutchDescription:
      'Er is een trend van negatievere beoordelingen gedetecteerd. Dit kan invloed hebben op je online reputatie en conversies.',
    defaultSeverity: 'MEDIUM',
    defaultThreshold: 10,
    minimumDataPoints: 14,
    metricKey: 'conversionRate', // proxy: negative reviews affect conversion
    direction: 'drop',
  },

  DEPLOYMENT_REGRESSION: {
    type: 'DEPLOYMENT_REGRESSION',
    dutchLabel: 'Implementatiedegradatie',
    dutchDescription:
      'Na een recente implementatie zijn de prestaties van je website verslechterd. Controleer of de wijzigingen geen onbedoelde bijeffecten hebben.',
    defaultSeverity: 'CRITICAL',
    defaultThreshold: 15,
    minimumDataPoints: 3,
    metricKey: 'sessions', // proxy: deployment issues affect traffic
    direction: 'drop',
  },
};

/**
 * Get a single alert rule by type.
 */
export function getAlertRule(type: AlertType): AlertRule {
  const rule = ALERT_RULES[type];
  if (!rule) {
    throw new Error(`Onbekend waarschuwingstype: ${type}`);
  }
  return rule;
}

/**
 * Get all alert rule definitions as an array.
 */
export function getAllAlertRules(): AlertRule[] {
  return Object.values(ALERT_RULES);
}

/**
 * Get alert rules filtered by severity.
 */
export function getAlertRulesBySeverity(severity: string): AlertRule[] {
  return Object.values(ALERT_RULES).filter(
    (rule) => rule.defaultSeverity === severity
  );
}

/**
 * Get alert rules filtered by direction.
 */
export function getAlertRulesByDirection(
  direction: 'drop' | 'increase' | 'any'
): AlertRule[] {
  return Object.values(ALERT_RULES).filter(
    (rule) => rule.direction === direction
  );
}
