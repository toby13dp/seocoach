export type { ClientPortalAccessType as ClientPortalAccessType } from '@prisma/client';
export type { PortalAccessConfig, ClientFilteredData, ClientRestrictedField } from './types';
export { PORTAL_ACCESS_TYPES, PORTAL_ACCESS_LABELS, CLIENT_RESTRICTED_FIELDS } from './types';
export {
  hasPortalAccess,
  getClientPortalAccess,
  setPortalAccess,
  initializeDefaultPortalAccess,
  filterClientData,
  isClientRole,
  getClientNotificationPreferences,
  updateClientNotificationPreferences,
} from './portal-manager';
