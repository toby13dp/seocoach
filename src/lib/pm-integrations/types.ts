// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Project Management Integration Types — Phase 10

import type { PMIntegrationProvider, PMIntegrationStatus } from '@prisma/client';

/**
 * PM-integratieprovider labels
 */
export const PM_PROVIDER_LABELS: Record<PMIntegrationProvider, string> = {
  JIRA: 'Jira',
  TRELLO: 'Trello',
  ASANA: 'Asana',
  CLICKUP: 'ClickUp',
  MONDAY: 'Monday.com',
  LINEAR: 'Linear',
  GITHUB_ISSUES: 'GitHub Issues',
  GENERIC_WEBHOOK: 'Algemene Webhook',
};

/**
 * Alle beschikbare PM-providers
 */
export const ALL_PM_PROVIDERS: PMIntegrationProvider[] = [
  'JIRA', 'TRELLO', 'ASANA', 'CLICKUP', 'MONDAY', 'LINEAR', 'GITHUB_ISSUES', 'GENERIC_WEBHOOK',
];

/**
 * Verbindingsresultaat
 */
export interface ConnectionTestResult {
  success: boolean;
  message: string; // Nederlandse melding
  details?: Record<string, unknown>;
}

/**
 * Taakexportdata
 */
export interface TaskExportData {
  plainSummary: string;
  technicalDetail?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  evidence?: Record<string, unknown>;
  urls?: string[];
  deadline?: Date;
  owner?: string;
  sourceLink?: string;
}

/**
 * Statussyncresultaat
 */
export interface StatusSyncResult {
  success: boolean;
  externalId: string;
  externalStatus?: string;
  lastSyncAt: Date;
  errors?: string[];
}

/**
 * PM-adapterinterface — elk PM-systeem implementeert dit
 */
export interface PMAdapter {
  provider: PMIntegrationProvider;
  testConnection(config: PMAdapterConfig): Promise<ConnectionTestResult>;
  exportTask(config: PMAdapterConfig, task: TaskExportData): Promise<{ externalId: string; externalUrl: string }>;
  syncStatus(config: PMAdapterConfig, externalId: string): Promise<StatusSyncResult>;
  mapOwner(config: PMAdapterConfig, internalUserId: string): Promise<string | null>;
}

export interface PMAdapterConfig {
  apiEndpoint?: string;
  apiKey?: string;
  projectMapping?: Record<string, string>;
  ownerMapping?: Record<string, string>;
  fieldMapping?: Record<string, string>;
}
