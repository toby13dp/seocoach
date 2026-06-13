// ============================================================================
// Experiments — Manager
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages the lifecycle of A/B experiments: create, update, start, complete,
// cancel, and soft-delete. All functions verify projectId for tenant isolation.
// ============================================================================

import { db } from '@/lib/db';
import type { ExperimentStatus } from '@prisma/client';
import type { ExperimentData, ExperimentFilters } from './types';
import { EXPERIMENT_STATUS_LABELS } from './types';

// ============================================================================
// Create
// ============================================================================

/**
 * Create a new experiment in DRAFT status.
 *
 * @param projectId - The project this experiment belongs to (tenant isolation)
 * @param data - Experiment data (Dutch text fields)
 * @returns The created Experiment record
 * @throws Error if required fields are missing
 */
export async function createExperiment(
  projectId: string,
  data: ExperimentData
) {
  if (!data.name || !data.hypothesis || !data.kpiName) {
    throw new Error(
      'Naam, hypothese en KPI-naam zijn vereist voor het aanmaken van een experiment.'
    );
  }

  return db.experiment.create({
    data: {
      projectId,
      name: data.name,
      description: data.description ?? null,
      hypothesis: data.hypothesis,
      testGroupName: data.testGroupName ?? null,
      controlGroupName: data.controlGroupName ?? null,
      testGroupSize: data.testGroupSize ?? null,
      controlGroupSize: data.controlGroupSize ?? null,
      kpiName: data.kpiName,
      kpiBaseline: data.kpiBaseline ?? null,
      kpiTarget: data.kpiTarget ?? null,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      status: 'DRAFT',
    },
  });
}

// ============================================================================
// Update
// ============================================================================

/**
 * Update an existing experiment.
 * Only DRAFT experiments can be updated with data changes.
 *
 * @param experimentId - The experiment to update
 * @param projectId - The project it belongs to (tenant isolation)
 * @param data - Partial experiment data to update
 * @returns The updated Experiment record
 * @throws Error if experiment not found or does not belong to project
 */
export async function updateExperiment(
  experimentId: string,
  projectId: string,
  data: Partial<ExperimentData>
) {
  // Verify ownership
  const existing = await db.experiment.findFirst({
    where: { id: experimentId, projectId, deletedAt: null },
  });

  if (!existing) {
    throw new Error(
      `Experiment met ID "${experimentId}" niet gevonden voor dit project.`
    );
  }

  // Only allow data updates on DRAFT experiments
  if (existing.status !== 'DRAFT') {
    throw new Error(
      `Alleen concept-experimenten kunnen worden bewerkt. Huidige status: ${EXPERIMENT_STATUS_LABELS[existing.status as ExperimentStatus]}.`
    );
  }

  return db.experiment.update({
    where: { id: experimentId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.hypothesis !== undefined && { hypothesis: data.hypothesis }),
      ...(data.testGroupName !== undefined && { testGroupName: data.testGroupName }),
      ...(data.controlGroupName !== undefined && { controlGroupName: data.controlGroupName }),
      ...(data.testGroupSize !== undefined && { testGroupSize: data.testGroupSize }),
      ...(data.controlGroupSize !== undefined && { controlGroupSize: data.controlGroupSize }),
      ...(data.kpiName !== undefined && { kpiName: data.kpiName }),
      ...(data.kpiBaseline !== undefined && { kpiBaseline: data.kpiBaseline }),
      ...(data.kpiTarget !== undefined && { kpiTarget: data.kpiTarget }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
    },
  });
}

// ============================================================================
// Read
// ============================================================================

/**
 * Get a single experiment by ID, verifying project ownership.
 *
 * @param experimentId - The experiment ID to retrieve
 * @param projectId - The project it must belong to (tenant isolation)
 * @returns The Experiment record or null if not found
 */
export async function getExperiment(
  experimentId: string,
  projectId: string
) {
  return db.experiment.findFirst({
    where: {
      id: experimentId,
      projectId,
      deletedAt: null,
    },
  });
}

/**
 * List experiments for a project with optional filters.
 *
 * @param projectId - The project to list experiments for
 * @param filters - Optional filters for status, pagination
 * @returns Paginated list of experiments and total count
 */
export async function listExperiments(
  projectId: string,
  filters?: ExperimentFilters
) {
  const where: Record<string, unknown> = {
    projectId,
    deletedAt: null,
  };

  if (filters?.status) {
    where.status = filters.status;
  }

  const [experiments, total] = await Promise.all([
    db.experiment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    }),
    db.experiment.count({ where }),
  ]);

  return { experiments, total };
}

// ============================================================================
// Status Transitions
// ============================================================================

/**
 * Start an experiment: transition from DRAFT → RUNNING.
 * Sets the startDate if not already set.
 *
 * @param experimentId - The experiment to start
 * @param projectId - The project it belongs to (tenant isolation)
 * @returns The updated Experiment record
 * @throws Error if experiment not found or not in DRAFT status
 */
export async function startExperiment(
  experimentId: string,
  projectId: string
) {
  const existing = await db.experiment.findFirst({
    where: { id: experimentId, projectId, deletedAt: null },
  });

  if (!existing) {
    throw new Error(
      `Experiment met ID "${experimentId}" niet gevonden voor dit project.`
    );
  }

  if (existing.status !== 'DRAFT') {
    throw new Error(
      `Alleen concept-experimenten kunnen worden gestart. Huidige status: ${EXPERIMENT_STATUS_LABELS[existing.status as ExperimentStatus]}.`
    );
  }

  return db.experiment.update({
    where: { id: experimentId },
    data: {
      status: 'RUNNING',
      startDate: existing.startDate ?? new Date(),
    },
  });
}

/**
 * Complete an experiment: transition from RUNNING → COMPLETED.
 * Sets the endDate if not already set.
 *
 * @param experimentId - The experiment to complete
 * @param projectId - The project it belongs to (tenant isolation)
 * @returns The updated Experiment record
 * @throws Error if experiment not found or not in RUNNING status
 */
export async function completeExperiment(
  experimentId: string,
  projectId: string
) {
  const existing = await db.experiment.findFirst({
    where: { id: experimentId, projectId, deletedAt: null },
  });

  if (!existing) {
    throw new Error(
      `Experiment met ID "${experimentId}" niet gevonden voor dit project.`
    );
  }

  if (existing.status !== 'RUNNING') {
    throw new Error(
      `Alleen actieve experimenten kunnen worden afgerond. Huidige status: ${EXPERIMENT_STATUS_LABELS[existing.status as ExperimentStatus]}.`
    );
  }

  return db.experiment.update({
    where: { id: experimentId },
    data: {
      status: 'COMPLETED',
      endDate: existing.endDate ?? new Date(),
    },
  });
}

/**
 * Cancel an experiment: transition any status → CANCELLED.
 *
 * @param experimentId - The experiment to cancel
 * @param projectId - The project it belongs to (tenant isolation)
 * @returns The updated Experiment record
 * @throws Error if experiment not found or already cancelled
 */
export async function cancelExperiment(
  experimentId: string,
  projectId: string
) {
  const existing = await db.experiment.findFirst({
    where: { id: experimentId, projectId, deletedAt: null },
  });

  if (!existing) {
    throw new Error(
      `Experiment met ID "${experimentId}" niet gevonden voor dit project.`
    );
  }

  if (existing.status === 'CANCELLED') {
    throw new Error(
      'Dit experiment is al geannuleerd.'
    );
  }

  return db.experiment.update({
    where: { id: experimentId },
    data: {
      status: 'CANCELLED',
      endDate: new Date(),
    },
  });
}

// ============================================================================
// Soft Delete
// ============================================================================

/**
 * Soft-delete an experiment by setting deletedAt.
 * The record remains in the database but is excluded from queries.
 *
 * @param experimentId - The experiment to delete
 * @param projectId - The project it belongs to (tenant isolation)
 * @returns The updated Experiment record
 * @throws Error if experiment not found
 */
export async function deleteExperiment(
  experimentId: string,
  projectId: string
) {
  const existing = await db.experiment.findFirst({
    where: { id: experimentId, projectId, deletedAt: null },
  });

  if (!existing) {
    throw new Error(
      `Experiment met ID "${experimentId}" niet gevonden voor dit project.`
    );
  }

  return db.experiment.update({
    where: { id: experimentId },
    data: {
      deletedAt: new Date(),
      status: 'CANCELLED',
    },
  });
}
