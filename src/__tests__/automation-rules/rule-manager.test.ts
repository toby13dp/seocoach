/**
 * Automation Rules Manager Tests
 * Tests for /src/lib/automation-rules/rule-manager.ts
 */

import { describe, test, expect } from 'bun:test';
import { evaluateConditions } from '@/lib/automation-rules/rule-manager';
import { TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS, RULE_STATUS_LABELS, isHighRiskAction, HIGH_RISK_ACTIONS } from '@/lib/automation-rules/types';
import type { AutomationCondition } from '@/lib/automation-rules/types';

// ============================================================================
// evaluateConditions — condition evaluation
// ============================================================================

describe('evaluateConditions — condition matching', () => {
  test('equals operator matches exact value', () => {
    const conditions: AutomationCondition[] = [{ field: 'status', operator: 'equals', value: 'critical' }];
    expect(evaluateConditions(conditions, { status: 'critical' })).toBe(true);
  });

  test('equals operator does not match different value', () => {
    const conditions: AutomationCondition[] = [{ field: 'status', operator: 'equals', value: 'critical' }];
    expect(evaluateConditions(conditions, { status: 'warning' })).toBe(false);
  });

  test('not_equals operator matches different value', () => {
    const conditions: AutomationCondition[] = [{ field: 'status', operator: 'not_equals', value: 'critical' }];
    expect(evaluateConditions(conditions, { status: 'warning' })).toBe(true);
  });

  test('greater_than operator works with numbers', () => {
    const conditions: AutomationCondition[] = [{ field: 'drop', operator: 'greater_than', value: 20 }];
    expect(evaluateConditions(conditions, { drop: 25 })).toBe(true);
    expect(evaluateConditions(conditions, { drop: 15 })).toBe(false);
    expect(evaluateConditions(conditions, { drop: 20 })).toBe(false);
  });

  test('less_than operator works with numbers', () => {
    const conditions: AutomationCondition[] = [{ field: 'score', operator: 'less_than', value: 50 }];
    expect(evaluateConditions(conditions, { score: 30 })).toBe(true);
    expect(evaluateConditions(conditions, { score: 60 })).toBe(false);
  });

  test('contains operator works with strings', () => {
    const conditions: AutomationCondition[] = [{ field: 'title', operator: 'contains', value: 'error' }];
    expect(evaluateConditions(conditions, { title: 'Server error detected' })).toBe(true);
    expect(evaluateConditions(conditions, { title: 'Warning found' })).toBe(false);
  });

  test('not_contains operator works with strings', () => {
    const conditions: AutomationCondition[] = [{ field: 'title', operator: 'not_contains', value: 'error' }];
    expect(evaluateConditions(conditions, { title: 'All clear' })).toBe(true);
    expect(evaluateConditions(conditions, { title: 'Server error detected' })).toBe(false);
  });

  test('multiple conditions are AND-combined', () => {
    const conditions: AutomationCondition[] = [
      { field: 'severity', operator: 'equals', value: 'high' },
      { field: 'count', operator: 'greater_than', value: 5 },
    ];
    expect(evaluateConditions(conditions, { severity: 'high', count: 10 })).toBe(true);
    expect(evaluateConditions(conditions, { severity: 'low', count: 10 })).toBe(false);
    expect(evaluateConditions(conditions, { severity: 'high', count: 3 })).toBe(false);
  });

  test('empty conditions always pass', () => {
    expect(evaluateConditions([], { anything: 'goes' })).toBe(true);
  });

  test('missing field in data returns false for equals', () => {
    const conditions: AutomationCondition[] = [{ field: 'missing', operator: 'equals', value: 'test' }];
    expect(evaluateConditions(conditions, { other: 'value' })).toBe(false);
  });
});

// ============================================================================
// High Risk Actions
// ============================================================================

describe('isHighRiskAction — high risk action detection', () => {
  test('GENERATE_CONTENT_DRAFT is high risk', () => {
    expect(isHighRiskAction('GENERATE_CONTENT_DRAFT')).toBe(true);
  });

  test('PREPARE_CMS_UPDATE is high risk', () => {
    expect(isHighRiskAction('PREPARE_CMS_UPDATE')).toBe(true);
  });

  test('RUN_CRAWL is high risk', () => {
    expect(isHighRiskAction('RUN_CRAWL')).toBe(true);
  });

  test('CALL_WEBHOOK is high risk', () => {
    expect(isHighRiskAction('CALL_WEBHOOK')).toBe(true);
  });

  test('CREATE_TASK is not high risk', () => {
    expect(isHighRiskAction('CREATE_TASK')).toBe(false);
  });

  test('CREATE_ALERT is not high risk', () => {
    expect(isHighRiskAction('CREATE_ALERT')).toBe(false);
  });

  test('NOTIFY_USER is not high risk', () => {
    expect(isHighRiskAction('NOTIFY_USER')).toBe(false);
  });

  test('HIGH_RISK_ACTIONS contains exactly 4 items', () => {
    expect(HIGH_RISK_ACTIONS.length).toBe(4);
  });
});

// ============================================================================
// Labels
// ============================================================================

describe('Automation labels — Dutch labels for all types', () => {
  test('TRIGGER_TYPE_LABELS has 11 trigger types', () => {
    expect(Object.keys(TRIGGER_TYPE_LABELS).length).toBe(11);
  });

  test('ACTION_TYPE_LABELS has 11 action types', () => {
    expect(Object.keys(ACTION_TYPE_LABELS).length).toBe(11);
  });

  test('RULE_STATUS_LABELS has 4 statuses', () => {
    expect(Object.keys(RULE_STATUS_LABELS).length).toBe(4);
  });

  test('trigger labels are in Dutch', () => {
    expect(TRIGGER_TYPE_LABELS.NEW_TECHNICAL_ISSUE).toBe('Nieuw technisch probleem');
    expect(TRIGGER_TYPE_LABELS.METRIC_DROP).toBe('Metrische daling');
    expect(TRIGGER_TYPE_LABELS.CONTENT_DECAY).toBe('Contentverval');
  });

  test('action labels are in Dutch', () => {
    expect(ACTION_TYPE_LABELS.CREATE_TASK).toBe('Taak aanmaken');
    expect(ACTION_TYPE_LABELS.GENERATE_BRIEF).toBe('Brief genereren');
    expect(ACTION_TYPE_LABELS.RUN_CRAWL).toBe('Crawl uitvoeren');
  });

  test('status labels are in Dutch', () => {
    expect(RULE_STATUS_LABELS.ACTIVE).toBe('Actief');
    expect(RULE_STATUS_LABELS.PAUSED).toBe('Gepauzeerd');
    expect(RULE_STATUS_LABELS.DRAFT).toBe('Concept');
  });

  test('all trigger labels are non-empty', () => {
    for (const label of Object.values(TRIGGER_TYPE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });

  test('all action labels are non-empty', () => {
    for (const label of Object.values(ACTION_TYPE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
