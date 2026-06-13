// ============================================================================
// Job System — AI-Driven SEO Automation Platform
// ============================================================================

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateJobParams {
  projectId: string;
  type: string;
  tenantId?: string | null;
  userId?: string | null;
  maxProgress?: number | null;
}

interface ListJobsFilters {
  status?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a new job with tenant context.
 */
export async function createJob(params: CreateJobParams) {
  const { projectId, type, tenantId = null, userId = null, maxProgress = null } = params;

  return db.job.create({
    data: {
      projectId,
      type,
      tenantId,
      userId,
      maxProgress,
      status: "PENDING",
      progress: 0,
    },
  });
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * Update the progress of a running job.
 * Automatically sets status to RUNNING and startedAt if not yet set.
 */
export async function updateJobProgress(
  jobId: string,
  progress: number,
  maxProgress?: number
) {
  const existing = await db.job.findUnique({ where: { id: jobId } });
  if (!existing) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const data: Record<string, unknown> = {
    progress,
    status: "RUNNING",
  };

  // Set startedAt the first time progress is reported
  if (!existing.startedAt) {
    data.startedAt = new Date();
  }

  if (maxProgress !== undefined) {
    data.maxProgress = maxProgress;
  }

  return db.job.update({
    where: { id: jobId },
    data,
  });
}

// ---------------------------------------------------------------------------
// Complete
// ---------------------------------------------------------------------------

/**
 * Mark a job as completed with an optional result payload.
 */
export async function completeJob(jobId: string, result?: Record<string, unknown>) {
  return db.job.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      progress: 100,
      completedAt: new Date(),
      result: result ? JSON.stringify(result) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// Fail
// ---------------------------------------------------------------------------

/**
 * Mark a job as failed with an error message.
 */
export async function failJob(jobId: string, error: string) {
  return db.job.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      error,
      completedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

/**
 * Mark a job as cancelled.
 */
export async function cancelJob(jobId: string) {
  return db.job.update({
    where: { id: jobId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Retrieve the current status and metadata of a job.
 */
export async function getJobStatus(jobId: string) {
  return db.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      projectId: true,
      type: true,
      status: true,
      progress: true,
      maxProgress: true,
      result: true,
      error: true,
      tenantId: true,
      userId: true,
      startedAt: true,
      completedAt: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * List jobs for a project with optional filters.
 */
export async function listProjectJobs(
  projectId: string,
  filters?: ListJobsFilters
) {
  const { status, type, limit = 50, offset = 0 } = filters ?? {};

  const where: Record<string, unknown> = {
    projectId,
  };

  if (status) {
    where.status = status;
  }

  if (type) {
    where.type = type;
  }

  const [jobs, total] = await Promise.all([
    db.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        maxProgress: true,
        error: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.job.count({ where }),
  ]);

  return { jobs, total };
}
