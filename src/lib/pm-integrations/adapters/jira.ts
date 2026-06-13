// SEOCoach: Jira Adapter — Phase 10
// Stub-adapter voor Jira-integratie

import type { PMIntegrationProvider } from '@prisma/client';
import type { PMAdapter, PMAdapterConfig, ConnectionTestResult, TaskExportData, StatusSyncResult } from '../types';

export function createJiraAdapter(): PMAdapter {
  return {
    provider: 'JIRA' as PMIntegrationProvider,

    async testConnection(config: PMAdapterConfig): Promise<ConnectionTestResult> {
      if (!config.apiEndpoint || !config.apiKey) {
        return {
          success: false,
          message: 'Jira API-eindpunt en API-sleutel zijn vereist',
        };
      }

      try {
        const response = await fetch(`${config.apiEndpoint}/rest/api/3/myself`, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          return { success: true, message: 'Verbinding met Jira succesvol' };
        }
        return {
          success: false,
          message: `Jira-verbinding mislukt: ${response.status} ${response.statusText}`,
        };
      } catch (error) {
        return {
          success: false,
          message: `Kan geen verbinding maken met Jira: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
        };
      }
    },

    async exportTask(config: PMAdapterConfig, task: TaskExportData) {
      const projectKey = config.projectMapping?.externalProjectKey ?? 'SEO';
      const priorityMap: Record<string, string> = {
        low: '3', medium: '2', high: '1', critical: '1',
      };

      const response = await fetch(`${config.apiEndpoint}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            project: { key: projectKey },
            summary: task.plainSummary,
            description: {
              type: 'doc',
              version: 1,
              content: [{
                type: 'paragraph',
                content: [{
                  type: 'text',
                  text: task.technicalDetail ?? task.plainSummary,
                }],
              }],
            },
            priority: { id: priorityMap[task.priority] ?? '3' },
            issuetype: { name: 'Task' },
            ...(task.deadline ? { duedate: task.deadline.toISOString().split('T')[0] } : {}),
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Jira taak aanmaken mislukt: ${response.status}`);
      }

      const data = await response.json();
      return {
        externalId: data.key,
        externalUrl: `${config.apiEndpoint}/browse/${data.key}`,
      };
    },

    async syncStatus(config: PMAdapterConfig, externalId: string): Promise<StatusSyncResult> {
      const response = await fetch(`${config.apiEndpoint}/rest/api/3/issue/${externalId}?fields=status`, {
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
          errors: [`Jira status ophalen mislukt: ${response.status}`],
        };
      }

      const data = await response.json();
      return {
        success: true,
        externalId,
        externalStatus: data.fields?.status?.name,
        lastSyncAt: new Date(),
      };
    },

    async mapOwner(config: PMAdapterConfig, internalUserId: string): Promise<string | null> {
      return config.ownerMapping?.[internalUserId] ?? null;
    },
  };
}
