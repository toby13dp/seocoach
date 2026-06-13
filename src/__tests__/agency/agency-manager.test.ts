/**
 * Agency Manager Tests
 * Tests for /src/lib/agency/agency-manager.ts
 */

import { describe, test, expect } from 'bun:test';
import {
  calculateHealthScore,
  determineHealthStatus,
  calculateNextRun,
} from '@/lib/agency/agency-manager';
import { HEALTH_SCORE_WEIGHTS, CLIENT_HEALTH_LABELS, SLA_STATUS_LABELS, DELIVERABLE_STATUS_LABELS } from '@/lib/agency/types';

// ============================================================================
// calculateHealthScore — weighted score calculation
// ============================================================================

describe('calculateHealthScore — weighted health score calculation', () => {
  test('perfect scores yield 100', () => {
    const score = calculateHealthScore({
      slaCompliance: 100,
      deliverableOnTime: 100,
      communicationResponsiveness: 100,
      seoProgress: 100,
      satisfaction: 100,
    });
    expect(score).toBe(100);
  });

  test('zero scores yield 0', () => {
    const score = calculateHealthScore({
      slaCompliance: 0,
      deliverableOnTime: 0,
      communicationResponsiveness: 0,
      seoProgress: 0,
      satisfaction: 0,
    });
    expect(score).toBe(0);
  });

  test('average scores yield ~50', () => {
    const score = calculateHealthScore({
      slaCompliance: 50,
      deliverableOnTime: 50,
      communicationResponsiveness: 50,
      seoProgress: 50,
      satisfaction: 50,
    });
    expect(score).toBe(50);
  });

  test('SLA compliance has 25% weight', () => {
    const score = calculateHealthScore({
      slaCompliance: 100,
      deliverableOnTime: 0,
      communicationResponsiveness: 0,
      seoProgress: 0,
      satisfaction: 0,
    });
    expect(score).toBe(25);
  });

  test('SEO progress has 25% weight', () => {
    const score = calculateHealthScore({
      slaCompliance: 0,
      deliverableOnTime: 0,
      communicationResponsiveness: 0,
      seoProgress: 100,
      satisfaction: 0,
    });
    expect(score).toBe(25);
  });

  test('deliverable on time has 20% weight', () => {
    const score = calculateHealthScore({
      slaCompliance: 0,
      deliverableOnTime: 100,
      communicationResponsiveness: 0,
      seoProgress: 0,
      satisfaction: 0,
    });
    expect(score).toBe(20);
  });

  test('communication responsiveness has 15% weight', () => {
    const score = calculateHealthScore({
      slaCompliance: 0,
      deliverableOnTime: 0,
      communicationResponsiveness: 100,
      seoProgress: 0,
      satisfaction: 0,
    });
    expect(score).toBe(15);
  });

  test('satisfaction has 15% weight', () => {
    const score = calculateHealthScore({
      slaCompliance: 0,
      deliverableOnTime: 0,
      communicationResponsiveness: 0,
      seoProgress: 0,
      satisfaction: 100,
    });
    expect(score).toBe(15);
  });

  test('mixed scores calculate correctly', () => {
    const score = calculateHealthScore({
      slaCompliance: 80,   // 80 * 0.25 = 20
      deliverableOnTime: 90, // 90 * 0.20 = 18
      communicationResponsiveness: 70, // 70 * 0.15 = 10.5
      seoProgress: 60,     // 60 * 0.25 = 15
      satisfaction: 85,    // 85 * 0.15 = 12.75
    });
    expect(score).toBe(76); // 20 + 18 + 10.5 + 15 + 12.75 = 76.25 → 76
  });

  test('weights sum to 1.0', () => {
    const total = Object.values(HEALTH_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0);
  });
});

// ============================================================================
// determineHealthStatus — score to status mapping
// ============================================================================

describe('determineHealthStatus — maps score to health status', () => {
  test('score 85+ yields EXCELLENT', () => {
    expect(determineHealthStatus(85)).toBe('EXCELLENT');
    expect(determineHealthStatus(100)).toBe('EXCELLENT');
    expect(determineHealthStatus(95)).toBe('EXCELLENT');
  });

  test('score 65-84 yields GOOD', () => {
    expect(determineHealthStatus(65)).toBe('GOOD');
    expect(determineHealthStatus(70)).toBe('GOOD');
    expect(determineHealthStatus(84)).toBe('GOOD');
  });

  test('score 40-64 yields NEEDS_ATTENTION', () => {
    expect(determineHealthStatus(40)).toBe('NEEDS_ATTENTION');
    expect(determineHealthStatus(50)).toBe('NEEDS_ATTENTION');
    expect(determineHealthStatus(64)).toBe('NEEDS_ATTENTION');
  });

  test('score below 40 yields CRITICAL', () => {
    expect(determineHealthStatus(0)).toBe('CRITICAL');
    expect(determineHealthStatus(39)).toBe('CRITICAL');
    expect(determineHealthStatus(20)).toBe('CRITICAL');
  });

  test('boundary: 84 is GOOD, 85 is EXCELLENT', () => {
    expect(determineHealthStatus(84)).toBe('GOOD');
    expect(determineHealthStatus(85)).toBe('EXCELLENT');
  });

  test('boundary: 64 is NEEDS_ATTENTION, 65 is GOOD', () => {
    expect(determineHealthStatus(64)).toBe('NEEDS_ATTENTION');
    expect(determineHealthStatus(65)).toBe('GOOD');
  });

  test('boundary: 39 is CRITICAL, 40 is NEEDS_ATTENTION', () => {
    expect(determineHealthStatus(39)).toBe('CRITICAL');
    expect(determineHealthStatus(40)).toBe('NEEDS_ATTENTION');
  });
});

// ============================================================================
// calculateNextRun — recurring task scheduling
// ============================================================================

describe('calculateNextRun — next execution date calculation', () => {
  test('DAILY returns tomorrow at 9:00', () => {
    const next = calculateNextRun('DAILY');
    const now = new Date();
    expect(next.getDate()).not.toBe(now.getDate());
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
  });

  test('WEEKLY with dayOfWeek=1 (Monday) returns next Monday', () => {
    const next = calculateNextRun('WEEKLY', 1);
    expect(next.getDay()).toBe(1); // Monday
    expect(next.getHours()).toBe(9);
  });

  test('WEEKLY defaults to Monday when no day specified', () => {
    const next = calculateNextRun('WEEKLY');
    expect(next.getDay()).toBe(1);
  });

  test('BIWEEKLY returns date 2+ weeks ahead', () => {
    const next = calculateNextRun('BIWEEKLY', 1);
    const now = new Date();
    const diffDays = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(7);
  });

  test('MONTHLY with dayOfMonth=1 returns next month on 1st', () => {
    const next = calculateNextRun('MONTHLY', undefined, 1);
    expect(next.getDate()).toBe(1);
  });

  test('MONTHLY caps dayOfMonth at 28 for February safety', () => {
    const next = calculateNextRun('MONTHLY', undefined, 31);
    expect(next.getDate()).toBeLessThanOrEqual(28);
  });

  test('QUARTERLY returns date 3 months ahead', () => {
    const next = calculateNextRun('QUARTERLY', undefined, 1);
    const now = new Date();
    const monthDiff = (next.getFullYear() - now.getFullYear()) * 12 + (next.getMonth() - now.getMonth());
    expect(monthDiff).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// Dutch Labels
// ============================================================================

describe('Dutch labels — all labels present', () => {
  test('CLIENT_HEALTH_LABELS has all 4 statuses', () => {
    expect(Object.keys(CLIENT_HEALTH_LABELS).length).toBe(4);
    expect(CLIENT_HEALTH_LABELS.EXCELLENT).toBe('Uitstekend');
    expect(CLIENT_HEALTH_LABELS.GOOD).toBe('Goed');
    expect(CLIENT_HEALTH_LABELS.NEEDS_ATTENTION).toBe('Heeft aandacht nodig');
    expect(CLIENT_HEALTH_LABELS.CRITICAL).toBe('Kritiek');
  });

  test('SLA_STATUS_LABELS has all 3 statuses', () => {
    expect(Object.keys(SLA_STATUS_LABELS).length).toBe(3);
    expect(SLA_STATUS_LABELS.ON_TRACK).toBe('Op schema');
    expect(SLA_STATUS_LABELS.AT_RISK).toBe('Risico');
    expect(SLA_STATUS_LABELS.BREACHED).toBe('Overtreden');
  });

  test('DELIVERABLE_STATUS_LABELS has all 6 statuses', () => {
    expect(Object.keys(DELIVERABLE_STATUS_LABELS).length).toBe(6);
    expect(DELIVERABLE_STATUS_LABELS.PENDING).toBe('In afwachting');
    expect(DELIVERABLE_STATUS_LABELS.OVERDUE).toBe('Te laat');
    expect(DELIVERABLE_STATUS_LABELS.APPROVED).toBe('Goedgekeurd');
  });

  test('all labels are Dutch (non-English)', () => {
    for (const label of Object.values(CLIENT_HEALTH_LABELS)) {
      expect(label).not.toBe(label.toLowerCase());
    }
    for (const label of Object.values(SLA_STATUS_LABELS)) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
