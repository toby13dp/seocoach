/**
 * Migration Manager Tests
 * Tests for /src/lib/migration/migration-manager.ts
 */

import { describe, test, expect } from 'bun:test';
import { validateRedirect, MIGRATION_CHECK_STATUS_LABELS, MIGRATION_PROJECT_STATUS_LABELS } from '@/lib/migration/migration-manager';

// ============================================================================
// validateRedirect
// ============================================================================

describe('validateRedirect — redirect validation', () => {
  test('301 redirect is valid', () => {
    const result = validateRedirect('https://old.example.com/page', 'https://new.example.com/page', 301);
    expect(result.isValid).toBe(true);
  });

  test('302 redirect is valid but warns about SEO', () => {
    const result = validateRedirect('https://old.example.com/page', 'https://new.example.com/page', 302);
    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Tijdelijke redirect');
  });

  test('307 redirect warns about passing link value', () => {
    const result = validateRedirect('https://old.example.com/page', 'https://new.example.com/page', 307);
    expect(result.isValid).toBe(true);
    expect(result.warnings.some(w => w.includes('linkwaarde'))).toBe(true);
  });

  test('308 redirect is valid', () => {
    const result = validateRedirect('https://old.example.com/page', 'https://new.example.com/page', 308);
    expect(result.isValid).toBe(true);
  });

  test('invalid redirect type is rejected', () => {
    const result = validateRedirect('https://old.example.com/page', 'https://new.example.com/page', 303);
    expect(result.isValid).toBe(false);
    expect(result.warnings[0]).toContain('Ongeldig redirect-type');
  });

  test('same URL warns about no redirect needed', () => {
    const result = validateRedirect('https://example.com/page', 'https://example.com/page', 301);
    expect(result.warnings.some(w => w.includes('identiek'))).toBe(true);
  });

  test('invalid target URL format is rejected', () => {
    const result = validateRedirect('https://old.example.com/page', 'not-a-valid-url', 301);
    expect(result.isValid).toBe(false);
    expect(result.warnings[0]).toContain('Ongeldig doel-URL');
  });

  test('valid URL with different paths passes', () => {
    const result = validateRedirect('https://example.com/old-page', 'https://example.com/new-page', 301);
    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBe(0);
  });
});

// ============================================================================
// Dutch Labels
// ============================================================================

describe('MIGRATION_CHECK_STATUS_LABELS — Dutch status labels', () => {
  test('NOC_TE_CONTROLEREN is in Dutch', () => {
    expect(MIGRATION_CHECK_STATUS_LABELS.NOG_TE_CONTROLEREN).toBe('Nog te controleren');
  });

  test('KLAAR is in Dutch', () => {
    expect(MIGRATION_CHECK_STATUS_LABELS.KLAAR).toBe('Klaar');
  });

  test('PROBLEEM_GEVONDEN is in Dutch', () => {
    expect(MIGRATION_CHECK_STATUS_LABELS.PROBLEEM_GEVONDEN).toBe('Probleem gevonden');
  });

  test('BLOKKEERT_LANCERING is in Dutch', () => {
    expect(MIGRATION_CHECK_STATUS_LABELS.BLOKKEERT_LANCERING).toBe('Blokkeert lancering');
  });

  test('GOEDGEKEURD is in Dutch', () => {
    expect(MIGRATION_CHECK_STATUS_LABELS.GOEDGEKEURD).toBe('Goedgekeurd');
  });

  test('all 5 statuses have labels', () => {
    expect(Object.keys(MIGRATION_CHECK_STATUS_LABELS).length).toBe(5);
  });
});

describe('MIGRATION_PROJECT_STATUS_LABELS — Dutch project status labels', () => {
  test('PLANNING is Dutch', () => {
    expect(MIGRATION_PROJECT_STATUS_LABELS.PLANNING).toBe('Planning');
  });

  test('CRAWLING_OLD is in Dutch', () => {
    expect(MIGRATION_PROJECT_STATUS_LABELS.CRAWLING_OLD).toBe('Oude site crawlen');
  });

  test('PRE_LAUNCH is in Dutch', () => {
    expect(MIGRATION_PROJECT_STATUS_LABELS.PRE_LAUNCH).toBe('Pre-launch controle');
  });

  test('LIVE is in Dutch', () => {
    expect(MIGRATION_PROJECT_STATUS_LABELS.LIVE).toBe('Live');
  });

  test('COMPLETED is in Dutch', () => {
    expect(MIGRATION_PROJECT_STATUS_LABELS.COMPLETED).toBe('Voltooid');
  });

  test('all 8 statuses have labels', () => {
    expect(Object.keys(MIGRATION_PROJECT_STATUS_LABELS).length).toBe(8);
  });
});
