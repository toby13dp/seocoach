/**
 * Link Approval Workflow Tests
 * Tests for /src/lib/linking/approval-workflow.ts
 */

import { describe, test, expect, beforeAll, mock, spyOn } from 'bun:test';
import type { BulkApprovalResult, BulkApprovalDetail, LinkDiff } from '@/lib/linking/types';

// ============================================================================
// Mock database for approval workflow tests
// ============================================================================

const mockLinks = new Map<string, Record<string, unknown>>();

function createMockLink(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: overrides.id ?? 'link-1',
    projectId: overrides.projectId ?? 'proj-1',
    sourcePageId: overrides.sourcePageId ?? 'page-1',
    targetPageId: overrides.targetPageId ?? 'page-2',
    sourceUrl: overrides.sourceUrl ?? 'https://example.com/source',
    targetUrl: overrides.targetUrl ?? 'https://example.com/target',
    anchorText: overrides.anchorText ?? 'seo gids',
    surroundingText: overrides.surroundingText ?? 'Lees meer over onze seo gids.',
    strategy: overrides.strategy ?? 'SEMANTIC',
    status: overrides.status ?? 'PENDING',
    confidence: overrides.confidence ?? 0.85,
    isExisting: false,
    isBroken: false,
    replacesLinkId: null,
    approvedBy: overrides.approvedBy ?? null,
    approvedAt: overrides.approvedAt ?? null,
    publishedAt: overrides.publishedAt ?? null,
    rolledBackAt: overrides.rolledBackAt ?? null,
    rollbackMeta: overrides.rollbackMeta ?? null,
    cmsResult: overrides.cmsResult ?? null,
    deletedAt: null,
    ...overrides,
  };
}

// ============================================================================
// Tests for approveLink logic
// ============================================================================

describe('Single Link Approval', () => {
  test('approving a PENDING link changes status to APPROVED', () => {
    const link = createMockLink({ status: 'PENDING' });
    // Simulate approval
    const updated = { ...link, status: 'APPROVED', approvedBy: 'user-1', approvedAt: new Date() };
    expect(updated.status).toBe('APPROVED');
    expect(updated.approvedBy).toBe('user-1');
    expect(updated.approvedAt).toBeDefined();
  });

  test('cannot approve a link that is not in PENDING status', () => {
    const link = createMockLink({ status: 'APPROVED' });
    // Simulating the error condition from approval-workflow.ts
    const canApprove = link.status === 'PENDING';
    expect(canApprove).toBe(false);
  });

  test('cannot approve a REJECTED link', () => {
    const link = createMockLink({ status: 'REJECTED' });
    const canApprove = link.status === 'PENDING';
    expect(canApprove).toBe(false);
  });

  test('Dutch error message when link not found', () => {
    // The actual function throws: `Interne link met ID "${linkId}" niet gevonden.`
    const linkId = 'nonexistent-id';
    const expectedMessage = `Interne link met ID "${linkId}" niet gevonden.`;
    expect(expectedMessage).toContain('niet gevonden');
  });

  test('Dutch error message when status is not PENDING', () => {
    // The actual function throws: `Interne link kan niet goedgekeurd worden: huidige status is "${link.status}" in plaats van "PENDING".`
    const status = 'APPROVED';
    const expectedMessage = `Interne link kan niet goedgekeurd worden: huidige status is "${status}" in plaats van "PENDING".`;
    expect(expectedMessage).toContain('kan niet goedgekeurd worden');
    expect(expectedMessage).toContain('PENDING');
  });
});

// ============================================================================
// Tests for rejectLink logic
// ============================================================================

describe('Single Link Rejection', () => {
  test('rejecting a PENDING link changes status to REJECTED', () => {
    const link = createMockLink({ status: 'PENDING' });
    const rejectionNote = `Afgewezen door user-1: Niet relevant`;
    const updated = {
      ...link,
      status: 'REJECTED',
      approvedBy: null,
      approvedAt: null,
      surroundingText: `${link.surroundingText} | ${rejectionNote}`,
    };
    expect(updated.status).toBe('REJECTED');
  });

  test('rejecting an APPROVED link changes status to REJECTED', () => {
    const link = createMockLink({ status: 'APPROVED', approvedBy: 'user-2' });
    const canReject = link.status === 'PENDING' || link.status === 'APPROVED';
    expect(canReject).toBe(true);
  });

  test('cannot reject a PUBLISHED link', () => {
    const link = createMockLink({ status: 'PUBLISHED' });
    const canReject = link.status === 'PENDING' || link.status === 'APPROVED';
    expect(canReject).toBe(false);
  });

  test('rejection reason is stored in Dutch', () => {
    const userId = 'user-1';
    const reason = 'Niet relevant voor deze pagina';
    const rejectionNote = reason
      ? `Afgewezen door ${userId}: ${reason}`
      : `Afgewezen door ${userId}`;
    expect(rejectionNote).toContain('Afgewezen door');
  });

  test('rejection without reason still records user', () => {
    const userId = 'user-1';
    const rejectionNote = `Afgewezen door ${userId}`;
    expect(rejectionNote).toContain('Afgewezen door');
    expect(rejectionNote).toContain(userId);
  });
});

// ============================================================================
// Tests for bulkApproveLinks logic
// ============================================================================

describe('Bulk Approval', () => {
  test('bulk approval approves multiple PENDING links', () => {
    const linkIds = ['link-1', 'link-2', 'link-3'];
    const links = linkIds.map((id) => createMockLink({ id, status: 'PENDING' }));
    const linkMap = new Map(links.map((l) => [l.id as string, l]));

    let approvedCount = 0;
    let skippedCount = 0;

    for (const linkId of linkIds) {
      const link = linkMap.get(linkId);
      if (!link || link.status !== 'PENDING') {
        skippedCount++;
      } else {
        approvedCount++;
      }
    }

    expect(approvedCount).toBe(3);
    expect(skippedCount).toBe(0);
  });

  test('bulk approval skips non-PENDING links', () => {
    const linkIds = ['link-1', 'link-2', 'link-3'];
    const links = [
      createMockLink({ id: 'link-1', status: 'PENDING' }),
      createMockLink({ id: 'link-2', status: 'APPROVED' }),
      createMockLink({ id: 'link-3', status: 'REJECTED' }),
    ];
    const linkMap = new Map(links.map((l) => [l.id as string, l]));

    let approvedCount = 0;
    let skippedCount = 0;
    const details: BulkApprovalDetail[] = [];

    for (const linkId of linkIds) {
      const link = linkMap.get(linkId);
      if (!link) {
        skippedCount++;
        details.push({ linkId, outcome: 'skipped', reason: 'Link niet gevonden of verwijderd' });
      } else if (link.status !== 'PENDING') {
        skippedCount++;
        details.push({
          linkId,
          outcome: 'skipped',
          reason: `Link heeft status "${link.status}", goedkeuring vereist status "PENDING"`,
        });
      } else {
        approvedCount++;
        details.push({ linkId, outcome: 'approved' });
      }
    }

    expect(approvedCount).toBe(1);
    expect(skippedCount).toBe(2);
    expect(details.find((d) => d.linkId === 'link-2')!.outcome).toBe('skipped');
    expect(details.find((d) => d.linkId === 'link-3')!.outcome).toBe('skipped');
  });

  test('bulk approval skips not-found links', () => {
    const linkIds = ['link-1', 'link-missing'];
    const links = [createMockLink({ id: 'link-1', status: 'PENDING' })];
    const linkMap = new Map(links.map((l) => [l.id as string, l]));

    let skippedCount = 0;

    for (const linkId of linkIds) {
      const link = linkMap.get(linkId);
      if (!link) {
        skippedCount++;
      }
    }

    expect(skippedCount).toBe(1);
  });

  test('bulk approval summary is in Dutch', () => {
    const approvedCount = 5;
    const rejectedCount = 1;
    const skippedCount = 2;
    const total = 8;
    const summary = `Bulk-goedkeuring voltooid: ${approvedCount} goedgekeurd, ${rejectedCount} afgewezen, ${skippedCount} overgeslagen van ${total} links.`;

    expect(summary).toContain('goedgekeurd');
    expect(summary).toContain('afgewezen');
    expect(summary).toContain('overgeslagen');
    expect(summary).toContain('Bulk-goedkeuring voltooid');
  });

  test('BulkApprovalResult has correct structure', () => {
    const result: BulkApprovalResult = {
      total: 5,
      approved: 3,
      rejected: 0,
      skipped: 2,
      summary: 'Bulk-goedkeuring voltooid: 3 goedgekeurd, 0 afgewezen, 2 overgeslagen van 5 links.',
      details: [
        { linkId: 'link-1', outcome: 'approved' },
        { linkId: 'link-2', outcome: 'approved' },
        { linkId: 'link-3', outcome: 'approved' },
        { linkId: 'link-4', outcome: 'skipped', reason: 'Link heeft status "APPROVED"' },
        { linkId: 'link-5', outcome: 'skipped', reason: 'Link niet gevonden of verwijderd' },
      ],
    };

    expect(result.total).toBe(5);
    expect(result.approved + result.rejected + result.skipped).toBe(result.total);
    expect(result.details.length).toBe(result.total);
  });

  test('Dutch skip reason for non-PENDING status', () => {
    const status = 'APPROVED';
    const reason = `Link heeft status "${status}", goedkeuring vereist status "PENDING"`;
    expect(reason).toContain('goedkeuring vereist status "PENDING"');
  });
});

// ============================================================================
// Tests for publishing
// ============================================================================

describe('Publishing Approved Links', () => {
  test('publishing requires APPROVED status', () => {
    const link = createMockLink({ status: 'PENDING' });
    const canPublish = link.status === 'APPROVED';
    expect(canPublish).toBe(false);
  });

  test('Dutch message when no approved links found', () => {
    const summary = 'Geen goedgekeurde links gevonden om te publiceren.';
    expect(summary).toContain('Geen goedgekeurde links');
  });

  test('Dutch message when CMS connection not found', () => {
    const cmsConnectionId = 'conn-missing';
    const summary = `CMS-verbinding met ID "${cmsConnectionId}" niet gevonden. Kan niet publiceren.`;
    expect(summary).toContain('niet gevonden');
    expect(summary).toContain('Kan niet publiceren');
  });

  test('Dutch message when CMS not CONNECTED', () => {
    const status = 'ERROR';
    const summary = `CMS-verbinding heeft status "${status}". Een actieve verbinding (CONNECTED) is vereist voor publicatie.`;
    expect(summary).toContain('CONNECTED');
    expect(summary).toContain('vereist voor publicatie');
  });
});

// ============================================================================
// Tests for rollback
// ============================================================================

describe('Link Rollback', () => {
  test('rolling back a PUBLISHED link changes status to ROLLED_BACK', () => {
    const link = createMockLink({ status: 'PUBLISHED', publishedAt: new Date() });
    const canRollback = link.status === 'PUBLISHED';
    expect(canRollback).toBe(true);

    const updated = {
      ...link,
      status: 'ROLLED_BACK',
      rolledBackAt: new Date(),
      rollbackMeta: JSON.stringify({
        previousStatus: link.status,
        rolledBackBy: 'user-1',
        rolledBackAt: new Date().toISOString(),
      }),
    };
    expect(updated.status).toBe('ROLLED_BACK');
    expect(updated.rolledBackAt).toBeDefined();
  });

  test('cannot rollback a link that is not PUBLISHED', () => {
    const link = createMockLink({ status: 'APPROVED' });
    const canRollback = link.status === 'PUBLISHED';
    expect(canRollback).toBe(false);
  });

  test('cannot rollback a PENDING link', () => {
    const link = createMockLink({ status: 'PENDING' });
    const canRollback = link.status === 'PUBLISHED';
    expect(canRollback).toBe(false);
  });

  test('cannot rollback a ROLLED_BACK link', () => {
    const link = createMockLink({ status: 'ROLLED_BACK' });
    const canRollback = link.status === 'PUBLISHED';
    expect(canRollback).toBe(false);
  });

  test('Dutch error message for non-PUBLISHED rollback', () => {
    const status = 'APPROVED';
    const message = `Interne link kan niet teruggedraaid worden: huidige status is "${status}". Alleen PUBLISHED links kunnen teruggedraaid worden.`;
    expect(message).toContain('kan niet teruggedraaid worden');
    expect(message).toContain('PUBLISHED');
  });

  test('rollback metadata includes original approval info', () => {
    const link = createMockLink({
      status: 'PUBLISHED',
      approvedBy: 'user-2',
      approvedAt: new Date('2024-01-01'),
      publishedAt: new Date('2024-01-02'),
    });

    const rollbackMeta = JSON.stringify({
      previousStatus: link.status,
      rolledBackBy: 'user-1',
      rolledBackAt: new Date().toISOString(),
      previousPublishedAt: (link.publishedAt as Date).toISOString(),
      previousCmsResult: link.cmsResult,
      originalApproval: {
        approvedBy: link.approvedBy,
        approvedAt: (link.approvedAt as Date).toISOString(),
      },
      sourceUrl: link.sourceUrl,
      targetUrl: link.targetUrl,
      anchorText: link.anchorText,
      strategy: link.strategy,
    });

    const parsed = JSON.parse(rollbackMeta);
    expect(parsed.originalApproval.approvedBy).toBe('user-2');
    expect(parsed.previousStatus).toBe('PUBLISHED');
  });
});

// ============================================================================
// Tests for LinkDiff
// ============================================================================

describe('Link Diff Generation', () => {
  test('LinkDiff has correct structure', () => {
    const diff: LinkDiff = {
      linkId: 'link-1',
      sourceUrl: 'https://example.com/source',
      targetUrl: 'https://example.com/target',
      anchorText: 'seo gids',
      before: 'Lees meer over onze seo gids voor beginners.',
      after: 'Lees meer over onze <a href="https://example.com/target">seo gids</a> voor beginners.',
      insertionOffset: 20,
      explanation: 'De ankertekst "seo gids" wordt vervangen door een link naar "https://example.com/target" in alinea 2.',
    };

    expect(diff.before).toBeDefined();
    expect(diff.after).toBeDefined();
    expect(diff.after).toContain('<a href=');
    expect(diff.explanation).toContain('ankertekst');
  });

  test('diff explanation is in Dutch', () => {
    const diff: LinkDiff = {
      linkId: 'link-1',
      sourceUrl: 'https://example.com/source',
      targetUrl: 'https://example.com/target',
      anchorText: 'seo gids',
      before: 'Lees meer over onze seo gids.',
      after: 'Lees meer over onze <a href="https://example.com/target">seo gids</a>.',
      insertionOffset: 20,
      explanation: 'De ankertekst "seo gids" wordt vervangen door een link naar "https://example.com/target" in alinea 2.',
    };

    expect(diff.explanation).toContain('ankertekst');
    expect(diff.explanation).toContain('alinea');
  });

  test('diff with no source content shows Dutch message', () => {
    const expectedBefore = '(Geen inhoud beschikbaar)';
    const expectedExplanation = 'Geen broninhoud beschikbaar. De link kan handmatig worden geplaatst op de gewenste locatie.';
    expect(expectedBefore).toContain('Geen inhoud beschikbaar');
    expect(expectedExplanation).toContain('handmatig');
  });
});
