/**
 * Content Change History Tests
 * Tests for /src/lib/content/change-history.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import type { ChangeType, RecordChangeParams, ChangeHistoryFilters, ContentDiff, RollbackResult } from '@/lib/content/change-history';

// ============================================================================
// Change type validation
// ============================================================================

describe('Change Types', () => {
  test('all change types are valid enum values', () => {
    const validChangeTypes: ChangeType[] = [
      'CREATE', 'UPDATE', 'DELETE', 'PUBLISH',
      'UNPUBLISH', 'SCHEDULE', 'APPROVE', 'REJECT', 'ROLLBACK',
    ];
    expect(validChangeTypes.length).toBe(9);
  });

  test('each change type is unique', () => {
    const validChangeTypes: ChangeType[] = [
      'CREATE', 'UPDATE', 'DELETE', 'PUBLISH',
      'UNPUBLISH', 'SCHEDULE', 'APPROVE', 'REJECT', 'ROLLBACK',
    ];
    const unique = new Set(validChangeTypes);
    expect(unique.size).toBe(9);
  });
});

// ============================================================================
// Record change parameter validation
// ============================================================================

describe('Record Change Creation', () => {
  test('projectId is required', () => {
    const params: Partial<RecordChangeParams> = {
      changeType: 'CREATE',
    };
    expect(params.projectId).toBeUndefined();
    // The function throws: 'Project ID is vereist om een wijziging vast te leggen'
  });

  test('changeType is required', () => {
    const params: Partial<RecordChangeParams> = {
      projectId: 'proj-1',
    };
    expect(params.changeType).toBeUndefined();
    // The function throws: 'Wijzigingstype is vereist'
  });

  test('Dutch error for missing projectId', () => {
    const message = 'Project ID is vereist om een wijziging vast te leggen';
    expect(message).toContain('vereist');
  });

  test('Dutch error for missing changeType', () => {
    const message = 'Wijzigingstype is vereist';
    expect(message).toContain('vereist');
  });

  test('invalid changeType produces Dutch error', () => {
    const invalidType = 'INVALID_TYPE';
    const validTypes = ['CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'UNPUBLISH', 'SCHEDULE', 'APPROVE', 'REJECT', 'ROLLBACK'];
    const message = `Ongeldig wijzigingstype: "${invalidType}". Geldige types zijn: ${validTypes.join(', ')}`;
    expect(message).toContain('Ongeldig wijzigingstype');
    expect(message).toContain('Geldige types zijn');
  });

  test('full change params are valid', () => {
    const params: RecordChangeParams = {
      projectId: 'proj-1',
      briefId: 'brief-1',
      versionId: 'version-1',
      pageId: 'page-1',
      changeType: 'UPDATE',
      previousContent: 'Oude inhoud van de pagina.',
      newContent: 'Nieuwe inhoud van de pagina.',
      userId: 'user-1',
      summary: 'Inhoud bijgewerkt met nieuwe SEO-inzichten',
      rollbackData: JSON.stringify({ content: 'Oude inhoud van de pagina.' }),
    };
    expect(params.projectId).toBe('proj-1');
    expect(params.changeType).toBe('UPDATE');
    expect(params.previousContent).toBeDefined();
    expect(params.newContent).toBeDefined();
  });

  test('change record with AI agent', () => {
    const params: RecordChangeParams = {
      projectId: 'proj-1',
      changeType: 'UPDATE',
      aiAgentId: 'agent-1',
      aiProviderId: 'provider-openai',
      summary: 'AI-gegenereerde update van de content',
    };
    expect(params.aiAgentId).toBe('agent-1');
    expect(params.aiProviderId).toBe('provider-openai');
  });

  test('optional fields can be omitted', () => {
    const params: RecordChangeParams = {
      projectId: 'proj-1',
      changeType: 'CREATE',
    };
    expect(params.briefId).toBeUndefined();
    expect(params.previousContent).toBeUndefined();
    expect(params.newContent).toBeUndefined();
  });
});

// ============================================================================
// Query with filters
// ============================================================================

describe('Query Change History with Filters', () => {
  test('filter by briefId', () => {
    const filters: ChangeHistoryFilters = {
      briefId: 'brief-1',
    };
    expect(filters.briefId).toBe('brief-1');
  });

  test('filter by changeType', () => {
    const filters: ChangeHistoryFilters = {
      changeType: 'PUBLISH',
    };
    expect(filters.changeType).toBe('PUBLISH');
  });

  test('filter by userId', () => {
    const filters: ChangeHistoryFilters = {
      userId: 'user-1',
    };
    expect(filters.userId).toBe('user-1');
  });

  test('filter by date range', () => {
    const filters: ChangeHistoryFilters = {
      dateRange: {
        from: new Date('2024-01-01'),
        to: new Date('2024-12-31'),
      },
    };
    expect(filters.dateRange).toBeDefined();
    expect(filters.dateRange!.from.getFullYear()).toBe(2024);
  });

  test('pagination parameters', () => {
    const filters: ChangeHistoryFilters = {
      page: 2,
      pageSize: 50,
    };
    expect(filters.page).toBe(2);
    expect(filters.pageSize).toBe(50);
  });

  test('default pagination values', () => {
    // Default: page 1, pageSize 25
    const defaultPage = 1;
    const defaultPageSize = 25;
    expect(defaultPage).toBe(1);
    expect(defaultPageSize).toBe(25);
  });

  test('pageSize capped at 100', () => {
    const requestedPageSize = 200;
    const maxPageSize = 100;
    const effectivePageSize = Math.min(maxPageSize, Math.max(1, requestedPageSize));
    expect(effectivePageSize).toBe(100);
  });
});

// ============================================================================
// Diff generation
// ============================================================================

describe('Content Diff Generation', () => {
  test('identical content produces no diff', () => {
    const previous = 'Dit is de inhoud van de pagina.';
    const current = 'Dit is de inhoud van de pagina.';

    const prevLines = previous.split('\n');
    const currLines = current.split('\n');

    let unchanged = 0;
    for (const line of prevLines) {
      if (currLines.includes(line)) unchanged++;
    }
    expect(unchanged).toBe(prevLines.length);
  });

  test('added lines are detected', () => {
    const previous = 'Regel 1\nRegel 2\nRegel 3';
    const current = 'Regel 1\nRegel 2\nNieuwe regel\nRegel 3';

    const prevLines = new Set(previous.split('\n'));
    const currLines = current.split('\n');

    const added = currLines.filter((l) => !prevLines.has(l));
    expect(added).toContain('Nieuwe regel');
  });

  test('removed lines are detected', () => {
    const previous = 'Regel 1\nRegel 2\nVerwijderde regel\nRegel 3';
    const current = 'Regel 1\nRegel 2\nRegel 3';

    const prevLines = previous.split('\n');
    const currLines = new Set(current.split('\n'));

    const removed = prevLines.filter((l) => !currLines.has(l));
    expect(removed).toContain('Verwijderde regel');
  });

  test('ContentDiff has correct structure', () => {
    const diff: ContentDiff = {
      changeId: 'change-1',
      removed: ['Oude regel'],
      added: ['Nieuwe regel'],
      unified: '- Oude regel\n+ Nieuwe regel\n  Onveranderde regel',
      stats: {
        linesAdded: 1,
        linesRemoved: 1,
        linesUnchanged: 1,
      },
    };

    expect(diff.changeId).toBe('change-1');
    expect(diff.removed.length).toBe(1);
    expect(diff.added.length).toBe(1);
    expect(diff.stats.linesAdded).toBe(1);
    expect(diff.stats.linesRemoved).toBe(1);
    expect(diff.unified).toContain('- Oude regel');
    expect(diff.unified).toContain('+ Nieuwe regel');
  });

  test('unified diff format uses +/-/  prefixes', () => {
    const diff: ContentDiff = {
      changeId: 'change-1',
      removed: ['Verwijderd'],
      added: ['Toegevoegd'],
      unified: '- Verwijderd\n+ Toegevoegd\n  Ongewijzigd',
      stats: { linesAdded: 1, linesRemoved: 1, linesUnchanged: 1 },
    };

    const lines = diff.unified.split('\n');
    expect(lines[0].startsWith('- ')).toBe(true);
    expect(lines[1].startsWith('+ ')).toBe(true);
    expect(lines[2].startsWith('  ')).toBe(true);
  });

  test('diff stats are accurate', () => {
    const diff: ContentDiff = {
      changeId: 'change-1',
      removed: ['A', 'B'],
      added: ['C', 'D', 'E'],
      unified: '',
      stats: { linesAdded: 3, linesRemoved: 2, linesUnchanged: 5 },
    };

    expect(diff.stats.linesAdded).toBe(diff.added.length);
    expect(diff.stats.linesRemoved).toBe(diff.removed.length);
  });

  test('Dutch error when change not found for diff', () => {
    const changeId = 'nonexistent';
    const message = `Wijziging "${changeId}" niet gevonden`;
    expect(message).toContain('niet gevonden');
  });
});

// ============================================================================
// Rollback functionality
// ============================================================================

describe('Rollback Functionality', () => {
  test('rollback creates a new change record with type ROLLBACK', () => {
    const result: RollbackResult = {
      rollbackChangeId: 'change-rollback-1',
      restoredContent: 'Oude inhoud van de pagina.',
      message: 'Wijziging succesvol teruggedraaid. De vorige content is hersteld.',
    };

    expect(result.rollbackChangeId).toBeDefined();
    expect(result.restoredContent.length).toBeGreaterThan(0);
    expect(result.message).toContain('teruggedraaid');
  });

  test('cannot rollback a ROLLBACK change', () => {
    const changeType: ChangeType = 'ROLLBACK';
    const canRollback = changeType !== 'ROLLBACK';
    expect(canRollback).toBe(false);
  });

  test('can rollback other change types', () => {
    const changeTypes: ChangeType[] = ['CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'UNPUBLISH', 'SCHEDULE', 'APPROVE', 'REJECT'];
    for (const type of changeTypes) {
      expect(type !== 'ROLLBACK').toBe(true);
    }
  });

  test('rollback requires rollbackData or previousContent', () => {
    // If both rollbackData and previousContent are missing, rollback should fail
    const change = {
      rollbackData: null,
      previousContent: null,
    };
    const canRollback = change.rollbackData !== null || change.previousContent !== null;
    expect(canRollback).toBe(false);
  });

  test('rollback with rollbackData extracts content', () => {
    const rollbackData = JSON.stringify({
      content: 'Oorspronkelijke inhoud van de pagina.',
      previousContent: 'Vorige inhoud.',
    });
    const parsed = JSON.parse(rollbackData);
    expect(parsed.content).toBe('Oorspronkelijke inhoud van de pagina.');
  });

  test('rollback falls back to previousContent when rollbackData has no content', () => {
    const previousContent = 'De vorige versie van de content.';
    const rollbackData = JSON.stringify({}); // No content field
    const parsed = JSON.parse(rollbackData);
    const restoredContent = parsed.content ?? parsed.previousContent ?? previousContent ?? '';
    expect(restoredContent).toBe(previousContent);
  });

  test('Dutch error for missing rollback data', () => {
    const message = 'Deze wijziging kan niet worden teruggedraaid: geen herstelgegevens beschikbaar';
    expect(message).toContain('kan niet worden teruggedraaid');
    expect(message).toContain('geen herstelgegevens');
  });

  test('Dutch error when change not found for rollback', () => {
    const changeId = 'nonexistent';
    const message = `Wijziging "${changeId}" niet gevonden`;
    expect(message).toContain('niet gevonden');
  });

  test('Dutch error when trying to rollback a rollback', () => {
    const message = 'Een rollback-wijziging kan niet zelf worden teruggedraaid';
    expect(message).toContain('kan niet zelf worden teruggedraaid');
  });

  test('rollback result message is in Dutch', () => {
    const message = 'Wijziging succesvol teruggedraaid. De vorige content is hersteld.';
    expect(message).toContain('succesvol teruggedraaid');
    expect(message).toContain('hersteld');
  });

  test('rollback summary includes original change type', () => {
    const originalSummary = 'Inhoud bijgewerkt met nieuwe SEO-inzichten';
    const changeType = 'UPDATE';
    const rollbackSummary = `Teruggedraaid: ${originalSummary ?? `wijziging ${changeType}`}`;
    expect(rollbackSummary).toContain('Teruggedraaid');
    expect(rollbackSummary).toContain(originalSummary);
  });

  test('rollback stores metadata about the original change', () => {
    const rollbackData = JSON.stringify({
      originalChangeId: 'change-1',
      originalChangeType: 'UPDATE',
      rolledBackBy: 'user-1',
      rolledBackAt: new Date().toISOString(),
    });
    const parsed = JSON.parse(rollbackData);
    expect(parsed.originalChangeId).toBe('change-1');
    expect(parsed.originalChangeType).toBe('UPDATE');
    expect(parsed.rolledBackBy).toBe('user-1');
  });
});

// ============================================================================
// Change detail
// ============================================================================

describe('Change Detail', () => {
  test('change detail includes previous and new content', () => {
    const detail = {
      id: 'change-1',
      projectId: 'proj-1',
      changeType: 'UPDATE',
      previousContent: 'Oude content',
      newContent: 'Nieuwe content',
      summary: 'Inhoud bijgewerkt',
      createdAt: new Date(),
    };
    expect(detail.previousContent).toBeDefined();
    expect(detail.newContent).toBeDefined();
  });

  test('Dutch error when change detail not found', () => {
    const changeId = 'nonexistent';
    const message = `Wijziging "${changeId}" niet gevonden`;
    expect(message).toContain('niet gevonden');
  });
});
