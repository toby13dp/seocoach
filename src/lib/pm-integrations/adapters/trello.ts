// SEOCoach: Trello Adapter — Phase 10
// Adapter voor Trello-integratie

import type { PMIntegrationProvider } from '@prisma/client';
import type { PMAdapter, PMAdapterConfig, ConnectionTestResult, TaskExportData, StatusSyncResult } from '../types';

export function createTrelloAdapter(): PMAdapter {
  return {
    provider: 'TRELLO' as PMIntegrationProvider,

    async testConnection(config: PMAdapterConfig): Promise<ConnectionTestResult> {
      if (!config.apiKey || !config.apiEndpoint) {
        return {
          success: false,
          message: 'Trello API-sleutel en bord-ID zijn vereist',
        };
      }

      try {
        // Trello gebruikt API-sleutel + token in query-params
        const response = await fetch(
          `${config.apiEndpoint}/1/members/me?key=${config.apiKey}&token=${config.apiKey}`,
          { signal: AbortSignal.timeout(10000) }
        );

        if (response.ok) {
          return { success: true, message: 'Verbinding met Trello succesvol' };
        }
        return {
          success: false,
          message: `Trello-verbinding mislukt: ${response.status}`,
        };
      } catch (error) {
        return {
          success: false,
          message: `Kan geen verbinding maken met Trello: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
        };
      }
    },

    async exportTask(config: PMAdapterConfig, task: TaskExportData) {
      const listId = config.projectMapping?.defaultListId ?? 'incoming';
      const priorityLabels: Record<string, string> = {
        low: config.fieldMapping?.lowLabel ?? 'green',
        medium: config.fieldMapping?.mediumLabel ?? 'yellow',
        high: config.fieldMapping?.highLabel ?? 'orange',
        critical: config.fieldMapping?.criticalLabel ?? 'red',
      };

      const response = await fetch(`${config.apiEndpoint}/1/cards?key=${config.apiKey}&token=${config.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idList: listId,
          name: task.plainSummary,
          desc: task.technicalDetail ?? '',
          due: task.deadline?.toISOString() ?? null,
          labels: [priorityLabels[task.priority] ?? 'yellow'],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Trello kaart aanmaken mislukt: ${response.status}`);
      }

      const data = await response.json();
      return {
        externalId: data.id,
        externalUrl: data.url ?? `${config.apiEndpoint}/c/${data.id}`,
      };
    },

    async syncStatus(config: PMAdapterConfig, externalId: string): Promise<StatusSyncResult> {
      const response = await fetch(
        `${config.apiEndpoint}/1/cards/${externalId}?key=${config.apiKey}&token=${config.apiKey}&fields=status,dueComplete`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) {
        return {
          success: false,
          externalId,
          lastSyncAt: new Date(),
          errors: [`Trello status ophalen mislukt: ${response.status}`],
        };
      }

      const data = await response.json();
      return {
        success: true,
        externalId,
        externalStatus: data.dueComplete ? 'voltooid' : 'open',
        lastSyncAt: new Date(),
      };
    },

    async mapOwner(config: PMAdapterConfig, internalUserId: string): Promise<string | null> {
      return config.ownerMapping?.[internalUserId] ?? null;
    },
  };
}
