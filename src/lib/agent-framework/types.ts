// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Agent Framework Types — Phase 11

import type { AgentType, AgentRunStatus } from '@prisma/client';

/**
 * Alle agenttypes met Nederlandse labels
 */
export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  STRATEGY: 'Strategie-agent',
  TECHNICAL_SEO: 'Technische SEO-agent',
  CONTENT_RESEARCH: 'Contentonderzoek-agent',
  CONTENT_WRITER: 'Contentwriter-agent',
  CONTENT_QUALITY: 'Contentkwaliteit-agent',
  INTERNAL_LINKING: 'Interne linking-agent',
  LOCAL_SEO: 'Lokale SEO-agent',
  ECOMMERCE: 'E-commerce-agent',
  GEO: 'GEO-agent',
  COMPETITOR: 'Concurrentie-agent',
  CRO: 'CRO-agent',
  REPORTING: 'Rapportage-agent',
  PUBLISHING: 'Publicatie-agent',
  MIGRATION: 'Migratie-agent',
  QUALITY_ASSURANCE: 'Kwaliteitsborging-agent',
};

/**
 * Alle 15 agenttypes
 */
export const ALL_AGENT_TYPES: AgentType[] = [
  'STRATEGY', 'TECHNICAL_SEO', 'CONTENT_RESEARCH', 'CONTENT_WRITER',
  'CONTENT_QUALITY', 'INTERNAL_LINKING', 'LOCAL_SEO', 'ECOMMERCE',
  'GEO', 'COMPETITOR', 'CRO', 'REPORTING', 'PUBLISHING',
  'MIGRATION', 'QUALITY_ASSURANCE',
];

/**
 * Statuslabels in het Nederlands
 */
export const AGENT_RUN_STATUS_LABELS: Record<AgentRunStatus, string> = {
  PENDING: 'In afwachting',
  RUNNING: 'Bezig',
  COMPLETED: 'Voltooid',
  FAILED: 'Mislukt',
  CANCELLED: 'Geannuleerd',
  AWAITING_APPROVAL: 'Wacht op goedkeuring',
};

/**
 * Tool-allowlists per agenttype
 * Elke agent mag alleen de tools gebruiken die in zijn allowlist staan
 */
export const AGENT_TOOL_ALLOWLISTS: Record<AgentType, string[]> = {
  STRATEGY: ['analyze_keywords', 'review_technical_issues', 'check_competitors', 'create_task', 'prepare_recommendation'],
  TECHNICAL_SEO: ['crawl_analysis', 'check_indexability', 'check_performance', 'create_task', 'prepare_recommendation'],
  CONTENT_RESEARCH: ['analyze_keywords', 'find_topics', 'check_competitors', 'create_brief', 'create_task'],
  CONTENT_WRITER: ['create_draft', 'check_quality', 'create_task'],
  CONTENT_QUALITY: ['check_quality', 'check_readability', 'check_source_grounding', 'create_task', 'flag_issue'],
  INTERNAL_LINKING: ['analyze_links', 'suggest_links', 'create_task', 'prepare_recommendation'],
  LOCAL_SEO: ['check_local_health', 'analyze_reviews', 'check_gbp', 'create_task', 'prepare_recommendation'],
  ECOMMERCE: ['analyze_products', 'check_feeds', 'analyze_categories', 'create_task', 'prepare_recommendation'],
  GEO: ['check_ai_visibility', 'analyze_geo', 'create_task', 'prepare_recommendation'],
  COMPETITOR: ['analyze_competitors', 'track_changes', 'create_task', 'prepare_recommendation'],
  CRO: ['analyze_behaviour', 'check_conversions', 'create_task', 'prepare_recommendation'],
  REPORTING: ['generate_report', 'summarize_data', 'create_task'],
  PUBLISHING: ['publish_content', 'schedule_content', 'check_quality', 'create_task'],
  MIGRATION: ['compare_urls', 'validate_redirects', 'create_task', 'prepare_recommendation'],
  QUALITY_ASSURANCE: ['check_quality', 'validate_data', 'flag_issue', 'create_task'],
};

/**
 * Agentconfiguratie
 */
export interface AgentConfig {
  agentType: AgentType;
  maxSteps: number;
  timeoutMs: number;
  costLimitEur: number;
  model: string;
  requiresApproval: boolean;
}

/**
 * Standaardconfiguratie per agenttype
 */
export const DEFAULT_AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  STRATEGY: { agentType: 'STRATEGY', maxSteps: 15, timeoutMs: 300000, costLimitEur: 1.0, model: 'gpt-4', requiresApproval: true },
  TECHNICAL_SEO: { agentType: 'TECHNICAL_SEO', maxSteps: 20, timeoutMs: 600000, costLimitEur: 1.5, model: 'gpt-4', requiresApproval: true },
  CONTENT_RESEARCH: { agentType: 'CONTENT_RESEARCH', maxSteps: 15, timeoutMs: 300000, costLimitEur: 1.0, model: 'gpt-4', requiresApproval: false },
  CONTENT_WRITER: { agentType: 'CONTENT_WRITER', maxSteps: 10, timeoutMs: 300000, costLimitEur: 1.0, model: 'gpt-4', requiresApproval: true },
  CONTENT_QUALITY: { agentType: 'CONTENT_QUALITY', maxSteps: 10, timeoutMs: 180000, costLimitEur: 0.5, model: 'gpt-4', requiresApproval: false },
  INTERNAL_LINKING: { agentType: 'INTERNAL_LINKING', maxSteps: 15, timeoutMs: 300000, costLimitEur: 0.75, model: 'gpt-4', requiresApproval: false },
  LOCAL_SEO: { agentType: 'LOCAL_SEO', maxSteps: 15, timeoutMs: 300000, costLimitEur: 0.75, model: 'gpt-4', requiresApproval: false },
  ECOMMERCE: { agentType: 'ECOMMERCE', maxSteps: 15, timeoutMs: 300000, costLimitEur: 0.75, model: 'gpt-4', requiresApproval: false },
  GEO: { agentType: 'GEO', maxSteps: 10, timeoutMs: 180000, costLimitEur: 0.5, model: 'gpt-4', requiresApproval: false },
  COMPETITOR: { agentType: 'COMPETITOR', maxSteps: 15, timeoutMs: 300000, costLimitEur: 0.75, model: 'gpt-4', requiresApproval: false },
  CRO: { agentType: 'CRO', maxSteps: 15, timeoutMs: 300000, costLimitEur: 0.75, model: 'gpt-4', requiresApproval: false },
  REPORTING: { agentType: 'REPORTING', maxSteps: 10, timeoutMs: 180000, costLimitEur: 0.5, model: 'gpt-4', requiresApproval: true },
  PUBLISHING: { agentType: 'PUBLISHING', maxSteps: 5, timeoutMs: 120000, costLimitEur: 0.25, model: 'gpt-4', requiresApproval: true },
  MIGRATION: { agentType: 'MIGRATION', maxSteps: 20, timeoutMs: 600000, costLimitEur: 2.0, model: 'gpt-4', requiresApproval: true },
  QUALITY_ASSURANCE: { agentType: 'QUALITY_ASSURANCE', maxSteps: 10, timeoutMs: 180000, costLimitEur: 0.5, model: 'gpt-4', requiresApproval: false },
};

/**
 * Agent-executieresultaat
 */
export interface AgentExecutionResult {
  runId: string;
  status: AgentRunStatus;
  result?: Record<string, unknown>;
  proposedActions?: Record<string, unknown>[];
  completedActions?: Record<string, unknown>[];
  confidence?: number;
  costEur: number;
  durationMs: number;
}
