/**
 * Response Drafter Tests
 * Tests for /src/lib/reviews/response-drafter.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// ============================================================================
// Mock database for response drafter tests
// ============================================================================

const mockReviewFindFirst = mock(() => Promise.resolve(null));
const mockReviewUpdate = mock(() => Promise.resolve({}));
const mockReviewResponseFindFirst = mock(() => Promise.resolve(null));
const mockReviewResponseCreate = mock(() => Promise.resolve({}));
const mockReviewResponseUpdate = mock(() => Promise.resolve({}));
const mockReviewResponseFindMany = mock(() => Promise.resolve([]));

mock.module('@/lib/db', () => ({
  db: {
    review: {
      findFirst: mockReviewFindFirst,
      findMany: mock(() => Promise.resolve([])),
      count: mock(() => Promise.resolve(0)),
      update: mockReviewUpdate,
      create: mock(() => Promise.resolve({})),
    },
    reviewResponse: {
      findFirst: mockReviewResponseFindFirst,
      findMany: mockReviewResponseFindMany,
      create: mockReviewResponseCreate,
      update: mockReviewResponseUpdate,
    },
  },
}));

// Import AFTER mock.module
import {
  generateResponseDraft,
  submitResponseForApproval,
  approveResponse,
  rejectResponse,
  updateResponseDraft,
  publishResponse,
  getReviewResponses,
} from '@/lib/reviews/response-drafter';

// ============================================================================
// Helper: Create a mock review
// ============================================================================

function createMockReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rev-1',
    projectId: 'proj-1',
    authorName: 'Jan de Vries',
    rating: 4,
    content: 'Goed product, snelle levering',
    title: 'Aanrader',
    source: 'GOOGLE',
    deletedAt: null,
    responseDraftId: null,
    ...overrides,
  };
}

function createMockResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'resp-1',
    projectId: 'proj-1',
    reviewId: 'rev-1',
    content: 'Bedankt voor uw beoordeling!',
    status: 'DRAFT',
    submittedBy: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    publishedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// generateResponseDraft — Creates DRAFT for positive/neutral/negative reviews
// ============================================================================

describe('generateResponseDraft — DRAFT creation', () => {
  beforeEach(() => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));
    mockReviewResponseFindFirst.mockImplementation(() => Promise.resolve(null));
    mockReviewResponseCreate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'resp-new', ...data, createdAt: new Date() })
    );
    mockReviewUpdate.mockImplementation(() => Promise.resolve({}));
  });

  test('throws Dutch error when review not found', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));

    expect(generateResponseDraft('nonexistent', 'proj-1')).rejects.toThrow('Review niet gevonden');
  });

  test('creates DRAFT status for positive review (4-5 stars)', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(createMockReview({ rating: 5 })));

    await generateResponseDraft('rev-1', 'proj-1');

    const createCall = mockReviewResponseCreate.mock.calls[mockReviewResponseCreate.mock.calls.length - 1];
    expect(createCall[0].data.status).toBe('DRAFT');
  });

  test('creates DRAFT status for neutral review (3 stars)', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(createMockReview({ rating: 3 })));

    await generateResponseDraft('rev-1', 'proj-1');

    const createCall = mockReviewResponseCreate.mock.calls[mockReviewResponseCreate.mock.calls.length - 1];
    expect(createCall[0].data.status).toBe('DRAFT');
  });

  test('creates DRAFT status for negative review (1-2 stars)', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(createMockReview({ rating: 1 })));

    await generateResponseDraft('rev-1', 'proj-1');

    const createCall = mockReviewResponseCreate.mock.calls[mockReviewResponseCreate.mock.calls.length - 1];
    expect(createCall[0].data.status).toBe('DRAFT');
  });

  test('positive review response thanks the customer', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(createMockReview({ rating: 5, authorName: 'Jan' })));

    await generateResponseDraft('rev-1', 'proj-1');

    const createCall = mockReviewResponseCreate.mock.calls[mockReviewResponseCreate.mock.calls.length - 1];
    const content = createCall[0].data.content;
    expect(content).toContain('Beste Jan');
    expect(content).toContain('Hartelijk dank');
  });

  test('negative review response apologizes and offers resolution', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(
      createMockReview({ rating: 1, content: 'Kapot product, langzame levering', authorName: 'Piet' })
    ));

    await generateResponseDraft('rev-1', 'proj-1');

    const createCall = mockReviewResponseCreate.mock.calls[mockReviewResponseCreate.mock.calls.length - 1];
    const content = createCall[0].data.content;
    expect(content).toContain('Het spijt ons');
    expect(content).toContain('contact');
  });

  test('neutral review response asks for improvement feedback', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(
      createMockReview({ rating: 3, authorName: 'Klaas' })
    ));

    await generateResponseDraft('rev-1', 'proj-1');

    const createCall = mockReviewResponseCreate.mock.calls[mockReviewResponseCreate.mock.calls.length - 1];
    const content = createCall[0].data.content;
    expect(content).toContain('verbeteren');
  });

  test('response templates are in Dutch', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(createMockReview({ rating: 4 })));

    await generateResponseDraft('rev-1', 'proj-1');

    const createCall = mockReviewResponseCreate.mock.calls[mockReviewResponseCreate.mock.calls.length - 1];
    const content = createCall[0].data.content;
    expect(content).toContain('Met vriendelijke groet');
  });

  test('returns existing DRAFT if one already exists', async () => {
    const existingDraft = createMockResponse({ status: 'DRAFT' });
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(
      createMockReview({ responseDraftId: 'resp-existing' })
    ));
    mockReviewResponseFindFirst.mockImplementation(() => Promise.resolve(existingDraft));

    const result = await generateResponseDraft('rev-1', 'proj-1');
    expect(result).toEqual(existingDraft);
  });

  test('links draft to review via responseDraftId', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(createMockReview()));

    await generateResponseDraft('rev-1', 'proj-1');

    const updateCall = mockReviewUpdate.mock.calls[mockReviewUpdate.mock.calls.length - 1];
    expect(updateCall[0].where.id).toBe('rev-1');
    expect(updateCall[0].data.responseDraftId).toBeDefined();
  });
});

// ============================================================================
// submitResponseForApproval — DRAFT → PENDING_APPROVAL
// ============================================================================

describe('submitResponseForApproval — DRAFT → PENDING_APPROVAL', () => {
  beforeEach(() => {
    mockReviewResponseFindFirst.mockImplementation(() => Promise.resolve(null));
    mockReviewResponseUpdate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'resp-1', ...data })
    );
  });

  test('throws Dutch error when response not found', async () => {
    mockReviewResponseFindFirst.mockImplementation(() => Promise.resolve(null));

    expect(submitResponseForApproval('nonexistent', 'proj-1', 'user-1')).rejects.toThrow('Reactie niet gevonden');
  });

  test('submits DRAFT response for approval', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'DRAFT' }))
    );

    await submitResponseForApproval('resp-1', 'proj-1', 'user-1');

    const updateCall = mockReviewResponseUpdate.mock.calls[mockReviewResponseUpdate.mock.calls.length - 1];
    expect(updateCall[0].data.status).toBe('PENDING_APPROVAL');
    expect(updateCall[0].data.submittedBy).toBe('user-1');
  });

  test('cannot submit for approval if status is not DRAFT', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'PENDING_APPROVAL' }))
    );

    expect(submitResponseForApproval('resp-1', 'proj-1', 'user-1')).rejects.toThrow('Alleen concept-reacties');
  });

  test('cannot submit APPROVED response for approval', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'APPROVED' }))
    );

    expect(submitResponseForApproval('resp-1', 'proj-1', 'user-1')).rejects.toThrow('Alleen concept-reacties');
  });

  test('cannot submit REJECTED response for approval', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'REJECTED' }))
    );

    expect(submitResponseForApproval('resp-1', 'proj-1', 'user-1')).rejects.toThrow('Alleen concept-reacties');
  });
});

// ============================================================================
// approveResponse — PENDING_APPROVAL → APPROVED
// ============================================================================

describe('approveResponse — PENDING_APPROVAL → APPROVED', () => {
  beforeEach(() => {
    mockReviewResponseFindFirst.mockImplementation(() => Promise.resolve(null));
    mockReviewResponseUpdate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'resp-1', ...data })
    );
  });

  test('approves a PENDING_APPROVAL response', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'PENDING_APPROVAL' }))
    );

    await approveResponse('resp-1', 'proj-1', 'user-2');

    const updateCall = mockReviewResponseUpdate.mock.calls[mockReviewResponseUpdate.mock.calls.length - 1];
    expect(updateCall[0].data.status).toBe('APPROVED');
    expect(updateCall[0].data.reviewedBy).toBe('user-2');
    expect(updateCall[0].data.reviewedAt).toBeInstanceOf(Date);
  });

  test('cannot approve if status is not PENDING_APPROVAL', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'DRAFT' }))
    );

    expect(approveResponse('resp-1', 'proj-1', 'user-2')).rejects.toThrow('Alleen reacties die wachten op goedkeuring');
  });

  test('cannot approve an already APPROVED response', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'APPROVED' }))
    );

    expect(approveResponse('resp-1', 'proj-1', 'user-2')).rejects.toThrow('Alleen reacties die wachten op goedkeuring');
  });

  test('cannot approve a REJECTED response', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'REJECTED' }))
    );

    expect(approveResponse('resp-1', 'proj-1', 'user-2')).rejects.toThrow('Alleen reacties die wachten op goedkeuring');
  });

  test('cannot approve a PUBLISHED response', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'PUBLISHED' }))
    );

    expect(approveResponse('resp-1', 'proj-1', 'user-2')).rejects.toThrow('Alleen reacties die wachten op goedkeuring');
  });
});

// ============================================================================
// rejectResponse — PENDING_APPROVAL → REJECTED
// ============================================================================

describe('rejectResponse — PENDING_APPROVAL → REJECTED', () => {
  beforeEach(() => {
    mockReviewResponseFindFirst.mockImplementation(() => Promise.resolve(null));
    mockReviewResponseUpdate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'resp-1', ...data })
    );
  });

  test('rejects a PENDING_APPROVAL response with Dutch reason', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'PENDING_APPROVAL' }))
    );

    await rejectResponse('resp-1', 'proj-1', 'user-2', 'Toon is niet professioneel genoeg');

    const updateCall = mockReviewResponseUpdate.mock.calls[mockReviewResponseUpdate.mock.calls.length - 1];
    expect(updateCall[0].data.status).toBe('REJECTED');
    expect(updateCall[0].data.reviewedBy).toBe('user-2');
    expect(updateCall[0].data.rejectionReason).toBe('Toon is niet professioneel genoeg');
    expect(updateCall[0].data.reviewedAt).toBeInstanceOf(Date);
  });

  test('cannot reject if status is not PENDING_APPROVAL', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'DRAFT' }))
    );

    expect(rejectResponse('resp-1', 'proj-1', 'user-2', 'Reden')).rejects.toThrow('Alleen reacties die wachten op goedkeuring kunnen worden afgewezen');
  });

  test('cannot reject an APPROVED response', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'APPROVED' }))
    );

    expect(rejectResponse('resp-1', 'proj-1', 'user-2', 'Reden')).rejects.toThrow('Alleen reacties die wachten op goedkeuring kunnen worden afgewezen');
  });
});

// ============================================================================
// updateResponseDraft — Can update DRAFT or REJECTED responses
// ============================================================================

describe('updateResponseDraft — editing drafts and rejected responses', () => {
  beforeEach(() => {
    mockReviewResponseFindFirst.mockImplementation(() => Promise.resolve(null));
    mockReviewResponseUpdate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'resp-1', ...data })
    );
  });

  test('can update content if status is DRAFT', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'DRAFT' }))
    );

    await updateResponseDraft('resp-1', 'proj-1', 'Nieuwe reactie tekst');

    const updateCall = mockReviewResponseUpdate.mock.calls[mockReviewResponseUpdate.mock.calls.length - 1];
    expect(updateCall[0].data.content).toBe('Nieuwe reactie tekst');
    expect(updateCall[0].data.status).toBe('DRAFT');
  });

  test('can update content if status is REJECTED (resets to DRAFT)', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'REJECTED', rejectionReason: 'Oud probleem' }))
    );

    await updateResponseDraft('resp-1', 'proj-1', 'Herziene reactie');

    const updateCall = mockReviewResponseUpdate.mock.calls[mockReviewResponseUpdate.mock.calls.length - 1];
    expect(updateCall[0].data.content).toBe('Herziene reactie');
    expect(updateCall[0].data.status).toBe('DRAFT');
    expect(updateCall[0].data.rejectionReason).toBeNull();
  });

  test('cannot update content if status is PENDING_APPROVAL', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'PENDING_APPROVAL' }))
    );

    expect(updateResponseDraft('resp-1', 'proj-1', 'Aangepast')).rejects.toThrow('Alleen concept- of afgewezen reacties kunnen worden bewerkt');
  });

  test('cannot update content if status is APPROVED', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'APPROVED' }))
    );

    expect(updateResponseDraft('resp-1', 'proj-1', 'Aangepast')).rejects.toThrow('Alleen concept- of afgewezen reacties kunnen worden bewerkt');
  });

  test('cannot update content if status is PUBLISHED', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'PUBLISHED' }))
    );

    expect(updateResponseDraft('resp-1', 'proj-1', 'Aangepast')).rejects.toThrow('Alleen concept- of afgewezen reacties kunnen worden bewerkt');
  });

  test('throws Dutch error when response not found', async () => {
    mockReviewResponseFindFirst.mockImplementation(() => Promise.resolve(null));

    expect(updateResponseDraft('nonexistent', 'proj-1', 'Tekst')).rejects.toThrow('Reactie niet gevonden');
  });
});

// ============================================================================
// publishResponse — APPROVED → PUBLISHED
// ============================================================================

describe('publishResponse — APPROVED → PUBLISHED', () => {
  beforeEach(() => {
    mockReviewResponseFindFirst.mockImplementation(() => Promise.resolve(null));
    mockReviewResponseUpdate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'resp-1', ...data })
    );
  });

  test('publishes an APPROVED response', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'APPROVED' }))
    );

    await publishResponse('resp-1', 'proj-1');

    const updateCall = mockReviewResponseUpdate.mock.calls[mockReviewResponseUpdate.mock.calls.length - 1];
    expect(updateCall[0].data.status).toBe('PUBLISHED');
    expect(updateCall[0].data.publishedAt).toBeInstanceOf(Date);
  });

  test('cannot publish directly from DRAFT (must go through approval first)', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'DRAFT' }))
    );

    expect(publishResponse('resp-1', 'proj-1')).rejects.toThrow('Alleen goedgekeurde reacties kunnen worden gepubliceerd');
  });

  test('cannot publish if status is PENDING_APPROVAL', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'PENDING_APPROVAL' }))
    );

    expect(publishResponse('resp-1', 'proj-1')).rejects.toThrow('Alleen goedgekeurde reacties kunnen worden gepubliceerd');
  });

  test('cannot publish if status is REJECTED', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'REJECTED' }))
    );

    expect(publishResponse('resp-1', 'proj-1')).rejects.toThrow('Alleen goedgekeurde reacties kunnen worden gepubliceerd');
  });

  test('cannot publish if already PUBLISHED', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'PUBLISHED' }))
    );

    expect(publishResponse('resp-1', 'proj-1')).rejects.toThrow('Alleen goedgekeurde reacties kunnen worden gepubliceerd');
  });

  test('error message mentions the approval process requirement', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'DRAFT' }))
    );

    try {
      await publishResponse('resp-1', 'proj-1');
    } catch (error) {
      expect((error as Error).message).toContain('goedkeuringsproces');
    }
  });
});

// ============================================================================
// getReviewResponses — Query responses for a review
// ============================================================================

describe('getReviewResponses — query review responses', () => {
  test('throws Dutch error when review not found', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(null));

    expect(getReviewResponses('nonexistent', 'proj-1')).rejects.toThrow('Review niet gevonden');
  });

  test('returns responses for a valid review', async () => {
    mockReviewFindFirst.mockImplementation(() => Promise.resolve(createMockReview()));
    mockReviewResponseFindMany.mockImplementation(() =>
      Promise.resolve([
        createMockResponse({ id: 'resp-1', status: 'PUBLISHED' }),
        createMockResponse({ id: 'resp-2', status: 'DRAFT' }),
      ])
    );

    const result = await getReviewResponses('rev-1', 'proj-1');
    expect(result.length).toBe(2);
  });
});

// ============================================================================
// CRITICAL WORKFLOW — End-to-end state transition tests
// ============================================================================

describe('CRITICAL WORKFLOW — full approval pipeline', () => {
  test('complete flow: DRAFT → PENDING_APPROVAL → APPROVED → PUBLISHED', async () => {
    // Step 1: DRAFT
    let currentStatus = 'DRAFT';
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: currentStatus }))
    );
    mockReviewResponseUpdate.mockImplementation(({ data }: any) => {
      currentStatus = data.status;
      return Promise.resolve(createMockResponse({ status: data.status }));
    });

    // Submit for approval
    await submitResponseForApproval('resp-1', 'proj-1', 'user-1');
    expect(currentStatus).toBe('PENDING_APPROVAL');

    // Approve
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'PENDING_APPROVAL' }))
    );
    await approveResponse('resp-1', 'proj-1', 'user-2');
    expect(currentStatus).toBe('APPROVED');

    // Publish
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'APPROVED' }))
    );
    await publishResponse('resp-1', 'proj-1');
    expect(currentStatus).toBe('PUBLISHED');
  });

  test('rejected flow: DRAFT → PENDING_APPROVAL → REJECTED → DRAFT (after edit)', async () => {
    // Submit draft
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'DRAFT' }))
    );
    await submitResponseForApproval('resp-1', 'proj-1', 'user-1');

    // Reject
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'PENDING_APPROVAL' }))
    );
    await rejectResponse('resp-1', 'proj-1', 'user-2', 'Niet professioneel');

    // Edit rejected → back to DRAFT
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'REJECTED' }))
    );
    mockReviewResponseUpdate.mockImplementation(({ data }: any) =>
      Promise.resolve(createMockResponse({ status: data.status }))
    );

    await updateResponseDraft('resp-1', 'proj-1', 'Verbeterde reactie');

    const updateCall = mockReviewResponseUpdate.mock.calls[mockReviewResponseUpdate.mock.calls.length - 1];
    expect(updateCall[0].data.status).toBe('DRAFT');
  });

  test('cannot skip approval step (DRAFT → PUBLISHED is blocked)', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'DRAFT' }))
    );

    expect(publishResponse('resp-1', 'proj-1')).rejects.toThrow();
  });

  test('cannot skip approval step (PENDING_APPROVAL → PUBLISHED is blocked)', async () => {
    mockReviewResponseFindFirst.mockImplementation(() =>
      Promise.resolve(createMockResponse({ status: 'PENDING_APPROVAL' }))
    );

    expect(publishResponse('resp-1', 'proj-1')).rejects.toThrow();
  });
});
