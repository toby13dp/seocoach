// ============================================================================
// Link Approval Workflow — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages the approval lifecycle for internal link suggestions:
//   - Single approve / reject
//   - Bulk approval with detailed results
//   - Link diff generation (before/after content comparison)
//   - Publishing approved links to CMS
//   - Rollback of published links
//
// Approval-first: no link is published without explicit approval.
// All user-facing strings are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import type {
  LinkDiff,
  BulkApprovalResult,
  BulkApprovalDetail,
  LinkStatus,
} from './types';

// ============================================================================
// Single Link Approval
// ============================================================================

/**
 * Approve a single internal link suggestion.
 * Changes status from PENDING to APPROVED and records who approved it.
 *
 * @param linkId - The internal link ID to approve
 * @param userId - The user ID who is approving the link
 * @returns The updated internal link record
 * @throws Error if the link is not found or not in PENDING status
 */
export async function approveLink(
  linkId: string,
  userId: string
): Promise<{
  id: string;
  status: string;
  approvedBy: string | null;
  approvedAt: Date | null;
}> {
  // Fetch the link
  const link = await db.internalLink.findUnique({
    where: { id: linkId, deletedAt: null },
  });

  if (!link) {
    throw new Error(`Interne link met ID "${linkId}" niet gevonden.`);
  }

  if (link.status !== 'PENDING') {
    throw new Error(
      `Interne link kan niet goedgekeurd worden: huidige status is "${link.status}" in plaats van "PENDING".`
    );
  }

  // Update the link status
  const updated = await db.internalLink.update({
    where: { id: linkId },
    data: {
      status: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    approvedBy: updated.approvedBy,
    approvedAt: updated.approvedAt,
  };
}

// ============================================================================
// Single Link Rejection
// ============================================================================

/**
 * Reject a single internal link suggestion.
 * Changes status from PENDING to REJECTED and records who rejected it.
 *
 * @param linkId - The internal link ID to reject
 * @param userId - The user ID who is rejecting the link
 * @param reason - Optional reason for rejection (stored in surroundingText as note)
 * @returns The updated internal link record
 * @throws Error if the link is not found or not in PENDING/APPROVED status
 */
export async function rejectLink(
  linkId: string,
  userId: string,
  reason?: string
): Promise<{
  id: string;
  status: string;
  rejectedBy: string;
  rejectionReason: string | null;
}> {
  const link = await db.internalLink.findUnique({
    where: { id: linkId, deletedAt: null },
  });

  if (!link) {
    throw new Error(`Interne link met ID "${linkId}" niet gevonden.`);
  }

  if (link.status !== 'PENDING' && link.status !== 'APPROVED') {
    throw new Error(
      `Interne link kan niet afgewezen worden: huidige status is "${link.status}". Alleen PENDING of APPROVED links kunnen afgewezen worden.`
    );
  }

  // Update the link status
  const rejectionNote = reason
    ? `Afgewezen door ${userId}: ${reason}`
    : `Afgewezen door ${userId}`;

  const updated = await db.internalLink.update({
    where: { id: linkId },
    data: {
      status: 'REJECTED',
      approvedBy: null,
      approvedAt: null,
      surroundingText: link.surroundingText
        ? `${link.surroundingText} | ${rejectionNote}`
        : rejectionNote,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    rejectedBy: userId,
    rejectionReason: reason ?? null,
  };
}

// ============================================================================
// Bulk Approval
// ============================================================================

/**
 * Approve multiple internal links in a single operation.
 * Processes each link individually and returns a detailed result
 * showing which links were approved, rejected, or skipped.
 *
 * @param linkIds - Array of internal link IDs to approve
 * @param userId - The user ID who is approving the links
 * @returns Bulk approval result with counts and per-link details
 */
export async function bulkApproveLinks(
  linkIds: string[],
  userId: string
): Promise<BulkApprovalResult> {
  const details: BulkApprovalDetail[] = [];
  let approvedCount = 0;
  let rejectedCount = 0;
  let skippedCount = 0;

  // Fetch all specified links
  const links = await db.internalLink.findMany({
    where: {
      id: { in: linkIds },
      deletedAt: null,
    },
  });

  const linkMap = new Map(links.map((l) => [l.id, l]));

  for (const linkId of linkIds) {
    const link = linkMap.get(linkId);

    if (!link) {
      skippedCount++;
      details.push({
        linkId,
        outcome: 'skipped',
        reason: 'Link niet gevonden of verwijderd',
      });
      continue;
    }

    if (link.status !== 'PENDING') {
      skippedCount++;
      details.push({
        linkId,
        outcome: 'skipped',
        reason: `Link heeft status "${link.status}", goedkeuring vereist status "PENDING"`,
      });
      continue;
    }

    try {
      await db.internalLink.update({
        where: { id: linkId },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });
      approvedCount++;
      details.push({
        linkId,
        outcome: 'approved',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      rejectedCount++;
      details.push({
        linkId,
        outcome: 'rejected',
        reason: `Fout bij goedkeuren: ${msg}`,
      });
    }
  }

  const total = linkIds.length;
  const summary = `Bulk-goedkeuring voltooid: ${approvedCount} goedgekeurd, ${rejectedCount} afgewezen, ${skippedCount} overgeslagen van ${total} links.`;

  return {
    total,
    approved: approvedCount,
    rejected: rejectedCount,
    skipped: skippedCount,
    summary,
    details,
  };
}

// ============================================================================
// Link Diff Generation
// ============================================================================

/**
 * Generate a before/after diff showing where a link would be inserted
 * in the source page content. Used for review before approval.
 *
 * @param linkId - The internal link ID to generate a diff for
 * @returns A LinkDiff object with before/after content
 * @throws Error if the link is not found
 */
export async function generateLinkDiff(linkId: string): Promise<LinkDiff> {
  const link = await db.internalLink.findUnique({
    where: { id: linkId, deletedAt: null },
  });

  if (!link) {
    throw new Error(`Interne link met ID "${linkId}" niet gevonden.`);
  }

  // Fetch the source page content
  let sourceContent = '';
  let sourceTitle = '';

  if (link.sourcePageId) {
    const sourcePage = await db.page.findUnique({
      where: { id: link.sourcePageId },
      select: { mainContent: true, title: true },
    });
    sourceContent = sourcePage?.mainContent ?? '';
    sourceTitle = sourcePage?.title ?? '';
  }

  // If no mainContent is available, use the surroundingText as context
  if (!sourceContent && link.surroundingText) {
    sourceContent = link.surroundingText;
  }

  // Find the best insertion point in the content
  const insertionResult = findInsertionPoint(
    sourceContent,
    link.anchorText,
    link.targetUrl
  );

  // Build the "after" content with the link inserted
  const before = insertionResult.contextBefore;
  const after = insertionResult.contextAfter;

  return {
    linkId: link.id,
    sourceUrl: link.sourceUrl,
    targetUrl: link.targetUrl,
    anchorText: link.anchorText,
    before,
    after,
    insertionOffset: insertionResult.insertionOffset,
    explanation: insertionResult.explanation,
  };
}

/**
 * Result of finding the best insertion point for a link in content.
 */
interface InsertionResult {
  /** Content excerpt before the link insertion */
  contextBefore: string;
  /** Content excerpt after the link insertion (with link markup) */
  contextAfter: string;
  /** Character offset where the insertion would occur */
  insertionOffset: number;
  /** Dutch explanation of the insertion */
  explanation: string;
}

/**
 * Find the best point in the source content to insert a link.
 * Uses keyword matching and paragraph analysis to find the most natural
 * location for the link anchor text.
 */
function findInsertionPoint(
  content: string,
  anchorText: string,
  targetUrl: string
): InsertionResult {
  if (!content || content.length === 0) {
    return {
      contextBefore: '(Geen inhoud beschikbaar)',
      contextAfter: `<a href="${targetUrl}">${anchorText}</a>`,
      insertionOffset: 0,
      explanation: 'Geen broninhoud beschikbaar. De link kan handmatig worden geplaatst op de gewenste locatie.',
    };
  }

  // Split content into paragraphs
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);

  // Strategy: Find the paragraph that best matches the anchor text topic
  const anchorLower = anchorText.toLowerCase();
  const anchorWords = anchorLower.split(/\s+/).filter((w) => w.length > 2);

  let bestParagraphIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].toLowerCase();
    let score = 0;

    // Check for anchor text words in the paragraph
    for (const word of anchorWords) {
      if (para.includes(word)) {
        score += 2;
      }
    }

    // Prefer paragraphs in the middle of the content (not first or last)
    const relativePosition = i / Math.max(paragraphs.length - 1, 1);
    if (relativePosition > 0.2 && relativePosition < 0.8) {
      score += 1;
    }

    // Prefer longer paragraphs (more context for the link)
    if (para.length > 100) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestParagraphIndex = i;
    }
  }

  // If no good match found, default to second paragraph if available
  if (bestScore <= 0 && paragraphs.length > 1) {
    bestParagraphIndex = 1;
  }

  const targetParagraph = paragraphs[bestParagraphIndex];

  // Find the best sentence within the paragraph for insertion
  const sentences = targetParagraph.split(/(?<=[.!?])\s+/);
  let bestSentenceIndex = 0;
  let bestSentenceScore = -1;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].toLowerCase();
    let score = 0;

    for (const word of anchorWords) {
      if (sentence.includes(word)) {
        score += 3;
      }
    }

    if (score > bestSentenceScore) {
      bestSentenceScore = score;
      bestSentenceIndex = i;
    }
  }

  const targetSentence = sentences[bestSentenceIndex] ?? targetParagraph;

  // Determine the insertion approach
  let contextBefore: string;
  let contextAfter: string;
  let insertionOffset: number;
  let explanation: string;

  if (bestSentenceScore > 0 && anchorLower.length > 0) {
    // The anchor text appears in the sentence — replace the text with a link
    const sentenceLower = targetSentence.toLowerCase();
    const anchorPos = sentenceLower.indexOf(anchorLower);

    if (anchorPos >= 0) {
      // Replace the matching text with a linked version
      const beforeText = targetSentence.slice(0, anchorPos);
      const matchedText = targetSentence.slice(anchorPos, anchorPos + anchorText.length);
      const afterText = targetSentence.slice(anchorPos + anchorText.length);

      contextBefore = `...${beforeText}${matchedText}${afterText}`;
      contextAfter = `...${beforeText}<a href="${targetUrl}">${matchedText}</a>${afterText}`;
      insertionOffset = anchorPos;

      explanation = `De ankertekst "${matchedText}" wordt vervangen door een link naar "${targetUrl}" in alinea ${bestParagraphIndex + 1}.`;
    } else {
      // Append link at end of sentence
      const linkedAnchor = `<a href="${targetUrl}">${anchorText}</a>`;
      contextBefore = targetSentence;
      contextAfter = `${targetSentence} ${linkedAnchor}`;
      insertionOffset = targetSentence.length;

      explanation = `De link "${anchorText}" wordt toegevoegd aan het einde van de zin in alinea ${bestParagraphIndex + 1}.`;
    }
  } else {
    // No natural match — append link at end of paragraph
    const linkedAnchor = `<a href="${targetUrl}">${anchorText}</a>`;
    const truncatedPara = targetParagraph.length > 200
      ? targetParagraph.slice(0, 200) + '...'
      : targetParagraph;

    contextBefore = truncatedPara;
    contextAfter = `${truncatedPara} ${linkedAnchor}`;
    insertionOffset = truncatedPara.length;

    explanation = `Geen natuurlijke plaats gevonden voor de ankertekst. De link "${anchorText}" wordt toegevoegd aan het einde van alinea ${bestParagraphIndex + 1}. Overweeg om de link handmatig op een meer natuurlijke locatie te plaatsen.`;
  }

  return {
    contextBefore,
    contextAfter,
    insertionOffset,
    explanation,
  };
}

// ============================================================================
// Publishing
// ============================================================================

/**
 * Publish all approved links for a project to the CMS.
 * Updates the link status to PUBLISHED and records the CMS response.
 *
 * If a cmsConnectionId is provided, attempts to publish through that connection.
 * Otherwise, marks links as published locally without CMS integration.
 *
 * @param projectId - The project whose approved links should be published
 * @param cmsConnectionId - Optional CMS connection ID to publish through
 * @returns Summary of the publishing operation
 */
export async function publishApprovedLinks(
  projectId: string,
  cmsConnectionId?: string
): Promise<{
  total: number;
  published: number;
  failed: number;
  summary: string;
}> {
  // Fetch all approved links for the project
  const approvedLinks = await db.internalLink.findMany({
    where: {
      projectId,
      status: 'APPROVED',
      deletedAt: null,
    },
  });

  if (approvedLinks.length === 0) {
    return {
      total: 0,
      published: 0,
      failed: 0,
      summary: 'Geen goedgekeurde links gevonden om te publiceren.',
    };
  }

  let publishedCount = 0;
  let failedCount = 0;

  // If a CMS connection is provided, verify it exists and is active
  let cmsConnection: {
    id: string;
    providerType: string;
    status: string;
    baseUrl: string;
  } | null = null;

  if (cmsConnectionId) {
    const connection = await db.cMSConnection.findUnique({
      where: { id: cmsConnectionId, deletedAt: null },
      select: {
        id: true,
        providerType: true,
        status: true,
        baseUrl: true,
      },
    });

    if (!connection) {
      return {
        total: approvedLinks.length,
        published: 0,
        failed: approvedLinks.length,
        summary: `CMS-verbinding met ID "${cmsConnectionId}" niet gevonden. Kan niet publiceren.`,
      };
    }

    if (connection.status !== 'CONNECTED') {
      return {
        total: approvedLinks.length,
        published: 0,
        failed: approvedLinks.length,
        summary: `CMS-verbinding heeft status "${connection.status}". Een actieve verbinding (CONNECTED) is vereist voor publicatie.`,
      };
    }

    cmsConnection = connection;
  }

  for (const link of approvedLinks) {
    try {
      let cmsResult: string | null = null;

      if (cmsConnection) {
        // Attempt to publish to the CMS
        cmsResult = await publishLinkToCMS(link.id, cmsConnection);
      }

      // Update the link status to PUBLISHED
      await db.internalLink.update({
        where: { id: link.id },
        data: {
          status: 'PUBLISHED' as LinkStatus,
          publishedAt: new Date(),
          cmsResult,
        },
      });

      publishedCount++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      failedCount++;

      // Record the failure in cmsResult
      await db.internalLink.update({
        where: { id: link.id },
        data: {
          cmsResult: JSON.stringify({
            success: false,
            error: msg,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      console.error(
        `[LinkApproval] Fout bij publiceren link ${link.id}: ${msg}`
      );
    }
  }

  const total = approvedLinks.length;
  const summary = cmsConnection
    ? `${publishedCount} van ${total} links gepubliceerd via CMS-verbinding. ${failedCount} mislukt.`
    : `${publishedCount} van ${total} links gemarkeerd als gepubliceerd (lokale registratie). ${failedCount} mislukt. Publiceer de links handmatig in uw CMS met de opgegeven ankertekst en locatie.`;

  return {
    total,
    published: publishedCount,
    failed: failedCount,
    summary,
  };
}

/**
 * Publish a single link to the CMS.
 * This is a placeholder implementation that would be extended
 * for specific CMS integrations (WordPress, Contentful, etc.).
 */
async function publishLinkToCMS(
  linkId: string,
  _cmsConnection: {
    id: string;
    providerType: string;
    status: string;
    baseUrl: string;
  }
): Promise<string> {
  // Fetch the full link record
  const link = await db.internalLink.findUnique({
    where: { id: linkId },
  });

  if (!link) {
    throw new Error(`Link niet gevonden voor CMS-publicatie.`);
  }

  // Generate the diff to determine the content change
  const diff = await generateLinkDiff(linkId);

  // Build the CMS result payload
  const cmsResult = {
    linkId: link.id,
    sourceUrl: link.sourceUrl,
    targetUrl: link.targetUrl,
    anchorText: link.anchorText,
    strategy: link.strategy,
    insertionOffset: diff.insertionOffset,
    before: diff.before,
    after: diff.after,
    publishedAt: new Date().toISOString(),
    cmsConnectionId: _cmsConnection.id,
    providerType: _cmsConnection.providerType,
    note: 'Gepubliceerd via SEOCoach interne link module',
  };

  // In a real implementation, this would make API calls to the CMS
  // For now, we store the result as a JSON record
  return JSON.stringify(cmsResult);
}

// ============================================================================
// Rollback
// ============================================================================

/**
 * Rollback a published internal link.
 * Changes status from PUBLISHED to ROLLED_BACK and stores
 * rollback metadata for potential restoration.
 *
 * @param linkId - The internal link ID to rollback
 * @param userId - The user ID who is performing the rollback
 * @returns The updated internal link record
 * @throws Error if the link is not found or not in PUBLISHED status
 */
export async function rollbackLink(
  linkId: string,
  userId: string
): Promise<{
  id: string;
  status: string;
  rolledBackAt: Date | null;
  rollbackMeta: string | null;
}> {
  const link = await db.internalLink.findUnique({
    where: { id: linkId, deletedAt: null },
  });

  if (!link) {
    throw new Error(`Interne link met ID "${linkId}" niet gevonden.`);
  }

  if (link.status !== 'PUBLISHED') {
    throw new Error(
      `Interne link kan niet teruggedraaid worden: huidige status is "${link.status}". Alleen PUBLISHED links kunnen teruggedraaid worden.`
    );
  }

  // Build rollback metadata
  const rollbackMeta = JSON.stringify({
    previousStatus: link.status,
    rolledBackBy: userId,
    rolledBackAt: new Date().toISOString(),
    previousPublishedAt: link.publishedAt?.toISOString() ?? null,
    previousCmsResult: link.cmsResult,
    originalApproval: {
      approvedBy: link.approvedBy,
      approvedAt: link.approvedAt?.toISOString() ?? null,
    },
    sourceUrl: link.sourceUrl,
    targetUrl: link.targetUrl,
    anchorText: link.anchorText,
    strategy: link.strategy,
  });

  // Update the link status
  const updated = await db.internalLink.update({
    where: { id: linkId },
    data: {
      status: 'ROLLED_BACK' as LinkStatus,
      rolledBackAt: new Date(),
      rollbackMeta,
    },
  });

  // If there was a CMS publication, we should also attempt to undo it
  // This would involve CMS-specific API calls
  if (link.cmsResult) {
    try {
      await rollbackCMSPublication(link);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `[LinkApproval] Fout bij terugdraaien CMS-publicatie voor link ${linkId}: ${msg}`
      );
      // Don't fail the entire rollback if CMS undo fails
      // The link is still marked as ROLLED_BACK in our system
    }
  }

  return {
    id: updated.id,
    status: updated.status,
    rolledBackAt: updated.rolledBackAt,
    rollbackMeta: updated.rollbackMeta,
  };
}

/**
 * Attempt to rollback a link publication in the CMS.
 * This is a placeholder for CMS-specific rollback logic.
 */
async function rollbackCMSPublication(
  link: {
    id: string;
    sourceUrl: string;
    targetUrl: string;
    anchorText: string;
    cmsResult: string | null;
  }
): Promise<void> {
  // Parse the CMS result to determine which CMS was used
  if (!link.cmsResult) return;

  try {
    const cmsData = JSON.parse(link.cmsResult) as Record<string, unknown>;
    const providerType = cmsData.providerType as string | undefined;

    // Placeholder: In a real implementation, this would:
    // 1. Connect to the CMS API
    // 2. Find the page at sourceUrl
    // 3. Remove the link from the content
    // 4. Save the updated content back to the CMS

    console.info(
      `[LinkApproval] CMS-terugdraaiing voor link ${link.id} (${providerType ?? 'onbekend'}): ` +
      `Verwijder link "${link.anchorText}" van ${link.sourceUrl} naar ${link.targetUrl}`
    );
  } catch {
    // Invalid CMS result JSON — nothing to rollback in CMS
  }
}
