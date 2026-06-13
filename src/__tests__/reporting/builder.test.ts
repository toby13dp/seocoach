/**
 * Report Builder Tests
 * Tests for /src/lib/reporting/builder.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockCreate = mock(() => Promise.resolve({ id: 'report-1' }));
const mockFindUnique = mock(() => Promise.resolve(null));
const mockUpdate = mock(() => Promise.resolve({ id: 'report-1' }));
const mockFindMany = mock(() => Promise.resolve([]));

mock.module('@/lib/db', () => ({
  db: {
    report: {
      create: mockCreate,
      findUnique: mockFindUnique,
      update: mockUpdate,
      findMany: mockFindMany,
    },
    technicalIssue: {
      findMany: mock(() => Promise.resolve([])),
    },
    contentDecay: {
      findMany: mock(() => Promise.resolve([])),
    },
    keyword: {
      findMany: mock(() => Promise.resolve([])),
    },
    internalLink: {
      findMany: mock(() => Promise.resolve([])),
    },
    roadmapItem: {
      findMany: mock(() => Promise.resolve([])),
    },
  },
}));

import {
  getDefaultSections,
  createReport,
  updateReportSections,
  addSection,
  removeSection,
  generateSnapshot,
  approveReport,
  archiveReport,
} from '@/lib/reporting/builder';

// ============================================================================
// Test: getDefaultSections for each report type
// ============================================================================

describe('getDefaultSections — report types', () => {
  test('MONTHLY report has 5 sections', () => {
    const sections = getDefaultSections('MONTHLY');
    expect(sections.length).toBe(5);
    expect(sections[0].type).toBe('KPI_CARDS');
    expect(sections[0].title).toBe('Kernstatistieken');
    expect(sections[1].type).toBe('CHART');
    expect(sections[1].title).toBe('Zoekprestatietrends');
    expect(sections[2].type).toBe('TABLE');
    expect(sections[2].title).toBe('Top zoekopdrachten');
  });

  test('QUARTERLY report has 5 sections', () => {
    const sections = getDefaultSections('QUARTERLY');
    expect(sections.length).toBe(5);
    expect(sections[0].title).toBe('Kwartaal-KPI\'s');
  });

  test('TECHNICAL_AUDIT report has 3 sections', () => {
    const sections = getDefaultSections('TECHNICAL_AUDIT');
    expect(sections.length).toBe(3);
    expect(sections[0].title).toBe('Technische gezondheid');
    expect(sections[1].type).toBe('TABLE');
  });

  test('CONTENT report has 3 sections', () => {
    const sections = getDefaultSections('CONTENT');
    expect(sections.length).toBe(3);
    expect(sections[0].title).toBe('Contentstatistieken');
  });

  test('KEYWORDS report has 3 sections', () => {
    const sections = getDefaultSections('KEYWORDS');
    expect(sections.length).toBe(3);
    expect(sections[0].title).toBe('Zoekwoordstatistieken');
  });

  test('EXECUTIVE report has 5 sections', () => {
    const sections = getDefaultSections('EXECUTIVE');
    expect(sections.length).toBe(5);
    expect(sections[1].title).toBe('Managementsamenvatting');
    // Should include a PAGE_BREAK
    const pageBreak = sections.find((s) => s.type === 'PAGE_BREAK');
    expect(pageBreak).toBeDefined();
  });

  test('HOLISTIC report has 6 sections', () => {
    const sections = getDefaultSections('HOLISTIC');
    expect(sections.length).toBe(6);
    expect(sections[0].title).toBe('Algemeen overzicht');
  });

  test('Specialized report types have 2 sections each', () => {
    const types = ['COMPETITORS', 'LOCAL_SEO', 'GEO', 'WOOCOMMERCE', 'CRO', 'REVENUE'] as const;
    for (const type of types) {
      const sections = getDefaultSections(type);
      expect(sections.length).toBe(2);
      expect(sections[0].type).toBe('KPI_CARDS');
    }
  });

  test('CUSTOM report has 1 default section', () => {
    const sections = getDefaultSections('CUSTOM');
    expect(sections.length).toBe(1);
    expect(sections[0].type).toBe('TEXT');
    expect(sections[0].title).toBe('Inleiding');
  });

  test('all sections have Dutch titles', () => {
    const types = ['MONTHLY', 'QUARTERLY', 'TECHNICAL_AUDIT', 'CONTENT', 'KEYWORDS', 'EXECUTIVE', 'HOLISTIC'] as const;
    for (const type of types) {
      const sections = getDefaultSections(type);
      for (const section of sections) {
        // PAGE_BREAK can have empty title, others must have Dutch text
        if (section.type !== 'PAGE_BREAK') {
          expect(section.title.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('all sections have sortOrder', () => {
    const sections = getDefaultSections('MONTHLY');
    for (const section of sections) {
      expect(section.sortOrder).toBeGreaterThanOrEqual(0);
    }
  });
});

// ============================================================================
// Test: createReport with valid config
// ============================================================================

describe('createReport — valid config', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  test('creates a report with default config', async () => {
    const mockReport = {
      id: 'report-1',
      projectId: 'proj-1',
      type: 'MONTHLY',
      status: 'DRAFT',
      title: 'Maandelijks rapport — januari 2025',
      sections: '[]',
    };

    mockCreate.mockImplementation(() => Promise.resolve(mockReport));

    const result = await createReport('proj-1', 'MONTHLY');

    expect(result.id).toBe('report-1');
    expect(result.type).toBe('MONTHLY');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          type: 'MONTHLY',
          status: 'DRAFT',
        }),
      })
    );
  });

  test('creates a report with custom title and description', async () => {
    const mockReport = {
      id: 'report-2',
      projectId: 'proj-1',
      type: 'QUARTERLY',
      status: 'DRAFT',
      title: 'Q1 2025 Review',
      description: 'Kwartaalrapportage voor Q1',
    };

    mockCreate.mockImplementation(() => Promise.resolve(mockReport));

    const result = await createReport('proj-1', 'QUARTERLY', {
      title: 'Q1 2025 Review',
      description: 'Kwartaalrapportage voor Q1',
    });

    expect(result.title).toBe('Q1 2025 Review');
    expect(result.description).toBe('Kwartaalrapportage voor Q1');
  });

  test('creates a report with DRAFT status by default', async () => {
    mockCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'report-3', ...args.data })
    );

    await createReport('proj-1', 'MONTHLY');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
        }),
      })
    );
  });
});

// ============================================================================
// Test: updateReportSections reorder
// ============================================================================

describe('updateReportSections', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });

  test('replaces sections with new array', async () => {
    const newSections = [
      { id: 's1', type: 'KPI_CARDS', title: 'KPIs', config: '{}', sortOrder: 0 },
      { id: 's2', type: 'CHART', title: 'Chart', config: '{}', sortOrder: 1 },
    ];

    mockUpdate.mockImplementation(() =>
      Promise.resolve({ id: 'report-1', sections: JSON.stringify(newSections) })
    );

    const result = await updateReportSections('report-1', newSections);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          sections: JSON.stringify(newSections),
        }),
      })
    );
  });
});

// ============================================================================
// Test: addSection and removeSection
// ============================================================================

describe('addSection', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  test('adds a section to a report', async () => {
    const existingSections = [
      { id: 's1', type: 'KPI_CARDS', title: 'KPIs', config: '{}', sortOrder: 0 },
    ];

    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ id: 'report-1', sections: JSON.stringify(existingSections) })
    );
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'report-1', sections: args.data.sections })
    );

    const newSection = {
      id: 's2',
      type: 'CHART' as const,
      title: 'New Chart',
      config: '{}',
      sortOrder: 1,
    };

    await addSection('report-1', newSection);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
      })
    );
  });

  test('throws error when report not found', async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(null));

    await expect(
      addSection('nonexistent', {
        id: 's1',
        type: 'TEXT',
        title: 'Test',
        config: '{}',
        sortOrder: 0,
      })
    ).rejects.toThrow('Rapport niet gevonden');
  });
});

describe('removeSection', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  test('removes a section from a report', async () => {
    const existingSections = [
      { id: 's1', type: 'KPI_CARDS', title: 'KPIs', config: '{}', sortOrder: 0 },
      { id: 's2', type: 'CHART', title: 'Chart', config: '{}', sortOrder: 1 },
    ];

    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ id: 'report-1', sections: JSON.stringify(existingSections) })
    );
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'report-1', sections: args.data.sections })
    );

    await removeSection('report-1', 's2');

    // The updated sections should not contain the removed section
    const updateCall = mockUpdate.mock.calls[0][0];
    const updatedSections = JSON.parse(updateCall.data.sections);
    expect(updatedSections.length).toBe(1);
    expect(updatedSections[0].id).toBe('s1');
  });

  test('re-sorts remaining sections after removal', async () => {
    const existingSections = [
      { id: 's1', type: 'KPI_CARDS', title: 'KPIs', config: '{}', sortOrder: 0 },
      { id: 's2', type: 'CHART', title: 'Chart', config: '{}', sortOrder: 1 },
      { id: 's3', type: 'TABLE', title: 'Table', config: '{}', sortOrder: 2 },
    ];

    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ id: 'report-1', sections: JSON.stringify(existingSections) })
    );
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'report-1', sections: args.data.sections })
    );

    await removeSection('report-1', 's1');

    const updateCall = mockUpdate.mock.calls[0][0];
    const updatedSections = JSON.parse(updateCall.data.sections);
    // Remaining sections should be re-indexed
    expect(updatedSections[0].sortOrder).toBe(0);
    expect(updatedSections[1].sortOrder).toBe(1);
  });

  test('throws error when report not found', async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(null));

    await expect(
      removeSection('nonexistent', 's1')
    ).rejects.toThrow('Rapport niet gevonden');
  });
});

// ============================================================================
// Test: generateSnapshot
// ============================================================================

describe('generateSnapshot', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  test('freezes current data into snapshot', async () => {
    const report = {
      id: 'report-1',
      projectId: 'proj-1',
      type: 'MONTHLY',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'),
      sections: JSON.stringify([
        { id: 's1', type: 'KPI_CARDS', config: JSON.stringify({ dataSource: 'search_console' }), sortOrder: 0 },
      ]),
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'report-1', ...args.data })
    );

    const result = await generateSnapshot('report-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          snapshotData: expect.any(String),
          snapshotGeneratedAt: expect.any(Date),
        }),
      })
    );
  });

  test('throws error when report not found', async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(null));

    await expect(
      generateSnapshot('nonexistent')
    ).rejects.toThrow('Rapport niet gevonden');
  });

  test('snapshot data includes generatedAt timestamp', async () => {
    const report = {
      id: 'report-1',
      projectId: 'proj-1',
      type: 'MONTHLY',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'),
      sections: JSON.stringify([
        { id: 's1', type: 'KPI_CARDS', config: JSON.stringify({ dataSource: 'search_console' }), sortOrder: 0 },
      ]),
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'report-1', ...args.data })
    );

    await generateSnapshot('report-1');

    const updateCall = mockUpdate.mock.calls[0][0];
    const snapshotData = JSON.parse(updateCall.data.snapshotData);
    expect(snapshotData.generatedAt).toBeDefined();
    expect(snapshotData.projectId).toBe('proj-1');
  });
});

// ============================================================================
// Test: approveReport — only works on IN_REVIEW status
// ============================================================================

describe('approveReport', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  test('approves report with IN_REVIEW status', async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ id: 'report-1', status: 'IN_REVIEW' })
    );
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'report-1', status: 'APPROVED' })
    );

    const result = await approveReport('report-1', 'user-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          status: 'APPROVED',
          approvedBy: 'user-1',
          approvedAt: expect.any(Date),
        }),
      })
    );
  });

  test('throws error when report not found', async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(null));

    await expect(
      approveReport('nonexistent', 'user-1')
    ).rejects.toThrow('Rapport niet gevonden');
  });

  test('throws error when report is not in IN_REVIEW status', async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ id: 'report-1', status: 'DRAFT' })
    );

    await expect(
      approveReport('report-1', 'user-1')
    ).rejects.toThrow('In behandeling');
  });

  test('throws error when report is already APPROVED', async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ id: 'report-1', status: 'APPROVED' })
    );

    await expect(
      approveReport('report-1', 'user-1')
    ).rejects.toThrow();
  });
});

// ============================================================================
// Test: archiveReport
// ============================================================================

describe('archiveReport', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });

  test('sets ARCHIVED status', async () => {
    mockUpdate.mockImplementation(() =>
      Promise.resolve({ id: 'report-1', status: 'ARCHIVED' })
    );

    const result = await archiveReport('report-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          status: 'ARCHIVED',
        }),
      })
    );
  });
});
