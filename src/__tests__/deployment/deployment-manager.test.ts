/**
 * Deployment Manager Tests
 * Tests for /src/lib/deployment/deployment-manager.ts
 */

import { describe, test, expect } from 'bun:test';
import {
  DEPLOYMENT_PROVIDER_LABELS,
  DEPLOYMENT_CHECK_TYPE_LABELS,
  ALL_DEPLOYMENT_CHECK_TYPES,
} from '@/lib/deployment/deployment-manager';

// ============================================================================
// Provider Labels
// ============================================================================

describe('DEPLOYMENT_PROVIDER_LABELS — Dutch provider labels', () => {
  test('GITHUB is correct', () => {
    expect(DEPLOYMENT_PROVIDER_LABELS.GITHUB).toBe('GitHub');
  });

  test('GITLAB is correct', () => {
    expect(DEPLOYMENT_PROVIDER_LABELS.GITLAB).toBe('GitLab');
  });

  test('GENERIC_CICD is in Dutch', () => {
    expect(DEPLOYMENT_PROVIDER_LABELS.GENERIC_CICD).toBe('Algemene CI/CD');
  });

  test('all 3 providers have labels', () => {
    expect(Object.keys(DEPLOYMENT_PROVIDER_LABELS).length).toBe(3);
  });
});

// ============================================================================
// Check Type Labels
// ============================================================================

describe('DEPLOYMENT_CHECK_TYPE_LABELS — Dutch check type labels', () => {
  test('ROBOTS_TXT is correct', () => {
    expect(DEPLOYMENT_CHECK_TYPE_LABELS.ROBOTS_TXT).toBe('robots.txt');
  });

  test('TITLES is in Dutch', () => {
    expect(DEPLOYMENT_CHECK_TYPE_LABELS.TITLES).toBe('Titels');
  });

  test('STATUS_CODES is in Dutch', () => {
    expect(DEPLOYMENT_CHECK_TYPE_LABELS.STATUS_CODES).toBe('Statuscodes');
  });

  test('STRUCTURED_DATA is in Dutch', () => {
    expect(DEPLOYMENT_CHECK_TYPE_LABELS.STRUCTURED_DATA).toBe('Gestructureerde data');
  });

  test('INTERNAL_LINKS is in Dutch', () => {
    expect(DEPLOYMENT_CHECK_TYPE_LABELS.INTERNAL_LINKS).toBe('Interne links');
  });

  test('PERFORMANCE is in Dutch', () => {
    expect(DEPLOYMENT_CHECK_TYPE_LABELS.PERFORMANCE).toBe('Prestaties');
  });

  test('CRITICAL_URLS has apostrophe', () => {
    expect(DEPLOYMENT_CHECK_TYPE_LABELS.CRITICAL_URLS).toContain('URL');
  });

  test('all 11 check types have labels', () => {
    expect(Object.keys(DEPLOYMENT_CHECK_TYPE_LABELS).length).toBe(11);
  });

  test('all labels are non-empty', () => {
    for (const label of Object.values(DEPLOYMENT_CHECK_TYPE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// ALL_DEPLOYMENT_CHECK_TYPES
// ============================================================================

describe('ALL_DEPLOYMENT_CHECK_TYPES — completeness', () => {
  test('contains exactly 11 check types', () => {
    expect(ALL_DEPLOYMENT_CHECK_TYPES.length).toBe(11);
  });

  test('includes ROBOTS_TXT', () => {
    expect(ALL_DEPLOYMENT_CHECK_TYPES).toContain('ROBOTS_TXT');
  });

  test('includes CANONICALS', () => {
    expect(ALL_DEPLOYMENT_CHECK_TYPES).toContain('CANONICALS');
  });

  test('includes PERFORMANCE', () => {
    expect(ALL_DEPLOYMENT_CHECK_TYPES).toContain('PERFORMANCE');
  });

  test('includes CRITICAL_URLS', () => {
    expect(ALL_DEPLOYMENT_CHECK_TYPES).toContain('CRITICAL_URLS');
  });

  test('all types are unique', () => {
    const unique = new Set(ALL_DEPLOYMENT_CHECK_TYPES);
    expect(unique.size).toBe(ALL_DEPLOYMENT_CHECK_TYPES.length);
  });
});
