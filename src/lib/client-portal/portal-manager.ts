// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Client Portal Manager — Phase 10
// Beheert cliëntportaaltoegang en gegevensfiltering

import { db } from '@/lib/db';
import type { ClientPortalAccessType } from '@prisma/client';
import { PORTAL_ACCESS_TYPES, CLIENT_RESTRICTED_FIELDS } from './types';
import type { PortalAccessConfig, ClientFilteredData } from './types';

/**
 * Controleert of een cliënt toegang heeft tot een specifiek type
 */
export async function hasPortalAccess(
  clientId: string,
  accessType: ClientPortalAccessType
): Promise<boolean> {
  const access = await db.clientPortalAccess.findFirst({
    where: {
      clientId_accessType: { clientId, accessType },
      deletedAt: null,
    },
  });
  return access?.granted ?? false;
}

/**
 * Haalt alle toegangsrechten op voor een cliënt
 */
export async function getClientPortalAccess(clientId: string): Promise<PortalAccessConfig> {
  const accessRecords = await db.clientPortalAccess.findMany({
    where: {
      clientId,
      deletedAt: null,
    },
  });

  const grantedAccess = accessRecords
    .filter(r => r.granted)
    .map(r => r.accessType);

  const restrictions: Record<string, Record<string, unknown>> = {};
  for (const record of accessRecords) {
    if (record.restrictions) {
      try {
        restrictions[record.accessType] = JSON.parse(record.restrictions);
      } catch {
        // Invalid JSON — skip
      }
    }
  }

  return { clientId, grantedAccess, restrictions };
}

/**
 * Stelt portaaltoegang in voor een cliënt
 */
export async function setPortalAccess(
  clientId: string,
  accessType: ClientPortalAccessType,
  granted: boolean,
  grantedBy: string,
  restrictions?: Record<string, unknown>
): Promise<void> {
  await db.clientPortalAccess.upsert({
    where: {
      clientId_accessType: { clientId, accessType },
    },
    create: {
      clientId,
      accessType,
      granted,
      grantedBy,
      grantedAt: new Date(),
      restrictions: restrictions ? JSON.stringify(restrictions) : null,
    },
    update: {
      granted,
      grantedBy,
      grantedAt: new Date(),
      restrictions: restrictions ? JSON.stringify(restrictions) : null,
    },
  });
}

/**
 * Initialiseert standaard portaaltoegang voor een nieuwe cliënt
 * Standaard alleen rapporten en KPI-samenvattingen
 */
export async function initializeDefaultPortalAccess(
  clientId: string,
  grantedBy: string
): Promise<void> {
  const defaultAccess: ClientPortalAccessType[] = ['REPORTS', 'KPI_SUMMARIES'];

  for (const accessType of PORTAL_ACCESS_TYPES) {
    const granted = defaultAccess.includes(accessType);
    await db.clientPortalAccess.create({
      data: {
        clientId,
        accessType,
        granted,
        grantedBy,
        grantedAt: granted ? new Date() : null,
      },
    });
  }
}

/**
 * Filtert gevoelige gegevens uit een object voordat het naar de cliënt gaat
 * Verwijdert alle velden die in CLIENT_RESTRICTED_FIELDS staan
 */
export function filterClientData<T extends Record<string, unknown>>(data: T): ClientFilteredData<Record<string, unknown>> {
  const filteredFields: string[] = [];
  const warnings: string[] = [];
  const filtered = { ...data } as Record<string, unknown>;

  for (const field of CLIENT_RESTRICTED_FIELDS) {
    if (field in filtered) {
      delete filtered[field];
      filteredFields.push(field);
    }
  }

  // Controleer op geneste gevoelige velden in JSON-stringvelden
  for (const [key, value] of Object.entries(filtered)) {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null) {
          let modified = false;
          for (const restrictedField of CLIENT_RESTRICTED_FIELDS) {
            if (restrictedField in (parsed as Record<string, unknown>)) {
              delete (parsed as Record<string, unknown>)[restrictedField];
              filteredFields.push(`${key}.${restrictedField}`);
              modified = true;
            }
          }
          if (modified) {
            filtered[key] = JSON.stringify(parsed);
          }
        }
      } catch {
        // Not JSON — skip
      }
    }
  }

  if (filteredFields.length > 0) {
    warnings.push(`${filteredFields.length} gevoelig(e) veld(en) gefilterd voor cliëntweergave`);
  }

  return { data: filtered, filteredFields, warnings };
}

/**
 * Controleert of een gebruiker een cliëntrol heeft (beperkte toegang)
 */
export function isClientRole(role: string): boolean {
  return role === 'CLIENT' || role === 'READ_ONLY';
}

/**
 * Haalt cliëntnotificatievoorkeuren op
 */
export async function getClientNotificationPreferences(clientId: string) {
  return db.clientNotificationPreference.upsert({
    where: { clientId },
    create: { clientId },
    update: {},
  });
}

/**
 * Werkt cliëntnotificatievoorkeuren bij
 */
export async function updateClientNotificationPreferences(
  clientId: string,
  preferences: {
    emailEnabled?: boolean;
    portalEnabled?: boolean;
    reportPublished?: boolean;
    contentApproval?: boolean;
    taskAssigned?: boolean;
    commentAdded?: boolean;
    slaWarning?: boolean;
    digestFrequency?: string;
  }
) {
  return db.clientNotificationPreference.upsert({
    where: { clientId },
    create: { clientId, ...preferences },
    update: preferences,
  });
}
