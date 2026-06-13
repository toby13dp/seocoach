// ============================================================================
// Source Grounding — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages content sources for factual grounding of AI-generated content.
// Provides claim verification against approved sources, ensuring no
// unsupported claims are published. All user-facing strings are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import { providerManager } from '@/lib/ai/provider-manager';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for adding a new content source.
 */
export interface AddSourceParams {
  /** Human-readable name for the source */
  name: string;
  /** Source type */
  type: 'PAGE' | 'BRAND_PROFILE' | 'DOCUMENT' | 'PRODUCT_DATA' | 'APPROVED_FACT' | 'EXTERNAL_SOURCE';
  /** URL of the source (optional) */
  url?: string;
  /** Extracted text content of the source */
  content?: string;
  /** Additional metadata as JSON string */
  metadata?: string;
  /** Brief to associate this source with */
  briefId?: string;
  /** When this source was approved for use */
  approvedAt?: Date;
}

/**
 * Status of a claim check against sources.
 */
export type ClaimStatus = 'SUPPORTED' | 'UNSUPPORTED' | 'PARTIALLY_SUPPORTED';

/**
 * Result of checking a single claim against sources.
 */
export interface ClaimCheckItem {
  /** The claim text that was checked */
  claim: string;
  /** Whether the claim is supported by sources */
  status: ClaimStatus;
  /** Dutch explanation of the check result */
  explanation: string;
  /** Source IDs that support this claim (if any) */
  supportingSources: string[];
  /** Source names that support this claim (if any) */
  supportingSourceNames: string[];
}

/**
 * Overall result of claim support checking.
 */
export interface ClaimCheckResult {
  /** The brief ID that was checked */
  briefId: string;
  /** Total number of claims found */
  totalClaims: number;
  /** Number of supported claims */
  supported: number;
  /** Number of unsupported claims */
  unsupported: number;
  /** Number of partially supported claims */
  partiallySupported: number;
  /** Detailed results for each claim */
  claims: ClaimCheckItem[];
  /** Overall Dutch summary */
  summary: string;
  /** Warning if no sources were selected */
  warning?: string;
}

/**
 * Content source record as returned from the database.
 */
export interface ContentSourceRecord {
  id: string;
  projectId: string;
  briefId: string | null;
  name: string;
  type: string;
  url: string | null;
  content: string | null;
  metadata: string | null;
  approvedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Add a new content source to a project.
 *
 * Creates a ContentSource record that can be associated with content briefs
 * for factual grounding. Sources can be crawled pages, brand profiles,
 * documents, product data, approved facts, or external references.
 *
 * @param projectId - The project to add the source to
 * @param source - The source parameters
 * @returns The created ContentSource record
 */
export async function addContentSource(
  projectId: string,
  source: AddSourceParams
): Promise<ContentSourceRecord> {
  // Validate source type
  const validTypes = [
    'PAGE',
    'BRAND_PROFILE',
    'DOCUMENT',
    'PRODUCT_DATA',
    'APPROVED_FACT',
    'EXTERNAL_SOURCE',
  ];

  if (!validTypes.includes(source.type)) {
    throw new Error(
      `Ongeldig brontype: "${source.type}". Geldige types zijn: ${validTypes.join(', ')}`
    );
  }

  const record = await db.contentSource.create({
    data: {
      projectId,
      name: source.name,
      type: source.type,
      url: source.url ?? null,
      content: source.content ?? null,
      metadata: source.metadata ?? null,
      briefId: source.briefId ?? null,
      approvedAt: source.approvedAt ?? null,
    },
  });

  return mapToRecord(record);
}

/**
 * List content sources for a project, optionally filtered by brief.
 *
 * Returns all non-deleted sources for a project. When a briefId is provided,
 * only sources associated with that brief are returned.
 *
 * @param projectId - The project to list sources for
 * @param briefId - Optional brief ID to filter by
 * @returns Array of content source records
 */
export async function listContentSources(
  projectId: string,
  briefId?: string
): Promise<ContentSourceRecord[]> {
  const where: Record<string, unknown> = {
    projectId,
    deletedAt: null,
  };

  if (briefId) {
    where.briefId = briefId;
  }

  const sources = await db.contentSource.findMany({
    where,
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  return sources.map(mapToRecord);
}

/**
 * Soft-delete a content source.
 *
 * Marks the source as deleted without removing it from the database,
 * preserving the audit trail. Soft-deleted sources are excluded from
 * listing and claim checking.
 *
 * @param sourceId - The source ID to remove
 * @throws Error if the source is not found
 */
export async function removeContentSource(
  sourceId: string
): Promise<void> {
  const source = await db.contentSource.findUnique({
    where: { id: sourceId },
  });

  if (!source) {
    throw new Error(`Bron "${sourceId}" niet gevonden`);
  }

  if (source.deletedAt) {
    throw new Error('Deze bron is al verwijderd');
  }

  await db.contentSource.update({
    where: { id: sourceId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Associate sources with a brief for grounding.
 *
 * Updates the briefId on the specified sources, linking them to the brief
 * for claim verification. Sources must belong to the same project as the brief.
 *
 * @param briefId - The brief to associate sources with
 * @param sourceIds - The source IDs to associate
 * @throws Error if the brief is not found
 */
export async function selectSourcesForBrief(
  briefId: string,
  sourceIds: string[]
): Promise<void> {
  // Verify the brief exists
  const brief = await db.contentBrief.findUnique({
    where: { id: briefId },
  });

  if (!brief) {
    throw new Error(`Content brief "${briefId}" niet gevonden`);
  }

  if (sourceIds.length === 0) {
    return;
  }

  // Verify all sources belong to the same project
  const sources = await db.contentSource.findMany({
    where: {
      id: { in: sourceIds },
      deletedAt: null,
    },
  });

  const invalidSources = sources.filter(
    (s) => s.projectId !== brief.projectId
  );

  if (invalidSources.length > 0) {
    throw new Error(
      `${invalidSources.length} bron(nen) behoren niet tot hetzelfde project als de brief`
    );
  }

  // Update all specified sources to associate with the brief
  await db.contentSource.updateMany({
    where: {
      id: { in: sourceIds },
      deletedAt: null,
    },
    data: { briefId },
  });
}

/**
 * Get all sources associated with a brief.
 *
 * Returns all non-deleted sources that are linked to the specified brief.
 * Used for claim verification and source review.
 *
 * @param briefId - The brief to get sources for
 * @returns Array of content source records
 */
export async function getSourcesForBrief(
  briefId: string
): Promise<ContentSourceRecord[]> {
  const sources = await db.contentSource.findMany({
    where: {
      briefId,
      deletedAt: null,
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  return sources.map(mapToRecord);
}

/**
 * Check claim support against selected sources.
 *
 * Analyzes AI-generated content for claim markers ([VERIFICATIE_NODIG]...[/VERIFICATIE_NODIG])
 * and verifies each claim against the sources associated with the brief.
 *
 * Claims are marked as:
 * - SUPPORTED: Content found in source that directly supports the claim
 * - UNSUPPORTED: No source content supports the claim
 * - PARTIALLY_SUPPORTED: Related content found but not an exact match
 *
 * IMPORTANT: This function NEVER claims content is factually verified when
 * sources do not support it. Unsupported claims are clearly flagged.
 *
 * @param briefId - The brief whose content to check
 * @param content - The AI-generated content with claim markers
 * @returns Detailed claim check results
 */
export async function checkClaimSupport(
  briefId: string,
  content: string
): Promise<ClaimCheckResult> {
  // Get sources for this brief
  const sources = await getSourcesForBrief(briefId);

  // Extract claims from content
  const claimRegex = /\[VERIFICATIE_NODIG\]([\s\S]*?)\[\/VERIFICATIE_NODIG\]/g;
  const claims: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = claimRegex.exec(content)) !== null) {
    const claimText = match[1].trim();
    if (claimText) {
      claims.push(claimText);
    }
  }

  // If no sources are selected, return a clear warning
  if (sources.length === 0) {
    return {
      briefId,
      totalClaims: claims.length,
      supported: 0,
      unsupported: claims.length,
      partiallySupported: 0,
      claims: claims.map((claim) => ({
        claim,
        status: 'UNSUPPORTED' as ClaimStatus,
        explanation:
          'Geen bronnen geselecteerd — deze claim kan niet worden gecontroleerd.',
        supportingSources: [],
        supportingSourceNames: [],
      })),
      summary:
        claims.length > 0
          ? `${claims.length} claim(s) gevonden, maar geen bronnen beschikbaar voor verificatie. Alle claims zijn gemarkeerd als niet-ondersteund.`
          : 'Geen claims gevonden in de content.',
      warning:
        'Geen bronnen geselecteerd — claims kunnen niet worden gecontroleerd',
    };
  }

  // If no claims found in the content
  if (claims.length === 0) {
    return {
      briefId,
      totalClaims: 0,
      supported: 0,
      unsupported: 0,
      partiallySupported: 0,
      claims: [],
      summary:
        'Geen verificatieplichtige claims gevonden in de content. De content bevat geen [VERIFICATIE_NODIG]-markeringen.',
    };
  }

  // Check each claim against sources using AI for semantic matching
  const claimResults: ClaimCheckItem[] = [];

  // Get the brief to find the projectId for AI calls
  const brief = await db.contentBrief.findUnique({
    where: { id: briefId },
    select: { projectId: true },
  });

  const projectId = brief?.projectId ?? '';

  for (const claim of claims) {
    const result = await checkSingleClaim(claim, sources, projectId);
    claimResults.push(result);
  }

  // Calculate summary stats
  const supported = claimResults.filter(
    (c) => c.status === 'SUPPORTED'
  ).length;
  const unsupported = claimResults.filter(
    (c) => c.status === 'UNSUPPORTED'
  ).length;
  const partiallySupported = claimResults.filter(
    (c) => c.status === 'PARTIALLY_SUPPORTED'
  ).length;

  // Generate overall summary
  let summary = `Gecontroleerd: ${claimResults.length} claim(s) tegen ${sources.length} bron(nen). `;
  summary += `${supported} ondersteund, ${partiallySupported} gedeeltelijk ondersteund, ${unsupported} niet ondersteund.`;

  if (unsupported > 0) {
    summary += ` ⚠️ ${unsupported} claim(s) vereisen aanvullende bronvermelding voordat publicatie veilig is.`;
  }

  return {
    briefId,
    totalClaims: claimResults.length,
    supported,
    unsupported,
    partiallySupported,
    claims: claimResults,
    summary,
  };
}

/**
 * Import a crawled page as a content source.
 *
 * Creates a ContentSource record of type PAGE from an existing crawled page.
 * Extracts the page's main content and metadata for use in claim verification.
 *
 * @param projectId - The project to add the source to
 * @param pageId - The crawled page ID to import
 * @returns The created ContentSource record
 * @throws Error if the page is not found
 */
export async function importPageAsSource(
  projectId: string,
  pageId: string
): Promise<ContentSourceRecord> {
  const page = await db.page.findUnique({
    where: { id: pageId },
  });

  if (!page) {
    throw new Error(`Pagina "${pageId}" niet gevonden`);
  }

  if (page.projectId !== projectId) {
    throw new Error(
      'De pagina behoort niet tot het opgegeven project'
    );
  }

  // Check if this page is already imported as a source
  const existingSource = await db.contentSource.findFirst({
    where: {
      projectId,
      type: 'PAGE',
      url: page.url,
      deletedAt: null,
    },
  });

  if (existingSource) {
    // Update the existing source with fresh content
    const updated = await db.contentSource.update({
      where: { id: existingSource.id },
      data: {
        name: page.title ?? page.url,
        content: page.mainContent ?? page.description ?? '',
        metadata: JSON.stringify({
          pageId: page.id,
          title: page.title,
          description: page.description,
          wordCount: page.wordCount,
          importDate: new Date().toISOString(),
        }),
      },
    });

    return mapToRecord(updated);
  }

  // Create a new source
  const source = await db.contentSource.create({
    data: {
      projectId,
      name: page.title ?? page.url,
      type: 'PAGE',
      url: page.url,
      content: page.mainContent ?? page.description ?? '',
      metadata: JSON.stringify({
        pageId: page.id,
        title: page.title,
        description: page.description,
        wordCount: page.wordCount,
        importDate: new Date().toISOString(),
      }),
    },
  });

  return mapToRecord(source);
}

/**
 * Import brand profile data as a content source.
 *
 * Creates a ContentSource record of type BRAND_PROFILE from the project's
 * brand profile. The brand profile serves as an authoritative source for
 * tone of voice, terminology, and approved claims.
 *
 * @param projectId - The project to add the source to
 * @param briefId - Optional brief to associate with
 * @returns The created ContentSource record
 * @throws Error if no brand profile is found for the project
 */
export async function importBrandProfileAsSource(
  projectId: string,
  briefId?: string
): Promise<ContentSourceRecord> {
  const profile = await db.brandProfile.findFirst({
    where: {
      projectId,
      deletedAt: null,
    },
  });

  if (!profile) {
    throw new Error(
      `Geen merkprofiel gevonden voor project "${projectId}"`
    );
  }

  // Build content string from brand profile fields
  const contentParts: string[] = [];

  if (profile.brandName) {
    contentParts.push(`Merknaam: ${profile.brandName}`);
  }
  if (profile.description) {
    contentParts.push(`Beschrijving: ${profile.description}`);
  }
  if (profile.toneOfVoice) {
    contentParts.push(`Tone of voice: ${profile.toneOfVoice}`);
  }
  if (profile.preferredTerminology) {
    try {
      const terms = JSON.parse(profile.preferredTerminology) as string[];
      contentParts.push(`Voorkeursterminologie: ${terms.join(', ')}`);
    } catch {
      // Skip invalid JSON
    }
  }
  if (profile.prohibitedTerminology) {
    try {
      const terms = JSON.parse(profile.prohibitedTerminology) as string[];
      contentParts.push(`Verboden terminologie: ${terms.join(', ')}`);
    } catch {
      // Skip invalid JSON
    }
  }
  if (profile.proofPoints) {
    try {
      const points = JSON.parse(profile.proofPoints) as string[];
      contentParts.push(`Bewijspunten: ${points.join('; ')}`);
    } catch {
      // Skip invalid JSON
    }
  }
  if (profile.certifications) {
    try {
      const certs = JSON.parse(profile.certifications) as string[];
      contentParts.push(`Certificeringen: ${certs.join(', ')}`);
    } catch {
      // Skip invalid JSON
    }
  }

  // Check if a brand profile source already exists for this project
  const existingSource = await db.contentSource.findFirst({
    where: {
      projectId,
      type: 'BRAND_PROFILE',
      deletedAt: null,
    },
  });

  if (existingSource) {
    const updated = await db.contentSource.update({
      where: { id: existingSource.id },
      data: {
        name: `Merkprofiel: ${profile.brandName ?? 'Onbekend'}`,
        content: contentParts.join('\n'),
        briefId: briefId ?? existingSource.briefId,
        metadata: JSON.stringify({
          brandProfileId: profile.id,
          brandName: profile.brandName,
          importDate: new Date().toISOString(),
        }),
      },
    });

    return mapToRecord(updated);
  }

  const source = await db.contentSource.create({
    data: {
      projectId,
      name: `Merkprofiel: ${profile.brandName ?? 'Onbekend'}`,
      type: 'BRAND_PROFILE',
      content: contentParts.join('\n'),
      briefId: briefId ?? null,
      metadata: JSON.stringify({
        brandProfileId: profile.id,
        brandName: profile.brandName,
        importDate: new Date().toISOString(),
      }),
    },
  });

  return mapToRecord(source);
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Check a single claim against all provided sources.
 *
 * Uses a combination of keyword matching and optional AI-powered semantic
 * analysis to determine if a claim is supported by source content.
 *
 * The function is conservative: it only marks a claim as SUPPORTED when
 * there is clear evidence in the source. It NEVER claims content is
 * factually verified when it is not.
 */
async function checkSingleClaim(
  claim: string,
  sources: ContentSourceRecord[],
  projectId: string
): Promise<ClaimCheckItem> {
  // First, do a keyword-based check for quick matching
  const claimLower = claim.toLowerCase();
  const claimWords = claimLower
    .split(/[\s,.:;!?()]+/)
    .filter((w) => w.length > 3); // Filter out short words

  const supportingSources: string[] = [];
  const supportingSourceNames: string[] = [];
  let bestMatchLevel: ClaimStatus = 'UNSUPPORTED';

  for (const source of sources) {
    if (!source.content) continue;

    const sourceLower = source.content.toLowerCase();

    // Check for exact or near-exact match (substantial overlap)
    const exactMatch = sourceLower.includes(claimLower);
    if (exactMatch) {
      supportingSources.push(source.id);
      supportingSourceNames.push(source.name);
      bestMatchLevel = 'SUPPORTED';
      continue;
    }

    // Check for keyword overlap
    const matchingWords = claimWords.filter((word) =>
      sourceLower.includes(word)
    );
    const overlapRatio =
      claimWords.length > 0 ? matchingWords.length / claimWords.length : 0;

    if (overlapRatio >= 0.7) {
      // High overlap - likely supported
      if (!supportingSources.includes(source.id)) {
        supportingSources.push(source.id);
        supportingSourceNames.push(source.name);
      }
      if (bestMatchLevel !== 'SUPPORTED') {
        bestMatchLevel = 'SUPPORTED';
      }
    } else if (overlapRatio >= 0.4) {
      // Medium overlap - partially supported
      if (!supportingSources.includes(source.id)) {
        supportingSources.push(source.id);
        supportingSourceNames.push(source.name);
      }
      if (bestMatchLevel === 'UNSUPPORTED') {
        bestMatchLevel = 'PARTIALLY_SUPPORTED';
      }
    }
  }

  // If keyword matching was inconclusive, try AI-based semantic matching
  if (bestMatchLevel === 'UNSUPPORTED' && projectId && sources.some((s) => s.content)) {
    try {
      const aiResult = await aiCheckClaimSupport(claim, sources, projectId);
      if (aiResult === 'SUPPORTED') {
        bestMatchLevel = 'SUPPORTED';
      } else if (aiResult === 'PARTIALLY_SUPPORTED') {
        bestMatchLevel = 'PARTIALLY_SUPPORTED';
      }
      // If AI also says UNSUPPORTED, keep it
    } catch {
      // AI check failed, rely on keyword analysis
    }
  }

  // Generate explanation in Dutch
  let explanation: string;
  switch (bestMatchLevel) {
    case 'SUPPORTED':
      explanation = `Claim wordt ondersteund door ${supportingSourceNames.length} bron(nen): ${supportingSourceNames.join(', ')}. De inhoud van de bron(nen) komt overeen met deze claim.`;
      break;
    case 'PARTIALLY_SUPPORTED':
      explanation = `Claim wordt gedeeltelijk ondersteund door ${supportingSourceNames.length} bron(nen): ${supportingSourceNames.join(', ')}. De bronnen bevatten gerelateerde informatie, maar dekken de claim niet volledig. Aanvullende verificatie wordt aanbevolen.`;
      break;
    case 'UNSUPPORTED':
      explanation =
        'Geen van de geselecteerde bronnen ondersteunt deze claim. De claim moet worden geverifieerd met aanvullende bronnen voordat deze wordt gepubliceerd.';
      break;
  }

  return {
    claim,
    status: bestMatchLevel,
    explanation,
    supportingSources,
    supportingSourceNames,
  };
}

/**
 * Use AI to semantically check if a claim is supported by sources.
 *
 * Falls back gracefully when AI is unavailable.
 */
async function aiCheckClaimSupport(
  claim: string,
  sources: ContentSourceRecord[],
  projectId: string
): Promise<ClaimStatus> {
  const sourcesWithContent = sources.filter((s) => s.content);
  if (sourcesWithContent.length === 0) {
    return 'UNSUPPORTED';
  }

  // Limit source content to avoid token overflow
  const sourceContexts = sourcesWithContent.map((s) => {
    const content = s.content ?? '';
    const truncated = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
    return `--- Bron: ${s.name} ---\n${truncated}`;
  });

  const prompt = `Je bent een feitencontroleur. Beoordeel of de volgende claim wordt ondersteund door de beschikbare bronnen.

CLAIM: ${claim}

BESCHIKBARE BRONNEN:
${sourceContexts.join('\n\n')}

Beantwoord ALLEEN met één van de volgende opties:
- SUPPORTED (als de claim duidelijk wordt ondersteund door de bronnen)
- PARTIALLY_SUPPORTED (als de bronnen gedeeltelijke steun bieden, maar de claim niet volledig dekken)
- UNSUPPORTED (als de bronnen de claim niet ondersteunen)

Wees conservatief: twijfel je? Kies dan PARTIALLY_SUPPORTED of UNSUPPORTED. Beweer NOOIT dat iets is ondersteund als dat niet het geval is.

Antwoord:`;

  try {
    const response = await providerManager.fallbackGenerate(projectId, {
      messages: [
        {
          role: 'system',
          content:
            'Je bent een nauwkeurige feitencontroleur. Je beoordeelt claims alleen als ondersteund als er duidelijk bewijs is in de bronnen. Je antwoordt altijd met precies één woord: SUPPORTED, PARTIALLY_SUPPORTED, of UNSUPPORTED.',
        },
        { role: 'user', content: prompt },
      ],
      purpose: 'claim-verification',
      maxTokens: 20,
      temperature: 0.1,
    });

    if (response.success && response.content.trim()) {
      const answer = response.content.trim().toUpperCase();
      if (answer.includes('SUPPORTED') && !answer.includes('PARTIALLY') && !answer.includes('UNSUPPORTED')) {
        return 'SUPPORTED';
      }
      if (answer.includes('PARTIALLY_SUPPORTED')) {
        return 'PARTIALLY_SUPPORTED';
      }
      if (answer.includes('UNSUPPORTED')) {
        return 'UNSUPPORTED';
      }
    }
  } catch {
    // AI check failed
  }

  return 'UNSUPPORTED';
}

/**
 * Map a Prisma ContentSource record to the ContentSourceRecord interface.
 */
function mapToRecord(
  record: {
    id: string;
    projectId: string;
    briefId: string | null;
    name: string;
    type: string;
    url: string | null;
    content: string | null;
    metadata: string | null;
    approvedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }
): ContentSourceRecord {
  return {
    id: record.id,
    projectId: record.projectId,
    briefId: record.briefId,
    name: record.name,
    type: record.type,
    url: record.url,
    content: record.content,
    metadata: record.metadata,
    approvedAt: record.approvedAt,
    deletedAt: record.deletedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
