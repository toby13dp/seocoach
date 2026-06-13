// ============================================================================
// Forecasting — Budget Manager
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages budget allocations across SEO categories with validation,
// rule-based recommendations, and tenant isolation.
// ============================================================================

import { db } from '@/lib/db';
import type { BudgetCategory } from '@prisma/client';
import type { BudgetAllocationData, BudgetRecommendation } from './types';
import { BUDGET_CATEGORY_LABELS } from './types';

// ============================================================================
// Validation
// ============================================================================

/**
 * All budget category fields as stored in the database.
 */
const ALLOCATION_FIELDS = [
  'technicalSeo',
  'content',
  'updates',
  'authority',
  'digitalPR',
  'cro',
  'localSeo',
  'geo',
  'monitoring',
  'reporting',
] as const;

/**
 * Validate that allocation percentages sum to 100%.
 * Uses ±0.01 tolerance for floating-point precision.
 *
 * @param allocations - The category allocations to validate
 * @throws Error with Dutch message if total is not 100%
 */
function validateAllocations(allocations: BudgetAllocationData['allocations']): void {
  const total = ALLOCATION_FIELDS.reduce((sum, field) => sum + (allocations[field] ?? 0), 0);

  if (Math.abs(total - 100) > 0.01) {
    throw new Error(
      `De totale toewijzing moet 100% bedragen. Huidig totaal: ${total.toFixed(1)}%.`
    );
  }

  // Validate individual percentages are non-negative
  for (const field of ALLOCATION_FIELDS) {
    const value = allocations[field] ?? 0;
    if (value < 0) {
      throw new Error(
        `Toewijzing voor "${BUDGET_CATEGORY_LABELS[field as BudgetCategory]}" mag niet negatief zijn.`
      );
    }
  }
}

// ============================================================================
// Create Budget
// ============================================================================

/**
 * Create a new budget allocation.
 * Validates that all category percentages sum to 100%.
 *
 * @param projectId - The project to create the budget for (tenant isolation)
 * @param data - Budget allocation data with Dutch text fields
 * @returns The created BudgetAllocation record
 * @throws Error if allocations do not sum to 100%
 */
export async function createBudget(
  projectId: string,
  data: BudgetAllocationData
) {
  validateAllocations(data.allocations);

  return db.budgetAllocation.create({
    data: {
      projectId,
      name: data.name,
      description: data.description ?? null,
      totalBudget: data.totalBudget,
      currency: data.currency ?? 'EUR',
      technicalSeo: data.allocations.technicalSeo,
      content: data.allocations.content,
      updates: data.allocations.updates,
      authority: data.allocations.authority,
      digitalPR: data.allocations.digitalPR,
      cro: data.allocations.cro,
      localSeo: data.allocations.localSeo,
      geo: data.allocations.geo,
      monitoring: data.allocations.monitoring,
      reporting: data.allocations.reporting,
      allocationNotes: data.allocationNotes ?? null,
      periodStart: data.periodStart ?? null,
      periodEnd: data.periodEnd ?? null,
    },
  });
}

// ============================================================================
// Update Budget
// ============================================================================

/**
 * Update an existing budget allocation.
 * If allocations are provided, validates that they still sum to 100%.
 *
 * @param budgetId - The budget to update
 * @param projectId - The project it belongs to (tenant isolation)
 * @param data - Partial budget allocation data
 * @returns The updated BudgetAllocation record
 * @throws Error if budget not found or allocations invalid
 */
export async function updateBudget(
  budgetId: string,
  projectId: string,
  data: Partial<BudgetAllocationData>
) {
  // Verify ownership
  const existing = await db.budgetAllocation.findFirst({
    where: { id: budgetId, projectId, deletedAt: null },
  });

  if (!existing) {
    throw new Error(
      `Budget met ID "${budgetId}" niet gevonden voor dit project.`
    );
  }

  // If allocations are provided, validate the full set
  if (data.allocations) {
    validateAllocations(data.allocations);
  }

  return db.budgetAllocation.update({
    where: { id: budgetId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.totalBudget !== undefined && { totalBudget: data.totalBudget }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.allocations?.technicalSeo !== undefined && { technicalSeo: data.allocations.technicalSeo }),
      ...(data.allocations?.content !== undefined && { content: data.allocations.content }),
      ...(data.allocations?.updates !== undefined && { updates: data.allocations.updates }),
      ...(data.allocations?.authority !== undefined && { authority: data.allocations.authority }),
      ...(data.allocations?.digitalPR !== undefined && { digitalPR: data.allocations.digitalPR }),
      ...(data.allocations?.cro !== undefined && { cro: data.allocations.cro }),
      ...(data.allocations?.localSeo !== undefined && { localSeo: data.allocations.localSeo }),
      ...(data.allocations?.geo !== undefined && { geo: data.allocations.geo }),
      ...(data.allocations?.monitoring !== undefined && { monitoring: data.allocations.monitoring }),
      ...(data.allocations?.reporting !== undefined && { reporting: data.allocations.reporting }),
      ...(data.allocationNotes !== undefined && { allocationNotes: data.allocationNotes }),
      ...(data.periodStart !== undefined && { periodStart: data.periodStart }),
      ...(data.periodEnd !== undefined && { periodEnd: data.periodEnd }),
    },
  });
}

// ============================================================================
// Read Budget
// ============================================================================

/**
 * Get a single budget allocation by ID, verifying project ownership.
 *
 * @param budgetId - The budget ID to retrieve
 * @param projectId - The project it must belong to (tenant isolation)
 * @returns The budget allocation record or null
 */
export async function getBudget(
  budgetId: string,
  projectId: string
) {
  return db.budgetAllocation.findFirst({
    where: {
      id: budgetId,
      projectId,
      deletedAt: null,
    },
  });
}

/**
 * List all active budget allocations for a project.
 *
 * @param projectId - The project to list budgets for
 * @returns Array of budget allocation records
 */
export async function listBudgets(
  projectId: string
) {
  return db.budgetAllocation.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ============================================================================
// Delete Budget
// ============================================================================

/**
 * Soft-delete a budget allocation by setting deletedAt.
 *
 * @param budgetId - The budget to delete
 * @param projectId - The project it belongs to (tenant isolation)
 * @returns The updated budget allocation record
 * @throws Error if budget not found
 */
export async function deleteBudget(
  budgetId: string,
  projectId: string
) {
  const existing = await db.budgetAllocation.findFirst({
    where: { id: budgetId, projectId, deletedAt: null },
  });

  if (!existing) {
    throw new Error(
      `Budget met ID "${budgetId}" niet gevonden voor dit project.`
    );
  }

  return db.budgetAllocation.update({
    where: { id: budgetId },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });
}

// ============================================================================
// Budget Recommendations
// ============================================================================

/**
 * Get rule-based Dutch budget recommendations for a project.
 *
 * Analyzes project state (technical issues, content decay, etc.) and provides
 * tailored budget allocation recommendations.
 *
 * @param projectId - The project to get recommendations for
 * @returns Array of category recommendations with Dutch reasons
 */
export async function getBudgetRecommendations(
  projectId: string
): Promise<BudgetRecommendation[]> {
  const recommendations: BudgetRecommendation[] = [];

  // Analyze project state from various data sources
  const [
    technicalIssueCount,
    decayPageCount,
    authorityRecordCount,
    locationCount,
    experimentCount,
  ] = await Promise.all([
    // Count active technical issues
    countTechnicalIssues(projectId),
    // Count pages with content decay
    countDecayPages(projectId),
    // Count authority records (backlinks)
    db.authorityRecord.count({
      where: { projectId, deletedAt: null, status: 'active' },
    }),
    // Count locations for local SEO
    db.location.count({
      where: { projectId, deletedAt: null },
    }),
    // Count experiments for CRO
    db.experiment.count({
      where: { projectId, deletedAt: null, status: { in: ['RUNNING', 'COMPLETED'] } },
    }),
  ]);

  // --- Technical SEO recommendation ---
  if (technicalIssueCount > 20) {
    recommendations.push({
      category: 'TECHNICAL_SEO',
      recommendedPercentage: 25,
      reason: `Technische SEO heeft aandacht nodig — ${technicalIssueCount} problemen gedetecteerd. Aanbevolen: 20-25%.`,
    });
  } else if (technicalIssueCount > 5) {
    recommendations.push({
      category: 'TECHNICAL_SEO',
      recommendedPercentage: 20,
      reason: `Technische SEO vereist aandacht — ${technicalIssueCount} problemen gedetecteerd. Aanbevolen: 15-20%.`,
    });
  } else {
    recommendations.push({
      category: 'TECHNICAL_SEO',
      recommendedPercentage: 15,
      reason: `Technische SEO is relatief gezond (${technicalIssueCount} problemen). Onderhoudsniveau: 15%.`,
    });
  }

  // --- Content recommendation ---
  if (decayPageCount > 20) {
    recommendations.push({
      category: 'CONTENT',
      recommendedPercentage: 25,
      reason: `Content vernieuwing is nodig — ${decayPageCount} pagina's met verval. Aanbevolen: 20-25%.`,
    });
  } else if (decayPageCount > 5) {
    recommendations.push({
      category: 'CONTENT',
      recommendedPercentage: 20,
      reason: `Enige content vernieuwing nodig — ${decayPageCount} pagina's met verval. Aanbevolen: 15-20%.`,
    });
  } else {
    recommendations.push({
      category: 'CONTENT',
      recommendedPercentage: 20,
      reason: 'Contentstrategie is op peil. Behoud huidige investering: 20%.',
    });
  }

  // --- Updates recommendation ---
  recommendations.push({
    category: 'UPDATES',
    recommendedPercentage: 5,
    reason: 'Regelmatige updates van bestaande content voorkomen verval. Aanbevolen: 5%.',
  });

  // --- Authority recommendation ---
  if (authorityRecordCount < 50) {
    recommendations.push({
      category: 'AUTHORITY',
      recommendedPercentage: 20,
      reason: `Autoriteitsopbouw heeft prioriteit — slechts ${authorityRecordCount} backlinks. Aanbevolen: 15-20%.`,
    });
  } else if (authorityRecordCount < 200) {
    recommendations.push({
      category: 'AUTHORITY',
      recommendedPercentage: 15,
      reason: `Autoriteit kan worden versterkt — ${authorityRecordCount} backlinks. Aanbevolen: 15%.`,
    });
  } else {
    recommendations.push({
      category: 'AUTHORITY',
      recommendedPercentage: 15,
      reason: `Goede autoriteit (${authorityRecordCount} backlinks). Behoud niveau: 15%.`,
    });
  }

  // --- Digital PR recommendation ---
  recommendations.push({
    category: 'DIGITAL_PR',
    recommendedPercentage: 5,
    reason: 'Digitale PR ondersteunt merkbeeld en autoriteit. Aanbevolen: 5%.',
  });

  // --- CRO recommendation ---
  if (experimentCount === 0) {
    recommendations.push({
      category: 'CRO',
      recommendedPercentage: 10,
      reason: 'Nog geen CRO-experimenten uitgevoerd. Start met A/B-tests: 10%.',
    });
  } else {
    recommendations.push({
      category: 'CRO',
      recommendedPercentage: 10,
      reason: `${experimentCount} experimenten uitgevoerd. Vervolg CRO-optimalisatie: 10%.`,
    });
  }

  // --- Local SEO recommendation ---
  if (locationCount > 3) {
    recommendations.push({
      category: 'LOCAL_SEO',
      recommendedPercentage: 10,
      reason: `${locationCount} locaties vereisen lokale SEO-inspanningen. Aanbevolen: 10%.`,
    });
  } else if (locationCount > 0) {
    recommendations.push({
      category: 'LOCAL_SEO',
      recommendedPercentage: 5,
      reason: `${locationCount} locatie(s) — basis lokale SEO volstaat: 5%.`,
    });
  } else {
    recommendations.push({
      category: 'LOCAL_SEO',
      recommendedPercentage: 5,
      reason: 'Lokale SEO kan waarde toevoegen, zelfs zonder fysieke locaties: 5%.',
    });
  }

  // --- GEO recommendation ---
  recommendations.push({
    category: 'GEO',
    recommendedPercentage: 5,
    reason: 'GEO (Generative Engine Optimization) wordt steeds belangrijker. Aanbevolen: 5%.',
  });

  // --- Monitoring recommendation ---
  recommendations.push({
    category: 'MONITORING',
    recommendedPercentage: 10,
    reason: 'Monitoring is essentieel voor het meten van resultaten en het detecteren van problemen. Aanbevolen: 10%.',
  });

  // --- Reporting recommendation ---
  recommendations.push({
    category: 'REPORTING',
    recommendedPercentage: 5,
    reason: 'Rapportage zorgt voor inzicht en verantwoording. Aanbevolen: 5%.',
  });

  return recommendations;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Count active technical issues for a project.
 * Queries CROFindings and pages with non-OK status as proxy for issues.
 */
async function countTechnicalIssues(projectId: string): Promise<number> {
  try {
    // Count CRO findings as a proxy for issues
    const croCount = await db.cROFinding.count({
      where: {
        projectId,
      },
    });

    // Count pages with error status codes as technical issues
    const errorPageCount = await db.page.count({
      where: {
        projectId,
        status: { in: ['CLIENT_ERROR', 'SERVER_ERROR', 'REDIRECT'] },
      },
    });

    return croCount + errorPageCount;
  } catch {
    // If queries fail, return 0
    return 0;
  }
}

/**
 * Count pages with content decay for a project.
 * Uses the ContentDecay model with IMPROVE/REDIRECT/NOINDEX actions.
 */
async function countDecayPages(projectId: string): Promise<number> {
  try {
    // Count content decay records that require action
    const count = await db.contentDecay.count({
      where: {
        projectId,
        pruningAction: { in: ['IMPROVE', 'MERGE', 'REDIRECT', 'NOINDEX'] },
      },
    });
    return count;
  } catch {
    return 0;
  }
}
