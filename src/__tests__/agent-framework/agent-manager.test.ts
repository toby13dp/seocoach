/**
 * Agent Framework Tests
 * Tests for /src/lib/agent-framework/agent-manager.ts
 */

import { describe, test, expect } from 'bun:test';
import {
  isToolAllowedForAgent,
  getAgentToolAllowlist,
  getAgentConfig,
  generateExecutionSummary,
} from '@/lib/agent-framework/agent-manager';
import {
  ALL_AGENT_TYPES,
  AGENT_TYPE_LABELS,
  AGENT_RUN_STATUS_LABELS,
  AGENT_TOOL_ALLOWLISTS,
  DEFAULT_AGENT_CONFIGS,
} from '@/lib/agent-framework/types';

// ============================================================================
// Agent Type Validation
// ============================================================================

describe('ALL_AGENT_TYPES — all 15 agent types present', () => {
  test('contains exactly 15 agent types', () => {
    expect(ALL_AGENT_TYPES.length).toBe(15);
  });

  test('includes STRATEGY', () => {
    expect(ALL_AGENT_TYPES).toContain('STRATEGY');
  });

  test('includes TECHNICAL_SEO', () => {
    expect(ALL_AGENT_TYPES).toContain('TECHNICAL_SEO');
  });

  test('includes CONTENT_WRITER', () => {
    expect(ALL_AGENT_TYPES).toContain('CONTENT_WRITER');
  });

  test('includes QUALITY_ASSURANCE', () => {
    expect(ALL_AGENT_TYPES).toContain('QUALITY_ASSURANCE');
  });

  test('includes MIGRATION', () => {
    expect(ALL_AGENT_TYPES).toContain('MIGRATION');
  });
});

// ============================================================================
// Agent Labels
// ============================================================================

describe('AGENT_TYPE_LABELS — Dutch labels for all types', () => {
  test('all 15 types have labels', () => {
    expect(Object.keys(AGENT_TYPE_LABELS).length).toBe(15);
  });

  test('STRATEGY is labeled correctly', () => {
    expect(AGENT_TYPE_LABELS.STRATEGY).toBe('Strategie-agent');
  });

  test('TECHNICAL_SEO is labeled in Dutch', () => {
    expect(AGENT_TYPE_LABELS.TECHNICAL_SEO).toContain('SEO');
  });

  test('all labels are non-empty strings', () => {
    for (const type of ALL_AGENT_TYPES) {
      expect(AGENT_TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Tool Allowlists
// ============================================================================

describe('AGENT_TOOL_ALLOWLISTS — tool permissions per agent', () => {
  test('all 15 agent types have allowlists', () => {
    expect(Object.keys(AGENT_TOOL_ALLOWLISTS).length).toBe(15);
  });

  test('STRATEGY agent can create tasks', () => {
    expect(isToolAllowedForAgent('STRATEGY', 'create_task')).toBe(true);
  });

  test('STRATEGY agent cannot create drafts', () => {
    expect(isToolAllowedForAgent('STRATEGY', 'create_draft')).toBe(false);
  });

  test('CONTENT_WRITER agent can create drafts', () => {
    expect(isToolAllowedForAgent('CONTENT_WRITER', 'create_draft')).toBe(true);
  });

  test('TECHNICAL_SEO agent can crawl', () => {
    expect(isToolAllowedForAgent('TECHNICAL_SEO', 'crawl_analysis')).toBe(true);
  });

  test('REPORTING agent can generate reports', () => {
    expect(isToolAllowedForAgent('REPORTING', 'generate_report')).toBe(true);
  });

  test('PUBLISHING agent can publish content', () => {
    expect(isToolAllowedForAgent('PUBLISHING', 'publish_content')).toBe(true);
  });

  test('MIGRATION agent can validate redirects', () => {
    expect(isToolAllowedForAgent('MIGRATION', 'validate_redirects')).toBe(true);
  });

  test('getAgentToolAllowlist returns array', () => {
    const list = getAgentToolAllowlist('STRATEGY');
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Default Agent Configs
// ============================================================================

describe('DEFAULT_AGENT_CONFIGS — configuration per agent', () => {
  test('all 15 agent types have configs', () => {
    expect(Object.keys(DEFAULT_AGENT_CONFIGS).length).toBe(15);
  });

  test('STRATEGY has reasonable defaults', () => {
    const config = getAgentConfig('STRATEGY');
    expect(config.maxSteps).toBeGreaterThanOrEqual(5);
    expect(config.timeoutMs).toBeGreaterThanOrEqual(60000);
    expect(config.costLimitEur).toBeGreaterThan(0);
  });

  test('all configs have model specified', () => {
    for (const type of ALL_AGENT_TYPES) {
      const config = getAgentConfig(type);
      expect(config.model.length).toBeGreaterThan(0);
    }
  });

  test('all configs have positive maxSteps', () => {
    for (const type of ALL_AGENT_TYPES) {
      const config = getAgentConfig(type);
      expect(config.maxSteps).toBeGreaterThan(0);
    }
  });

  test('all configs have positive costLimitEur', () => {
    for (const type of ALL_AGENT_TYPES) {
      const config = getAgentConfig(type);
      expect(config.costLimitEur).toBeGreaterThan(0);
    }
  });

  test('high-risk agents require approval', () => {
    // Publishing, Content Writer, Migration, Reporting should require approval
    expect(DEFAULT_AGENT_CONFIGS.PUBLISHING.requiresApproval).toBe(true);
    expect(DEFAULT_AGENT_CONFIGS.CONTENT_WRITER.requiresApproval).toBe(true);
    expect(DEFAULT_AGENT_CONFIGS.MIGRATION.requiresApproval).toBe(true);
  });
});

// ============================================================================
// Execution Summary
// ============================================================================

describe('generateExecutionSummary — human-readable summary', () => {
  test('generates summary for completed run', () => {
    const summary = generateExecutionSummary({
      agentType: 'STRATEGY',
      objective: 'Analyseer SEO-strategie',
      status: 'COMPLETED',
      currentStep: 10,
      maxSteps: 10,
      costEur: 0.35,
      durationMs: 45000,
      result: null,
      errors: null,
    });
    expect(summary).toContain('Strategie-agent');
    expect(summary).toContain('Analyseer SEO-strategie');
    expect(summary).toContain('Voltooid');
  });

  test('generates summary for running run', () => {
    const summary = generateExecutionSummary({
      agentType: 'TECHNICAL_SEO',
      objective: 'Controleer technische gezondheid',
      status: 'RUNNING',
      currentStep: 5,
      maxSteps: 20,
      costEur: 0.15,
      durationMs: null,
      result: null,
      errors: null,
    });
    expect(summary).toContain('Bezig');
    expect(summary).toContain('stap 5/20');
  });

  test('includes cost in summary', () => {
    const summary = generateExecutionSummary({
      agentType: 'STRATEGY',
      objective: 'Test',
      status: 'COMPLETED',
      currentStep: 10,
      maxSteps: 10,
      costEur: 1.2345,
      durationMs: 30000,
      result: null,
      errors: null,
    });
    expect(summary).toContain('€1.2345');
  });

  test('includes duration in seconds', () => {
    const summary = generateExecutionSummary({
      agentType: 'STRATEGY',
      objective: 'Test',
      status: 'COMPLETED',
      currentStep: 10,
      maxSteps: 10,
      costEur: 0.5,
      durationMs: 90000,
      result: null,
      errors: null,
    });
    expect(summary).toContain('90s');
  });
});

// ============================================================================
// Status Labels
// ============================================================================

describe('AGENT_RUN_STATUS_LABELS — Dutch labels for all statuses', () => {
  test('all 6 statuses have labels', () => {
    expect(Object.keys(AGENT_RUN_STATUS_LABELS).length).toBe(6);
  });

  test('PENDING is In afwachting', () => {
    expect(AGENT_RUN_STATUS_LABELS.PENDING).toBe('In afwachting');
  });

  test('RUNNING is Bezig', () => {
    expect(AGENT_RUN_STATUS_LABELS.RUNNING).toBe('Bezig');
  });

  test('AWAITING_APPROVAL is Wacht op goedkeuring', () => {
    expect(AGENT_RUN_STATUS_LABELS.AWAITING_APPROVAL).toBe('Wacht op goedkeuring');
  });
});
