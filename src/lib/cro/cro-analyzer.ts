// ============================================================================
// CRO & Behaviour — CRO Analyzer
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core CRO finding generator. Analyzes behaviour data to produce actionable
// CRO findings with Dutch titles, descriptions, and recommendations.
// All functions verify projectId for tenant isolation.
// ============================================================================

import { db } from '@/lib/db';
import {
  BehaviourType,
  CROCategory,
  CROSeverity,
} from '@prisma/client';
import type { BehaviourImportData, CROFindingData } from './types';

// ============================================================================
// Prisma Record Types
// ============================================================================

/** BehaviourRecord type from Prisma (non-null, as returned by findMany) */
type BehaviourRecord = Awaited<ReturnType<typeof db.behaviourRecord.findMany>>[number];

/** CROFinding type from Prisma (non-null, as returned by findMany) */
type CROFinding = Awaited<ReturnType<typeof db.cROFinding.findMany>>[number];

// Re-export for external use
export type { BehaviourRecord, CROFinding };

// ============================================================================
// Project Verification
// ============================================================================

/**
 * Verify that a project exists and is not soft-deleted.
 * Throws an error in Dutch if the project is not found.
 */
async function verifyProject(projectId: string): Promise<void> {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });

  if (!project) {
    throw new Error(`Project met ID "${projectId}" niet gevonden of verwijderd.`);
  }
}

// ============================================================================
// Main Analysis Entry Point
// ============================================================================

/**
 * Analyze all behaviour data for a project and generate CRO findings.
 * This is the main entry point for CRO analysis. It runs all individual
 * analysis modules and combines their findings.
 *
 * Findings are saved to the database and returned.
 *
 * @param projectId - The project ID for tenant isolation
 * @returns Array of generated CRO findings
 */
export async function analyzeCROFindings(
  projectId: string
): Promise<CROFinding[]> {
  await verifyProject(projectId);

  // Fetch all behaviour records for the project
  const records = await db.behaviourRecord.findMany({
    where: { projectId },
    orderBy: { recordedAt: 'desc' },
  });

  if (records.length === 0) {
    return [];
  }

  // Run all analysis modules
  const allFindings: CROFindingData[] = [
    ...analyzeScrollDepth(records),
    ...analyzeRageClicks(records),
    ...analyzeDeadClicks(records),
    ...analyzeFormAbandonment(records),
    ...analyzeDeviceEngagement(records),
  ];

  if (allFindings.length === 0) {
    return [];
  }

  // Save findings to database
  await saveCROFindings(projectId, allFindings);

  // Return the saved findings
  return db.cROFinding.findMany({
    where: {
      projectId,
      source: 'behaviour_analysis',
    },
    orderBy: [
      { severity: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}

// ============================================================================
// Scroll Depth Analysis
// ============================================================================

/**
 * Analyze scroll depth records to generate CRO findings.
 * Low scroll depth indicates that visitors are not seeing important content.
 *
 * Thresholds:
 * - avg scroll depth < 25%: CRITICAL
 * - avg scroll depth < 50%: HIGH
 *
 * @param records - All behaviour records for the project
 * @returns Array of CRO finding data for scroll depth issues
 */
export function analyzeScrollDepth(records: BehaviourRecord[]): CROFindingData[] {
  const findings: CROFindingData[] = [];

  // Filter scroll depth records
  const scrollRecords = records.filter(
    (r) => r.behaviourType === BehaviourType.SCROLL_DEPTH && r.value != null
  );

  if (scrollRecords.length === 0) {
    return findings;
  }

  // Group by page URL
  const pageGroups: Record<string, number[]> = {};
  for (const record of scrollRecords) {
    const url = record.pageUrl ?? '(onbekend)';
    if (!pageGroups[url]) {
      pageGroups[url] = [];
    }
    pageGroups[url].push(record.value!);
  }

  // Analyze each page
  for (const [url, values] of Object.entries(pageGroups)) {
    if (values.length < 3) continue; // Need at least 3 data points

    const avgScrollDepth = values.reduce((sum, v) => sum + v, 0) / values.length;
    const roundedAvg = Math.round(avgScrollDepth * 10) / 10;

    if (avgScrollDepth < 25) {
      findings.push({
        category: CROCategory.LANDING_PAGES,
        severity: CROSeverity.CRITICAL,
        title: `Lage scroll-diepte op ${url}`,
        description: `Lage scroll-diepte op ${url}. Bezoekers zien niet de helft van je content. Gemiddeld scrollen bezoekers slechts ${roundedAvg}% van de pagina.`,
        recommendation:
          'Verplaats belangrijke content en call-to-actions naar het bovenste deel van de pagina. Verminder de hoeveelheid content boven de vouw en maak de pagina visueel aantrekkelijker om verder te scrollen.',
        evidence: JSON.stringify({
          avgScrollDepth: roundedAvg,
          dataPoints: values.length,
          pageUrl: url,
        }),
        pageUrl: url,
        estimatedImpact:
          'Hoog — Bezoekers missen mogelijk belangrijke conversie-elementen en informatie.',
        effort: 'medium',
      });
    } else if (avgScrollDepth < 50) {
      findings.push({
        category: CROCategory.LANDING_PAGES,
        severity: CROSeverity.HIGH,
        title: `Gemiddelde scroll-diepte op ${url}`,
        description: `Gemiddelde scroll-diepte op ${url}. Belangrijke content staat mogelijk te ver op de pagina. Gemiddeld scrollen bezoekers ${roundedAvg}% van de pagina.`,
        recommendation:
          'Heroverweeg de paginalay-out. Plaats key content en conversie-elementen hoger op de pagina. Overweeg visuele ankers die scrollen aanmoedigen.',
        evidence: JSON.stringify({
          avgScrollDepth: roundedAvg,
          dataPoints: values.length,
          pageUrl: url,
        }),
        pageUrl: url,
        estimatedImpact:
          'Gemiddeld — Een deel van de bezoekers bereikt niet alle belangrijke content.',
        effort: 'low',
      });
    }
  }

  return findings;
}

// ============================================================================
// Rage Click Analysis
// ============================================================================

/**
 * Analyze rage click records to generate CRO findings.
 * Rage clicks indicate that visitors are repeatedly clicking on an element
 * without receiving a response, suggesting broken or confusing UI.
 *
 * @param records - All behaviour records for the project
 * @returns Array of CRO finding data for rage click issues
 */
export function analyzeRageClicks(records: BehaviourRecord[]): CROFindingData[] {
  const findings: CROFindingData[] = [];

  // Filter rage click records
  const rageClickRecords = records.filter(
    (r) => r.behaviourType === BehaviourType.RAGE_CLICK
  );

  if (rageClickRecords.length === 0) {
    return findings;
  }

  // Group by page URL + element
  const clickGroups: Record<string, { count: number; element: string; url: string }> = {};

  for (const record of rageClickRecords) {
    const url = record.pageUrl ?? '(onbekend)';
    const element = record.element ?? '(onbekend element)';
    const key = `${url}|${element}`;

    if (!clickGroups[key]) {
      clickGroups[key] = { count: 0, element, url };
    }
    clickGroups[key].count++;
  }

  // Generate findings for significant rage click patterns
  for (const group of Object.values(clickGroups)) {
    if (group.count < 3) continue; // Need at least 3 rage click events

    findings.push({
      category: CROCategory.CTA,
      severity: CROSeverity.HIGH,
      title: `Woedeklikken gedetecteerd op ${group.url}`,
      description: `Woedeklikken gedetecteerd op ${group.url}. Bezoekers klikken herhaaldelijk op '${group.element}' zonder reactie. Controleer of het element goed werkt. ${group.count} incidenten geregistreerd.`,
      recommendation:
        'Controleer of het element correct werkt en reageert op klikken. Voeg visuele feedback toe (zoals hover-effecten of laadindicatoren). Overweeg het element duidelijker klikbaar te maken of de interactie te verbeteren.',
      evidence: JSON.stringify({
        element: group.element,
        count: group.count,
        pageUrl: group.url,
        behaviourType: 'RAGE_CLICK',
      }),
      pageUrl: group.url,
      estimatedImpact:
        'Hoog — Gefrustreerde bezoekers verlaten waarschijnlijk de site zonder te converteren.',
      effort: 'low',
    });
  }

  return findings;
}

// ============================================================================
// Dead Click Analysis
// ============================================================================

/**
 * Analyze dead click records to generate CRO findings.
 * Dead clicks indicate that visitors click on an element but nothing happens,
 * suggesting non-interactive elements that appear clickable or broken links.
 *
 * @param records - All behaviour records for the project
 * @returns Array of CRO finding data for dead click issues
 */
export function analyzeDeadClicks(records: BehaviourRecord[]): CROFindingData[] {
  const findings: CROFindingData[] = [];

  // Filter dead click records
  const deadClickRecords = records.filter(
    (r) => r.behaviourType === BehaviourType.DEAD_CLICK
  );

  if (deadClickRecords.length === 0) {
    return findings;
  }

  // Group by page URL + element
  const clickGroups: Record<string, { count: number; element: string; url: string }> = {};

  for (const record of deadClickRecords) {
    const url = record.pageUrl ?? '(onbekend)';
    const element = record.element ?? '(onbekend element)';
    const key = `${url}|${element}`;

    if (!clickGroups[key]) {
      clickGroups[key] = { count: 0, element, url };
    }
    clickGroups[key].count++;
  }

  // Generate findings for significant dead click patterns
  for (const group of Object.values(clickGroups)) {
    if (group.count < 3) continue;

    findings.push({
      category: CROCategory.CTA,
      severity: CROSeverity.MEDIUM,
      title: `Dode klik gedetecteerd op ${group.url}`,
      description: `Dode klik gedetecteerd op ${group.url}. Bezoekers klikken op '${group.element}' maar er gebeurt niets. Dit kan frustratie veroorzaken. ${group.count} incidenten geregistreerd.`,
      recommendation:
        'Maak het element interactief of verwijder de visuele aanwijzing dat het klikbaar is. Voeg cursor:pointer toe aan klikbare elementen en verwijder het van niet-klikbare elementen.',
      evidence: JSON.stringify({
        element: group.element,
        count: group.count,
        pageUrl: group.url,
        behaviourType: 'DEAD_CLICK',
      }),
      pageUrl: group.url,
      estimatedImpact:
        'Gemiddeld — Bezoekers kunnen gefrustreerd raken en de site verlaten.',
      effort: 'low',
    });
  }

  return findings;
}

// ============================================================================
// Form Abandonment Analysis
// ============================================================================

/**
 * Analyze form abandonment records to generate CRO findings.
 * Form abandonment indicates that visitors start filling in a form but
 * leave before completing it, suggesting the form is too complex or confusing.
 *
 * @param records - All behaviour records for the project
 * @returns Array of CRO finding data for form abandonment issues
 */
export function analyzeFormAbandonment(records: BehaviourRecord[]): CROFindingData[] {
  const findings: CROFindingData[] = [];

  // Filter form abandonment records
  const formRecords = records.filter(
    (r) => r.behaviourType === BehaviourType.FORM_ABANDONMENT
  );

  if (formRecords.length === 0) {
    return findings;
  }

  // Group by page URL
  const pageGroups: Record<string, { count: number; elements: string[] }> = {};

  for (const record of formRecords) {
    const url = record.pageUrl ?? '(onbekend)';
    if (!pageGroups[url]) {
      pageGroups[url] = { count: 0, elements: [] };
    }
    pageGroups[url].count++;
    if (record.element && !pageGroups[url].elements.includes(record.element)) {
      pageGroups[url].elements.push(record.element);
    }
  }

  // Generate findings for pages with significant form abandonment
  for (const [url, data] of Object.entries(pageGroups)) {
    if (data.count < 2) continue;

    findings.push({
      category: CROCategory.FORMS,
      severity: CROSeverity.HIGH,
      title: `Formulier-afbreking op ${url}`,
      description: `Formulier-afbreking op ${url}. ${data.count} bezoekers startten het formulier maar braken het af. Vereenvoudig het formulier of voeg voortgangsindicatoren toe.`,
      recommendation:
        'Vereenvoudig het formulier: verminder het aantal velden, voeg voortgangsindicatoren toe, gebruik duidelijke foutmeldingen, en overweeg een meerstapsformulier met validatie per stap.',
      evidence: JSON.stringify({
        abandonmentCount: data.count,
        elements: data.elements,
        pageUrl: url,
        behaviourType: 'FORM_ABANDONMENT',
      }),
      pageUrl: url,
      estimatedImpact:
        'Hoog — Elke afgebroken formulierinzending is een gemiste conversie.',
      effort: 'medium',
    });
  }

  return findings;
}

// ============================================================================
// Device Engagement Analysis
// ============================================================================

/**
 * Analyze device type and engagement records to generate CRO findings.
 * Compares mobile vs desktop engagement to identify pages where the
 * mobile experience needs improvement.
 *
 * @param records - All behaviour records for the project
 * @returns Array of CRO finding data for mobile UX issues
 */
export function analyzeDeviceEngagement(records: BehaviourRecord[]): CROFindingData[] {
  const findings: CROFindingData[] = [];

  // Filter engagement records
  const engagementRecords = records.filter(
    (r) => r.behaviourType === BehaviourType.ENGAGEMENT && r.value != null
  );

  if (engagementRecords.length === 0) {
    return findings;
  }

  // Group by page URL + device type
  const pageDeviceGroups: Record<
    string,
    { desktop: number[]; mobile: number[] }
  > = {};

  for (const record of engagementRecords) {
    const url = record.pageUrl ?? '(onbekend)';
    if (!pageDeviceGroups[url]) {
      pageDeviceGroups[url] = { desktop: [], mobile: [] };
    }

    const device = (record.deviceType ?? '').toLowerCase();
    const value = record.value!;

    if (device === 'desktop') {
      pageDeviceGroups[url].desktop.push(value);
    } else if (device === 'mobile' || device === 'tablet') {
      pageDeviceGroups[url].mobile.push(value);
    }
  }

  // Compare mobile vs desktop engagement per page
  for (const [url, data] of Object.entries(pageDeviceGroups)) {
    if (data.desktop.length < 3 || data.mobile.length < 3) continue;

    const avgDesktop =
      data.desktop.reduce((sum, v) => sum + v, 0) / data.desktop.length;
    const avgMobile =
      data.mobile.reduce((sum, v) => sum + v, 0) / data.mobile.length;

    if (avgDesktop === 0) continue;

    const mobileVsDesktopPct = ((avgDesktop - avgMobile) / avgDesktop) * 100;

    // Only flag if mobile engagement is significantly lower (>20%)
    if (mobileVsDesktopPct > 20) {
      const roundedPct = Math.round(mobileVsDesktopPct);

      findings.push({
        category: CROCategory.MOBILE_UX,
        severity: roundedPct > 50 ? CROSeverity.HIGH : CROSeverity.MEDIUM,
        title: `Lage mobiele betrokkenheid op ${url}`,
        description: `Mobiele betrokkenheid is ${roundedPct}% lager dan desktop op ${url}. Optimaliseer de mobiele ervaring.`,
        recommendation:
          'Verbeter de mobiele gebruikerservaring: optimaliseer laadtijden, vergroot klikdoelen, verbeter de leesbaarheid, en vereenvoudig navigatie voor mobiele apparaten.',
        evidence: JSON.stringify({
          avgDesktopEngagement: Math.round(avgDesktop * 10) / 10,
          avgMobileEngagement: Math.round(avgMobile * 10) / 10,
          differencePercentage: roundedPct,
          pageUrl: url,
          desktopDataPoints: data.desktop.length,
          mobileDataPoints: data.mobile.length,
        }),
        pageUrl: url,
        estimatedImpact:
          'Gemiddeld — Mobiele bezoekers vormen een groeiend deel van het verkeer en lagere betrokkenheid leidt tot minder conversies.',
        effort: 'high',
      });
    }
  }

  return findings;
}

// ============================================================================
// Save CRO Findings
// ============================================================================

/**
 * Save CRO findings to the database.
 * Findings are created with source "behaviour_analysis" and status "open".
 *
 * @param projectId - The project ID for tenant isolation
 * @param findings - Array of CRO finding data to save
 * @returns Number of findings saved
 */
export async function saveCROFindings(
  projectId: string,
  findings: CROFindingData[]
): Promise<number> {
  await verifyProject(projectId);

  let saved = 0;

  for (const finding of findings) {
    try {
      await db.cROFinding.create({
        data: {
          projectId,
          category: finding.category,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          recommendation: finding.recommendation,
          evidence: finding.evidence ?? null,
          pageUrl: finding.pageUrl ?? null,
          estimatedImpact: finding.estimatedImpact ?? null,
          effort: finding.effort ?? null,
          status: 'open',
          source: 'behaviour_analysis',
        },
      });
      saved++;
    } catch (error) {
      // Skip individual errors but continue saving others
      console.error(
        `Fout bij opslaan CRO-bevinding voor project ${projectId}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return saved;
}

// ============================================================================
// Get CRO Findings
// ============================================================================

/**
 * Retrieve CRO findings for a project with optional filters.
 *
 * @param projectId - The project ID for tenant isolation
 * @param filters - Optional filters for category, severity, status, pageUrl
 * @returns Array of CRO findings matching the filters
 */
export async function getCROFindings(
  projectId: string,
  filters?: {
    category?: CROCategory;
    severity?: CROSeverity;
    status?: string;
    pageUrl?: string;
  }
): Promise<CROFinding[]> {
  await verifyProject(projectId);

  const where: Record<string, unknown> = {
    projectId,
  };

  if (filters?.category) {
    where.category = filters.category;
  }

  if (filters?.severity) {
    where.severity = filters.severity;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.pageUrl) {
    where.pageUrl = filters.pageUrl;
  }

  return db.cROFinding.findMany({
    where,
    orderBy: [
      { severity: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}

// ============================================================================
// Update CRO Finding
// ============================================================================

/**
 * Update a CRO finding's status or dismissal reason.
 * Verifies that the finding belongs to the specified project for tenant isolation.
 *
 * @param findingId - The finding ID to update
 * @param projectId - The project ID for tenant isolation
 * @param data - Update data (status and/or dismissedReason)
 * @returns The updated CRO finding
 */
export async function updateCROFinding(
  findingId: string,
  projectId: string,
  data: {
    status?: string;
    dismissedReason?: string;
  }
): Promise<CROFinding> {
  await verifyProject(projectId);

  // Verify the finding belongs to the project
  const existing = await db.cROFinding.findFirst({
    where: { id: findingId, projectId },
  });

  if (!existing) {
    throw new Error(
      `CRO-bevinding "${findingId}" niet gevonden voor project "${projectId}".`
    );
  }

  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.dismissedReason !== undefined) {
    updateData.dismissedReason = data.dismissedReason;
  }

  return db.cROFinding.update({
    where: { id: findingId },
    data: updateData,
  });
}

// ============================================================================
// Manual CRO Finding Creation
// ============================================================================

/**
 * Create a manual CRO finding.
 * This allows users to add their own CRO observations that were not
 * detected by the automated analysis.
 *
 * @param projectId - The project ID for tenant isolation
 * @param data - CRO finding data (all Dutch text fields)
 * @returns The created CRO finding
 */
export async function generateManualFinding(
  projectId: string,
  data: CROFindingData
): Promise<CROFinding> {
  await verifyProject(projectId);

  return db.cROFinding.create({
    data: {
      projectId,
      category: data.category,
      severity: data.severity,
      title: data.title,
      description: data.description,
      recommendation: data.recommendation,
      evidence: data.evidence ?? null,
      pageUrl: data.pageUrl ?? null,
      estimatedImpact: data.estimatedImpact ?? null,
      effort: data.effort ?? null,
      status: 'open',
      source: 'manual',
    },
  });
}
