// ============================================================================
// Content Change History — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Records, tracks, and manages content changes with full history.
// Supports rollback functionality, content diff generation, and
// paginated history queries. All user-facing strings are in Dutch.
// ============================================================================

import { db } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

/**
 * Change types that map to the ContentChangeType enum in Prisma.
 */
export type ChangeType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'PUBLISH'
  | 'UNPUBLISH'
  | 'SCHEDULE'
  | 'APPROVE'
  | 'REJECT'
  | 'ROLLBACK';

/**
 * Parameters for recording a content change.
 */
export interface RecordChangeParams {
  /** Project ID */
  projectId: string;
  /** Brief ID (optional) */
  briefId?: string;
  /** Content version ID (optional) */
  versionId?: string;
  /** Page ID (optional) */
  pageId?: string;
  /** Type of change */
  changeType: ChangeType;
  /** Previous content snapshot */
  previousContent?: string;
  /** New content snapshot */
  newContent?: string;
  /** User who made the change */
  userId?: string;
  /** AI agent ID if change was AI-initiated */
  aiAgentId?: string;
  /** AI provider ID used for the change */
  aiProviderId?: string;
  /** Dutch summary of the change */
  summary?: string;
  /** JSON result from CMS */
  cmsResult?: string;
  /** JSON data needed for rollback */
  rollbackData?: string;
}

/**
 * Filters for querying change history.
 */
export interface ChangeHistoryFilters {
  /** Filter by brief ID */
  briefId?: string;
  /** Filter by page ID */
  pageId?: string;
  /** Filter by change type */
  changeType?: ChangeType;
  /** Filter by user ID */
  userId?: string;
  /** Date range filter */
  dateRange?: {
    /** Start date (inclusive) */
    from: Date;
    /** End date (inclusive) */
    to: Date;
  };
  /** Page number (1-based) */
  page?: number;
  /** Items per page */
  pageSize?: number;
}

/**
 * Paginated result of change history entries.
 */
export interface PaginatedChangeHistory {
  /** Change entries for the current page */
  items: ChangeHistoryEntry[];
  /** Total number of changes matching the filters */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Summary of a change history entry for list views.
 */
export interface ChangeHistoryEntry {
  id: string;
  projectId: string;
  briefId?: string;
  versionId?: string;
  pageId?: string;
  changeType: string;
  userId?: string;
  aiAgentId?: string;
  summary?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
}

/**
 * Full detail of a change including previous and new content.
 */
export interface ChangeDetail extends ChangeHistoryEntry {
  previousContent?: string;
  newContent?: string;
  aiProviderId?: string;
  cmsResult?: string;
  rollbackData?: string;
  approvalId?: string;
}

/**
 * Result of a rollback operation.
 */
export interface RollbackResult {
  /** The new ContentChange record documenting the rollback */
  rollbackChangeId: string;
  /** The previous content that was restored */
  restoredContent: string;
  /** Dutch message describing the result */
  message: string;
}

/**
 * Content diff representation.
 */
export interface ContentDiff {
  /** The change ID that was compared */
  changeId: string;
  /** Lines that were removed */
  removed: string[];
  /** Lines that were added */
  added: string[];
  /** Unified diff format */
  unified: string;
  /** Summary statistics */
  stats: {
    linesAdded: number;
    linesRemoved: number;
    linesUnchanged: number;
  };
}

// ============================================================================
// Diff Algorithm (Simple Line-Based)
// ============================================================================

/**
 * Compute a simple line-based diff between two strings.
 *
 * Uses a longest common subsequence (LCS) approach to identify
 * added, removed, and unchanged lines. Returns unified diff format
 * suitable for display.
 */
function computeLineDiff(previous: string, current: string): {
  removed: string[];
  added: string[];
  unified: string;
  stats: { linesAdded: number; linesRemoved: number; linesUnchanged: number };
} {
  const prevLines = previous.split('\n');
  const currLines = current.split('\n');

  // Build LCS table
  const m = prevLines.length;
  const n = currLines.length;

  // Optimize: for very large texts, use a simplified approach
  if (m * n > 1000000) {
    return computeSimplifiedDiff(prevLines, currLines);
  }

  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (prevLines[i - 1] === currLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  // Backtrack to find the diff
  const removed: string[] = [];
  const added: string[] = [];
  const unifiedLines: string[] = [];
  let linesUnchanged = 0;

  let i = m;
  let j = n;

  // Collect operations in reverse order
  const ops: Array<{ type: 'add' | 'remove' | 'equal'; line: string }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && prevLines[i - 1] === currLines[j - 1]) {
      ops.push({ type: 'equal', line: prevLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      ops.push({ type: 'add', line: currLines[j - 1] });
      j--;
    } else {
      ops.push({ type: 'remove', line: prevLines[i - 1] });
      i--;
    }
  }

  // Reverse to get correct order
  ops.reverse();

  for (const op of ops) {
    switch (op.type) {
      case 'add':
        added.push(op.line);
        unifiedLines.push(`+ ${op.line}`);
        break;
      case 'remove':
        removed.push(op.line);
        unifiedLines.push(`- ${op.line}`);
        break;
      case 'equal':
        linesUnchanged++;
        unifiedLines.push(`  ${op.line}`);
        break;
    }
  }

  return {
    removed,
    added,
    unified: unifiedLines.join('\n'),
    stats: {
      linesAdded: added.length,
      linesRemoved: removed.length,
      linesUnchanged,
    },
  };
}

/**
 * Simplified diff for very large texts.
 * Falls back to a paragraph-level comparison when line-by-line is too expensive.
 */
function computeSimplifiedDiff(
  prevLines: string[],
  currLines: string[]
): {
  removed: string[];
  added: string[];
  unified: string;
  stats: { linesAdded: number; linesRemoved: number; linesUnchanged: number };
} {
  const prevSet = new Set(prevLines);
  const currSet = new Set(currLines);

  const removed = prevLines.filter((l) => !currSet.has(l));
  const added = currLines.filter((l) => !prevSet.has(l));
  const unchanged = prevLines.filter((l) => currSet.has(l));

  const unifiedLines: string[] = [];

  // Show removed lines first, then added
  for (const line of removed) {
    unifiedLines.push(`- ${line}`);
  }
  for (const line of added) {
    unifiedLines.push(`+ ${line}`);
  }
  for (const line of unchanged) {
    unifiedLines.push(`  ${line}`);
  }

  return {
    removed,
    added,
    unified: unifiedLines.join('\n'),
    stats: {
      linesAdded: added.length,
      linesRemoved: removed.length,
      linesUnchanged: unchanged.length,
    },
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Record a content change in the history.
 *
 * Creates a ContentChange record that captures the before/after state
 * of a content modification. Used for audit trails, rollback support,
 * and collaboration tracking.
 *
 * @param params - The change parameters
 * @returns The created ContentChange record
 * @throws Error if required parameters are missing
 */
export async function recordChange(params: RecordChangeParams) {
  if (!params.projectId) {
    throw new Error('Project ID is vereist om een wijziging vast te leggen');
  }

  if (!params.changeType) {
    throw new Error('Wijzigingstype is vereist');
  }

  // Validate changeType is a valid enum value
  const validChangeTypes: ChangeType[] = [
    'CREATE',
    'UPDATE',
    'DELETE',
    'PUBLISH',
    'UNPUBLISH',
    'SCHEDULE',
    'APPROVE',
    'REJECT',
    'ROLLBACK',
  ];

  if (!validChangeTypes.includes(params.changeType)) {
    throw new Error(
      `Ongeldig wijzigingstype: "${params.changeType}". Geldige types zijn: ${validChangeTypes.join(', ')}`
    );
  }

  const change = await db.contentChange.create({
    data: {
      projectId: params.projectId,
      briefId: params.briefId ?? null,
      versionId: params.versionId ?? null,
      pageId: params.pageId ?? null,
      changeType: params.changeType,
      previousContent: params.previousContent ?? null,
      newContent: params.newContent ?? null,
      userId: params.userId ?? null,
      aiAgentId: params.aiAgentId ?? null,
      aiProviderId: params.aiProviderId ?? null,
      summary: params.summary ?? null,
      cmsResult: params.cmsResult ?? null,
      rollbackData: params.rollbackData ?? null,
    },
  });

  return change;
}

/**
 * Get change history for a project with pagination and filters.
 *
 * Returns a paginated list of content changes ordered by creation date
 * (most recent first). Supports filtering by brief, page, change type,
 * user, and date range.
 *
 * @param projectId - The project ID
 * @param filters - Optional filters and pagination
 * @returns Paginated list of change history entries
 */
export async function getChangeHistory(
  projectId: string,
  filters?: ChangeHistoryFilters
): Promise<PaginatedChangeHistory> {
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 25));

  const where: Record<string, unknown> = { projectId };

  if (filters?.briefId) where.briefId = filters.briefId;
  if (filters?.pageId) where.pageId = filters.pageId;
  if (filters?.changeType) where.changeType = filters.changeType;
  if (filters?.userId) where.userId = filters.userId;

  if (filters?.dateRange) {
    where.createdAt = {
      gte: filters.dateRange.from,
      lte: filters.dateRange.to,
    };
  }

  const [total, changes] = await Promise.all([
    db.contentChange.count({ where }),
    db.contentChange.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        projectId: true,
        briefId: true,
        versionId: true,
        pageId: true,
        changeType: true,
        userId: true,
        aiAgentId: true,
        summary: true,
        approvedBy: true,
        approvedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    items: changes.map((c) => ({
      id: c.id,
      projectId: c.projectId,
      briefId: c.briefId ?? undefined,
      versionId: c.versionId ?? undefined,
      pageId: c.pageId ?? undefined,
      changeType: c.changeType,
      userId: c.userId ?? undefined,
      aiAgentId: c.aiAgentId ?? undefined,
      summary: c.summary ?? undefined,
      approvedBy: c.approvedBy ?? undefined,
      approvedAt: c.approvedAt ?? undefined,
      createdAt: c.createdAt,
    })),
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Get the full detail of a content change.
 *
 * Includes the previous and new content snapshots, CMS result,
 * and rollback data. Used for detailed change review.
 *
 * @param changeId - The change ID to retrieve
 * @returns Full change detail
 * @throws Error if the change is not found
 */
export async function getChangeDetail(
  changeId: string
): Promise<ChangeDetail> {
  const change = await db.contentChange.findUnique({
    where: { id: changeId },
  });

  if (!change) {
    throw new Error(`Wijziging "${changeId}" niet gevonden`);
  }

  return {
    id: change.id,
    projectId: change.projectId,
    briefId: change.briefId ?? undefined,
    versionId: change.versionId ?? undefined,
    pageId: change.pageId ?? undefined,
    changeType: change.changeType,
    previousContent: change.previousContent ?? undefined,
    newContent: change.newContent ?? undefined,
    userId: change.userId ?? undefined,
    aiAgentId: change.aiAgentId ?? undefined,
    aiProviderId: change.aiProviderId ?? undefined,
    summary: change.summary ?? undefined,
    cmsResult: change.cmsResult ?? undefined,
    rollbackData: change.rollbackData ?? undefined,
    approvalId: change.approvalId ?? undefined,
    approvedBy: change.approvedBy ?? undefined,
    approvedAt: change.approvedAt ?? undefined,
    createdAt: change.createdAt,
  };
}

/**
 * Rollback a content change.
 *
 * Creates a new ContentChange record with type ROLLBACK and returns
 * the previous content so it can be applied. The original change must
 * have rollbackData available.
 *
 * @param changeId - The change ID to rollback
 * @param userId - The user performing the rollback
 * @returns The rollback result with the restored content
 * @throws Error if the change is not found or cannot be rolled back
 */
export async function rollbackChange(
  changeId: string,
  userId: string
): Promise<RollbackResult> {
  const change = await db.contentChange.findUnique({
    where: { id: changeId },
  });

  if (!change) {
    throw new Error(`Wijziging "${changeId}" niet gevonden`);
  }

  if (change.changeType === 'ROLLBACK') {
    throw new Error('Een rollback-wijziging kan niet zelf worden teruggedraaid');
  }

  // Determine the content to restore
  // Prefer rollbackData, fall back to previousContent
  let restoredContent: string;

  if (change.rollbackData) {
    try {
      const rollbackInfo = JSON.parse(change.rollbackData) as {
        content?: string;
        previousContent?: string;
      };
      restoredContent = rollbackInfo.content ?? rollbackInfo.previousContent ?? change.previousContent ?? '';
    } catch {
      restoredContent = change.previousContent ?? '';
    }
  } else if (change.previousContent) {
    restoredContent = change.previousContent;
  } else {
    throw new Error(
      'Deze wijziging kan niet worden teruggedraaid: geen herstelgegevens beschikbaar'
    );
  }

  // Create a rollback change record
  const rollbackChange = await db.contentChange.create({
    data: {
      projectId: change.projectId,
      briefId: change.briefId,
      versionId: change.versionId,
      pageId: change.pageId,
      changeType: 'ROLLBACK',
      previousContent: change.newContent,
      newContent: restoredContent,
      userId,
      summary: `Teruggedraaid: ${change.summary ?? `wijziging ${change.changeType}`}`,
      rollbackData: JSON.stringify({
        originalChangeId: changeId,
        originalChangeType: change.changeType,
        rolledBackBy: userId,
        rolledBackAt: new Date().toISOString(),
      }),
    },
  });

  return {
    rollbackChangeId: rollbackChange.id,
    restoredContent,
    message: `Wijziging succesvol teruggedraaid. De vorige content is hersteld.`,
  };
}

/**
 * Generate a text diff between the previous and new content of a change.
 *
 * Returns a unified diff format showing added, removed, and unchanged lines.
 * Useful for visual comparison of content changes.
 *
 * @param changeId - The change ID to diff
 * @returns Content diff with statistics
 * @throws Error if the change is not found
 */
export async function getContentDiff(changeId: string): Promise<ContentDiff> {
  const change = await db.contentChange.findUnique({
    where: { id: changeId },
  });

  if (!change) {
    throw new Error(`Wijziging "${changeId}" niet gevonden`);
  }

  const previous = change.previousContent ?? '';
  const current = change.newContent ?? '';

  const diff = computeLineDiff(previous, current);

  return {
    changeId,
    removed: diff.removed,
    added: diff.added,
    unified: diff.unified,
    stats: diff.stats,
  };
}
