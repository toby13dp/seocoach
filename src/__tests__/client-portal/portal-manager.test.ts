/**
 * Client Portal Manager Tests
 * Tests for /src/lib/client-portal/portal-manager.ts
 */

import { describe, test, expect } from 'bun:test';
import {
  hasPortalAccess,
  filterClientData,
  isClientRole,
  initializeDefaultPortalAccess,
  getClientPortalAccess,
  setPortalAccess,
} from '@/lib/client-portal/portal-manager';
import { PORTAL_ACCESS_TYPES, CLIENT_RESTRICTED_FIELDS } from '@/lib/client-portal/types';

// ============================================================================
// isClientRole
// ============================================================================

describe('isClientRole — role detection', () => {
  test('CLIENT role is detected as client role', () => {
    expect(isClientRole('CLIENT')).toBe(true);
  });

  test('READ_ONLY role is detected as client role', () => {
    expect(isClientRole('READ_ONLY')).toBe(true);
  });

  test('ORG_OWNER is not a client role', () => {
    expect(isClientRole('ORG_OWNER')).toBe(false);
  });

  test('AGENCY_OWNER is not a client role', () => {
    expect(isClientRole('AGENCY_OWNER')).toBe(false);
  });

  test('SEO_MANAGER is not a client role', () => {
    expect(isClientRole('SEO_MANAGER')).toBe(false);
  });

  test('DEVELOPER is not a client role', () => {
    expect(isClientRole('DEVELOPER')).toBe(false);
  });
});

// ============================================================================
// filterClientData — removes restricted fields
// ============================================================================

describe('filterClientData — removes restricted fields from objects', () => {
  test('removes billingNotes field', () => {
    const data = { id: '1', name: 'Test', billingNotes: 'Confidential' };
    const result = filterClientData(data);
    expect(result.data).not.toHaveProperty('billingNotes');
    expect(result.data).toHaveProperty('name', 'Test');
    expect(result.filteredFields).toContain('billingNotes');
  });

  test('removes costRate field', () => {
    const data = { id: '1', costRate: 75 };
    const result = filterClientData(data);
    expect(result.data).not.toHaveProperty('costRate');
    expect(result.filteredFields).toContain('costRate');
  });

  test('removes profitability field', () => {
    const data = { id: '1', profitability: 0.35 };
    const result = filterClientData(data);
    expect(result.data).not.toHaveProperty('profitability');
    expect(result.filteredFields).toContain('profitability');
  });

  test('removes internalMargins field', () => {
    const data = { id: '1', internalMargins: 0.4 };
    const result = filterClientData(data);
    expect(result.data).not.toHaveProperty('internalMargins');
  });

  test('removes privateAgencyNotes field', () => {
    const data = { id: '1', privateAgencyNotes: 'Secret notes' };
    const result = filterClientData(data);
    expect(result.data).not.toHaveProperty('privateAgencyNotes');
  });

  test('removes providerCredentials field', () => {
    const data = { id: '1', providerCredentials: 'api-key-123' };
    const result = filterClientData(data);
    expect(result.data).not.toHaveProperty('providerCredentials');
  });

  test('removes internalAiPrompts field', () => {
    const data = { id: '1', internalAiPrompts: 'system prompt' };
    const result = filterClientData(data);
    expect(result.data).not.toHaveProperty('internalAiPrompts');
  });

  test('removes internalNotes field', () => {
    const data = { id: '1', internalNotes: 'Internal note' };
    const result = filterClientData(data);
    expect(result.data).not.toHaveProperty('internalNotes');
  });

  test('removes all restricted fields at once', () => {
    const data = {
      id: '1',
      name: 'Test',
      billingNotes: 'Confidential',
      costRate: 75,
      profitability: 0.35,
      internalMargins: 0.4,
      privateAgencyNotes: 'Secret',
      providerCredentials: 'key',
      internalAiPrompts: 'prompt',
      unsharedOperationalData: 'data',
      internalNotes: 'note',
      otherClients: 'client list',
    };
    const result = filterClientData(data);
    expect(result.filteredFields.length).toBe(10);
    expect(result.data).toHaveProperty('name', 'Test');
    expect(result.data).toHaveProperty('id', '1');
  });

  test('generates warning when fields are filtered', () => {
    const data = { id: '1', billingNotes: 'Secret' };
    const result = filterClientData(data);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('gevoelig');
  });

  test('no warning when no fields filtered', () => {
    const data = { id: '1', name: 'Test' };
    const result = filterClientData(data);
    expect(result.warnings.length).toBe(0);
    expect(result.filteredFields.length).toBe(0);
  });

  test('filters restricted fields inside JSON strings', () => {
    const data = {
      id: '1',
      settings: JSON.stringify({ theme: 'dark', billingNotes: 'hidden', nested: { costRate: 100 } }),
    };
    const result = filterClientData(data);
    const parsed = JSON.parse(result.data.settings as string);
    expect(parsed).not.toHaveProperty('billingNotes');
    expect(parsed).toHaveProperty('theme', 'dark');
  });

  test('leaves non-JSON strings untouched', () => {
    const data = { id: '1', description: 'Dit is een normale beschrijving' };
    const result = filterClientData(data);
    expect(result.data).toHaveProperty('description', 'Dit is een normale beschrijving');
  });
});

// ============================================================================
// PORTAL_ACCESS_TYPES — completeness check
// ============================================================================

describe('PORTAL_ACCESS_TYPES — all access types defined', () => {
  test('contains all 11 access types', () => {
    expect(PORTAL_ACCESS_TYPES.length).toBe(11);
  });

  test('contains REPORTS', () => {
    expect(PORTAL_ACCESS_TYPES).toContain('REPORTS');
  });

  test('contains KPI_SUMMARIES', () => {
    expect(PORTAL_ACCESS_TYPES).toContain('KPI_SUMMARIES');
  });

  test('contains CONTENT_APPROVAL', () => {
    expect(PORTAL_ACCESS_TYPES).toContain('CONTENT_APPROVAL');
  });

  test('contains APPROVAL_REQUESTS', () => {
    expect(PORTAL_ACCESS_TYPES).toContain('APPROVAL_REQUESTS');
  });

  test('contains MEETING_NOTES', () => {
    expect(PORTAL_ACCESS_TYPES).toContain('MEETING_NOTES');
  });
});

// ============================================================================
// CLIENT_RESTRICTED_FIELDS — completeness
// ============================================================================

describe('CLIENT_RESTRICTED_FIELDS — all restricted fields defined', () => {
  test('contains exactly 10 restricted fields', () => {
    expect(CLIENT_RESTRICTED_FIELDS.length).toBe(10);
  });

  test('includes internalMargins', () => {
    expect(CLIENT_RESTRICTED_FIELDS).toContain('internalMargins');
  });

  test('includes privateAgencyNotes', () => {
    expect(CLIENT_RESTRICTED_FIELDS).toContain('privateAgencyNotes');
  });

  test('includes otherClients', () => {
    expect(CLIENT_RESTRICTED_FIELDS).toContain('otherClients');
  });

  test('includes providerCredentials', () => {
    expect(CLIENT_RESTRICTED_FIELDS).toContain('providerCredentials');
  });

  test('includes internalAiPrompts', () => {
    expect(CLIENT_RESTRICTED_FIELDS).toContain('internalAiPrompts');
  });

  test('includes unsharedOperationalData', () => {
    expect(CLIENT_RESTRICTED_FIELDS).toContain('unsharedOperationalData');
  });

  test('includes billingNotes', () => {
    expect(CLIENT_RESTRICTED_FIELDS).toContain('billingNotes');
  });

  test('includes costRate', () => {
    expect(CLIENT_RESTRICTED_FIELDS).toContain('costRate');
  });

  test('includes profitability', () => {
    expect(CLIENT_RESTRICTED_FIELDS).toContain('profitability');
  });

  test('includes internalNotes', () => {
    expect(CLIENT_RESTRICTED_FIELDS).toContain('internalNotes');
  });
});
