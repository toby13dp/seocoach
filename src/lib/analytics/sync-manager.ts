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
      if (!config.propertyId) {
        return {
          success: false,
          message:
            'Google Search Console verbinding vereist een Property ID. Configureer dit via de OAuth-instellingen.',
        };
      }
      return {
        success: false,
        message:
          'Google Search Console OAuth-integratie moet handmatig worden ingesteld. Volg de instructies in de documentatie om de verbinding te autoriseren.',
      };
    }

    case 'GOOGLE_ANALYTICS_4': {
      if (!config.propertyId) {
        return {
          success: false,
          message:
            'Google Analytics 4 verbinding vereist een Property ID. Configureer dit via de OAuth-instellingen.',
        };
      }
      return {
        success: false,
        message:
          'Google Analytics 4 OAuth-integratie moet handmatig worden ingesteld. Volg de instructies in de documentatie om de verbinding te autoriseren.',
      };
    }

    case 'GOOGLE_BUSINESS_PROFILE': {
      return {
        success: false,
        message:
          'Google Business Profile integratie moet handmatig worden ingesteld. Volg de instructies in de documentatie.',
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
        await updateSyncNotSupported(connectionId);
        return {
          success: false,
          message:
            'Automatische synchronisatie met Google Search Console is nog niet beschikbaar. Importeer je GSC-gegevens handmatig via een CSV-export.',
        };
      }

      case 'GOOGLE_ANALYTICS_4': {
        await updateSyncNotSupported(connectionId);
        return {
          success: false,
          message:
            'Automatische synchronisatie met Google Analytics 4 is nog niet beschikbaar. Importeer je GA4-gegevens handmatig via een CSV-export.',
        };
      }

      case 'GOOGLE_BUSINESS_PROFILE': {
        await updateSyncNotSupported(connectionId);
        return {
          success: false,
          message:
            'Automatische synchronisatie met Google Business Profile is nog niet beschikbaar.',
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
