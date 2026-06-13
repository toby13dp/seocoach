// ============================================================================
// Reviews & Reputation — Response Drafter
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Generates Dutch response drafts for reviews using template-based rules.
// Enforces approval-first workflow: responses are ALWAYS created as DRAFT,
// must go through PENDING_APPROVAL, and cannot be published directly from DRAFT.
// All response content is in Dutch.
// ============================================================================

import { ReviewResponseStatus } from '@prisma/client';
import { db } from '@/lib/db';

// ============================================================================
// Response Templates (Dutch)
// ============================================================================

/**
 * Generate a Dutch response draft for a positive review (4-5 stars).
 * Thanks the customer and mentions specific aspects.
 */
function draftPositiveResponse(review: {
  authorName?: string | null;
  rating: number;
  content?: string | null;
  title?: string | null;
}): string {
  const name = review.authorName ? ` ${review.authorName}` : '';
  const parts: string[] = [];

  parts.push(`Beste${name},`);

  // Thank the customer
  if (review.rating === 5) {
    parts.push('Wat fantastisch om te horen dat u zo positief over ons bent! Hartelijk dank voor uw geweldige beoordeling.');
  } else {
    parts.push('Hartelijk dank voor uw positieve beoordeling! We zijn blij dat u tevreden bent.');
  }

  // Add specific acknowledgment if content mentions themes
  const text = `${review.title ?? ''} ${review.content ?? ''}`.toLowerCase();

  if (text.includes('levering') || text.includes('bezorging') || text.includes('snel')) {
    parts.push('We doen ons best om snel te leveren en het is fijn om te zien dat dit gewaardeerd wordt.');
  }
  if (text.includes('kwaliteit')) {
    parts.push('Kwaliteit staat bij ons hoog in het vaandel, dus uw compliment over de kwaliteit doet ons goed.');
  }
  if (text.includes('service') || text.includes('klantenservice') || text.includes('vriendelijk')) {
    parts.push('Onze klantenservice is een belangrijk onderdeel van onze service, dus bedankt voor het positieve feedback hierover.');
  }
  if (text.includes('prijs')) {
    parts.push('We streven naar een eerlijke prijs-kwaliteitverhouding en zijn blij dat dit bevestigd wordt.');
  }

  // Closing
  parts.push('We hopen u graag weer te mogen verwelkomen als klant.');

  parts.push('Met vriendelijke groet,');
  parts.push('Het team');

  return parts.join('\n\n');
}

/**
 * Generate a Dutch response draft for a neutral review (3 stars).
 * Thanks the customer and asks for feedback on how to improve.
 */
function draftNeutralResponse(review: {
  authorName?: string | null;
  rating: number;
  content?: string | null;
  title?: string | null;
}): string {
  const name = review.authorName ? ` ${review.authorName}` : '';
  const parts: string[] = [];

  parts.push(`Beste${name},`);

  parts.push('Bedankt voor uw beoordeling. We stellen het op prijs dat u de tijd heeft genomen om uw ervaring met ons te delen.');

  // Acknowledge what's mentioned
  const text = `${review.title ?? ''} ${review.content ?? ''}`.toLowerCase();

  if (text.includes('levering') || text.includes('bezorging')) {
    parts.push('We begrijpen dat de levering niet geheel aan uw verwachtingen heeft voldaan. We werken continu aan het verbeteren van onze levertijden.');
  }
  if (text.includes('service') || text.includes('klantenservice')) {
    parts.push('We nemen uw feedback over onze service ter harte en zullen kijken hoe we dit kunnen verbeteren.');
  }
  if (text.includes('prijs')) {
    parts.push('Uw opmerking over de prijs nemen we mee. We streven altijd naar een eerlijke prijs-kwaliteitverhouding.');
  }

  // Ask for more feedback
  parts.push('Zou u ons willen laten weten wat we kunnen verbeteren om uw ervaring naar 4 of 5 sterren te tillen? Uw feedback helpt ons om onze service te verbeteren.');

  parts.push('Met vriendelijke groet,');
  parts.push('Het team');

  return parts.join('\n\n');
}

/**
 * Generate a Dutch response draft for a negative review (1-2 stars).
 * Apologizes, offers resolution, and invites the customer to contact us.
 */
function draftNegativeResponse(review: {
  authorName?: string | null;
  rating: number;
  content?: string | null;
  title?: string | null;
}): string {
  const name = review.authorName ? ` ${review.authorName}` : '';
  const parts: string[] = [];

  parts.push(`Beste${name},`);

  // Apologize
  parts.push('Het spijt ons te horen dat uw ervaring niet aan uw verwachtingen heeft voldaan. Dit is niet de indruk die we willen achterlaten, en we nemen uw feedback zeer serieus.');

  // Address specific issues
  const text = `${review.title ?? ''} ${review.content ?? ''}`.toLowerCase();

  if (text.includes('levering') || text.includes('bezorging') || text.includes('langzaam') || text.includes('trage')) {
    parts.push('We begrijpen uw frustratie over de levering. Dit is niet de standaard die we onszelf stellen en we zullen dit intern aanscherpen.');
  }
  if (text.includes('kapot') || text.includes('defect') || text.includes('beschadigd')) {
    parts.push('Het is onacceptabel dat u een beschadigd of defect product heeft ontvangen. We willen dit graag zo snel mogelijk voor u oplossen.');
  }
  if (text.includes('klantenservice') || text.includes('service') || text.includes('geen reactie') || text.includes('onvriendelijk')) {
    parts.push('Uw ervaring met onze klantenservice is niet wat we nastreven. We zullen dit direct intern bespreken en verbeteren.');
  }
  if (text.includes('retour') || text.includes('ruilen') || text.includes('terugbetaling')) {
    parts.push('We begrijpen dat het retourproces niet soepel is verlopen. Dit zou eenvoudiger moeten zijn en we gaan dit verbeteren.');
  }
  if (text.includes('verkeerd') && (text.includes('product') || text.includes('artikel'))) {
    parts.push('Het leveren van het verkeerde product is een fout die we hadden moeten voorkomen. Onze excuses hiervoor.');
  }

  // Offer resolution
  parts.push('We willen dit graag voor u oplossen. Neem gerust contact met ons op via [e-mail/telefoon] zodat we een passende oplossing kunnen bieden.');

  // Closing
  parts.push('We hopen dat u ons de kans geeft om uw vertrouwen terug te winnen.');

  parts.push('Met vriendelijke groet,');
  parts.push('Het team');

  return parts.join('\n\n');
}

/**
 * Select and generate the appropriate response template based on rating.
 * All responses are in Dutch.
 */
function generateTemplateResponse(review: {
  authorName?: string | null;
  rating: number;
  content?: string | null;
  title?: string | null;
}): string {
  if (review.rating >= 4) {
    return draftPositiveResponse(review);
  } else if (review.rating === 3) {
    return draftNeutralResponse(review);
  } else {
    return draftNegativeResponse(review);
  }
}

// ============================================================================
// Response Draft Generation
// ============================================================================

/**
 * Generate a response draft for a review.
 *
 * CRITICAL: The response is ALWAYS created with DRAFT status.
 * It must go through the full approval workflow before publication.
 * Direct publishing from DRAFT is NOT allowed.
 *
 * @param reviewId - The review to generate a response for
 * @param projectId - The project ID for tenant isolation
 * @returns The created ReviewResponse in DRAFT status
 */
export async function generateResponseDraft(
  reviewId: string,
  projectId: string
) {
  // Fetch the review
  const review = await db.review.findFirst({
    where: {
      id: reviewId,
      projectId,
      deletedAt: null,
    },
  });

  if (!review) {
    throw new Error(`Review niet gevonden (ID: ${reviewId})`);
  }

  // Check if there's already a draft response
  if (review.responseDraftId) {
    const existingDraft = await db.reviewResponse.findFirst({
      where: {
        id: review.responseDraftId,
        projectId,
      },
    });

    if (existingDraft && existingDraft.status === ('DRAFT' as ReviewResponseStatus)) {
      // Return existing draft - don't create duplicate
      return existingDraft;
    }
  }

  // Generate Dutch response content using template
  const content = generateTemplateResponse({
    authorName: review.authorName,
    rating: review.rating,
    content: review.content,
    title: review.title,
  });

  // Create response as DRAFT
  const response = await db.reviewResponse.create({
    data: {
      projectId,
      reviewId,
      content,
      status: 'DRAFT' as ReviewResponseStatus,
    },
  });

  // Link the draft to the review
  await db.review.update({
    where: { id: reviewId },
    data: { responseDraftId: response.id },
  });

  return response;
}

// ============================================================================
// Approval Workflow
// ============================================================================

/**
 * Submit a response draft for approval.
 * Changes status from DRAFT to PENDING_APPROVAL.
 *
 * @param responseId - The response ID to submit
 * @param projectId - The project ID for tenant isolation
 * @param submittedBy - User ID of the person submitting
 * @returns The updated ReviewResponse in PENDING_APPROVAL status
 */
export async function submitResponseForApproval(
  responseId: string,
  projectId: string,
  submittedBy: string
) {
  // Fetch the response
  const response = await db.reviewResponse.findFirst({
    where: {
      id: responseId,
      projectId,
    },
  });

  if (!response) {
    throw new Error(`Reactie niet gevonden (ID: ${responseId})`);
  }

  // Only DRAFT responses can be submitted for approval
  if (response.status !== ('DRAFT' as ReviewResponseStatus)) {
    throw new Error(
      'Alleen concept-reacties kunnen worden ingediend voor goedkeuring'
    );
  }

  return db.reviewResponse.update({
    where: { id: responseId },
    data: {
      status: 'PENDING_APPROVAL' as ReviewResponseStatus,
      submittedBy,
    },
  });
}

/**
 * Approve a response that is pending approval.
 * Changes status from PENDING_APPROVAL to APPROVED.
 *
 * @param responseId - The response ID to approve
 * @param projectId - The project ID for tenant isolation
 * @param reviewedBy - User ID of the person approving
 * @returns The updated ReviewResponse in APPROVED status
 */
export async function approveResponse(
  responseId: string,
  projectId: string,
  reviewedBy: string
) {
  // Fetch the response
  const response = await db.reviewResponse.findFirst({
    where: {
      id: responseId,
      projectId,
    },
  });

  if (!response) {
    throw new Error(`Reactie niet gevonden (ID: ${responseId})`);
  }

  // Only PENDING_APPROVAL responses can be approved
  if (response.status !== ('PENDING_APPROVAL' as ReviewResponseStatus)) {
    throw new Error(
      'Alleen reacties die wachten op goedkeuring kunnen worden goedgekeurd'
    );
  }

  return db.reviewResponse.update({
    where: { id: responseId },
    data: {
      status: 'APPROVED' as ReviewResponseStatus,
      reviewedBy,
      reviewedAt: new Date(),
    },
  });
}

/**
 * Reject a response with a Dutch reason.
 * Changes status from PENDING_APPROVAL to REJECTED.
 *
 * @param responseId - The response ID to reject
 * @param projectId - The project ID for tenant isolation
 * @param reviewedBy - User ID of the person rejecting
 * @param rejectionReason - Dutch reason for rejection
 * @returns The updated ReviewResponse in REJECTED status
 */
export async function rejectResponse(
  responseId: string,
  projectId: string,
  reviewedBy: string,
  rejectionReason: string
) {
  // Fetch the response
  const response = await db.reviewResponse.findFirst({
    where: {
      id: responseId,
      projectId,
    },
  });

  if (!response) {
    throw new Error(`Reactie niet gevonden (ID: ${responseId})`);
  }

  // Only PENDING_APPROVAL responses can be rejected
  if (response.status !== ('PENDING_APPROVAL' as ReviewResponseStatus)) {
    throw new Error(
      'Alleen reacties die wachten op goedkeuring kunnen worden afgewezen'
    );
  }

  return db.reviewResponse.update({
    where: { id: responseId },
    data: {
      status: 'REJECTED' as ReviewResponseStatus,
      reviewedBy,
      reviewedAt: new Date(),
      rejectionReason,
    },
  });
}

// ============================================================================
// Draft Editing
// ============================================================================

/**
 * Update the content of a response draft.
 * Only DRAFT or REJECTED responses can be edited.
 *
 * @param responseId - The response ID to update
 * @param projectId - The project ID for tenant isolation
 * @param content - New Dutch response text
 * @returns The updated ReviewResponse
 */
export async function updateResponseDraft(
  responseId: string,
  projectId: string,
  content: string
) {
  // Fetch the response
  const response = await db.reviewResponse.findFirst({
    where: {
      id: responseId,
      projectId,
    },
  });

  if (!response) {
    throw new Error(`Reactie niet gevonden (ID: ${responseId})`);
  }

  // Only DRAFT or REJECTED responses can be edited
  if (
    response.status !== ('DRAFT' as ReviewResponseStatus) &&
    response.status !== ('REJECTED' as ReviewResponseStatus)
  ) {
    throw new Error(
      'Alleen concept- of afgewezen reacties kunnen worden bewerkt'
    );
  }

  // When editing a REJECTED response, reset to DRAFT
  const newStatus =
    response.status === ('REJECTED' as ReviewResponseStatus)
      ? ('DRAFT' as ReviewResponseStatus)
      : response.status;

  return db.reviewResponse.update({
    where: { id: responseId },
    data: {
      content,
      status: newStatus,
      rejectionReason: null,
    },
  });
}

// ============================================================================
// Publishing
// ============================================================================

/**
 * Publish an approved response.
 *
 * CRITICAL: Only APPROVED responses can be published.
 * Direct publishing from DRAFT or PENDING_APPROVAL is NOT allowed.
 * This is a placeholder — actual publishing to external platforms
 * would be implemented per-integration.
 *
 * @param responseId - The response ID to publish
 * @param projectId - The project ID for tenant isolation
 * @returns The updated ReviewResponse in PUBLISHED status
 */
export async function publishResponse(
  responseId: string,
  projectId: string
) {
  // Fetch the response
  const response = await db.reviewResponse.findFirst({
    where: {
      id: responseId,
      projectId,
    },
  });

  if (!response) {
    throw new Error(`Reactie niet gevonden (ID: ${responseId})`);
  }

  // CRITICAL: Only APPROVED responses can be published
  if (response.status !== ('APPROVED' as ReviewResponseStatus)) {
    throw new Error(
      'Alleen goedgekeurde reacties kunnen worden gepubliceerd. ' +
      'De reactie moet eerst worden goedgekeurd via het goedkeuringsproces.'
    );
  }

  return db.reviewResponse.update({
    where: { id: responseId },
    data: {
      status: 'PUBLISHED' as ReviewResponseStatus,
      publishedAt: new Date(),
    },
  });
}

// ============================================================================
// Query Responses
// ============================================================================

/**
 * Get all responses for a review, ordered by creation date (newest first).
 *
 * @param reviewId - The review ID
 * @param projectId - The project ID for tenant isolation
 * @returns Array of ReviewResponse records
 */
export async function getReviewResponses(reviewId: string, projectId: string) {
  // Verify the review belongs to this project
  const review = await db.review.findFirst({
    where: {
      id: reviewId,
      projectId,
      deletedAt: null,
    },
  });

  if (!review) {
    throw new Error(`Review niet gevonden (ID: ${reviewId})`);
  }

  return db.reviewResponse.findMany({
    where: {
      reviewId,
      projectId,
    },
    orderBy: { createdAt: 'desc' },
  });
}
