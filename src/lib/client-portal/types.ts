// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Client Portal Types — Phase 10

import type { ClientPortalAccessType } from '@prisma/client';

/**
 * Toegangstypen voor het cliëntportaal
 * Access types for the client portal
 */
export const PORTAL_ACCESS_TYPES: ClientPortalAccessType[] = [
  'REPORTS',
  'KPI_SUMMARIES',
  'ROADMAP',
  'TASKS',
  'CONTENT_DRAFTS',
  'CONTENT_APPROVAL',
  'TECH_ACTION_APPROVAL',
  'COMMENTS',
  'DOCUMENTS',
  'MEETING_NOTES',
  'APPROVAL_REQUESTS',
];

/**
 * Nederlandse labels voor toegangstypen
 */
export const PORTAL_ACCESS_LABELS: Record<ClientPortalAccessType, string> = {
  REPORTS: 'Rapporten',
  KPI_SUMMARIES: 'KPI-samenvattingen',
  ROADMAP: 'Roadmap',
  TASKS: 'Taken',
  CONTENT_DRAFTS: 'Conceptcontent',
  CONTENT_APPROVAL: 'Contentgoedkeuring',
  TECH_ACTION_APPROVAL: 'Technische actiegoedkeuring',
  COMMENTS: 'Opmerkingen',
  DOCUMENTS: 'Documenten',
  MEETING_NOTES: 'Notulen',
  APPROVAL_REQUESTS: 'Goedkeuringsverzoeken',
};

/**
 * Gegevens die NOOIT zichtbaar mogen zijn voor cliënten
 * Data that must NEVER be visible to clients
 */
export const CLIENT_RESTRICTED_FIELDS = [
  'internalMargins',
  'privateAgencyNotes',
  'otherClients',
  'providerCredentials',
  'internalAiPrompts',
  'unsharedOperationalData',
  'billingNotes',
  'costRate',
  'profitability',
  'internalNotes',
] as const;

export type ClientRestrictedField = typeof CLIENT_RESTRICTED_FIELDS[number];

/**
 * Poortaaltoegang configuratie
 */
export interface PortalAccessConfig {
  clientId: string;
  grantedAccess: ClientPortalAccessType[];
  restrictions?: Record<ClientPortalAccessType, Record<string, unknown>>;
}

/**
 * Gefilterde gegevens voor cliëntweergave
 */
export interface ClientFilteredData<T> {
  data: T;
  filteredFields: string[];
  warnings: string[];
}
