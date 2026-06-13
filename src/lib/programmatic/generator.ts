// ============================================================================
// Programmatic SEO Page Generator — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Generates programmatic SEO pages from templates and data rows, expands
// templates with AI, runs quality gates, and manages the approval/publishing
// workflow. All user-facing strings are in Dutch.
//
// Flow:
//   1. Fill template with row data (variable substitution)
//   2. Use AI to expand template into full content (with brand context)
//   3. Run quality gates on the generated content
//   4. If approved, save to ProgrammaticPage with APPROVED status
//   5. If rejected, save with REJECTED status and rejection reasons
// ============================================================================

import { db } from '@/lib/db';
import { providerManager } from '@/lib/ai/provider-manager';
import { renderTemplate, extractTitle, generateSlug } from './template-manager';
import { runQualityGates } from './quality-gates';
import type {
  ProgrammaticDataRows,
  ProgrammaticGenerationResult,
  QualityGatesConfig,
} from './types';

// ============================================================================
// AI Prompt Construction
// ============================================================================

/**
 * Build the AI system prompt for programmatic content expansion.
 * Includes brand context when available.
 */
function buildSystemPrompt(brandContext?: string): string {
  let prompt = `Je bent een SEO-contentexpert voor het Nederlandse taalgebied. Je taak is om een sjabloon-gebaseerde pagina uit te breiden tot volledige, hoogwaardige SEO-content.

Vereisten:
- Schrijf in vloeiend, professioneel Nederlands
- De content moet minstens 300 woorden bevatten
- Gebruik natuurlijke trefwoordplaatsing zonder keyword stuffing
- Voeg waar relevant interne linksuggesties toe in Markdown-formaat: [beschrijving](/pad)
- Vermijd dunne of doorway-content — elke pagina moet unieke waarde bieden
- Gebruik H2- en H3-koppen voor structuur
- Sluit af met een call-to-action of samenvatting
- Gebruik geen ononderbouwde claims of superlatieven zonder bron`;

  if (brandContext) {
    prompt += `\n\nMerkcontext:\n${brandContext}`;
  }

  return prompt;
}

/**
 * Build the AI user prompt for expanding a template with data.
 */
function buildUserPrompt(
  renderedTemplate: string,
  targetKeyword: string,
  rowData: Record<string, string | number>
): string {
  const dataSummary = Object.entries(rowData)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  return `Breid het volgende SEO-sjabloon uit tot een volledige, unieke pagina.

Doeltrefwoord: ${targetKeyword}

Gebruikte gegevens:
${dataSummary}

Sjabloon:
${renderedTemplate}

Schrijf volledige, unieke content op basis van dit sjabloon. Behoud de structuur en koppen, maar breid elke sectie uit met waardevolle, specifieke informatie. Zorg dat de content onderscheidend is en niet als dunne of doorway-content kan worden beschouwd.`;
}

/**
 * Get brand context from the project's brand profile.
 */
async function getBrandContext(projectId: string): Promise<string | undefined> {
  const brandProfile = await db.brandProfile.findUnique({
    where: { projectId },
  });

  if (!brandProfile) return undefined;

  const parts: string[] = [];

  if (brandProfile.brandName) parts.push(`Merknaam: ${brandProfile.brandName}`);
  if (brandProfile.toneOfVoice) parts.push(`Tone of voice: ${brandProfile.toneOfVoice}`);
  if (brandProfile.description) parts.push(`Beschrijving: ${brandProfile.description}`);

  if (brandProfile.preferredTerminology) {
    try {
      const terms: string[] = JSON.parse(brandProfile.preferredTerminology);
      if (terms.length > 0) parts.push(`Voorkeursterminologie: ${terms.join(', ')}`);
    } catch { /* skip invalid JSON */ }
  }

  if (brandProfile.prohibitedTerminology) {
    try {
      const terms: string[] = JSON.parse(brandProfile.prohibitedTerminology);
      if (terms.length > 0) parts.push(`Verboden terminologie: ${terms.join(', ')}`);
    } catch { /* skip invalid JSON */ }
  }

  if (brandProfile.allowedClaims) {
    try {
      const claims: string[] = JSON.parse(brandProfile.allowedClaims);
      if (claims.length > 0) parts.push(`Toegestane claims: ${claims.join(', ')}`);
    } catch { /* skip invalid JSON */ }
  }

  if (brandProfile.prohibitedClaims) {
    try {
      const claims: string[] = JSON.parse(brandProfile.prohibitedClaims);
      if (claims.length > 0) parts.push(`Verboden claims: ${claims.join(', ')}`);
    } catch { /* skip invalid JSON */ }
  }

  if (brandProfile.editorialRules) {
    try {
      const rules: string[] = JSON.parse(brandProfile.editorialRules);
      if (rules.length > 0) parts.push(`Redactionele regels: ${rules.join('; ')}`);
    } catch { /* skip invalid JSON */ }
  }

  return parts.length > 0 ? parts.join('\n') : undefined;
}

// ============================================================================
// Page Generation
// ============================================================================

/**
 * Generate programmatic SEO pages for all data rows in a template.
 *
 * For each data row:
 * 1. Fill template with row data
 * 2. Use AI to expand template into full content (with brand context)
 * 3. Run quality gates
 * 4. If approved, save to ProgrammaticPage with APPROVED status
 * 5. If rejected, save with REJECTED status and rejection reasons
 *
 * @param templateId - The template to generate pages for
 * @param limit - Optional maximum number of pages to generate
 * @returns Generation result with counts and rejection reasons
 */
export async function generatePages(
  templateId: string,
  limit?: number
): Promise<ProgrammaticGenerationResult> {
  const template = await db.programmaticTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template || template.deletedAt) {
    throw new Error(`Sjabloon met ID "${templateId}" niet gevonden of verwijderd.`);
  }

  const dataRows: ProgrammaticDataRows = template.dataRows
    ? JSON.parse(template.dataRows)
    : [];

  const qualityGatesConfig: QualityGatesConfig = template.qualityGates
    ? JSON.parse(template.qualityGates)
    : {};

  const brandContext = await getBrandContext(template.projectId);

  // Get already-generated row data to skip duplicates
  const existingPages = await db.programmaticPage.findMany({
    where: {
      templateId,
      deletedAt: null,
    },
    select: { rowData: true },
  });

  const existingRowDataSet = new Set(
    existingPages.map((p) => {
      try {
        return JSON.stringify(JSON.parse(p.rowData));
      } catch {
        return p.rowData;
      }
    })
  );

  const rowsToProcess = dataRows.filter((row) => {
    return !existingRowDataSet.has(JSON.stringify(row));
  });

  const effectiveLimit = limit ?? rowsToProcess.length;
  const rows = rowsToProcess.slice(0, effectiveLimit);

  let totalGenerated = 0;
  let approved = 0;
  let rejected = 0;
  const rejectionReasons: Record<string, number> = {};

  for (const rowData of rows) {
    try {
      // Step 1: Fill template with row data
      const renderedTemplate = renderTemplate(template.contentTemplate, rowData);
      const targetKeyword = renderTemplate(template.targetKeyword || '', rowData);

      // Step 2: Use AI to expand template into full content
      const systemPrompt = buildSystemPrompt(brandContext);
      const userPrompt = buildUserPrompt(renderedTemplate, targetKeyword, rowData);

      const aiResponse = await providerManager.fallbackGenerate(template.projectId, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        purpose: 'programmatic-seo',
        temperature: 0.7,
        maxTokens: 4096,
      });

      const generatedContent = aiResponse.success
        ? aiResponse.content
        : renderedTemplate; // Fallback to basic rendered template

      // Step 3: Run quality gates
      const qualityResult = await runQualityGates(
        template.projectId,
        templateId,
        generatedContent,
        rowData,
        qualityGatesConfig
      );

      // Step 4: Extract metadata
      const title = extractTitle(generatedContent);
      const slug = generateSlug(title);

      // Generate meta title and description
      const metaTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
      const firstParagraph = generatedContent
        .replace(/^#+\s+.*$/gm, '')
        .split('\n\n')
        .find((p) => p.trim().length > 0) || '';
      const metaDescription =
        firstParagraph.length > 160
          ? firstParagraph.substring(0, 157) + '...'
          : firstParagraph;

      // Step 5: Save to database
      const pageStatus = qualityResult.approved ? 'APPROVED' : 'REJECTED';

      await db.programmaticPage.create({
        data: {
          templateId,
          projectId: template.projectId,
          rowData: JSON.stringify(rowData),
          generatedContent,
          title,
          slug,
          metaTitle,
          metaDescription,
          status: pageStatus,
          qualityScore: qualityResult.overallScore,
          qualityResults: JSON.stringify(qualityResult.results),
          rejectionReasons: qualityResult.rejectionReasons.length > 0
            ? JSON.stringify(qualityResult.rejectionReasons)
            : null,
          approvedAt: qualityResult.approved ? new Date() : null,
        },
      });

      totalGenerated++;

      if (qualityResult.approved) {
        approved++;
      } else {
        rejected++;
        for (const reason of qualityResult.rejectionReasons) {
          rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
        }
      }
    } catch (error) {
      // On error, save as rejected with the error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      totalGenerated++;
      rejected++;
      const reason = `Fout bij genereren: ${errorMessage}`;
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;

      try {
        await db.programmaticPage.create({
          data: {
            templateId,
            projectId: template.projectId,
            rowData: JSON.stringify(rowData),
            generatedContent: null,
            status: 'REJECTED',
            qualityScore: 0,
            qualityResults: null,
            rejectionReasons: JSON.stringify([reason]),
          },
        });
      } catch {
        // If we can't even save the error record, just continue
        console.error(`[ProgrammaticSEO] Failed to save error record for row: ${JSON.stringify(rowData)}`);
      }
    }
  }

  return {
    totalGenerated,
    approved,
    rejected,
    rejectionReasons,
  };
}

/**
 * Regenerate a single rejected page.
 *
 * Re-runs the template filling, AI expansion, and quality gates for
 * a specific page that was previously rejected.
 *
 * @param pageId - The page to regenerate
 * @returns The regenerated page database record
 * @throws Error if the page is not found or not in REJECTED status
 */
export async function regeneratePage(pageId: string) {
  const page = await db.programmaticPage.findUnique({
    where: { id: pageId },
    include: { template: true },
  });

  if (!page || page.deletedAt) {
    throw new Error(`Pagina met ID "${pageId}" niet gevonden of verwijderd.`);
  }

  if (page.status !== 'REJECTED') {
    throw new Error(
      `Alleen afgewezen pagina's kunnen opnieuw worden gegenereerd. Huidige status: "${page.status}".`
    );
  }

  const template = page.template;
  let rowData: Record<string, string | number>;

  try {
    rowData = JSON.parse(page.rowData);
  } catch {
    throw new Error('Pagina-gegevens konden niet worden gelezen (ongeldige JSON).');
  }

  const qualityGatesConfig: QualityGatesConfig = template.qualityGates
    ? JSON.parse(template.qualityGates)
    : {};

  const brandContext = await getBrandContext(template.projectId);

  // Step 1: Fill template with row data
  const renderedTemplate = renderTemplate(template.contentTemplate, rowData);
  const targetKeyword = renderTemplate(template.targetKeyword || '', rowData);

  // Step 2: Use AI to expand template into full content
  const systemPrompt = buildSystemPrompt(brandContext);
  const userPrompt = buildUserPrompt(renderedTemplate, targetKeyword, rowData);

  const aiResponse = await providerManager.fallbackGenerate(template.projectId, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    purpose: 'programmatic-seo-regenerate',
    temperature: 0.8, // Slightly higher temperature for regeneration
    maxTokens: 4096,
  });

  const generatedContent = aiResponse.success
    ? aiResponse.content
    : renderedTemplate;

  // Step 3: Run quality gates
  const qualityResult = await runQualityGates(
    template.projectId,
    template.id,
    generatedContent,
    rowData,
    qualityGatesConfig
  );

  // Step 4: Update the page
  const title = extractTitle(generatedContent);
  const slug = generateSlug(title);
  const metaTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
  const firstParagraph = generatedContent
    .replace(/^#+\s+.*$/gm, '')
    .split('\n\n')
    .find((p) => p.trim().length > 0) || '';
  const metaDescription =
    firstParagraph.length > 160
      ? firstParagraph.substring(0, 157) + '...'
      : firstParagraph;

  const newStatus = qualityResult.approved ? 'APPROVED' : 'REJECTED';

  const updatedPage = await db.programmaticPage.update({
    where: { id: pageId },
    data: {
      generatedContent,
      title,
      slug,
      metaTitle,
      metaDescription,
      status: newStatus,
      qualityScore: qualityResult.overallScore,
      qualityResults: JSON.stringify(qualityResult.results),
      rejectionReasons: qualityResult.rejectionReasons.length > 0
        ? JSON.stringify(qualityResult.rejectionReasons)
        : null,
      approvedAt: qualityResult.approved ? new Date() : null,
      approvedBy: null,
    },
  });

  return updatedPage;
}

// ============================================================================
// Publishing
// ============================================================================

/**
 * Publish approved pages for a template.
 *
 * Only pages with APPROVED status are published. The publication limit
 * set on the template is respected.
 *
 * @param templateId - The template whose approved pages to publish
 * @param cmsConnectionId - Optional CMS connection to publish to
 * @returns Number of pages published
 */
export async function publishApprovedPages(
  templateId: string,
  cmsConnectionId?: string
): Promise<number> {
  const template = await db.programmaticTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template || template.deletedAt) {
    throw new Error(`Sjabloon met ID "${templateId}" niet gevonden of verwijderd.`);
  }

  // Get approved pages that haven't been published yet
  const approvedPages = await db.programmaticPage.findMany({
    where: {
      templateId,
      deletedAt: null,
      status: 'APPROVED',
    },
    orderBy: { qualityScore: 'desc' }, // Publish highest quality first
  });

  // Respect the publication limit
  const alreadyPublished = template.publishedCount;
  const maxNewPublications = Math.max(0, template.maxPages - alreadyPublished);
  const pagesToPublish = approvedPages.slice(0, maxNewPublications);

  if (pagesToPublish.length === 0) {
    return 0;
  }

  // If a CMS connection is specified, validate it exists
  if (cmsConnectionId) {
    const cmsConnection = await db.cMSConnection.findUnique({
      where: { id: cmsConnectionId },
    });

    if (!cmsConnection || cmsConnection.deletedAt) {
      throw new Error(`CMS-verbinding met ID "${cmsConnectionId}" niet gevonden of verwijderd.`);
    }

    if (cmsConnection.status !== 'CONNECTED') {
      throw new Error(
        `CMS-verbinding "${cmsConnection.name}" is niet verbonden. Huidige status: "${cmsConnection.status}".`
      );
    }
  }

  let publishedCount = 0;

  for (const page of pagesToPublish) {
    try {
      let cmsResult: Record<string, unknown> | null = null;

      // If CMS connection is provided, attempt to publish to CMS
      if (cmsConnectionId) {
        // Record the CMS publication attempt
        cmsResult = {
          attempted: true,
          cmsConnectionId,
          timestamp: new Date().toISOString(),
          status: 'pending',
          note: 'CMS-publicatie wordt asynchroon verwerkt.',
        };
      }

      await db.programmaticPage.update({
        where: { id: page.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          cmsResult: cmsResult ? JSON.stringify(cmsResult) : null,
        },
      });

      publishedCount++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `[ProgrammaticSEO] Fout bij publiceren van pagina ${page.id}: ${errorMsg}`
      );
      // Continue with remaining pages
    }
  }

  // Update the template's published count
  await db.programmaticTemplate.update({
    where: { id: templateId },
    data: {
      publishedCount: alreadyPublished + publishedCount,
    },
  });

  return publishedCount;
}

/**
 * Set the maximum number of pages that can be published for a template.
 *
 * @param templateId - The template to configure
 * @param maxPages - Maximum number of publishable pages
 * @throws Error if the template is not found
 */
export async function setPublicationLimit(
  templateId: string,
  maxPages: number
): Promise<void> {
  if (maxPages < 0) {
    throw new Error('De publicatielimiet moet een positief getal zijn.');
  }

  const template = await db.programmaticTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template || template.deletedAt) {
    throw new Error(`Sjabloon met ID "${templateId}" niet gevonden of verwijderd.`);
  }

  await db.programmaticTemplate.update({
    where: { id: templateId },
    data: { maxPages },
  });
}
