/**
 * Report Sharing Tests
 * Tests for /src/lib/reporting/sharing.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockFindUnique = mock(() => Promise.resolve(null));
const mockUpdate = mock(() => Promise.resolve({ id: 'report-1' }));
const mockCreate = mock(() => Promise.resolve({ id: 'comment-1' }));

mock.module('@/lib/db', () => ({
  db: {
    report: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    reportComment: {
      create: mockCreate,
      update: mock(() => Promise.resolve({ id: 'comment-1', resolved: true })),
      findMany: mock(() => Promise.resolve([])),
    },
  },
}));

import {
  createShareLink,
  accessSharedReport,
  revokeShareLink,
  addReportComment,
  resolveComment,
} from '@/lib/reporting/sharing';

// ============================================================================
// Test: createShareLink generates token
// ============================================================================

describe('createShareLink — token generation', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  test('generates a share token for a report', async () => {
    const report = {
      id: 'report-1',
      status: 'APPROVED',
      shareToken: null,
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'report-1', ...args.data })
    );

    const result = await createShareLink('report-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          shareToken: expect.any(String),
          shareAccessCount: 0,
        }),
      })
    );

    // Token should be a 64-character hex string (32 bytes)
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data.shareToken.length).toBe(64);
  });

  test('throws error when report not found', async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(null));

    await expect(createShareLink('nonexistent')).rejects.toThrow(
      'Rapport niet gevonden'
    );
  });
});

// ============================================================================
// Test: createShareLink with password (hashes it)
// ============================================================================

describe('createShareLink — password protection', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  test('hashes the password before storing', async () => {
    const report = {
      id: 'report-1',
      status: 'APPROVED',
      shareToken: null,
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'report-1', ...args.data })
    );

    await createShareLink('report-1', { password: 'geheim123' });

    const updateCall = mockUpdate.mock.calls[0][0];
    // Password should be hashed (salt:hash format)
    expect(updateCall.data.sharePassword).toBeDefined();
    expect(updateCall.data.sharePassword).toContain(':');
    expect(updateCall.data.sharePassword).not.toBe('geheim123');
  });

  test('sets sharePassword to null when no password provided', async () => {
    const report = {
      id: 'report-1',
      status: 'APPROVED',
      shareToken: null,
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'report-1', ...args.data })
    );

    await createShareLink('report-1');

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data.sharePassword).toBeNull();
  });
});

// ============================================================================
// Test: createShareLink with expiry
// ============================================================================

describe('createShareLink — expiry', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  test('sets expiry date when provided', async () => {
    const report = {
      id: 'report-1',
      status: 'APPROVED',
      shareToken: null,
    };

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    mockFindUnique.mockImplementation(() => Promise.resolve(report));
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'report-1', ...args.data })
    );

    await createShareLink('report-1', { expiresAt: expiryDate });

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data.shareExpiresAt).toEqual(expiryDate);
  });

  test('sets null expiry when not provided', async () => {
    const report = {
      id: 'report-1',
      status: 'APPROVED',
      shareToken: null,
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'report-1', ...args.data })
    );

    await createShareLink('report-1');

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data.shareExpiresAt).toBeNull();
  });
});

// ============================================================================
// Test: accessSharedReport with valid token
// ============================================================================

describe('accessSharedReport — valid token', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  test('grants access with valid token and approved report', async () => {
    const report = {
      id: 'report-1',
      title: 'Maandelijks rapport',
      type: 'MONTHLY',
      status: 'APPROVED',
      shareToken: 'valid-token-123',
      sharePassword: null,
      shareExpiresAt: null,
      shareAccessCount: 5,
      htmlOutput: '<html>Report</html>',
      snapshotData: '{"data": true}',
      deletedAt: null,
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));
    mockUpdate.mockImplementation(() => Promise.resolve(report));

    const result = await accessSharedReport('valid-token-123');

    expect(result.granted).toBe(true);
    expect(result.report).toBeDefined();
    expect(result.report!.title).toBe('Maandelijks rapport');
  });

  test('increments access count on successful access', async () => {
    const report = {
      id: 'report-1',
      title: 'Test Report',
      type: 'MONTHLY',
      status: 'APPROVED',
      shareToken: 'valid-token',
      sharePassword: null,
      shareExpiresAt: null,
      shareAccessCount: 5,
      htmlOutput: null,
      snapshotData: null,
      deletedAt: null,
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));
    mockUpdate.mockImplementation(() => Promise.resolve(report));

    await accessSharedReport('valid-token');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          shareAccessCount: 6,
        }),
      })
    );
  });
});

// ============================================================================
// Test: accessSharedReport with expired token
// ============================================================================

describe('accessSharedReport — expired token', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  test('denies access when share link has expired', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const report = {
      id: 'report-1',
      title: 'Test Report',
      type: 'MONTHLY',
      status: 'APPROVED',
      shareToken: 'expired-token',
      sharePassword: null,
      shareExpiresAt: pastDate,
      shareAccessCount: 5,
      htmlOutput: null,
      snapshotData: null,
      deletedAt: null,
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));

    const result = await accessSharedReport('expired-token');

    expect(result.granted).toBe(false);
    expect(result.reason).toContain('verlopen');
  });
});

// ============================================================================
// Test: accessSharedReport with wrong password
// ============================================================================

describe('accessSharedReport — wrong password', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  test('denies access when no password provided for password-protected report', async () => {
    const report = {
      id: 'report-1',
      title: 'Test Report',
      type: 'MONTHLY',
      status: 'APPROVED',
      shareToken: 'protected-token',
      sharePassword: 'somesalt:somehash',
      shareExpiresAt: null,
      shareAccessCount: 0,
      htmlOutput: null,
      snapshotData: null,
      deletedAt: null,
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));

    const result = await accessSharedReport('protected-token');

    expect(result.granted).toBe(false);
    expect(result.reason).toContain('wachtwoord');
  });

  test('denies access with incorrect password', async () => {
    const report = {
      id: 'report-1',
      title: 'Test Report',
      type: 'MONTHLY',
      status: 'APPROVED',
      shareToken: 'protected-token',
      sharePassword: 'realsalt:realhash',
      shareExpiresAt: null,
      shareAccessCount: 0,
      htmlOutput: null,
      snapshotData: null,
      deletedAt: null,
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));

    const result = await accessSharedReport('protected-token', 'wrongpassword');

    expect(result.granted).toBe(false);
    expect(result.reason).toContain('onjuist');
  });

  test('denies access for report that is not approved', async () => {
    const report = {
      id: 'report-1',
      title: 'Test Report',
      type: 'MONTHLY',
      status: 'DRAFT',
      shareToken: 'draft-token',
      sharePassword: null,
      shareExpiresAt: null,
      shareAccessCount: 0,
      htmlOutput: null,
      snapshotData: null,
      deletedAt: null,
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));

    const result = await accessSharedReport('draft-token');

    expect(result.granted).toBe(false);
    expect(result.reason).toContain('niet goedgekeurd');
  });

  test('denies access for deleted report', async () => {
    const report = {
      id: 'report-1',
      title: 'Test Report',
      type: 'MONTHLY',
      status: 'APPROVED',
      shareToken: 'deleted-token',
      sharePassword: null,
      shareExpiresAt: null,
      shareAccessCount: 0,
      htmlOutput: null,
      snapshotData: null,
      deletedAt: new Date(),
    };

    mockFindUnique.mockImplementation(() => Promise.resolve(report));

    const result = await accessSharedReport('deleted-token');

    expect(result.granted).toBe(false);
    expect(result.reason).toContain('bestaat niet');
  });

  test('denies access for non-existent token', async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(null));

    const result = await accessSharedReport('nonexistent-token');

    expect(result.granted).toBe(false);
    expect(result.reason).toContain('bestaat niet');
  });
});

// ============================================================================
// Test: revokeShareLink
// ============================================================================

describe('revokeShareLink', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });

  test('removes share token, password, and expiry', async () => {
    mockUpdate.mockImplementation(() =>
      Promise.resolve({
        id: 'report-1',
        shareToken: null,
        sharePassword: null,
        shareExpiresAt: null,
        shareAccessCount: 0,
      })
    );

    await revokeShareLink('report-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          shareToken: null,
          sharePassword: null,
          shareExpiresAt: null,
          shareAccessCount: 0,
        }),
      })
    );
  });
});

// ============================================================================
// Test: addReportComment
// ============================================================================

describe('addReportComment', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  test('creates a comment for a report section', async () => {
    mockCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'comment-1', ...args.data })
    );

    const result = await addReportComment(
      'report-1',
      'section-1',
      'Deze grafiek klopt niet',
      'user-1'
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportId: 'report-1',
          sectionId: 'section-1',
          comment: 'Deze grafiek klopt niet',
          userId: 'user-1',
        }),
      })
    );
  });

  test('creates a comment without userId (anonymous)', async () => {
    mockCreate.mockImplementation((args: any) =>
      Promise.resolve({ id: 'comment-2', ...args.data })
    );

    await addReportComment(
      'report-1',
      null,
      'Anonieme feedback op rapport'
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportId: 'report-1',
          sectionId: null,
          comment: 'Anonieme feedback op rapport',
          userId: null,
        }),
      })
    );
  });
});

// ============================================================================
// Test: resolveComment
// ============================================================================

describe('resolveComment', () => {
  test('marks a comment as resolved', async () => {
    const mockCommentUpdate = mock(() =>
      Promise.resolve({ id: 'comment-1', resolved: true })
    );

    // Override the reportComment.update mock for this test
    const { db } = await import('@/lib/db');
    db.reportComment.update = mockCommentUpdate;

    const result = await resolveComment('comment-1');

    expect(mockCommentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comment-1' },
        data: { resolved: true },
      })
    );
  });
});
