// SEOCoach: Asana Adapter — Phase 10
// Adapter voor Asana-integratie

import type { PMIntegrationProvider } from '@prisma/client';
import type { PMAdapter, PMAdapterConfig, ConnectionTestResult, TaskExportData, StatusSyncResult } from '../types';

export function createAsanaAdapter(): PMAdapter {
  return {
    provider: 'ASANA' as PMIntegrationProvider,

    async testConnection(config: PMAdapterConfig): Promise<ConnectionTestResult> {
      if (!config.apiKey) {
        return {
          success: false,
          message: 'Asana persoonlijke toegangstoken is vereist',
        };
      }

      try {
        const response = await fetch('https://app.asana.com/api/1.0/users/me', {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          return { success: true, message: 'Verbinding met Asana succesvol' };
        }
        return {
          success: false,
          message: `Asana-verbinding mislukt: ${response.status}`,
        };
      } catch (error) {
        return {
          success: false,
          message: `Kan geen verbinding maken met Asana: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
        };
      }
    },

    async exportTask(config: PMAdapterConfig, task: TaskExportData) {
      const projectId = config.projectMapping?.asanaProjectId ?? config.projectMapping?.externalProjectId;

      const response = await fetch('https://app.asana.com/api/1.0/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            name: task.plainSummary,
            notes: task.technicalDetail ?? '',
            projects: projectId ? [projectId] : undefined,
            due_on: task.deadline?.toISOString().split('T')[0] ?? null,
            assignee: task.owner ?? null,
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Asana taak aanmaken mislukt: ${response.status}`);
      }

      const data = await response.json();
      return {
        externalId: data.data.gid,
        externalUrl: `https://app.asana.com/0/${projectId ?? ''}/${data.data.gid}`,
      };
    },

    async syncStatus(config: PMAdapterConfig, externalId: string): Promise<StatusSyncResult> {
      const response = await fetch(`https://app.asana.com/api/1.0/tasks/${externalId}?fields=completed,name`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {
          success: false,
          externalId,
          lastSyncAt: new Date(),
          errors: [`Asana status ophalen mislukt: ${response.status}`],
        };
      }

      const data = await response.json();
      return {
        success: true,
        externalId,
        externalStatus: data.data?.completed ? 'voltooid' : 'open',
        lastSyncAt: new Date(),
      };
    },

    async mapOwner(config: PMAdapterConfig, internalUserId: string): Promise<string | null> {
      return config.ownerMapping?.[internalUserId] ?? null;
    },
  };
}
