// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Copilot Manager — Phase 11
// Beheert de Nederlandse projectbewuste copilot

import { db } from '@/lib/db';
import { PROMPT_INJECTION_PATTERNS, COPILOT_TOOLS } from './types';
import type { CopilotTool, CopilotResponse, Citation, ToolUsage } from './types';

// ============================================================================
// Prompt Injection Protection
// ============================================================================

/**
 * Controleert gebruikersinvoer op prompt-injectiepatronen
 * Beschermt tegen injectie vanuit gecrawlde pagina's
 */
export function detectPromptInjection(input: string): { isInjection: boolean; patterns: string[] } {
  const detectedPatterns: string[] = [];

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.source);
    }
  }

  return {
    isInjection: detectedPatterns.length > 0,
    patterns: detectedPatterns,
  };
}

/**
 * Reinigt gebruikersinvoer door injectiepatronen te neutraliseren
 */
export function sanitizeInput(input: string): string {
  let sanitized = input;

  // Verwijder bekende injectiepatronen
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[gefilterd]');
  }

  // Beperk lengte
  if (sanitized.length > 4000) {
    sanitized = sanitized.substring(0, 4000) + '... [afgekapt]';
  }

  return sanitized;
}

// ============================================================================
// Conversation Management
// ============================================================================

/**
 * Maakt een nieuw copilot-gesprek aan
 */
export async function createConversation(
  organizationId: string,
  projectId: string,
  userId: string,
  title: string
) {
  return db.copilotConversation.create({
    data: {
      organizationId,
      projectId,
      userId,
      title,
    },
  });
}

/**
 * Haalt gesprekken op voor een project
 */
export async function getProjectConversations(projectId: string, userId: string) {
  return db.copilotConversation.findMany({
    where: {
      projectId,
      userId,
      deletedAt: null,
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 1, // Laatste bericht voor preview
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Voegt een bericht toe aan een gesprek
 */
export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  options?: {
    citations?: Citation[];
    toolsUsed?: ToolUsage[];
    hasWarning?: boolean;
    warningType?: string;
    tokenCount?: number;
    modelUsed?: string;
  }
) {
  return db.copilotMessage.create({
    data: {
      conversationId,
      role,
      content,
      citations: options?.citations ? JSON.stringify(options.citations) : null,
      toolsUsed: options?.toolsUsed ? JSON.stringify(options.toolsUsed) : null,
      hasWarning: options?.hasWarning ?? false,
      warningType: options?.warningType ?? null,
      tokenCount: options?.tokenCount,
      modelUsed: options?.modelUsed,
    },
  });
}

/**
 * Haalt alle berichten op voor een gesprek
 */
export async function getConversationMessages(conversationId: string) {
  return db.copilotMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
}

// ============================================================================
// Copilot Tool Execution
// ============================================================================

/**
 * Voert een copilot-tool uit (alleen veilige, goedgekeurde tools)
 * Gevaarlijke acties vereisen een goedkeuringsworkflow
 */
export async function executeCopilotTool(
  tool: CopilotTool,
  input: Record<string, unknown>,
  organizationId: string,
  projectId: string,
  userId: string
): Promise<{ success: boolean; result?: Record<string, unknown>; requiresApproval: boolean }> {
  // Controleer of de tool bestaat
  if (!COPILOT_TOOLS.includes(tool)) {
    return { success: false, requiresApproval: false };
  }

  switch (tool) {
    case 'create_draft_task': {
      // Maakt een concepttaak aan — vereist goedkeuring voor publicatie
      const task = await db.actionItem.create({
        data: {
          projectId,
          title: (input.title as string) ?? 'Nieuwe taak (concept)',
          description: (input.description as string) ?? '',
          priority: ((input.priority as string) ?? 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
          status: 'PENDING',
          effort: 'MEDIUM',
        },
      });
      return {
        success: true,
        result: { taskId: task.id, status: 'draft' },
        requiresApproval: true,
      };
    }

    case 'create_draft_content_brief': {
      // Maakt een conceptcontentbrief aan
      const brief = await db.contentBrief.create({
        data: {
          projectId,
          title: (input.title as string) ?? 'Nieuwe contentbrief (concept)',
          topic: (input.topic as string) ?? '',
          targetAudience: (input.targetAudience as string) ?? '',
          primaryKeyword: (input.primaryKeyword as string) ?? '',
          status: 'DRAFT',
        },
      });
      return {
        success: true,
        result: { briefId: brief.id, status: 'draft' },
        requiresApproval: true,
      };
    }

    case 'create_draft_report_summary': {
      // Maakt een conceptrapportsamenvatting aan
      return {
        success: true,
        result: { summary: input.summary ?? 'Conceptrapportsamenvatting aangemaakt', status: 'draft' },
        requiresApproval: true,
      };
    }

    case 'prepare_recommendation': {
      // Bereidt een aanbeveling voor
      return {
        success: true,
        result: { recommendation: input.recommendation ?? 'Aanbeveling voorbereid' },
        requiresApproval: false,
      };
    }

    case 'open_relevant_pages': {
      // Geeft URLs terug voor relevante pagina's (alleen-lezen)
      return {
        success: true,
        result: { urls: input.urls ?? [] },
        requiresApproval: false,
      };
    }

    case 'prepare_approval_request': {
      // Bereidt een goedkeuringsverzoek voor — altijd vereist
      return {
        success: true,
        result: { approvalRequested: true, itemType: input.itemType, itemId: input.itemId },
        requiresApproval: true,
      };
    }

    default:
      return { success: false, requiresApproval: false };
  }
}

// ============================================================================
// Copilot Response Generation
// ============================================================================

/**
 * Bouwt een copilot-antwoord op met bronvermelding en waarschuwingen
 */
export function buildCopilotResponse(
  content: string,
  options?: {
    citations?: Citation[];
    toolsUsed?: ToolUsage[];
    confidence?: number;
    missingData?: string[];
    uncertainAreas?: string[];
  }
): CopilotResponse {
  let hasWarning = false;
  let warningType: string | undefined;

  // Voeg waarschuwing toe voor ontbrekende gegevens
  if (options?.missingData && options.missingData.length > 0) {
    hasWarning = true;
    warningType = 'missing_data';
  }

  // Voeg waarschuwing toe voor onzekerheid
  if (options?.uncertainAreas && options.uncertainAreas.length > 0) {
    hasWarning = true;
    warningType = warningType ?? 'uncertainty';
  }

  return {
    content,
    citations: options?.citations ?? [],
    toolsUsed: options?.toolsUsed ?? [],
    hasWarning,
    warningType,
    confidence: options?.confidence ?? 0.5,
  };
}

/**
 * Genereert een antwoord over ontbrekende gegevens
 */
export function generateMissingDataResponse(missingItems: string[]): string {
  if (missingItems.length === 0) return '';

  const items = missingItems.map(item => `- ${item}`).join('\n');
  return `De volgende gegevens zijn niet beschikbaar:\n${items}\n\nIk kan geen betrouwbare analyse geven zonder deze gegevens. Controleer of de benodigde integraties actief zijn.`;
}

/**
 * Genereert een antwoord over onzekerheid
 */
export function generateUncertaintyResponse(areas: string[]): string {
  if (areas.length === 0) return '';

  const items = areas.map(area => `- ${area}`).join('\n');
  return `Let op: er is onzekerheid over de volgende aspecten:\n${items}\n\nDe bovenstaande analyse moet met voorzichtigheid worden geïnterpreteerd.`;
}
