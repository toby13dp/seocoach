// ============================================================================
// Content Brief Manager — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages content briefs: creation, updates, listing, approval workflow,
// and AI-powered outline generation. Briefs serve as the strategic foundation
// for content creation, linking keywords, topics, and brand guidelines.
// ============================================================================

import { db } from '@/lib/db';
import { providerManager } from '@/lib/ai/provider-manager';
import type {
  ContentBriefData,
  OutlineItem,
  BriefFilters,
  PaginatedBriefs,
  BriefSummary,
  ContentBriefWithDetails,
  ContentVersionSummary,
} from './types';

// ============================================================================
// Enum Mapping Helpers
// ============================================================================

/**
 * Map a string value to the SearchIntent enum.
 * Falls back to UNKNOWN if the value is not a valid enum member.
 */
function toSearchIntent(value?: string): string {
  const valid = [
    'INFORMATIONAL',
    'NAVIGATIONAL',
    'TRANSACTIONAL',
    'COMMERCIAL_INVESTIGATION',
    'LOCAL',
    'BRANDED',
    'UNKNOWN',
  ];
  if (!value) return 'UNKNOWN';
  const upper = value.toUpperCase().replace(/\s+/g, '_');
  return valid.includes(upper) ? upper : 'UNKNOWN';
}

/**
 * Map a string value to the FunnelStage enum.
 * Falls back to UNKNOWN if the value is not a valid enum member.
 */
function toFunnelStage(value?: string): string {
  const valid = ['AWARENESS', 'CONSIDERATION', 'DECISION', 'RETENTION', 'UNKNOWN'];
  if (!value) return 'UNKNOWN';
  const upper = value.toUpperCase().replace(/\s+/g, '_');
  return valid.includes(upper) ? upper : 'UNKNOWN';
}

/**
 * Map a string value to the ContentApprovalStatus enum.
 * Falls back to DRAFT if the value is not a valid enum member.
 */
function toApprovalStatus(value?: string): string {
  const valid = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'];
  if (!value) return 'DRAFT';
  const upper = value.toUpperCase();
  return valid.includes(upper) ? upper : 'DRAFT';
}

// ============================================================================
// Brief CRUD Operations
// ============================================================================

/**
 * Create a new content brief for a project.
 *
 * The brief captures the strategic intent for a piece of content,
 * including the target keyword, outline, audience, and tone of voice.
 * It can optionally be linked to a keyword and/or topic record.
 *
 * @param projectId - The project to create the brief in
 * @param data - Brief creation data
 * @returns The created ContentBrief with full details
 * @throws Error if the project does not exist
 */
export async function createBrief(
  projectId: string,
  data: ContentBriefData
): Promise<ContentBriefWithDetails> {
  // Verify the project exists
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    throw new Error(`Project "${projectId}" niet gevonden`);
  }

  // If a target keyword is specified, try to find or reference it
  let keywordId: string | undefined;
  if (data.targetKeyword) {
    const existingKeyword = await db.keyword.findFirst({
      where: { projectId, keyword: data.targetKeyword, deletedAt: null },
    });
    if (existingKeyword) {
      keywordId = existingKeyword.id;
    }
  }

  const brief = await db.contentBrief.create({
    data: {
      projectId,
      keywordId: keywordId ?? null,
      title: data.title,
      targetKeyword: data.targetKeyword ?? null,
      secondaryKeywords: data.secondaryKeywords
        ? JSON.stringify(data.secondaryKeywords)
        : null,
      searchIntent: toSearchIntent(data.searchIntent) as never,
      funnelStage: toFunnelStage(data.funnelStage) as never,
      outline: data.outline ? JSON.stringify(data.outline) : null,
      sources: data.sources ? JSON.stringify(data.sources) : null,
      brandProfileUsed: data.brandProfileUsed ?? true,
      internalPages: data.internalPages
        ? JSON.stringify(data.internalPages)
        : null,
      targetWordCount: data.targetWordCount ?? null,
      targetAudience: data.targetAudience ?? null,
      toneOfVoice: data.toneOfVoice ?? null,
    },
    include: {
      versions: {
        select: {
          id: true,
          version: true,
          wordCount: true,
          aiGenerated: true,
          changeSummary: true,
          createdAt: true,
        },
        orderBy: { version: 'desc' },
      },
    },
  });

  return prismaBriefToDetails(brief);
}

/**
 * Update an existing content brief.
 *
 * Only the provided fields are updated. Enum values are mapped
 * automatically from strings. JSON fields (outline, secondaryKeywords,
 * sources, internalPages) are serialized automatically.
 *
 * @param briefId - The brief to update
 * @param data - Partial brief data with fields to update
 * @returns The updated ContentBrief with full details
 * @throws Error if the brief does not exist
 */
export async function updateBrief(
  briefId: string,
  data: Partial<ContentBriefData>
): Promise<ContentBriefWithDetails> {
  const existing = await db.contentBrief.findUnique({
    where: { id: briefId },
  });

  if (!existing) {
    throw new Error(`Content brief "${briefId}" niet gevonden`);
  }

  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.targetKeyword !== undefined)
    updateData.targetKeyword = data.targetKeyword;
  if (data.secondaryKeywords !== undefined)
    updateData.secondaryKeywords = data.secondaryKeywords
      ? JSON.stringify(data.secondaryKeywords)
      : null;
  if (data.searchIntent !== undefined)
    updateData.searchIntent = toSearchIntent(data.searchIntent);
  if (data.funnelStage !== undefined)
    updateData.funnelStage = toFunnelStage(data.funnelStage);
  if (data.outline !== undefined)
    updateData.outline = data.outline ? JSON.stringify(data.outline) : null;
  if (data.sources !== undefined)
    updateData.sources = data.sources ? JSON.stringify(data.sources) : null;
  if (data.brandProfileUsed !== undefined)
    updateData.brandProfileUsed = data.brandProfileUsed;
  if (data.internalPages !== undefined)
    updateData.internalPages = data.internalPages
      ? JSON.stringify(data.internalPages)
      : null;
  if (data.targetWordCount !== undefined)
    updateData.targetWordCount = data.targetWordCount;
  if (data.targetAudience !== undefined)
    updateData.targetAudience = data.targetAudience;
  if (data.toneOfVoice !== undefined)
    updateData.toneOfVoice = data.toneOfVoice;

  const brief = await db.contentBrief.update({
    where: { id: briefId },
    data: updateData,
    include: {
      versions: {
        select: {
          id: true,
          version: true,
          wordCount: true,
          aiGenerated: true,
          changeSummary: true,
          createdAt: true,
        },
        orderBy: { version: 'desc' },
      },
    },
  });

  return prismaBriefToDetails(brief);
}

/**
 * Soft-delete is not directly supported on ContentBrief in the schema.
 * Instead, we set the approval status to ARCHIVED.
 *
 * @param briefId - The brief to archive/delete
 * @throws Error if the brief does not exist
 */
export async function deleteBrief(briefId: string): Promise<void> {
  const existing = await db.contentBrief.findUnique({
    where: { id: briefId },
  });

  if (!existing) {
    throw new Error(`Content brief "${briefId}" niet gevonden`);
  }

  await db.contentBrief.update({
    where: { id: briefId },
    data: { approvalStatus: 'ARCHIVED' as never },
  });
}

/**
 * Get a content brief with full details including all versions.
 *
 * Parses JSON fields (outline, secondaryKeywords, sources, internalPages)
 * into their structured types.
 *
 * @param briefId - The brief to retrieve
 * @returns The brief with all details and version summaries
 * @throws Error if the brief does not exist
 */
export async function getBrief(
  briefId: string
): Promise<ContentBriefWithDetails> {
  const brief = await db.contentBrief.findUnique({
    where: { id: briefId },
    include: {
      versions: {
        select: {
          id: true,
          version: true,
          wordCount: true,
          aiGenerated: true,
          changeSummary: true,
          createdAt: true,
        },
        orderBy: { version: 'desc' },
      },
    },
  });

  if (!brief) {
    throw new Error(`Content brief "${briefId}" niet gevonden`);
  }

  return prismaBriefToDetails(brief);
}

/**
 * List content briefs for a project with filtering and pagination.
 *
 * Supports filtering by approval status, search intent, funnel stage,
 * and free-text search. Results are paginated and sortable.
 *
 * @param projectId - The project to list briefs for
 * @param filters - Optional filters, sorting, and pagination
 * @returns Paginated list of brief summaries
 */
export async function listBriefs(
  projectId: string,
  filters?: BriefFilters
): Promise<PaginatedBriefs> {
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 20));
  const sortBy = filters?.sortBy ?? 'createdAt';
  const sortDirection = filters?.sortDirection ?? 'desc';

  // Build where clause
  const where: Record<string, unknown> = { projectId };

  if (filters?.approvalStatus) {
    where.approvalStatus = toApprovalStatus(filters.approvalStatus);
  }

  if (filters?.searchIntent) {
    where.searchIntent = toSearchIntent(filters.searchIntent);
  }

  if (filters?.funnelStage) {
    where.funnelStage = toFunnelStage(filters.funnelStage);
  }

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { targetKeyword: { contains: filters.search } },
    ];
  }

  // Get total count
  const total = await db.contentBrief.count({ where });

  // Get paginated results
  const briefs = await db.contentBrief.findMany({
    where,
    select: {
      id: true,
      title: true,
      targetKeyword: true,
      searchIntent: true,
      funnelStage: true,
      approvalStatus: true,
      targetWordCount: true,
      createdAt: true,
      updatedAt: true,
      versions: { select: { id: true } },
    },
    orderBy: { [sortBy]: sortDirection },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const items: BriefSummary[] = briefs.map((b) => ({
    id: b.id,
    title: b.title,
    targetKeyword: b.targetKeyword ?? undefined,
    searchIntent: b.searchIntent,
    funnelStage: b.funnelStage,
    approvalStatus: b.approvalStatus,
    targetWordCount: b.targetWordCount ?? undefined,
    versionCount: b.versions.length,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Approve a content brief, moving it to the APPROVED status.
 *
 * Records who approved the brief and when. Only briefs in DRAFT or
 * IN_REVIEW status can be approved.
 *
 * @param briefId - The brief to approve
 * @param userId - The user who is approving the brief
 * @returns The updated brief with details
 * @throws Error if the brief does not exist or cannot be approved
 */
export async function approveBrief(
  briefId: string,
  userId: string
): Promise<ContentBriefWithDetails> {
  const existing = await db.contentBrief.findUnique({
    where: { id: briefId },
  });

  if (!existing) {
    throw new Error(`Content brief "${briefId}" niet gevonden`);
  }

  const allowedStatuses = ['DRAFT', 'IN_REVIEW'];
  if (!allowedStatuses.includes(existing.approvalStatus)) {
    throw new Error(
      `Deze content brief kan niet goedgekeurd worden. Huidige status: "${existing.approvalStatus}". Alleen briefs met status "DRAFT" of "IN_REVIEW" kunnen goedgekeurd worden.`
    );
  }

  const brief = await db.contentBrief.update({
    where: { id: briefId },
    data: {
      approvalStatus: 'APPROVED' as never,
      approvedBy: userId,
      approvedAt: new Date(),
    },
    include: {
      versions: {
        select: {
          id: true,
          version: true,
          wordCount: true,
          aiGenerated: true,
          changeSummary: true,
          createdAt: true,
        },
        orderBy: { version: 'desc' },
      },
    },
  });

  return prismaBriefToDetails(brief);
}

// ============================================================================
// Outline Generation
// ============================================================================

/**
 * Generate a content outline for a keyword and search intent.
 *
 * Uses AI to generate a structured outline when available, falling back
 * to a rule-based template when AI is not accessible.
 *
 * The outline includes H2 and H3 headings with key points, organized
 * according to Dutch SEO best practices for the given intent type.
 *
 * @param projectId - The project context (for AI provider selection)
 * @param keyword - The target keyword to generate an outline for
 * @param intent - The search intent classification
 * @returns An array of OutlineItem objects forming the content structure
 */
export async function generateOutline(
  projectId: string,
  keyword: string,
  intent: string
): Promise<OutlineItem[]> {
  // Try AI-based outline generation first
  try {
    const aiResponse = await providerManager.fallbackGenerate(projectId, {
      messages: [
        {
          role: 'system',
          content: `Je bent een SEO-contentstrateeg voor de Nederlandse markt. Genereer een gestructureerde contentoutline in JSON-formaat. Elke heading moet een "id", "heading", "level", "keyPoints" (array van strings), "children" (array van sub-headings), en "sortOrder" bevatten. Gebruik level 2 voor H2 en level 3 voor H3. De outline moet SEO-geoptimaliseerd zijn voor de zoekintentie. Geef ALLEEN geldige JSON terug, geen andere tekst.`,
        },
        {
          role: 'user',
          content: `Genereer een contentoutline voor:\n\nZoekwoord: ${keyword}\nZoekintentie: ${intent}\n\nGenereer een JSON-array van outline-items. Elke heading moet "id", "heading", "level", "keyPoints", "children", en "sortOrder" bevatten.`,
        },
      ],
      purpose: 'outline-generation',
      maxTokens: 2000,
      temperature: 0.5,
      jsonMode: true,
    });

    if (aiResponse.success && aiResponse.content.trim()) {
      try {
        const parsed = JSON.parse(aiResponse.content.trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          return validateAndFixOutline(parsed);
        }
      } catch {
        // JSON parsing failed, fall through to template
      }
    }
  } catch {
    // AI not available, fall through to template
  }

  // Rule-based fallback: generate outline from templates
  return generateTemplateOutline(keyword, intent);
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Convert a Prisma ContentBrief record (with versions) to ContentBriefWithDetails.
 *
 * Parses JSON fields into their structured types and maps enum values.
 */
function prismaBriefToDetails(
  brief: {
    id: string;
    projectId: string;
    title: string;
    targetKeyword: string | null;
    secondaryKeywords: string | null;
    searchIntent: string;
    funnelStage: string;
    outline: string | null;
    sources: string | null;
    brandProfileUsed: boolean;
    internalPages: string | null;
    targetWordCount: number | null;
    targetAudience: string | null;
    toneOfVoice: string | null;
    approvalStatus: string;
    approvedBy: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    versions: {
      id: string;
      version: number;
      wordCount: number;
      aiGenerated: boolean;
      changeSummary: string | null;
      createdAt: Date;
    }[];
  }
): ContentBriefWithDetails {
  let outline: OutlineItem[] = [];
  if (brief.outline) {
    try {
      outline = JSON.parse(brief.outline);
    } catch {
      outline = [];
    }
  }

  let secondaryKeywords: string[] = [];
  if (brief.secondaryKeywords) {
    try {
      secondaryKeywords = JSON.parse(brief.secondaryKeywords);
    } catch {
      secondaryKeywords = [];
    }
  }

  let sources: string[] = [];
  if (brief.sources) {
    try {
      sources = JSON.parse(brief.sources);
    } catch {
      sources = [];
    }
  }

  let internalPages: string[] = [];
  if (brief.internalPages) {
    try {
      internalPages = JSON.parse(brief.internalPages);
    } catch {
      internalPages = [];
    }
  }

  const versions: ContentVersionSummary[] = brief.versions.map((v) => ({
    id: v.id,
    version: v.version,
    wordCount: v.wordCount,
    aiGenerated: v.aiGenerated,
    changeSummary: v.changeSummary ?? undefined,
    createdAt: v.createdAt,
  }));

  return {
    id: brief.id,
    projectId: brief.projectId,
    title: brief.title,
    targetKeyword: brief.targetKeyword ?? undefined,
    secondaryKeywords,
    searchIntent: brief.searchIntent,
    funnelStage: brief.funnelStage,
    outline,
    sources,
    brandProfileUsed: brief.brandProfileUsed,
    internalPages,
    targetWordCount: brief.targetWordCount ?? undefined,
    targetAudience: brief.targetAudience ?? undefined,
    toneOfVoice: brief.toneOfVoice ?? undefined,
    approvalStatus: brief.approvalStatus,
    approvedBy: brief.approvedBy ?? undefined,
    approvedAt: brief.approvedAt ?? undefined,
    versions,
    createdAt: brief.createdAt,
    updatedAt: brief.updatedAt,
  };
}

/**
 * Validate and fix outline items from AI generation.
 *
 * Ensures each item has the required fields with sensible defaults
 * for missing or invalid values.
 */
function validateAndFixOutline(items: unknown[]): OutlineItem[] {
  return items
    .map((item, index) => {
      if (typeof item !== 'object' || item === null) return null;

      const obj = item as Record<string, unknown>;

      return {
        id: typeof obj.id === 'string' ? obj.id : `h-${index + 1}`,
        heading:
          typeof obj.heading === 'string' ? obj.heading : `Sectie ${index + 1}`,
        level:
          typeof obj.level === 'number' && obj.level >= 2 && obj.level <= 4
            ? obj.level
            : 2,
        keyPoints: Array.isArray(obj.keyPoints)
          ? obj.keyPoints.filter((p: unknown) => typeof p === 'string')
          : [],
        children: Array.isArray(obj.children)
          ? validateAndFixOutline(obj.children)
          : [],
        sortOrder:
          typeof obj.sortOrder === 'number' ? obj.sortOrder : index + 1,
      } as OutlineItem;
    })
    .filter((item): item is OutlineItem => item !== null);
}

/**
 * Generate a rule-based content outline template for a keyword and intent.
 *
 * Provides sensible default structures based on the search intent type,
 * following Dutch SEO content best practices.
 */
function generateTemplateOutline(keyword: string, intent: string): OutlineItem[] {
  const baseId = (n: number) => `h-${n}`;
  const baseSortOrder = (n: number) => n;

  switch (intent.toUpperCase()) {
    case 'INFORMATIONAL':
      return [
        {
          id: baseId(1),
          heading: `Wat is ${keyword}?`,
          level: 2,
          keyPoints: ['Definitie en uitleg', 'Belang voor de lezer', 'Korte samenvatting'],
          children: [],
          sortOrder: baseSortOrder(1),
        },
        {
          id: baseId(2),
          heading: 'Waarom is dit belangrijk?',
          level: 2,
          keyPoints: ['Relevantie voor de doelgroep', 'Voordelen en mogelijkheden'],
          children: [],
          sortOrder: baseSortOrder(2),
        },
        {
          id: baseId(3),
          heading: 'Hoe werkt het?',
          level: 2,
          keyPoints: ['Stap-voor-stap uitleg', 'Praktische voorbeelden'],
          children: [
            {
              id: baseId(4),
              heading: 'Stap-voor-stap handleiding',
              level: 3,
              keyPoints: ['Overzicht van de stappen', 'Tips per stap'],
              children: [],
              sortOrder: 1,
            },
          ],
          sortOrder: baseSortOrder(3),
        },
        {
          id: baseId(5),
          heading: 'Tips en beste praktijken',
          level: 2,
          keyPoints: ['Do\'s en don\'ts', 'Veelgemaakte fouten'],
          children: [],
          sortOrder: baseSortOrder(4),
        },
        {
          id: baseId(6),
          heading: 'Veelgestelde vragen',
          level: 2,
          keyPoints: ['Meest gestelde vragen met antwoorden'],
          children: [],
          sortOrder: baseSortOrder(5),
        },
        {
          id: baseId(7),
          heading: 'Conclusie',
          level: 2,
          keyPoints: ['Samenvatting belangrijkste punten', 'Vervolgstappen'],
          children: [],
          sortOrder: baseSortOrder(6),
        },
      ];

    case 'TRANSACTIONAL':
      return [
        {
          id: baseId(1),
          heading: `${keyword}: Overzicht en vergelijking`,
          level: 2,
          keyPoints: ['Korte introductie', 'Wat ga je kopen of doen?'],
          children: [],
          sortOrder: baseSortOrder(1),
        },
        {
          id: baseId(2),
          heading: 'Opties vergelijken',
          level: 2,
          keyPoints: ['Vergelijking van de beste opties', 'Prijs-kwaliteitverhouding'],
          children: [
            {
              id: baseId(3),
              heading: 'Prijzen en pakketten',
              level: 3,
              keyPoints: ['Kostenoverzicht', 'Wat krijg je voor je geld?'],
              children: [],
              sortOrder: 1,
            },
          ],
          sortOrder: baseSortOrder(2),
        },
        {
          id: baseId(4),
          heading: 'Voordelen en nadelen',
          level: 2,
          keyPoints: ['Belangrijkste pluspunten', 'Punten van aandacht'],
          children: [],
          sortOrder: baseSortOrder(3),
        },
        {
          id: baseId(5),
          heading: 'Onze aanbeveling',
          level: 2,
          keyPoints: ['Welke optie past het beste bij jou?', 'Waarom deze keuze?'],
          children: [],
          sortOrder: baseSortOrder(4),
        },
        {
          id: baseId(6),
          heading: 'Direct aan de slag',
          level: 2,
          keyPoints: ['Call-to-action', 'Hoe nu verder?'],
          children: [],
          sortOrder: baseSortOrder(5),
        },
      ];

    case 'COMMERCIAL_INVESTIGATION':
      return [
        {
          id: baseId(1),
          heading: `${keyword}: Complete vergelijking`,
          level: 2,
          keyPoints: ['Wat je moet weten', 'Waarom deze vergelijking belangrijk is'],
          children: [],
          sortOrder: baseSortOrder(1),
        },
        {
          id: baseId(2),
          heading: 'De belangrijkste opties',
          level: 2,
          keyPoints: ['Overzicht van de marktleiders', 'Unieke kenmerken per optie'],
          children: [],
          sortOrder: baseSortOrder(2),
        },
        {
          id: baseId(3),
          heading: 'Gedetailleerde vergelijking',
          level: 2,
          keyPoints: ['Features vergelijken', 'Prestaties en resultaten'],
          children: [
            {
              id: baseId(4),
              heading: 'Functionaliteiten',
              level: 3,
              keyPoints: ['Kernfuncties', 'Extra mogelijkheden'],
              children: [],
              sortOrder: 1,
            },
            {
              id: baseId(5),
              heading: 'Prijs en waarde',
              level: 3,
              keyPoints: ['Kostenstructuur', 'Return on investment'],
              children: [],
              sortOrder: 2,
            },
          ],
          sortOrder: baseSortOrder(3),
        },
        {
          id: baseId(6),
          heading: 'Welke optie past bij jou?',
          level: 2,
          keyPoints: ['Keuzehulp per situatie', 'Onze aanbeveling'],
          children: [],
          sortOrder: baseSortOrder(4),
        },
        {
          id: baseId(7),
          heading: 'Conclusie en volgende stappen',
          level: 2,
          keyPoints: ['Samenvatting', 'Call-to-action'],
          children: [],
          sortOrder: baseSortOrder(5),
        },
      ];

    case 'NAVIGATIONAL':
      return [
        {
          id: baseId(1),
          heading: `${keyword}: Direct naar de juiste pagina`,
          level: 2,
          keyPoints: ['Snelle navigatie', 'Wat je zoekt en waar je het vindt'],
          children: [],
          sortOrder: baseSortOrder(1),
        },
        {
          id: baseId(2),
          heading: 'Overzicht van opties',
          level: 2,
          keyPoints: ['Directe links en verwijzingen', 'Alternatieven'],
          children: [],
          sortOrder: baseSortOrder(2),
        },
        {
          id: baseId(3),
          heading: 'Meer informatie',
          level: 2,
          keyPoints: ['Aanvullende bronnen', 'Gerelateerde pagina\'s'],
          children: [],
          sortOrder: baseSortOrder(3),
        },
      ];

    default:
      // Generic template for UNKNOWN or other intent types
      return [
        {
          id: baseId(1),
          heading: `Introductie: ${keyword}`,
          level: 2,
          keyPoints: ['Wat lezer moet weten', 'Waarom dit onderwerp relevant is'],
          children: [],
          sortOrder: baseSortOrder(1),
        },
        {
          id: baseId(2),
          heading: 'Uitgebreide uitleg',
          level: 2,
          keyPoints: ['Kernconcepten', 'Praktijkvoorbeelden'],
          children: [],
          sortOrder: baseSortOrder(2),
        },
        {
          id: baseId(3),
          heading: 'Praktische toepassing',
          level: 2,
          keyPoints: ['Hoe toe te passen', 'Tips en tricks'],
          children: [],
          sortOrder: baseSortOrder(3),
        },
        {
          id: baseId(4),
          heading: 'Conclusie',
          level: 2,
          keyPoints: ['Samenvatting', 'Vervolgstappen'],
          children: [],
          sortOrder: baseSortOrder(4),
        },
      ];
  }
}
