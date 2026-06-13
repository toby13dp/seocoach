// ============================================================================
// Authority — Outreach Campaign Management
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages outreach campaigns for link building and brand mentions.
// CRITICAL: Does NOT send outreach automatically.
// ============================================================================

import { db } from '@/lib/db';

/**
 * Create a new outreach campaign.
 *
 * @param projectId - The project to create the campaign for
 * @param name - Campaign name
 * @param description - Optional Dutch description
 * @returns The created OutreachCampaign record
 */
export async function createCampaign(
  projectId: string,
  name: string,
  description?: string
) {
  return db.outreachCampaign.create({
    data: {
      projectId,
      name,
      description: description ?? null,
      status: 'draft',
    },
  });
}

/**
 * Update an outreach campaign.
 *
 * @param campaignId - The campaign to update
 * @param updates - Partial update data
 * @returns The updated OutreachCampaign record
 */
export async function updateCampaign(
  campaignId: string,
  updates: {
    name?: string;
    description?: string | null;
    status?: string;
    startDate?: Date | null;
    endDate?: Date | null;
  }
) {
  return db.outreachCampaign.update({
    where: { id: campaignId },
    data: updates,
  });
}

/**
 * Add authority records to an outreach campaign.
 * This sets the campaignId on the specified records and
 * updates their status to "outreached".
 *
 * @param campaignId - The campaign to add records to
 * @param recordIds - Array of authority record IDs to add
 * @returns Number of records updated
 */
export async function addToCampaign(
  campaignId: string,
  recordIds: string[]
): Promise<number> {
  const result = await db.authorityRecord.updateMany({
    where: {
      id: { in: recordIds },
      deletedAt: null,
    },
    data: {
      campaignId,
      status: 'outreached',
    },
  });

  // Recalculate campaign stats
  await updateCampaignStats(campaignId);

  return result.count;
}

/**
 * Remove authority records from an outreach campaign.
 * Resets their campaignId to null and status to "active".
 *
 * @param campaignId - The campaign to remove records from
 * @param recordIds - Array of authority record IDs to remove
 * @returns Number of records updated
 */
export async function removeFromCampaign(
  campaignId: string,
  recordIds: string[]
): Promise<number> {
  const result = await db.authorityRecord.updateMany({
    where: {
      id: { in: recordIds },
      campaignId,
      deletedAt: null,
    },
    data: {
      campaignId: null,
      status: 'active',
    },
  });

  // Recalculate campaign stats
  await updateCampaignStats(campaignId);

  return result.count;
}

/**
 * Get outreach campaigns for a project with optional filters.
 *
 * @param projectId - The project to get campaigns for
 * @param filters - Optional filters
 * @returns Array of campaigns with stats
 */
export async function getCampaigns(
  projectId: string,
  filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
) {
  const where: Record<string, unknown> = {
    projectId,
    deletedAt: null,
  };

  if (filters?.status) where.status = filters.status;

  return db.outreachCampaign.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 50,
    skip: filters?.offset ?? 0,
  });
}

/**
 * Recalculate campaign statistics by counting the
 * authority records linked to this campaign.
 *
 * Updates: targetCount, contactedCount, responseCount, acquiredCount
 *
 * @param campaignId - The campaign to update stats for
 */
export async function updateCampaignStats(campaignId: string): Promise<void> {
  const records = await db.authorityRecord.findMany({
    where: {
      campaignId,
      deletedAt: null,
    },
    select: { status: true },
  });

  const targetCount = records.length;
  const contactedCount = records.filter((r) =>
    ['outreached', 'acquired', 'lost'].includes(r.status)
  ).length;
  const responseCount = records.filter((r) =>
    r.status === 'acquired' || r.status === 'active'
  ).length;
  const acquiredCount = records.filter((r) =>
    r.status === 'acquired'
  ).length;

  await db.outreachCampaign.update({
    where: { id: campaignId },
    data: {
      targetCount,
      contactedCount,
      responseCount,
      acquiredCount,
    },
  });
}
