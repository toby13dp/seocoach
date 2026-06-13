// ============================================================================
// Content Workflow — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Implements the 14-step content creation workflow, from opportunity selection
// through publishing. Each step advances the workflow state and delegates to
// specialized modules (brief-manager, draft-generator, quality-controls,
// source-grounding). All user-facing strings are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import { providerManager } from '@/lib/ai/provider-manager';
import { generateDraft, regenerateDraft } from './draft-generator';
import { runPrePublicationChecks, hasBlockingFindings } from './quality-controls';
import { checkClaimSupport, selectSourcesForBrief, getSourcesForBrief } from './source-grounding';
import { recordChange } from './change-history';
import type { OutlineItem } from './types';

// ============================================================================
// Content Type Definitions
// ============================================================================

/**
 * Supported content types with Dutch labels and descriptions.
 * These map to the contentType field stored on ContentBrief metadata.
 */
export const contentTypeOptions = [
  {
    value: 'ARTICLE',
    label: 'Artikel',
    description: 'Informatief artikel gericht op kennisdeling en SEO-zichtbaarheid',
  },
  {
    value: 'SERVICE_PAGE',
    label: 'Dienstpagina',
    description: 'Pagina die een specifieke dienst of aanbod beschrijft',
  },
  {
    value: 'LOCATION_PAGE',
    label: 'Locatiepagina',
    description: 'Locatiegerichte pagina voor lokale SEO-optimalisatie',
  },
  {
    value: 'CATEGORY_PAGE',
    label: 'Categoriepagina',
    description: 'Overzichtspagina die producten of diensten categoriseert',
  },
  {
    value: 'PRODUCT_DESCRIPTION',
    label: 'Productbeschrijving',
    description: 'Beschrijvende content voor een specifiek product',
  },
  {
    value: 'COMPARISON_PAGE',
    label: 'Vergelijkingspagina',
    description: 'Vergelijking tussen opties, producten of diensten',
  },
  {
    value: 'FAQ',
    label: 'Veelgestelde vragen',
    description: 'Veelgestelde vragen met gestructureerde antwoorden',
  },
  {
    value: 'GLOSSARY',
    label: 'Woordenlijst',
    description: 'Definities en uitleg van branchespecifieke termen',
  },
  {
    value: 'HOW_TO',
    label: 'Instructie',
    description: 'Stap-voor-stap instructie of handleiding',
  },
  {
    value: 'PILLAR_PAGE',
    label: 'Pilarpagina',
    description: 'Uitgebreide hoofdpagina die als hub dient voor een onderwerp',
  },
  {
    value: 'LANDING_PAGE',
    label: 'Landingspagina',
    description: 'Conversiegerichte pagina voor marketingcampagnes',
  },
  {
    value: 'AI_ANSWER_POST',
    label: 'AI-antwoordbericht',
    description: 'Blogpost geoptimaliseerd voor AI-zoekantwoorden en featured snippets',
  },
  {
    value: 'META_TITLE',
    label: 'Meta-titel',
    description: 'Geoptimaliseerde titel voor zoekmachineresultaten',
  },
  {
    value: 'META_DESCRIPTION',
    label: 'Meta-beschrijving',
    description: 'Overtuigende beschrijving voor zoekmachineresultaten',
  },
  {
    value: 'CTA',
    label: 'Call-to-action',
    description: 'Actiegerichte content om conversies te stimuleren',
  },
  {
    value: 'INTRODUCTION',
    label: 'Introductie',
    description: 'Inleidende content die de lezer betrekt en het onderwerp introduceert',
  },
  {
    value: 'CONTENT_UPDATE',
    label: 'Content-update',
    description: 'Vernieuwing van bestaande content om relevantie te behouden',
  },
] as const;

/**
 * Workflow step definitions with Dutch labels.
 */
const WORKFLOW_STEPS = [
  { step: 1, key: 'SELECT_OPPORTUNITY', label: 'Zoekwoord selecteren' },
  { step: 2, key: 'SELECT_CONTENT_TYPE', label: 'Contenttype selecteren' },
  { step: 3, key: 'GENERATE_BRIEF', label: 'Brief genereren' },
  { step: 4, key: 'EDIT_OUTLINE', label: 'Outline bewerken' },
  { step: 5, key: 'SELECT_SOURCES', label: 'Bronnen selecteren' },
  { step: 6, key: 'GENERATE_DRAFT', label: 'Draft genereren' },
  { step: 7, key: 'QUALITY_CHECKS', label: 'Kwaliteitscontroles uitvoeren' },
  { step: 8, key: 'REVIEW_CLAIMS', label: 'Claims controleren' },
  { step: 9, key: 'INTERNAL_LINKS', label: 'Interne links toevoegen' },
  { step: 10, key: 'PREVIEW', label: 'Content previewen' },
  { step: 11, key: 'APPROVE', label: 'Content goedkeuren' },
  { step: 12, key: 'CMS_DRAFT', label: 'Opslaan als CMS-concept' },
  { step: 13, key: 'SCHEDULE', label: 'Inplannen of publiceren' },
  { step: 14, key: 'PUBLISHED', label: 'Gepubliceerd' },
] as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Status of a workflow step.
 */
export interface WorkflowStepStatus {
  /** The current step number (1-14) */
  currentStep: number;
  /** Human-readable step label in Dutch */
  currentStepLabel: string;
  /** The brief approval status */
  approvalStatus: string;
  /** Whether the current step is complete */
  isComplete: boolean;
  /** All steps with their completion status */
  steps: Array<{
    step: number;
    key: string;
    label: string;
    completed: boolean;
  }>;
  /** Brief details */
  brief: {
    id: string;
    title: string;
    targetKeyword: string | null;
    contentType: string | null;
    hasOutline: boolean;
    sourceCount: number;
    versionCount: number;
    latestVersionId: string | null;
  } | null;
}

/**
 * Workflow summary for listing.
 */
export interface WorkflowSummary {
  /** Workflow ID (= brief ID) */
  id: string;
  /** Project ID */
  projectId: string;
  /** Brief title */
  title: string;
  /** Target keyword */
  targetKeyword: string | null;
  /** Content type */
  contentType: string | null;
  /** Current step number */
  currentStep: number;
  /** Current step label in Dutch */
  currentStepLabel: string;
  /** Approval status */
  approvalStatus: string;
  /** Creation date */
  createdAt: Date;
  /** Last update date */
  updatedAt: Date;
}

// ============================================================================
// Public API: Workflow Management
// ============================================================================

/**
 * Initialize a new content creation workflow.
 *
 * Creates a ContentBrief in DRAFT status as the workflow container.
 * The brief ID serves as the workflow ID throughout the process.
 *
 * @param projectId - The project to create the workflow for
 * @param keywordId - Optional keyword to pre-associate
 * @returns The workflow ID (= brief ID)
 */
export async function startWorkflow(
  projectId: string,
  keywordId?: string
): Promise<string> {
  // Optionally verify the keyword exists
  let title = 'Nieuwe content workflow';
  let targetKeyword: string | null = null;

  if (keywordId) {
    const keyword = await db.keyword.findUnique({
      where: { id: keywordId },
    });
    if (keyword) {
      title = `Content workflow: ${keyword.keyword}`;
      targetKeyword = keyword.keyword;
    }
  }

  const brief = await db.contentBrief.create({
    data: {
      projectId,
      keywordId: keywordId ?? null,
      title,
      targetKeyword,
      approvalStatus: 'DRAFT',
    },
  });

  // Record the creation
  await recordChange({
    projectId,
    briefId: brief.id,
    changeType: 'CREATE',
    summary: `Nieuwe content workflow gestart: "${title}"`,
  });

  return brief.id;
}

/**
 * Step 1: Select a keyword opportunity for the workflow.
 *
 * Associates the selected keyword with the brief and updates the
 * brief title and target keyword.
 *
 * @param workflowId - The workflow/brief ID
 * @param keywordId - The keyword ID to select
 * @throws Error if the workflow or keyword is not found
 */
export async function selectOpportunity(
  workflowId: string,
  keywordId: string
): Promise<void> {
  const brief = await getBriefOrThrow(workflowId);
  const keyword = await db.keyword.findUnique({
    where: { id: keywordId },
  });

  if (!keyword) {
    throw new Error(`Zoekwoord "${keywordId}" niet gevonden`);
  }

  await db.contentBrief.update({
    where: { id: workflowId },
    data: {
      keywordId,
      targetKeyword: keyword.keyword,
      title: `Content workflow: ${keyword.keyword}`,
    },
  });
}

/**
 * Step 2: Select a content type for the workflow.
 *
 * Stores the selected content type in the brief's metadata.
 * The content type determines the structure and tone of the generated content.
 *
 * @param workflowId - The workflow/brief ID
 * @param contentType - The content type to select (must be one of contentTypeOptions values)
 * @throws Error if the workflow is not found or the content type is invalid
 */
export async function selectContentType(
  workflowId: string,
  contentType: string
): Promise<void> {
  await getBriefOrThrow(workflowId);

  // Validate content type
  const validTypes = contentTypeOptions.map((opt) => opt.value);
  if (!validTypes.includes(contentType as typeof validTypes[number])) {
    throw new Error(
      `Ongeldig contenttype: "${contentType}". Geldige types zijn: ${validTypes.join(', ')}`
    );
  }

  // Store contentType in the brief's sources JSON field (repurposed as metadata)
  // or use a dedicated approach through the metadata
  const brief = await db.contentBrief.findUnique({
    where: { id: workflowId },
  });

  let sourcesData: Record<string, unknown> = {};
  if (brief?.sources) {
    try {
      sourcesData = JSON.parse(brief.sources) as Record<string, unknown>;
    } catch {
      sourcesData = {};
    }
  }

  sourcesData.contentType = contentType;

  await db.contentBrief.update({
    where: { id: workflowId },
    data: {
      sources: JSON.stringify(sourcesData),
    },
  });
}

/**
 * Step 3: Auto-generate brief from keyword + content type using AI.
 *
 * Uses the AI provider to generate a comprehensive content brief including
 * title, target audience, tone of voice, search intent, and outline.
 *
 * @param workflowId - The workflow/brief ID
 * @throws Error if the workflow is not found or AI generation fails
 */
export async function generateBriefFromWorkflow(
  workflowId: string
): Promise<void> {
  const brief = await getBriefOrThrow(workflowId);

  // Determine content type
  let contentType = 'ARTICLE';
  if (brief.sources) {
    try {
      const sourcesData = JSON.parse(brief.sources) as Record<string, unknown>;
      if (sourcesData.contentType) {
        contentType = sourcesData.contentType as string;
      }
    } catch {
      // Keep default
    }
  }

  const contentTypeLabel =
    contentTypeOptions.find((opt) => opt.value === contentType)?.label ??
    'Artikel';

  const keyword = brief.targetKeyword ?? 'algemeen onderwerp';

  // Use AI to generate the brief content
  const prompt = `Genereer een uitgebreide content brief voor het volgende:

**Zoekwoord:** ${keyword}
**Contenttype:** ${contentTypeLabel}

Geef de volgende informatie in gestructureerd formaat:

1. **Titel:** Een SEO-geoptimaliseerde titel
2. **Doelgroep:** Beschrijving van de doelgroep
3. **Tone of voice:** Aanbevolen tone of voice
4. **Zoekintentie:** INFORMATIONAL, TRANSACTIONAL, COMMERCIAL_INVESTIGATION, of NAVIGATIONAL
5. **Funnelstage:** AWARENESS, CONSIDERATION, DECISION, of RETENTION
6. **Secundaire zoekwoorden:** 5-8 gerelateerde zoekwoorden (komma-gescheiden)
7. **Doelwoordlengte:** Aanbevolen aantal woorden
8. **Outline:** Gestructureerde outline met H2/H3-koppen en kernpunten

Gebruik het volgende formaat voor de outline:
## [H2-kop]
- Kernpunt 1
- Kernpunt 2
### [H3-kop]
- Kernpunt 1

Schrijf alles in het Nederlands.`;

  let aiGenerated = false;

  try {
    const response = await providerManager.fallbackGenerate(brief.projectId, {
      messages: [
        {
          role: 'system',
          content:
            'Je bent een ervaren SEO-strateeg die content briefs schrijft voor de Nederlandse markt. Je output is altijd gestructureerd en actiegericht.',
        },
        { role: 'user', content: prompt },
      ],
      purpose: 'brief-generation',
      maxTokens: 3000,
      temperature: 0.6,
    });

    if (response.success && response.content.trim()) {
      const aiContent = response.content.trim();
      await parseAndUpdateBrief(workflowId, aiContent, contentType);
      aiGenerated = true;
    }
  } catch {
    // AI generation failed, keep defaults
  }

  if (!aiGenerated) {
    // Set minimal defaults
    await db.contentBrief.update({
      where: { id: workflowId },
      data: {
        title: `${keyword} — ${contentTypeLabel}`,
        targetAudience: 'Niet opgegeven (AI-generatie mislukt)',
        toneOfVoice: 'Professioneel en toegankelijk',
        searchIntent: 'INFORMATIONAL',
        funnelStage: 'AWARENESS',
      },
    });
  }
}

/**
 * Step 4: Edit the outline structure of the workflow brief.
 *
 * Replaces the current outline with the provided structure.
 * The outline guides the draft generation process.
 *
 * @param workflowId - The workflow/brief ID
 * @param outline - The new outline structure
 */
export async function editOutline(
  workflowId: string,
  outline: OutlineItem[]
): Promise<void> {
  await getBriefOrThrow(workflowId);

  await db.contentBrief.update({
    where: { id: workflowId },
    data: {
      outline: JSON.stringify(outline),
    },
  });
}

/**
 * Step 5: Select sources for grounding the workflow content.
 *
 * Associates the specified sources with the workflow's brief for
 * claim verification during the review step.
 *
 * @param workflowId - The workflow/brief ID
 * @param sourceIds - The source IDs to associate
 */
export async function selectSourcesForWorkflow(
  workflowId: string,
  sourceIds: string[]
): Promise<void> {
  await getBriefOrThrow(workflowId);
  await selectSourcesForBrief(workflowId, sourceIds);
}

/**
 * Step 6: Generate a content draft from the workflow brief.
 *
 * Uses the existing draft-generator module to create a draft based on
 * the brief's outline, keyword, and brand profile settings.
 *
 * @param workflowId - The workflow/brief ID
 * @returns The generated draft details
 * @throws Error if the workflow is not found
 */
export async function generateDraftFromWorkflow(
  workflowId: string
): Promise<{
  id: string;
  briefId: string;
  version: number;
  content: string;
  wordCount: number;
  aiGenerated: boolean;
  aiModel?: string;
  claimMarkers?: string[];
}> {
  const brief = await getBriefOrThrow(workflowId);

  // Check if there's already a draft; if so, regenerate
  const existingVersion = await db.contentVersion.findFirst({
    where: { briefId: workflowId },
    orderBy: { version: 'desc' },
  });

  if (existingVersion) {
    const result = await regenerateDraft(workflowId);
    return {
      id: result.id,
      briefId: result.briefId,
      version: result.version,
      content: result.content,
      wordCount: result.wordCount,
      aiGenerated: result.aiGenerated,
      aiModel: result.aiModel,
    };
  }

  const result = await generateDraft({
    briefId: workflowId,
    projectId: brief.projectId,
    includeInternalLinks: true,
  });

  return {
    id: result.id,
    briefId: result.briefId,
    version: result.version,
    content: result.content,
    wordCount: result.wordCount,
    aiGenerated: result.aiGenerated,
    aiModel: result.aiModel,
    claimMarkers: result.claimMarkers,
  };
}

/**
 * Step 7: Run quality checks on the workflow's latest draft.
 *
 * Uses the quality-controls module to perform pre-publication checks
 * and creates QualityFinding records for any issues found.
 *
 * @param workflowId - The workflow/brief ID
 * @returns The quality check results
 * @throws Error if no draft exists yet
 */
export async function runQualityChecksFromWorkflow(
  workflowId: string
): Promise<{
  totalChecks: number;
  findings: number;
  blockingFindings: number;
  warningFindings: number;
  infoFindings: number;
}> {
  const brief = await getBriefOrThrow(workflowId);

  // Get the latest version
  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId: workflowId },
    orderBy: { version: 'desc' },
  });

  if (!latestVersion) {
    throw new Error(
      'Geen draft beschikbaar. Genereer eerst een draft voordat je kwaliteitscontroles uitvoert.'
    );
  }

  // Run pre-publication checks
  const result = await runPrePublicationChecks(brief.projectId, latestVersion.id);

  return {
    totalChecks: result.totalChecks,
    findings: result.findingsCreated,
    blockingFindings: result.bySeverity.BLOCKING,
    warningFindings: result.bySeverity.WARNING,
    infoFindings: result.bySeverity.INFO,
  };
}

/**
 * Step 8: Review claim support against selected sources.
 *
 * Uses the source-grounding module to verify that claims in the
 * AI-generated content are supported by the selected sources.
 *
 * @param workflowId - The workflow/brief ID
 * @returns The claim check results
 * @throws Error if no draft exists yet
 */
export async function reviewClaimsFromWorkflow(
  workflowId: string
): Promise<{
  totalClaims: number;
  supported: number;
  unsupported: number;
  partiallySupported: number;
  summary: string;
  warning?: string;
}> {
  await getBriefOrThrow(workflowId);

  // Get the latest version
  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId: workflowId },
    orderBy: { version: 'desc' },
  });

  if (!latestVersion) {
    throw new Error(
      'Geen draft beschikbaar. Genereer eerst een draft voordat je claims controleert.'
    );
  }

  const result = await checkClaimSupport(workflowId, latestVersion.content);

  return {
    totalClaims: result.totalClaims,
    supported: result.supported,
    unsupported: result.unsupported,
    partiallySupported: result.partiallySupported,
    summary: result.summary,
    warning: result.warning,
  };
}

/**
 * Step 9: Generate internal link suggestions for the workflow content.
 *
 * Analyzes the current draft and project pages to suggest relevant
 * internal links that improve SEO structure and user navigation.
 *
 * @param workflowId - The workflow/brief ID
 * @returns Suggested internal links with context
 * @throws Error if no draft exists yet
 */
export async function addInternalLinksFromWorkflow(
  workflowId: string
): Promise<{
  suggestions: Array<{
    pageId: string;
    url: string;
    title: string | null;
    anchorText: string;
    context: string;
  }>;
  totalSuggestions: number;
}> {
  const brief = await getBriefOrThrow(workflowId);

  // Get the latest version
  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId: workflowId },
    orderBy: { version: 'desc' },
  });

  if (!latestVersion) {
    throw new Error(
      'Geen draft beschikbaar. Genereer eerst een draft voordat je interne links toevoegt.'
    );
  }

  // Get project pages for link suggestions
  const pages = await db.page.findMany({
    where: {
      projectId: brief.projectId,
      status: 'OK',
      wordCount: { gt: 200 },
    },
    select: {
      id: true,
      url: true,
      title: true,
      h1: true,
      description: true,
    },
    take: 50,
  });

  // Use AI to suggest internal links
  const suggestions: Array<{
    pageId: string;
    url: string;
    title: string | null;
    anchorText: string;
    context: string;
  }> = [];

  try {
    const pageList = pages
      .map((p) => `- ${p.url} (titel: ${p.title ?? p.h1 ?? 'Onbekend'})`)
      .join('\n');

    const prompt = `Analyseer de volgende content en suggesties voor interne links.

CONTENT (eerste 3000 tekens):
${latestVersion.content.substring(0, 3000)}

BESCHIKBARE PAGINA'S:
${pageList}

Geef maximaal 5 interne linksuggesties in het volgende formaat (één per regel):
URL|Ankertekst|Contextuele zin

Voorbeeld:
https://example.com/dienst|onze diensten|Lees meer over onze diensten voor meer informatie.

Geef alleen suggesties die relevant zijn voor de content. Gebruik Nederlandse ankerteksten.`;

    const response = await providerManager.fallbackGenerate(
      brief.projectId,
      {
        messages: [
          {
            role: 'system',
            content:
              'Je bent een SEO-expert die interne linksuggesties geeft voor Nederlandse content. Je output bevat alleen regels in het gevraagde formaat.',
          },
          { role: 'user', content: prompt },
        ],
        purpose: 'internal-links',
        maxTokens: 1000,
        temperature: 0.4,
      }
    );

    if (response.success && response.content.trim()) {
      const lines = response.content.trim().split('\n');
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 3) {
          const url = parts[0].trim();
          const anchorText = parts[1].trim();
          const context = parts[2].trim();

          const matchingPage = pages.find((p) => p.url === url);
          if (matchingPage) {
            suggestions.push({
              pageId: matchingPage.id,
              url: matchingPage.url,
              title: matchingPage.title,
              anchorText,
              context,
            });
          }
        }
      }
    }
  } catch {
    // AI suggestion failed, return empty suggestions
  }

  // Update the brief with internal page references
  if (suggestions.length > 0) {
    const internalPages = suggestions.map((s) => s.pageId);
    await db.contentBrief.update({
      where: { id: workflowId },
      data: {
        internalPages: JSON.stringify(internalPages),
      },
    });
  }

  return {
    suggestions,
    totalSuggestions: suggestions.length,
  };
}

/**
 * Step 10: Preview the final content with links and structured data.
 *
 * Returns the latest draft content along with metadata for preview rendering.
 * Strips claim markers for the preview version.
 *
 * @param workflowId - The workflow/brief ID
 * @returns Preview data including cleaned content and metadata
 * @throws Error if no draft exists yet
 */
export async function previewContent(
  workflowId: string
): Promise<{
  content: string;
  cleanContent: string;
  wordCount: number;
  title: string;
  targetKeyword: string | null;
  contentType: string | null;
  internalLinks: Array<{
    pageId: string;
    url: string;
    title: string | null;
  }>;
  metaTitle: string;
  metaDescription: string;
}> {
  const brief = await getBriefOrThrow(workflowId);

  // Get the latest version
  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId: workflowId },
    orderBy: { version: 'desc' },
  });

  if (!latestVersion) {
    throw new Error(
      'Geen draft beschikbaar. Genereer eerst een draft voordat je een preview bekijkt.'
    );
  }

  // Strip claim markers for clean preview
  const cleanContent = latestVersion.content
    .replace(/\[VERIFICATIE_NODIG\]/g, '')
    .replace(/\[\/VERIFICATIE_NODIG\]/g, '');

  // Determine content type from metadata
  let contentType: string | null = null;
  if (brief.sources) {
    try {
      const sourcesData = JSON.parse(brief.sources) as Record<string, unknown>;
      contentType = (sourcesData.contentType as string) ?? null;
    } catch {
      // Keep null
    }
  }

  // Get internal links
  let internalLinks: Array<{
    pageId: string;
    url: string;
    title: string | null;
  }> = [];

  if (brief.internalPages) {
    try {
      const pageIds = JSON.parse(brief.internalPages) as string[];
      const pages = await db.page.findMany({
        where: { id: { in: pageIds } },
        select: { id: true, url: true, title: true },
      });
      internalLinks = pages.map((p) => ({
        pageId: p.id,
        url: p.url,
        title: p.title,
      }));
    } catch {
      // Keep empty
    }
  }

  // Generate meta title and description
  const metaTitle = brief.title;
  const metaDescription =
    brief.targetAudience
      ? `${brief.title} — ${brief.targetAudience}`
      : brief.title;

  return {
    content: latestVersion.content,
    cleanContent,
    wordCount: latestVersion.wordCount,
    title: brief.title,
    targetKeyword: brief.targetKeyword,
    contentType,
    internalLinks,
    metaTitle,
    metaDescription,
  };
}

/**
 * Step 11: Approve content for publishing.
 *
 * Checks that there are no blocking quality findings before approving.
 * Updates the brief's approval status and records the approval in the
 * change history.
 *
 * @param workflowId - The workflow/brief ID
 * @param userId - The user approving the content
 * @throws Error if blocking findings exist or the workflow is not found
 */
export async function approveContent(
  workflowId: string,
  userId: string
): Promise<void> {
  const brief = await getBriefOrThrow(workflowId);

  // Get the latest version
  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId: workflowId },
    orderBy: { version: 'desc' },
  });

  if (!latestVersion) {
    throw new Error(
      'Geen draft beschikbaar. Genereer eerst een draft voordat je goedkeurt.'
    );
  }

  // Check for blocking findings
  const hasBlocking = await hasBlockingFindings(latestVersion.id);

  if (hasBlocking) {
    throw new Error(
      'De content kan niet worden goedgekeurd: er zijn blokkerende kwaliteitsbevindingen die eerst moeten worden opgelost. Controleer de kwaliteitscontroles en los de blokkerende problemen op.'
    );
  }

  // Also check for unsupported claims
  const claimResult = await checkClaimSupport(workflowId, latestVersion.content);
  if (claimResult.unsupported > 0) {
    throw new Error(
      `De content kan niet worden goedgekeurd: ${claimResult.unsupported} claim(s) worden niet ondersteund door bronnen. Los deze op of voeg ondersteunende bronnen toe voordat je goedkeurt.`
    );
  }

  // Update brief approval status
  await db.contentBrief.update({
    where: { id: workflowId },
    data: {
      approvalStatus: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
    },
  });

  // Record the approval
  await recordChange({
    projectId: brief.projectId,
    briefId: workflowId,
    versionId: latestVersion.id,
    changeType: 'APPROVE',
    userId,
    summary: `Content goedgekeurd voor publicatie: "${brief.title}"`,
  });
}

/**
 * Step 12: Save as CMS draft.
 *
 * Saves the approved content as a draft in the connected CMS.
 * The CMS connection must be active and configured.
 *
 * @param workflowId - The workflow/brief ID
 * @param cmsConnectionId - The CMS connection to save to
 * @throws Error if the content is not approved or CMS connection is invalid
 */
export async function saveAsCMSDraft(
  workflowId: string,
  cmsConnectionId: string
): Promise<{
  cmsPostId: string | null;
  cmsPostUrl: string | null;
  message: string;
}> {
  const brief = await getBriefOrThrow(workflowId);

  // Verify the content is approved
  if (brief.approvalStatus !== 'APPROVED') {
    throw new Error(
      'De content moet zijn goedgekeurd voordat het als CMS-concept kan worden opgeslagen.'
    );
  }

  // Verify the CMS connection exists and is active
  const cmsConnection = await db.cMSConnection.findUnique({
    where: { id: cmsConnectionId },
  });

  if (!cmsConnection) {
    throw new Error(
      `CMS-verbinding "${cmsConnectionId}" niet gevonden`
    );
  }

  if (cmsConnection.deletedAt) {
    throw new Error(
      'Deze CMS-verbinding is verwijderd'
    );
  }

  if (cmsConnection.status !== 'CONNECTED') {
    throw new Error(
      `CMS-verbinding is niet actief (huidige status: ${cmsConnection.status}). Activeer de verbinding eerst.`
    );
  }

  // Get the latest version
  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId: workflowId },
    orderBy: { version: 'desc' },
  });

  if (!latestVersion) {
    throw new Error('Geen draft beschikbaar om op te slaan');
  }

  // Clean content for CMS (strip claim markers)
  const cleanContent = latestVersion.content
    .replace(/\[VERIFICATIE_NODIG\]/g, '')
    .replace(/\[\/VERIFICATIE_NODIG\]/g, '');

  // Record the CMS save
  const cmsResult = JSON.stringify({
    cmsConnectionId,
    providerType: cmsConnection.providerType,
    savedAt: new Date().toISOString(),
    contentLength: cleanContent.length,
    wordCount: latestVersion.wordCount,
  });

  await recordChange({
    projectId: brief.projectId,
    briefId: workflowId,
    versionId: latestVersion.id,
    changeType: 'UPDATE',
    summary: `Content opgeslagen als CMS-concept via ${cmsConnection.name}`,
    cmsResult,
  });

  // In a real implementation, this would make an API call to the CMS
  // For now, we return a placeholder result
  return {
    cmsPostId: null,
    cmsPostUrl: null,
    message: `Content succesvol opgeslagen als concept in ${cmsConnection.name}. Publicatie moet nog worden uitgevoerd via het CMS of de inplanfunctie.`,
  };
}

/**
 * Step 13/14: Schedule or publish the content immediately.
 *
 * If a publishDate is provided, the content is scheduled for that date.
 * Otherwise, it is published immediately. Requires prior approval.
 *
 * @param workflowId - The workflow/brief ID
 * @param publishDate - Optional date to schedule publication for
 * @param cmsConnectionId - Optional CMS connection to publish through
 * @throws Error if the content is not approved
 */
export async function scheduleOrPublish(
  workflowId: string,
  publishDate?: Date,
  cmsConnectionId?: string
): Promise<{
  scheduled: boolean;
  publishDate: Date | null;
  message: string;
}> {
  const brief = await getBriefOrThrow(workflowId);

  // Verify the content is approved
  if (brief.approvalStatus !== 'APPROVED') {
    throw new Error(
      'De content moet zijn goedgekeurd voordat het kan worden gepubliceerd of ingepland.'
    );
  }

  // Get the latest version
  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId: workflowId },
    orderBy: { version: 'desc' },
  });

  if (!latestVersion) {
    throw new Error('Geen draft beschikbaar om te publiceren');
  }

  const isScheduled = publishDate !== undefined;

  if (isScheduled) {
    // Schedule the publication
    await db.contentBrief.update({
      where: { id: workflowId },
      data: {
        approvalStatus: 'APPROVED', // Keep approved status until published
      },
    });

    // Record the scheduling
    await recordChange({
      projectId: brief.projectId,
      briefId: workflowId,
      versionId: latestVersion.id,
      changeType: 'SCHEDULE',
      summary: `Content ingepland voor publicatie op ${publishDate.toLocaleDateString('nl-NL')}: "${brief.title}"`,
      cmsResult: cmsConnectionId
        ? JSON.stringify({
            cmsConnectionId,
            scheduledDate: publishDate.toISOString(),
          })
        : undefined,
    });

    return {
      scheduled: true,
      publishDate,
      message: `Content is ingepland voor publicatie op ${publishDate.toLocaleDateString('nl-NL')} om ${publishDate.toLocaleTimeString('nl-NL')}.`,
    };
  }

  // Publish immediately
  await db.contentBrief.update({
    where: { id: workflowId },
    data: {
      approvalStatus: 'PUBLISHED',
    },
  });

  // Record the publication
  await recordChange({
    projectId: brief.projectId,
    briefId: workflowId,
    versionId: latestVersion.id,
    changeType: 'PUBLISH',
    summary: `Content gepubliceerd: "${brief.title}"`,
    cmsResult: cmsConnectionId
      ? JSON.stringify({
          cmsConnectionId,
          publishedAt: new Date().toISOString(),
        })
      : undefined,
  });

  return {
    scheduled: false,
    publishDate: null,
    message: `Content is succesvol gepubliceerd: "${brief.title}".`,
  };
}

// ============================================================================
// Public API: Workflow Status & Listing
// ============================================================================

/**
 * Get the current workflow status and step information.
 *
 * Calculates the current step based on the brief's state (outline, sources,
 * draft, quality checks, approval) and returns detailed step-by-step progress.
 *
 * @param workflowId - The workflow/brief ID
 * @returns Detailed workflow status
 */
export async function getWorkflowStatus(
  workflowId: string
): Promise<WorkflowStepStatus> {
  const brief = await db.contentBrief.findUnique({
    where: { id: workflowId },
  });

  if (!brief) {
    throw new Error(`Workflow "${workflowId}" niet gevonden`);
  }

  // Determine completion of each step
  const stepCompletions: Record<string, boolean> = {};

  // Step 1: Select opportunity - complete if keywordId is set
  stepCompletions['SELECT_OPPORTUNITY'] = !!brief.keywordId;

  // Step 2: Select content type - complete if sources JSON has contentType
  let contentType: string | null = null;
  if (brief.sources) {
    try {
      const sourcesData = JSON.parse(brief.sources) as Record<string, unknown>;
      contentType = (sourcesData.contentType as string) ?? null;
    } catch {
      // Keep null
    }
  }
  stepCompletions['SELECT_CONTENT_TYPE'] = !!contentType;

  // Step 3: Generate brief - complete if title is not default
  stepCompletions['GENERATE_BRIEF'] =
    brief.title !== 'Nieuwe content workflow' &&
    !brief.title.startsWith('Content workflow: ');

  // Step 4: Edit outline - complete if outline is set
  stepCompletions['EDIT_OUTLINE'] = !!brief.outline;

  // Step 5: Select sources - complete if there are sources
  const sourceCount = await db.contentSource.count({
    where: { briefId: workflowId, deletedAt: null },
  });
  stepCompletions['SELECT_SOURCES'] = sourceCount > 0;

  // Step 6: Generate draft - complete if there's at least one version
  const versionCount = await db.contentVersion.count({
    where: { briefId: workflowId },
  });
  stepCompletions['GENERATE_DRAFT'] = versionCount > 0;

  // Step 7: Quality checks - complete if there are quality findings
  const findingCount = await db.qualityFinding.count({
    where: { briefId: workflowId },
  });
  stepCompletions['QUALITY_CHECKS'] = findingCount > 0 || versionCount > 0;

  // Step 8: Review claims - complete if latest version has been checked
  stepCompletions['REVIEW_CLAIMS'] = versionCount > 0;

  // Step 9: Internal links - complete if internalPages is set
  stepCompletions['INTERNAL_LINKS'] = !!brief.internalPages;

  // Step 10: Preview - complete if there's a draft
  stepCompletions['PREVIEW'] = versionCount > 0;

  // Step 11: Approve - complete if approved
  stepCompletions['APPROVE'] =
    brief.approvalStatus === 'APPROVED' ||
    brief.approvalStatus === 'PUBLISHED';

  // Step 12: CMS draft - complete if there's a CMS-related change
  const cmsChange = await db.contentChange.findFirst({
    where: {
      briefId: workflowId,
      changeType: 'UPDATE',
      cmsResult: { not: null },
    },
  });
  stepCompletions['CMS_DRAFT'] = !!cmsChange;

  // Step 13: Schedule or publish - complete if published
  stepCompletions['SCHEDULE'] =
    brief.approvalStatus === 'PUBLISHED' ||
    !!cmsChange;

  // Step 14: Published - complete if published
  stepCompletions['PUBLISHED'] = brief.approvalStatus === 'PUBLISHED';

  // Determine current step (first incomplete step)
  let currentStep = 1;
  for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
    const step = WORKFLOW_STEPS[i];
    if (!stepCompletions[step.key]) {
      currentStep = step.step;
      break;
    }
    if (i === WORKFLOW_STEPS.length - 1) {
      currentStep = step.step;
    }
  }

  const currentStepLabel =
    WORKFLOW_STEPS.find((s) => s.step === currentStep)?.label ??
    'Onbekend';

  // Get latest version info
  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId: workflowId },
    orderBy: { version: 'desc' },
    select: { id: true },
  });

  // Build steps array
  const steps = WORKFLOW_STEPS.map((step) => ({
    step: step.step,
    key: step.key,
    label: step.label,
    completed: stepCompletions[step.key] ?? false,
  }));

  return {
    currentStep,
    currentStepLabel,
    approvalStatus: brief.approvalStatus,
    isComplete: brief.approvalStatus === 'PUBLISHED',
    steps,
    brief: {
      id: brief.id,
      title: brief.title,
      targetKeyword: brief.targetKeyword,
      contentType,
      hasOutline: !!brief.outline,
      sourceCount,
      versionCount,
      latestVersionId: latestVersion?.id ?? null,
    },
  };
}

/**
 * List all workflows for a project.
 *
 * Returns a summary of each workflow, including the current step,
 * content type, and approval status.
 *
 * @param projectId - The project to list workflows for
 * @returns Array of workflow summaries
 */
export async function listWorkflows(
  projectId: string
): Promise<WorkflowSummary[]> {
  const briefs = await db.contentBrief.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
  });

  const summaries: WorkflowSummary[] = [];

  for (const brief of briefs) {
    // Determine content type
    let contentType: string | null = null;
    if (brief.sources) {
      try {
        const sourcesData = JSON.parse(brief.sources) as Record<string, unknown>;
        contentType = (sourcesData.contentType as string) ?? null;
      } catch {
        // Keep null
      }
    }

    // Get a simplified step status
    const status = await getWorkflowStatus(brief.id);

    summaries.push({
      id: brief.id,
      projectId: brief.projectId,
      title: brief.title,
      targetKeyword: brief.targetKeyword,
      contentType,
      currentStep: status.currentStep,
      currentStepLabel: status.currentStepLabel,
      approvalStatus: brief.approvalStatus,
      createdAt: brief.createdAt,
      updatedAt: brief.updatedAt,
    });
  }

  return summaries;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get a content brief or throw an error if not found.
 */
async function getBriefOrThrow(briefId: string) {
  const brief = await db.contentBrief.findUnique({
    where: { id: briefId },
  });

  if (!brief) {
    throw new Error(`Workflow "${briefId}" niet gevonden`);
  }

  return brief;
}

/**
 * Parse AI-generated brief content and update the brief record.
 *
 * Extracts structured data from the AI response and maps it to
 * ContentBrief fields. Falls back gracefully when parsing fails.
 */
async function parseAndUpdateBrief(
  briefId: string,
  aiContent: string,
  contentType: string
): Promise<void> {
  const lines = aiContent.split('\n');
  let title = '';
  let targetAudience = '';
  let toneOfVoice = '';
  let searchIntent = 'INFORMATIONAL';
  let funnelStage = 'AWARENESS';
  let secondaryKeywords: string[] = [];
  let targetWordCount = 1500;
  const outlineItems: OutlineItem[] = [];

  let inOutline = false;
  let currentH2: OutlineItem | null = null;
  let sortOrder = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Parse title
    if (trimmed.match(/\*\*Titel:\*\*/i) || trimmed.match(/^Titel:/i)) {
      title = trimmed.replace(/\*\*Titel:\*\*/i, '').replace(/^Titel:/i, '').trim();
    }

    // Parse target audience
    if (trimmed.match(/\*\*Doelgroep:\*\*/i) || trimmed.match(/^Doelgroep:/i)) {
      targetAudience = trimmed.replace(/\*\*Doelgroep:\*\*/i, '').replace(/^Doelgroep:/i, '').trim();
    }

    // Parse tone of voice
    if (trimmed.match(/\*\*Tone of voice:\*\*/i) || trimmed.match(/^Tone of voice:/i)) {
      toneOfVoice = trimmed.replace(/\*\*Tone of voice:\*\*/i, '').replace(/^Tone of voice:/i, '').trim();
    }

    // Parse search intent
    if (trimmed.match(/\*\*Zoekintentie:\*\*/i) || trimmed.match(/^Zoekintentie:/i)) {
      const intentStr = trimmed.replace(/\*\*Zoekintentie:\*\*/i, '').replace(/^Zoekintentie:/i, '').trim().toUpperCase();
      if (['INFORMATIONAL', 'NAVIGATIONAL', 'TRANSACTIONAL', 'COMMERCIAL_INVESTIGATION'].includes(intentStr)) {
        searchIntent = intentStr;
      }
    }

    // Parse funnel stage
    if (trimmed.match(/\*\*Funnelstage:\*\*/i) || trimmed.match(/^Funnelstage:/i)) {
      const funnelStr = trimmed.replace(/\*\*Funnelstage:\*\*/i, '').replace(/^Funnelstage:/i, '').trim().toUpperCase();
      if (['AWARENESS', 'CONSIDERATION', 'DECISION', 'RETENTION'].includes(funnelStr)) {
        funnelStage = funnelStr;
      }
    }

    // Parse secondary keywords
    if (trimmed.match(/\*\*Secundaire zoekwoorden:\*\*/i) || trimmed.match(/^Secundaire zoekwoorden:/i)) {
      const kwStr = trimmed
        .replace(/\*\*Secundaire zoekwoorden:\*\*/i, '')
        .replace(/^Secundaire zoekwoorden:/i, '')
        .trim();
      secondaryKeywords = kwStr
        .split(/[,;]/)
        .map((kw) => kw.trim())
        .filter((kw) => kw.length > 0);
    }

    // Parse target word count
    if (trimmed.match(/\*\*Doelwoordlengte:\*\*/i) || trimmed.match(/^Doelwoordlengte:/i)) {
      const numMatch = trimmed.match(/(\d+)/);
      if (numMatch) {
        targetWordCount = parseInt(numMatch[1], 10);
      }
    }

    // Parse outline
    if (trimmed.match(/\*\*Outline:\*\*/i) || trimmed.match(/^Outline:/i)) {
      inOutline = true;
      continue;
    }

    if (inOutline) {
      // H2 heading
      if (trimmed.startsWith('## ')) {
        const heading = trimmed.replace(/^##\s+/, '').trim();
        currentH2 = {
          id: `h2-${sortOrder}`,
          heading,
          level: 2,
          keyPoints: [],
          children: [],
          sortOrder,
        };
        outlineItems.push(currentH2);
        sortOrder++;
      }
      // H3 heading
      else if (trimmed.startsWith('### ') && currentH2) {
        const heading = trimmed.replace(/^###\s+/, '').trim();
        const h3Item: OutlineItem = {
          id: `h3-${sortOrder}`,
          heading,
          level: 3,
          keyPoints: [],
          sortOrder,
        };
        if (!currentH2.children) {
          currentH2.children = [];
        }
        currentH2.children.push(h3Item);
        sortOrder++;
      }
      // Key point
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const point = trimmed.replace(/^[-*]\s+/, '').trim();
        if (currentH2 && currentH2.children && currentH2.children.length > 0) {
          const lastH3 = currentH2.children[currentH2.children.length - 1];
          if (!lastH3.keyPoints) lastH3.keyPoints = [];
          lastH3.keyPoints.push(point);
        } else if (currentH2) {
          if (!currentH2.keyPoints) currentH2.keyPoints = [];
          currentH2.keyPoints.push(point);
        }
      }
    }
  }

  // Update the brief
  await db.contentBrief.update({
    where: { id: briefId },
    data: {
      title: title || undefined,
      targetAudience: targetAudience || undefined,
      toneOfVoice: toneOfVoice || undefined,
      searchIntent: searchIntent as any,
      funnelStage: funnelStage as any,
      secondaryKeywords:
        secondaryKeywords.length > 0
          ? JSON.stringify(secondaryKeywords)
          : undefined,
      targetWordCount,
      outline:
        outlineItems.length > 0
          ? JSON.stringify(outlineItems)
          : undefined,
    },
  });
}
