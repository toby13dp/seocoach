// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Copilot Types — Phase 11

/**
 * Copilot-vraagtypes die de copilot moet kunnen beantwoorden
 */
export const COPILOT_QUESTION_TYPES = [
  'which_pages_to_improve',
  'why_traffic_changed',
  'which_topics_missing',
  'which_pages_compete',
  'what_competitors_changed',
  'which_technical_problems_matter',
  'which_opportunities_affect_revenue',
  'monthly_client_summary',
  'which_location_needs_attention',
  'where_brand_absent_from_ai',
] as const;

export type CopilotQuestionType = typeof COPILOT_QUESTION_TYPES[number];

/**
 * Nederlandse labels voor vraagtypes
 */
export const COPILOT_QUESTION_LABELS: Record<CopilotQuestionType, string> = {
  which_pages_to_improve: 'Welke pagina\'s moeten eerst worden verbeterd?',
  why_traffic_changed: 'Waarom is het verkeer veranderd?',
  which_topics_missing: 'Welke onderwerpen ontbreken?',
  which_pages_compete: 'Welke pagina\'s concurreren met elkaar?',
  what_competitors_changed: 'Wat hebben concurrenten gewijzigd?',
  which_technical_problems_matter: 'Welke technische problemen zijn het belangrijkst?',
  which_opportunities_affect_revenue: 'Welke kansen beïnvloeden waarschijnlijk de omzet?',
  monthly_client_summary: 'Wat moet in de maandelijkse cliëntsamenvatting?',
  which_location_needs_attention: 'Welke locatie vereist aandacht?',
  where_brand_absent_from_ai: 'Waar is het merk afwezig in AI-antwoorden?',
};

/**
 * Copilot-tools die de copilot kan gebruiken
 */
export const COPILOT_TOOLS = [
  'create_draft_task',
  'create_draft_content_brief',
  'create_draft_report_summary',
  'prepare_recommendation',
  'open_relevant_pages',
  'prepare_approval_request',
] as const;

export type CopilotTool = typeof COPILOT_TOOLS[number];

/**
 * Copilot-toolbeschrijvingen in het Nederlands
 */
export const COPILOT_TOOL_LABELS: Record<CopilotTool, string> = {
  create_draft_task: 'Concepttaak aanmaken',
  create_draft_content_brief: 'Conceptcontentbrief aanmaken',
  create_draft_report_summary: 'Conceptrapportsamenvatting aanmaken',
  prepare_recommendation: 'Aanbeveling voorbereiden',
  open_relevant_pages: 'Relevante pagina\'s openen',
  prepare_approval_request: 'Goedkeuringsverzoek voorbereiden',
};

/**
 * Gevoelige patronen die prompt-injectie moeten blokkeren
 */
export const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+instructions/i,
  /forget\s+(everything|all|previous)/i,
  /you\s+are\s+now/i,
  /system\s*:\s*/i,
  /assistant\s*:\s*/i,
  /<\/?system>/i,
  /reveal\s+(your|the)\s+(prompt|instructions|system)/i,
  /show\s+me\s+(your|the)\s+(prompt|instructions)/i,
  /what\s+are\s+your\s+instructions/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /developer\s+mode/i,
] as const;

/**
 * Bericht in een copilot-gesprek
 */
export interface CopilotMessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  toolsUsed?: ToolUsage[];
  hasWarning?: boolean;
  warningType?: string;
  tokenCount?: number;
  modelUsed?: string;
  createdAt: string;
}

export interface Citation {
  recordType: string;
  recordId: string;
  url?: string;
  snippet: string;
}

export interface ToolUsage {
  tool: CopilotTool;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
}

/**
 * Antwoord van de copilot
 */
export interface CopilotResponse {
  content: string;
  citations: Citation[];
  toolsUsed: ToolUsage[];
  hasWarning: boolean;
  warningType?: string;
  confidence: number;
}
