// ============================================================================
// Content Draft Generator — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Generates content drafts from content briefs using the AI provider layer.
// Supports brand profile injection, multiple draft versions, AI usage tracking,
// claim marker insertion, and manual draft saving. Falls back gracefully
// when AI is unavailable.
// ============================================================================

import { db } from '@/lib/db';
import { providerManager } from '@/lib/ai/provider-manager';
import type { ContentDraftRequest, OutlineItem } from './types';

// ============================================================================
// Claim Marker System
// ============================================================================

/**
 * Claim marker prefix for AI-generated content.
 * Used to identify passages that may need factual verification.
 * These markers are visible in the editor but can be stripped before publishing.
 */
const CLAIM_MARKER_OPEN = '[VERIFICATIE_NODIG]';
const CLAIM_MARKER_CLOSE = '[/VERIFICATIE_NODIG]';

/**
 * Wrap a factual claim in verification markers.
 * Signals that this content needs human review before publishing.
 */
function markClaim(text: string): string {
  return `${CLAIM_MARKER_OPEN}${text}${CLAIM_MARKER_CLOSE}`;
}

/**
 * Wrap specific types of AI-generated claims with verification markers.
 * Applies markers to sentences containing statistics, specific numbers,
 * or superlative claims that should be fact-checked.
 */
function addClaimMarkers(content: string): string {
  // Mark sentences with statistics (percentages, numbers, averages)
  let marked = content.replace(
    /([^.!?\n]*\d+([.,]\d+)?\s*(procent|%|per jaar|jaarlijks|maandelijks|wekelijks|gemiddeld|van de|van het|meer dan|minder dan|hoger dan|lager dan)[^.!?\n]*[.!?])/gi,
    (match) => markClaim(match)
  );

  // Mark sentences with superlative claims
  marked = marked.replace(
    /([^.!*\n]*(beste|slechtste|grootste|kleinste|meest|minst|nr\.\s*1|nummer\s*1|top\s*\d+|belangrijkste|essentieel|cruciaal|onmisbaar|onvermijdelijk)[^.!?\n]*[.!?])/gi,
    (match) => markClaim(match)
  );

  return marked;
}

// ============================================================================
// Brand Profile Injection
// ============================================================================

/**
 * Build a brand context section for the AI prompt.
 *
 * Loads the brand profile from the database and formats it as
 * instructions that the AI model should follow when generating content.
 *
 * @param projectId - The project to get the brand profile for
 * @param brandProfileId - Optional specific brand profile ID
 * @returns Formatted brand context string, or empty string if no profile
 */
async function buildBrandContext(
  projectId: string,
  brandProfileId?: string
): Promise<string> {
  try {
    const profile = brandProfileId
      ? await db.brandProfile.findUnique({
          where: { id: brandProfileId, deletedAt: null },
        })
      : await db.brandProfile.findFirst({
          where: { projectId, deletedAt: null },
        });

    if (!profile) return '';

    const parts: string[] = [];

    if (profile.brandName) {
      parts.push(`**Merknaam:** ${profile.brandName}`);
    }

    if (profile.toneOfVoice) {
      parts.push(`**Tone of voice:** ${profile.toneOfVoice}`);
    }

    if (profile.preferredTerminology) {
      try {
        const terms = JSON.parse(profile.preferredTerminology) as string[];
        if (terms.length > 0) {
          parts.push(`**Te gebruiken terminologie:** ${terms.join(', ')}`);
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    if (profile.prohibitedTerminology) {
      try {
        const terms = JSON.parse(profile.prohibitedTerminology) as string[];
        if (terms.length > 0) {
          parts.push(`**Te vermijden terminologie:** ${terms.join(', ')}`);
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    if (profile.prohibitedClaims) {
      try {
        const claims = JSON.parse(profile.prohibitedClaims) as string[];
        if (claims.length > 0) {
          parts.push(`**Niet te maken beweringen:** ${claims.join('; ')}`);
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    if (profile.proofPoints) {
      try {
        const points = JSON.parse(profile.proofPoints) as string[];
        if (points.length > 0) {
          parts.push(`**Bewijspunten om te gebruiken:** ${points.join('; ')}`);
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    if (profile.editorialRules) {
      try {
        const rules = JSON.parse(profile.editorialRules) as string[];
        if (rules.length > 0) {
          parts.push(`**Redactionele richtlijnen:** ${rules.join('; ')}`);
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    if (profile.disclaimers) {
      try {
        const disclaimers = JSON.parse(profile.disclaimers) as string[];
        if (disclaimers.length > 0) {
          parts.push(`**Disclaimers om toe te voegen:** ${disclaimers.join('; ')}`);
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    if (parts.length === 0) return '';

    return `\n\n--- MERKRICHTLIJNEN ---\n${parts.join('\n')}\n--- EINDE MERKRICHTLIJNEN ---\n`;
  } catch {
    return '';
  }
}

/**
 * Build an outline description string from structured outline items.
 */
function outlineToString(items: OutlineItem[], indent = 0): string {
  const prefix = '  '.repeat(indent);
  return items
    .map((item) => {
      const heading = `${prefix}${'#'.repeat(item.level)} ${item.heading}`;
      const points =
        item.keyPoints && item.keyPoints.length > 0
          ? item.keyPoints.map((p) => `${prefix}  - ${p}`).join('\n')
          : '';
      const children =
        item.children && item.children.length > 0
          ? outlineToString(item.children, indent + 1)
          : '';
      return [heading, points, children].filter(Boolean).join('\n');
    })
    .join('\n');
}

// ============================================================================
// Draft Generation
// ============================================================================

/**
 * Generate a content draft from a brief using AI.
 *
 * The draft generation process:
 * 1. Loads the brief and its outline
 * 2. Injects brand profile data into the prompt
 * 3. Sends the request to the AI provider
 * 4. Adds claim markers to factual assertions
 * 5. Saves the result as a new ContentVersion
 * 6. Tracks AI usage (tokens, cost)
 *
 * When AI is unavailable, returns a structured placeholder that the
 * user can fill in manually.
 *
 * @param request - The draft generation request
 * @returns The created ContentVersion record
 * @throws Error if the brief does not exist
 */
export async function generateDraft(
  request: ContentDraftRequest
): Promise<{
  id: string;
  briefId: string;
  version: number;
  content: string;
  wordCount: number;
  aiGenerated: boolean;
  aiModel?: string;
  aiProviderId?: string;
  claimMarkers?: string[];
  changeSummary?: string;
  createdAt: Date;
}> {
  // Load the brief
  const brief = await db.contentBrief.findUnique({
    where: { id: request.briefId },
  });

  if (!brief) {
    throw new Error(`Content brief "${request.briefId}" niet gevonden`);
  }

  // Determine the outline to use
  const outline = request.outline ?? (brief.outline ? JSON.parse(brief.outline) as OutlineItem[] : []);
  const outlineStr = outline.length > 0 ? outlineToString(outline) : 'Geen structuur opgegeven.';

  // Build brand context
  const brandContext = await buildBrandContext(
    request.projectId,
    request.brandProfileId
  );

  // Determine target word count
  const targetWordCount = request.targetWordCount ?? brief.targetWordCount ?? 1500;

  // Build secondary keywords
  let secondaryKeywords = '';
  if (brief.secondaryKeywords) {
    try {
      const kw = JSON.parse(brief.secondaryKeywords) as string[];
      secondaryKeywords = kw.join(', ');
    } catch {
      secondaryKeywords = '';
    }
  }

  // Build the AI prompt
  const userMessage = `Schrijf een volledige, SEO-geoptimaliseerde content draft op basis van de volgende brief:

**Onderwerp:** ${brief.title}
**Hoofdzoekwoord:** ${brief.targetKeyword ?? 'Niet opgegeven'}
**Secundaire zoekwoorden:** ${secondaryKeywords || 'Niet opgegeven'}
**Tone of voice:** ${brief.toneOfVoice ?? 'Professioneel en toegankelijk'}
**Doelgroep:** ${brief.targetAudience ?? 'Niet opgegeven'}
**Gewenste woordlengte:** ${targetWordCount} woorden
**Structuur:**
${outlineStr}
${brandContext}
Vereisten:
- Gebruik het hoofdzoekwoord natuurlijk in de eerste alinea
- Verwerk secundaire zoekwoorden organisch door de tekst
- Gebruik heldere H2/H3-structuur volgens de bovenstaande outline
- Schrijf actieve, toegankelijke zinnen (B1-niveau)
- Voeg een interne linksuggestie toe waar relevant${request.includeInternalLinks ? ' (gebruik [interne link: onderwerp] als placeholder)' : ''}
- Sluit af met een duidelijke call-to-action
- Gebruik Nederlandse spelling en grammatica
- Schrijf ongeveer ${targetWordCount} woorden

Schrijf de volledige content draft in het Nederlands.`;

  // Try AI generation
  let content = '';
  let aiGenerated = false;
  let aiModel: string | undefined;
  let aiProviderId: string | undefined;
  let claimMarkersList: string[] = [];

  try {
    const aiResponse = await providerManager.fallbackGenerate(request.projectId, {
      messages: [
        {
          role: 'system',
          content:
            'Je bent een professionele SEO-contentwriter die vloeiend en overtuigend in het Nederlands schrijft. Je content is altijd geoptimaliseerd voor zowel zoekmachines als lezers. Volg de merkrichtlijnen nauwkeurig op als deze zijn opgegeven.',
        },
        { role: 'user', content: userMessage },
      ],
      purpose: 'content-draft',
      maxTokens: Math.min(8000, targetWordCount * 2),
      temperature: 0.7,
      promptTemplateId: 'content-draft',
    });

    if (aiResponse.success && aiResponse.content.trim()) {
      content = aiResponse.content.trim();
      aiGenerated = true;
      aiModel = aiResponse.model;
      aiProviderId = aiResponse.providerId;

      // Add claim markers to factual assertions
      content = addClaimMarkers(content);

      // Extract claim markers for metadata
      const markerRegex = /\[VERIFICATIE_NODIG\]([\s\S]*?)\[\/VERIFICATIE_NODIG\]/g;
      let match: RegExpExecArray | null;
      while ((match = markerRegex.exec(content)) !== null) {
        claimMarkersList.push(match[1].trim());
      }
    }
  } catch {
    // AI generation failed, use placeholder
  }

  // Fallback: structured placeholder when AI is unavailable
  if (!aiGenerated) {
    content = generatePlaceholderDraft(brief.title, outline, targetWordCount);
    claimMarkersList = [];
  }

  // Count words
  const wordCount = countWords(content);

  // Determine version number
  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId: request.briefId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  // Save the content version
  const version = await db.contentVersion.create({
    data: {
      briefId: request.briefId,
      version: nextVersion,
      content,
      wordCount,
      changeSummary: aiGenerated
        ? `AI-gegenereerde draft (versie ${nextVersion})`
        : `Placeholder draft - AI niet beschikbaar (versie ${nextVersion})`,
      aiGenerated,
      aiProviderId: aiProviderId ?? null,
      aiModel: aiModel ?? null,
      claimMarkers:
        claimMarkersList.length > 0
          ? JSON.stringify(claimMarkersList)
          : null,
    },
  });

  return {
    id: version.id,
    briefId: version.briefId,
    version: version.version,
    content: version.content,
    wordCount: version.wordCount,
    aiGenerated: version.aiGenerated,
    aiModel: version.aiModel ?? undefined,
    aiProviderId: version.aiProviderId ?? undefined,
    claimMarkers: claimMarkersList.length > 0 ? claimMarkersList : undefined,
    changeSummary: version.changeSummary ?? undefined,
    createdAt: version.createdAt,
  };
}

/**
 * Regenerate a content draft with optional feedback.
 *
 * Creates a new version of the draft, optionally incorporating user
 * feedback to improve the content. The previous versions are preserved.
 *
 * @param briefId - The brief to regenerate a draft for
 * @param feedback - Optional feedback to incorporate into the new draft
 * @returns The new ContentVersion record
 * @throws Error if the brief does not exist
 */
export async function regenerateDraft(
  briefId: string,
  feedback?: string
): Promise<{
  id: string;
  briefId: string;
  version: number;
  content: string;
  wordCount: number;
  aiGenerated: boolean;
  aiModel?: string;
  changeSummary?: string;
  createdAt: Date;
}> {
  // Load the brief
  const brief = await db.contentBrief.findUnique({
    where: { id: briefId },
  });

  if (!brief) {
    throw new Error(`Content brief "${briefId}" niet gevonden`);
  }

  // Get the latest version for context
  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId },
    orderBy: { version: 'desc' },
  });

  // Build feedback context
  let feedbackContext = '';
  if (feedback) {
    feedbackContext = `\n\n**Feedback op de vorige versie:**\n${feedback}\n\nHoud rekening met deze feedback bij het herschrijven van de content.`;
  }

  // Build outline
  let outlineStr = 'Geen structuur opgegeven.';
  if (brief.outline) {
    try {
      const outline = JSON.parse(brief.outline) as OutlineItem[];
      outlineStr = outlineToString(outline);
    } catch {
      // Keep default
    }
  }

  // Build brand context
  const brandContext = await buildBrandContext(brief.projectId);

  const previousContent = latestVersion?.content ?? '';

  const userMessage = `Herschrijf de volgende content draft op basis van de brief:${feedbackContext}

**Onderwerp:** ${brief.title}
**Hoofdzoekwoord:** ${brief.targetKeyword ?? 'Niet opgegeven'}
**Structuur:**
${outlineStr}
${brandContext}
**Vorige versie:**
${previousContent.substring(0, 6000)}${previousContent.length > 6000 ? '\n...(afgekort)' : ''}

Herschrijf de content volledig met verbeteringen. Gebruik Nederlandse spelling en grammatica.`;

  let content = '';
  let aiGenerated = false;
  let aiModel: string | undefined;
  let claimMarkersList: string[] = [];

  try {
    const aiResponse = await providerManager.fallbackGenerate(brief.projectId, {
      messages: [
        {
          role: 'system',
          content:
            'Je bent een professionele SEO-contentwriter die vloeiend en overtuigend in het Nederlands schrijft. Je herschrijft content op basis van feedback en verbetert kwaliteit, leesbaarheid en SEO-optimalisatie.',
        },
        { role: 'user', content: userMessage },
      ],
      purpose: 'content-draft-regenerate',
      maxTokens: 8000,
      temperature: 0.7,
    });

    if (aiResponse.success && aiResponse.content.trim()) {
      content = addClaimMarkers(aiResponse.content.trim());
      aiGenerated = true;
      aiModel = aiResponse.model;

      const markerRegex = /\[VERIFICATIE_NODIG\]([\s\S]*?)\[\/VERIFICATIE_NODIG\]/g;
      let match: RegExpExecArray | null;
      while ((match = markerRegex.exec(content)) !== null) {
        claimMarkersList.push(match[1].trim());
      }
    }
  } catch {
    // AI failed
  }

  if (!aiGenerated) {
    content = generatePlaceholderDraft(
      brief.title,
      brief.outline ? (JSON.parse(brief.outline) as OutlineItem[]) : [],
      brief.targetWordCount ?? 1500
    );
  }

  const wordCount = countWords(content);
  const nextVersion = (latestVersion?.version ?? 0) + 1;

  const version = await db.contentVersion.create({
    data: {
      briefId,
      version: nextVersion,
      content,
      wordCount,
      changeSummary: feedback
        ? `Herschreven op basis van feedback (versie ${nextVersion})`
        : `Herschreven draft (versie ${nextVersion})`,
      aiGenerated,
      aiModel: aiModel ?? null,
      aiProviderId: null,
      claimMarkers:
        claimMarkersList.length > 0
          ? JSON.stringify(claimMarkersList)
          : null,
      diffFromPrev: latestVersion
        ? JSON.stringify({ previousVersionId: latestVersion.id })
        : null,
    },
  });

  return {
    id: version.id,
    briefId: version.briefId,
    version: version.version,
    content: version.content,
    wordCount: version.wordCount,
    aiGenerated: version.aiGenerated,
    aiModel: version.aiModel ?? undefined,
    changeSummary: version.changeSummary ?? undefined,
    createdAt: version.createdAt,
  };
}

/**
 * Save a manually written draft as a new content version.
 *
 * Manual drafts are marked as non-AI-generated and do not receive
 * claim markers. The word count is calculated automatically.
 *
 * @param briefId - The brief to save the manual draft for
 * @param content - The manually written content
 * @returns The created ContentVersion record
 * @throws Error if the brief does not exist
 */
export async function saveManualDraft(
  briefId: string,
  content: string
): Promise<{
  id: string;
  briefId: string;
  version: number;
  content: string;
  wordCount: number;
  aiGenerated: boolean;
  changeSummary: string;
  createdAt: Date;
}> {
  const brief = await db.contentBrief.findUnique({
    where: { id: briefId },
  });

  if (!brief) {
    throw new Error(`Content brief "${briefId}" niet gevonden`);
  }

  const latestVersion = await db.contentVersion.findFirst({
    where: { briefId },
    orderBy: { version: 'desc' },
    select: { version: true, id: true },
  });

  const nextVersion = (latestVersion?.version ?? 0) + 1;
  const wordCount = countWords(content);

  const version = await db.contentVersion.create({
    data: {
      briefId,
      version: nextVersion,
      content,
      wordCount,
      changeSummary: `Handmatig opgestelde draft (versie ${nextVersion})`,
      aiGenerated: false,
      diffFromPrev: latestVersion
        ? JSON.stringify({ previousVersionId: latestVersion.id })
        : null,
    },
  });

  return {
    id: version.id,
    briefId: version.briefId,
    version: version.version,
    content: version.content,
    wordCount: version.wordCount,
    aiGenerated: version.aiGenerated,
    changeSummary: version.changeSummary ?? '',
    createdAt: version.createdAt,
  };
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Count the number of words in a text string.
 *
 * Uses a simple whitespace split approach suitable for Dutch text.
 * Strips claim markers before counting to avoid inflating the count.
 */
function countWords(text: string): number {
  const cleaned = text
    .replace(/\[VERIFICATIE_NODIG\]/g, '')
    .replace(/\[\/VERIFICATIE_NODIG\]/g, '')
    .trim();
  return cleaned.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Generate a placeholder draft when AI is unavailable.
 *
 * Creates a structured template based on the brief's outline that
 * the user can fill in manually.
 */
function generatePlaceholderDraft(
  title: string,
  outline: OutlineItem[],
  targetWordCount: number
): string {
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(
    '⚠️ De AI-contentgenerator is momenteel niet beschikbaar. Hieronder vind je een sjabloon dat je handmatig kunt invullen.'
  );
  lines.push('');

  if (outline.length === 0) {
    lines.push('## Introductie');
    lines.push('');
    lines.push('[Schrijf hier een inleidende alinea die het hoofdzoekwoord bevat en de lezer betrekt.]');
    lines.push('');
    lines.push('## Hoofdinhoud');
    lines.push('');
    lines.push(
      `[Schrijf hier de hoofdinhoud. Doelwoordlengte: circa ${targetWordCount} woorden.]`
    );
    lines.push('');
    lines.push('## Conclusie');
    lines.push('');
    lines.push('[Sluit af met een samenvatting en een duidelijke call-to-action.]');
  } else {
    for (const item of outline) {
      lines.push(`${'#'.repeat(item.level)} ${item.heading}`);
      lines.push('');

      if (item.keyPoints && item.keyPoints.length > 0) {
        lines.push('Punten om te behandelen:');
        for (const point of item.keyPoints) {
          lines.push(`- ${point}`);
        }
        lines.push('');
      }

      lines.push('[Schrijf hier de content voor deze sectie.]');
      lines.push('');

      if (item.children) {
        for (const child of item.children) {
          lines.push(`${'#'.repeat(child.level)} ${child.heading}`);
          lines.push('');

          if (child.keyPoints && child.keyPoints.length > 0) {
            lines.push('Punten om te behandelen:');
            for (const point of child.keyPoints) {
              lines.push(`- ${point}`);
            }
            lines.push('');
          }

          lines.push('[Schrijf hier de content voor deze subsectie.]');
          lines.push('');
        }
      }
    }
  }

  return lines.join('\n');
}
