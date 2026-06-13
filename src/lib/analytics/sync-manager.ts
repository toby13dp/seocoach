// ============================================================================
// Analytics & Monitoring — Data Sync Manager
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages data connections (GSC, GA4, CSV), sync scheduling, and
// connection lifecycle. All user-facing messages are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import type { DataConnectionConfig, SyncStatusInfo } from './types';
import {
  importSearchPerformanceCSV,
  importQueryPerformanceCSV,
  importAnalyticsCSV,
  importConversionsCSV,
  importRevenueCSV,
} from './csv-import';
import { syncGSCData, syncGA4Data, getOAuthTokens, verifyConnection } from '@/lib/google';
import { appLogger as logger } from '@/lib/observability/logger';

// ============================================================================
// Data Connection CRUD
// ============================================================================

/**
 * Create a new data connection for a project.
 *
 * @param projectId - The project ID
 * @param name - Human-readable connection name
 * @param type - Connection type (e.g. 'CSV_SEARCH_PERFORMANCE')
 * @param config - Connection configuration
 * @returns The created DataConnection record
 *
 * @example
 * ```typescript
 * const conn = await createDataConnection(
 *   'project-123',
 *   'GSC Export Januari',
 *   'CSV_SEARCH_PERFORMANCE',
 *   { fileName: 'gsc-jan-2025.csv', autoSync: false }
 * );
 * ```
 */
export async function createDataConnection(
  projectId: string,
  name: string,
  type: string,
  config: DataConnectionConfig
) {
  if (!name || name.trim().length === 0) {
    throw new Error('Verbindingsnaam mag niet leeg zijn');
  }

  if (name.trim().length > 200) {
    throw new Error('Verbindingsnaam mag maximaal 200 tekens bevatten');
  }

  const connection = await db.dataConnection.create({
    data: {
      projectId,
      name: name.trim(),
      type: type as 'GOOGLE_SEARCH_CONSOLE' | 'GOOGLE_ANALYTICS_4' | 'CSV_SEARCH_PERFORMANCE' | 'CSV_ANALYTICS' | 'CSV_CONVERSIONS' | 'CSV_REVENUE' | 'GOOGLE_BUSINESS_PROFILE',
      status: 'PENDING',
      config: JSON.stringify(config),
      syncIntervalMinutes: config.syncIntervalMinutes ?? 1440,
    },
  });

  return connection;
}

/**
 * Update an existing data connection.
 *
 * @param connectionId - The connection ID to update
 * @param updates - Partial updates to apply
 * @returns The updated DataConnection record
 */
export async function updateDataConnection(
  connectionId: string,
  updates: {
    name?: string;
    config?: DataConnectionConfig;
    status?: string;
    syncIntervalMinutes?: number;
  }
) {
  // Verify the connection exists and is not soft-deleted
  const existing = await db.dataConnection.findFirst({
    where: { id: connectionId, deletedAt: null },
  });

  if (!existing) {
    throw new Error('Gegevensverbinding niet gevonden');
  }

  const data: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    if (updates.name.trim().length === 0) {
      throw new Error('Verbindingsnaam mag niet leeg zijn');
    }
    data.name = updates.name.trim();
  }

  if (updates.config !== undefined) {
    data.config = JSON.stringify(updates.config);
  }

  if (updates.status !== undefined) {
    data.status = updates.status;
  }

  if (updates.syncIntervalMinutes !== undefined) {
    if (updates.syncIntervalMinutes < 15) {
      throw new Error(
        'Synchronisatie-interval moet minimaal 15 minuten zijn'
      );
    }
    data.syncIntervalMinutes = updates.syncIntervalMinutes;
  }

  const updated = await db.dataConnection.update({
    where: { id: connectionId },
    data,
  });

  return updated;
}

/**
 * Soft-delete a data connection.
 *
 * @param connectionId - The connection ID to delete
 */
export async function deleteDataConnection(
  connectionId: string
): Promise<void> {
  const existing = await db.dataConnection.findFirst({
    where: { id: connectionId, deletedAt: null },
  });

  if (!existing) {
    throw new Error('Gegevensverbinding niet gevonden');
  }

  await db.dataConnection.update({
    where: { id: connectionId },
    data: { deletedAt: new Date() },
  });
}

// ============================================================================
// Connection Testing
// ============================================================================

/**
 * Test if a data connection works.
 *
 * For CSV connections: validates that the file reference exists in config.
 * For GSC/GA4 connections: placeholder — returns info about manual OAuth setup.
 *
 * @param connectionId - The connection ID to test
 * @returns Object with success flag and Dutch message
 */
export async function testConnection(
  connectionId: string
): Promise<{ success: boolean; message: string }> {
  const connection = await db.dataConnection.findFirst({
    where: { id: connectionId, deletedAt: null },
  });

  if (!connection) {
    return {
      success: false,
      message: 'Gegevensverbinding niet gevonden',
    };
  }

  const config: DataConnectionConfig = connection.config
    ? JSON.parse(connection.config)
    : {};

  switch (connection.type) {
    case 'CSV_SEARCH_PERFORMANCE':
    case 'CSV_ANALYTICS':
    case 'CSV_CONVERSIONS':
    case 'CSV_REVENUE': {
      if (!config.fileName) {
        return {
          success: false,
          message:
            'Geen bestandsnaam geconfigureerd. Stel een CSV-bestand in om te importeren.',
        };
      }
      return {
        success: true,
        message: `CSV-bestand "${config.fileName}" is geconfigureerd. Gebruik "Gegevens synchroniseren" om te importeren.`,
      };
    }

    case 'GOOGLE_SEARCH_CONSOLE': {
      // Check if OAuth tokens exist
      const tokens = await getOAuthTokens(connectionId);
      if (!tokens) {
        return {
          success: false,
          message:
            'Google Search Console is nog niet gekoppeld. Koppel je Google-account via de koppelingen-pagina om OAuth-autorisatie te voltooien.',
        };
      }

      if (!config.propertyId) {
        return {
          success: false,
          message:
            'Google Search Console verbinding vereist een Property URL. Selecteer een property via de koppelingen-pagina.',
        };
      }

      // Verify the OAuth connection is still valid
      const verification = await verifyConnection(connectionId);
      if (!verification.valid) {
        return {
          success: false,
          message:
            verification.error ?? 'Google Search Console verbinding is verlopen. Koppel je Google-account opnieuw.',
        };
      }

      return {
        success: true,
        message: `Google Search Console verbinding is actief voor "${config.propertyId}". Gebruik "Gegevens synchroniseren" om gegevens op te halen.`,
      };
    }

    case 'GOOGLE_ANALYTICS_4': {
      const tokens = await getOAuthTokens(connectionId);
      if (!tokens) {
        return {
          success: false,
          message:
            'Google Analytics 4 is nog niet gekoppeld. Koppel je Google-account via de koppelingen-pagina om OAuth-autorisatie te voltooien.',
        };
      }

      if (!config.propertyId) {
        return {
          success: false,
          message:
            'Google Analytics 4 verbinding vereist een Property ID. Selecteer een property via de koppelingen-pagina.',
        };
      }

      const verification = await verifyConnection(connectionId);
      if (!verification.valid) {
        return {
          success: false,
          message:
            verification.error ?? 'Google Analytics 4 verbinding is verlopen. Koppel je Google-account opnieuw.',
        };
      }

      return {
        success: true,
        message: `Google Analytics 4 verbinding is actief voor property "${config.propertyId}". Gebruik "Gegevens synchroniseren" om gegevens op te halen.`,
      };
    }

    case 'GOOGLE_BUSINESS_PROFILE': {
      const tokens = await getOAuthTokens(connectionId);
      if (!tokens) {
        return {
          success: false,
          message:
            'Google Bedrijfsprofiel is nog niet gekoppeld. Koppel je Google-account via de koppelingen-pagina.',
        };
      }

      const verification = await verifyConnection(connectionId);
      if (!verification.valid) {
        return {
          success: false,
          message:
            verification.error ?? 'Google Bedrijfsprofiel verbinding is verlopen. Koppel je Google-account opnieuw.',
        };
      }

      return {
        success: true,
        message: 'Google Bedrijfsprofiel verbinding is actief. Gebruik "Gegevens synchroniseren" om beoordelingen en profielgegevens op te halen.',
      };
    }

    default:
      return {
        success: false,
        message: `Onbekend verbindingstype: "${connection.type}"`,
      };
  }
}

// ============================================================================
// Data Synchronization
// ============================================================================

/**
 * Trigger a data sync for a connection.
 *
 * For CSV connections: calls the appropriate import function.
 * For GSC/GA4 connections: placeholder with Dutch message.
 *
 * @param connectionId - The connection ID to sync
 * @param csvContent - Required for CSV connections: the CSV content to import
 * @returns Object with success flag, Dutch message, and import result (for CSV)
 */
export async function syncData(
  connectionId: string,
  csvContent?: string
): Promise<{
  success: boolean;
  message: string;
  result?: { imported: number; updated: number; skipped: number; errors: string[] };
}> {
  const connection = await db.dataConnection.findFirst({
    where: { id: connectionId, deletedAt: null },
  });

  if (!connection) {
    return {
      success: false,
      message: 'Gegevensverbinding niet gevonden',
    };
  }

  // Parse connection config for use in switch cases
  const config: DataConnectionConfig = connection.config
    ? JSON.parse(connection.config)
    : {};

  try {
    switch (connection.type) {
      case 'CSV_SEARCH_PERFORMANCE': {
        if (!csvContent) {
          return {
            success: false,
            message:
              'CSV-inhoud is vereist voor het importeren van zoekprestatiegegevens.',
          };
        }

        const result = await importSearchPerformanceCSV(
          connection.projectId,
          connectionId,
          csvContent
        );

        await updateSyncSuccess(connectionId, result);
        return {
          success: result.errors.length === 0,
          message:
            result.errors.length === 0
              ? `${result.imported} nieuwe en ${result.updated} bijgewerkte rijen geïmporteerd.`
              : `${result.imported} geïmporteerd, ${result.updated} bijgewerkt, ${result.errors.length} fouten.`,
          result,
        };
      }

      case 'CSV_ANALYTICS': {
        if (!csvContent) {
          return {
            success: false,
            message:
              'CSV-inhoud is vereist voor het importeren van analytische gegevens.',
          };
        }

        const result = await importAnalyticsCSV(
          connection.projectId,
          connectionId,
          csvContent
        );

        await updateSyncSuccess(connectionId, result);
        return {
          success: result.errors.length === 0,
          message:
            result.errors.length === 0
              ? `${result.imported} nieuwe en ${result.updated} bijgewerkte rijen geïmporteerd.`
              : `${result.imported} geïmporteerd, ${result.updated} bijgewerkt, ${result.errors.length} fouten.`,
          result,
        };
      }

      case 'CSV_CONVERSIONS': {
        if (!csvContent) {
          return {
            success: false,
            message:
              'CSV-inhoud is vereist voor het importeren van conversiegegevens.',
          };
        }

        const result = await importConversionsCSV(
          connection.projectId,
          connectionId,
          csvContent
        );

        await updateSyncSuccess(connectionId, result);
        return {
          success: result.errors.length === 0,
          message:
            result.errors.length === 0
              ? `${result.imported} nieuwe en ${result.updated} bijgewerkte rijen geïmporteerd.`
              : `${result.imported} geïmporteerd, ${result.updated} bijgewerkt, ${result.errors.length} fouten.`,
          result,
        };
      }

      case 'CSV_REVENUE': {
        if (!csvContent) {
          return {
            success: false,
            message:
              'CSV-inhoud is vereist voor het importeren van omzetgegevens.',
          };
        }

        const result = await importRevenueCSV(
          connection.projectId,
          connectionId,
          csvContent
        );

        await updateSyncSuccess(connectionId, result);
        return {
          success: result.errors.length === 0,
          message:
            result.errors.length === 0
              ? `${result.imported} nieuwe en ${result.updated} bijgewerkte rijen geïmporteerd.`
              : `${result.imported} geïmporteerd, ${result.updated} bijgewerkt, ${result.errors.length} fouten.`,
          result,
        };
      }

      case 'GOOGLE_SEARCH_CONSOLE': {
        // Check if OAuth tokens exist
        const gscTokens = await getOAuthTokens(connectionId);
        if (!gscTokens) {
          await updateSyncError(connectionId, 'Google Search Console is niet gekoppeld. Koppel eerst je Google-account via de koppelingen-pagina.');
          return {
            success: false,
            message: 'Google Search Console is niet gekoppeld. Koppel eerst je Google-account via de koppelingen-pagina.',
          };
        }

        if (!config.propertyId) {
          await updateSyncError(connectionId, 'Geen property URL geconfigureerd. Selecteer een GSC-property via de koppelingen-pagina.');
          return {
            success: false,
            message: 'Geen property URL geconfigureerd. Selecteer een GSC-property via de koppelingen-pagina.',
          };
        }

        // Determine date range: last sync or 90 days ago
        const gscEndDate = new Date();
        const gscStartDate = connection.lastSyncAt
          ? new Date(connection.lastSyncAt.getTime() - 24 * 60 * 60 * 1000) // overlap 1 day
          : new Date(gscEndDate.getTime() - 90 * 24 * 60 * 60 * 1000); // default: 90 days

        const gscResult = await syncGSCData(
          connectionId,
          connection.projectId,
          config.propertyId,
          gscStartDate.toISOString().split('T')[0],
          gscEndDate.toISOString().split('T')[0]
        );

        await updateSyncSuccess(connectionId, gscResult);
        return {
          success: gscResult.errors.length === 0,
          message:
            gscResult.errors.length === 0
              ? `GSC: ${gscResult.imported} nieuwe en ${gscResult.updated} bijgewerkte rijen opgehaald.`
              : `GSC: ${gscResult.imported} opgehaald, ${gscResult.updated} bijgewerkt, ${gscResult.errors.length} fouten.`,
          result: gscResult,
        };
      }

      case 'GOOGLE_ANALYTICS_4': {
        const ga4Tokens = await getOAuthTokens(connectionId);
        if (!ga4Tokens) {
          await updateSyncError(connectionId, 'Google Analytics 4 is niet gekoppeld. Koppel eerst je Google-account via de koppelingen-pagina.');
          return {
            success: false,
            message: 'Google Analytics 4 is niet gekoppeld. Koppel eerst je Google-account via de koppelingen-pagina.',
          };
        }

        if (!config.propertyId) {
          await updateSyncError(connectionId, 'Geen Property ID geconfigureerd. Selecteer een GA4-property via de koppelingen-pagina.');
          return {
            success: false,
            message: 'Geen Property ID geconfigureerd. Selecteer een GA4-property via de koppelingen-pagina.',
          };
        }

        const ga4EndDate = new Date();
        const ga4StartDate = connection.lastSyncAt
          ? new Date(connection.lastSyncAt.getTime() - 24 * 60 * 60 * 1000)
          : new Date(ga4EndDate.getTime() - 90 * 24 * 60 * 60 * 1000);

        const ga4Result = await syncGA4Data(
          connectionId,
          connection.projectId,
          config.propertyId,
          ga4StartDate.toISOString().split('T')[0],
          ga4EndDate.toISOString().split('T')[0]
        );

        await updateSyncSuccess(connectionId, ga4Result);
        return {
          success: ga4Result.errors.length === 0,
          message:
            ga4Result.errors.length === 0
              ? `GA4: ${ga4Result.imported} nieuwe en ${ga4Result.updated} bijgewerkte rijen opgehaald.`
              : `GA4: ${ga4Result.imported} opgehaald, ${ga4Result.updated} bijgewerkt, ${ga4Result.errors.length} fouten.`,
          result: ga4Result,
        };
      }

      case 'GOOGLE_BUSINESS_PROFILE': {
        const gbpTokens = await getOAuthTokens(connectionId);
        if (!gbpTokens) {
          await updateSyncError(connectionId, 'Google Bedrijfsprofiel is niet gekoppeld. Koppel eerst je Google-account via de koppelingen-pagina.');
          return {
            success: false,
            message: 'Google Bedrijfsprofiel is niet gekoppeld. Koppel eerst je Google-account via de koppelingen-pagina.',
          };
        }

        // GBP sync requires accountId and locationId from config
        const gbpConfig = config as DataConnectionConfig & { accountId?: string; locationIdGBP?: string };
        if (!gbpConfig.accountId || !gbpConfig.locationIdGBP) {
          await updateSyncError(connectionId, 'Geen GBP-account of locatie geconfigureerd. Selecteer een locatie via de koppelingen-pagina.');
          return {
            success: false,
            message: 'Geen GBP-account of locatie geconfigureerd. Selecteer een locatie via de koppelingen-pagina.',
          };
        }

        // Use the syncGBPDataToDb function from google-api
        const { syncGBPDataToDb } = await import('@/lib/google/google-api');
        const gbpResult = await syncGBPDataToDb(
          connectionId,
          gbpConfig.locationIdGBP,
          connection.projectId,
          gbpConfig.accountId,
          gbpConfig.locationIdGBP
        );

        if (gbpResult.synced) {
          await db.dataConnection.update({
            where: { id: connectionId },
            data: {
              status: 'CONNECTED',
              lastSyncAt: new Date(),
              lastSyncStatus: 'success',
              lastSyncError: null,
            },
          });
        } else {
          await updateSyncError(connectionId, gbpResult.error ?? 'GBP synchronisatie mislukt.');
        }

        return {
          success: gbpResult.synced,
          message: gbpResult.synced
            ? `GBP: ${gbpResult.reviewCount} beoordelingen gesynchroniseerd. Gemiddelde beoordeling: ${gbpResult.avgRating.toFixed(1)}.`
            : `GBP synchronisatie mislukt: ${gbpResult.error}`,
        };
      }

      default:
        return {
          success: false,
          message: `Onbekend verbindingstype: "${connection.type}"`,
        };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    await db.dataConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncStatus: 'failed',
        lastSyncError: `Synchronisatie mislukt: ${msg}`,
        lastSyncAt: new Date(),
      },
    });

    return {
      success: false,
      message: `Synchronisatie mislukt: ${msg}`,
    };
  }
}

/**
 * Update connection after a successful sync.
 */
async function updateSyncSuccess(
  connectionId: string,
  result: { imported: number; updated: number; skipped: number; errors: string[] }
): Promise<void> {
  const now = new Date();
  const connection = await db.dataConnection.findUnique({
    where: { id: connectionId },
    select: { syncIntervalMinutes: true },
  });

  const nextSyncAt = new Date(
    now.getTime() + (connection?.syncIntervalMinutes ?? 1440) * 60 * 1000
  );

  // Update data range based on actual imported data
  const dataRange = await db.dailyMetric.aggregate({
    where: { projectId: (await db.dataConnection.findUnique({ where: { id: connectionId } }))?.projectId },
    _min: { date: true },
    _max: { date: true },
  });

  await db.dataConnection.update({
    where: { id: connectionId },
    data: {
      status: 'CONNECTED',
      lastSyncAt: now,
      lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
      lastSyncError:
        result.errors.length > 0
          ? result.errors.slice(0, 5).join('; ')
          : null,
      nextSyncAt,
      dataStartDate: dataRange._min.date,
      dataEndDate: dataRange._max.date,
    },
  });
}

/**
 * Update connection when auto-sync is not supported.
 */
async function updateSyncNotSupported(
  connectionId: string
): Promise<void> {
  await db.dataConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: 'failed',
      lastSyncError:
        'Automatische synchronisatie wordt momenteel niet ondersteund voor dit verbindingstype.',
    },
  });
}

/**
 * Update connection with a specific sync error message.
 */
async function updateSyncError(
  connectionId: string,
  errorMessage: string
): Promise<void> {
  await db.dataConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: 'failed',
      lastSyncError: errorMessage,
    },
  });
}

// ============================================================================
// Sync Scheduling
// ============================================================================

/**
 * Calculate and set the next sync time for a connection.
 *
 * @param connectionId - The connection ID
 * @returns The calculated next sync time
 */
export async function scheduleNextSync(
  connectionId: string
): Promise<Date | null> {
  const connection = await db.dataConnection.findFirst({
    where: { id: connectionId, deletedAt: null },
  });

  if (!connection) {
    return null;
  }

  const config: DataConnectionConfig = connection.config
    ? JSON.parse(connection.config)
    : {};

  // Don't schedule if auto-sync is disabled
  if (config.autoSync === false) {
    return null;
  }

  const intervalMinutes = connection.syncIntervalMinutes ?? 1440;
  const lastSync = connection.lastSyncAt ?? new Date();
  const nextSync = new Date(lastSync.getTime() + intervalMinutes * 60 * 1000);

  await db.dataConnection.update({
    where: { id: connectionId },
    data: { nextSyncAt: nextSync },
  });

  return nextSync;
}

// ============================================================================
// Sync Status
// ============================================================================

/**
 * Get sync status for all data connections of a project.
 *
 * @param projectId - The project ID
 * @returns Array of SyncStatusInfo for each active connection
 */
export async function getSyncStatus(
  projectId: string
): Promise<SyncStatusInfo[]> {
  const connections = await db.dataConnection.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      lastSyncAt: true,
      lastSyncError: true,
      nextSyncAt: true,
    },
  });

  return connections.map((conn) => ({
    connectionId: conn.id,
    connectionName: conn.name,
    connectionType: conn.type,
    status: conn.status,
    lastSyncAt: conn.lastSyncAt,
    lastSyncError: conn.lastSyncError,
    nextSyncAt: conn.nextSyncAt,
  }));
}

// ============================================================================
// Query Performance Sync (Convenience)
// ============================================================================

/**
 * Import query performance CSV data through a data connection.
 *
 * This is a convenience wrapper that combines creating/updating
 * a sync and importing query-level data.
 *
 * @param projectId - The project ID
 * @param connectionId - The data connection ID
 * @param csvContent - The CSV content to import
 * @param columnOverrides - Optional column mapping overrides
 * @returns Import result with counts
 */
export async function syncQueryPerformanceCSV(
  projectId: string,
  connectionId: string,
  csvContent: string,
  columnOverrides?: Record<string, string[]>
) {
  const result = await importQueryPerformanceCSV(
    projectId,
    connectionId,
    csvContent,
    columnOverrides
  );

  // Update connection sync status
  await db.dataConnection.update({
    where: { id: connectionId },
    data: {
      status: 'CONNECTED',
      lastSyncAt: new Date(),
      lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
      lastSyncError:
        result.errors.length > 0
          ? result.errors.slice(0, 5).join('; ')
          : null,
    },
  });

  return result;
}
