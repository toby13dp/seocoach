// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// PM Integration Manager — Phase 10
// Beheert verbindingen met externe projectmanagementtools

import { db } from '@/lib/db';
import type { PMIntegrationProvider } from '@prisma/client';
import type { ConnectionTestResult, TaskExportData, PMAdapter, PMAdapterConfig } from './types';
import { createJiraAdapter } from './adapters/jira';
import { createTrelloAdapter } from './adapters/trello';
import { createAsanaAdapter } from './adapters/asana';
import { createGenericWebhookAdapter } from './adapters/generic-webhook';

// ============================================================================
// Adapter Registry
// ============================================================================

const adapters: Map<PMIntegrationProvider, PMAdapter> = new Map();

function registerAdapter(adapter: PMAdapter): void {
  adapters.set(adapter.provider, adapter);
}

// Registreer beschikbare adapters
registerAdapter(createJiraAdapter());
registerAdapter(createTrelloAdapter());
registerAdapter(createAsanaAdapter());
registerAdapter(createGenericWebhookAdapter());

// Stub-adapters voor providers zonder volledige implementatie
const STUB_PROVIDERS: PMIntegrationProvider[] = ['CLICKUP', 'MONDAY', 'LINEAR', 'GITHUB_ISSUES'];
for (const provider of STUB_PROVIDERS) {
  registerAdapter(createStubAdapter(provider));
}

function createStubAdapter(provider: PMIntegrationProvider): PMAdapter {
  return {
    provider,
    async testConnection(): Promise<ConnectionTestResult> {
      return {
        success: false,
        message: `${provider}-adapter is nog niet volledig geïmplementeerd. Gebruik de algemene webhook-adapter als tijdelijke oplossing.`,
      };
    },
    async exportTask(): Promise<{ externalId: string; externalUrl: string }> {
      throw new Error(`${provider}-adapter is nog niet geïmplementeerd`);
    },
    async syncStatus(): Promise<{ success: boolean; externalId: string; externalStatus?: string; lastSyncAt: Date; errors?: string[] }> {
      throw new Error(`${provider}-adapter is nog niet geïmplementeerd`);
    },
    async mapOwner(): Promise<string | null> {
      return null;
    },
  };
}

// ============================================================================
// Integration CRUD
// ============================================================================

/**
 * Maakt een nieuwe PM-integratie aan
 */
export async function createPMIntegration(data: {
  organizationId: string;
  projectId?: string;
  provider: PMIntegrationProvider;
  apiEndpoint?: string;
  apiKeyEncrypted?: string;
  projectMapping?: Record<string, string>;
  ownerMapping?: Record<string, string>;
  fieldMapping?: Record<string, string>;
}) {
  return db.pMIntegration.create({
    data: {
      organizationId: data.organizationId,
      projectId: data.projectId,
      provider: data.provider,
      apiEndpoint: data.apiEndpoint,
      apiKeyEncrypted: data.apiKeyEncrypted,
      projectMapping: data.projectMapping ? JSON.stringify(data.projectMapping) : null,
      ownerMapping: data.ownerMapping ? JSON.stringify(data.ownerMapping) : null,
      fieldMapping: data.fieldMapping ? JSON.stringify(data.fieldMapping) : null,
      status: 'DISCONNECTED',
    },
  });
}

/**
 * Test de verbinding met een PM-systeem
 */
export async function testPMConnection(integrationId: string): Promise<ConnectionTestResult> {
  const integration = await db.pMIntegration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    return { success: false, message: 'Integratie niet gevonden' };
  }

  const adapter = adapters.get(integration.provider);
  if (!adapter) {
    return { success: false, message: `Geen adapter beschikbaar voor ${integration.provider}` };
  }

  const config = buildAdapterConfig(integration);
  const result = await adapter.testConnection(config);

  // Update integratiestatus
  await db.pMIntegration.update({
    where: { id: integrationId },
    data: {
      status: result.success ? 'CONNECTED' : 'ERROR',
      lastSyncAt: result.success ? new Date() : null,
      syncErrors: result.success ? null : JSON.stringify([{ message: result.message, timestamp: new Date().toISOString() }]),
    },
  });

  return result;
}

/**
 * Exporteert een SEO-taak naar een PM-systeem
 */
export async function exportTaskToPM(
  integrationId: string,
  task: TaskExportData,
  taskId?: string,
  taskType: string = 'action_item'
) {
  const integration = await db.pMIntegration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw new Error('Integratie niet gevonden');
  }

  if (integration.status !== 'CONNECTED') {
    throw new Error('Integratie is niet verbonden. Test de verbinding eerst.');
  }

  const adapter = adapters.get(integration.provider);
  if (!adapter) {
    throw new Error(`Geen adapter beschikbaar voor ${integration.provider}`);
  }

  const config = buildAdapterConfig(integration);

  // Kaart eigenaar toe als er een mapping is
  let owner = task.owner;
  if (owner && config.ownerMapping) {
    const mappedOwner = await adapter.mapOwner(config, owner);
    if (mappedOwner) owner = mappedOwner;
  }

  const updatedTask = { ...task, owner };

  // Exporteer de taak
  const result = await adapter.exportTask(config, updatedTask);

  // Sla de export op
  await db.pMTaskExport.create({
    data: {
      integrationId,
      taskId,
      taskType,
      externalId: result.externalId,
      externalUrl: result.externalUrl,
      plainSummary: task.plainSummary,
      technicalDetail: task.technicalDetail,
      priority: task.priority,
      evidence: task.evidence ? JSON.stringify(task.evidence) : null,
      urls: task.urls ? JSON.stringify(task.urls) : null,
      deadline: task.deadline,
      owner: task.owner,
      sourceLink: task.sourceLink,
      exportStatus: 'exported',
      lastSyncAt: new Date(),
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      organizationId: integration.organizationId,
      userId: owner ?? 'system',
      action: 'PM_TASK_EXPORTED',
      entity: 'pm_task_export',
      entityId: result.externalId,
      changes: JSON.stringify({ provider: integration.provider, taskId, externalId: result.externalId }),
    },
  });

  return result;
}

/**
 * Synchroniseert de status van een geëxporteerde taak
 */
export async function syncTaskStatus(exportId: string) {
  const exportRecord = await db.pMTaskExport.findUnique({
    where: { id: exportId },
    include: { integration: true },
  });

  if (!exportRecord || !exportRecord.externalId) {
    throw new Error('Exportrecord niet gevonden of geen extern ID');
  }

  const adapter = adapters.get(exportRecord.integration.provider);
  if (!adapter) {
    throw new Error(`Geen adapter beschikbaar voor ${exportRecord.integration.provider}`);
  }

  const config = buildAdapterConfig(exportRecord.integration);

  try {
    const result = await adapter.syncStatus(config, exportRecord.externalId);

    await db.pMTaskExport.update({
      where: { id: exportId },
      data: {
        exportStatus: result.success ? 'synced' : 'error',
        lastSyncAt: result.lastSyncAt,
        syncError: result.errors?.join('; ') ?? null,
      },
    });

    return result;
  } catch (error) {
    await db.pMTaskExport.update({
      where: { id: exportId },
      data: {
        exportStatus: 'error',
        syncError: error instanceof Error ? error.message : 'Onbekende fout',
      },
    });
    throw error;
  }
}

/**
 * Bouwt de adapterconfiguratie op uit een integratierecord
 */
function buildAdapterConfig(integration: {
  apiEndpoint: string | null;
  apiKeyEncrypted: string | null;
  projectMapping: string | null;
  ownerMapping: string | null;
  fieldMapping: string | null;
}): PMAdapterConfig {
  let projectMapping: Record<string, string> | undefined;
  let ownerMapping: Record<string, string> | undefined;
  let fieldMapping: Record<string, string> | undefined;

  try {
    if (integration.projectMapping) projectMapping = JSON.parse(integration.projectMapping);
  } catch { /* invalid JSON */ }
  try {
    if (integration.ownerMapping) ownerMapping = JSON.parse(integration.ownerMapping);
  } catch { /* invalid JSON */ }
  try {
    if (integration.fieldMapping) fieldMapping = JSON.parse(integration.fieldMapping);
  } catch { /* invalid JSON */ }

  return {
    apiEndpoint: integration.apiEndpoint ?? undefined,
    apiKey: integration.apiKeyEncrypted ?? undefined,
    projectMapping,
    ownerMapping,
    fieldMapping,
  };
}

/**
 * Haalt alle integraties op voor een organisatie
 */
export async function getOrganizationIntegrations(organizationId: string) {
  return db.pMIntegration.findMany({
    where: { organizationId, deletedAt: null },
    include: { project: { select: { id: true, name: true } } },
  });
}

/**
 * Verwijdert een integratie (soft delete)
 */
export async function deletePMIntegration(integrationId: string) {
  return db.pMIntegration.update({
    where: { id: integrationId },
    data: { deletedAt: new Date() },
  });
}
