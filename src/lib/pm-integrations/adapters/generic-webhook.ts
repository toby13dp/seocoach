// SEOCoach: Generic Webhook Adapter — Phase 10
// Adapter voor algemene webhook-integratie

import type { PMIntegrationProvider } from '@prisma/client';
import type { PMAdapter, PMAdapterConfig, ConnectionTestResult, TaskExportData, StatusSyncResult } from '../types';

export function createGenericWebhookAdapter(): PMAdapter {
  return {
    provider: 'GENERIC_WEBHOOK' as PMIntegrationProvider,

    async testConnection(config: PMAdapterConfig): Promise<ConnectionTestResult> {
      if (!config.apiEndpoint) {
        return {
          success: false,
          message: 'Webhook-URL is vereist',
        };
      }

      try {
        // Stuur een test-ping naar de webhook
        const response = await fetch(config.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SEOCoach-Event': 'connection_test',
          },
          body: JSON.stringify({
            event: 'connection_test',
            timestamp: new Date().toISOString(),
            source: 'SEOCoach',
          }),
          signal: AbortSignal.timeout(10000),
        });

        // Veel webhooks retourneren 2xx, sommige altijd 200
        if (response.ok || response.status === 200 || response.status === 201 || response.status === 204) {
          return { success: true, message: 'Webhook-verbinding succesvol' };
        }
        return {
          success: false,
          message: `Webhook-test mislukt: ${response.status} ${response.statusText}`,
        };
      } catch (error) {
        return {
          success: false,
          message: `Kan geen verbinding maken met webhook: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
        };
      }
    },

    async exportTask(config: PMAdapterConfig, task: TaskExportData) {
      if (!config.apiEndpoint) {
        throw new Error('Webhook-URL is vereist');
      }

      const payload = {
        event: 'task_created',
        timestamp: new Date().toISOString(),
        source: 'SEOCoach',
        data: {
          summary: task.plainSummary,
          technicalDetail: task.technicalDetail,
          priority: task.priority,
          evidence: task.evidence,
          urls: task.urls,
          deadline: task.deadline?.toISOString() ?? null,
          owner: task.owner,
          sourceLink: task.sourceLink,
        },
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-SEOCoach-Event': 'task_created',
      };
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Webhook taak exporteren mislukt: ${response.status}`);
      }

      // Probeer extern ID uit antwoord te halen
      let externalId = `webhook-${Date.now()}`;
      let externalUrl = config.apiEndpoint;
      try {
        const data = await response.json();
        externalId = data.id ?? data.externalId ?? externalId;
        externalUrl = data.url ?? data.externalUrl ?? externalUrl;
      } catch {
        // Geen JSON-antwoord — gebruik gegenereerd ID
      }

      return { externalId, externalUrl };
    },

    async syncStatus(config: PMAdapterConfig, externalId: string): Promise<StatusSyncResult> {
      // Webhooks zijn eenrichtingsverkeer — geen statussync mogelijk
      return {
        success: false,
        externalId,
        lastSyncAt: new Date(),
        errors: ['Webhook-adapter ondersteunt geen statussync (eenrichtingsverkeer)'],
      };
    },

    async mapOwner(config: PMAdapterConfig, internalUserId: string): Promise<string | null> {
      return config.ownerMapping?.[internalUserId] ?? null;
    },
  };
}
