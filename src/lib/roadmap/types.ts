// ============================================================================
// Roadmap Types — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Type definitions for the Roadmap module — priority-based SEO action planning
// with timeline views (Today / This Week / This Month / 90 Days / Later).
// All user-facing strings are in Dutch.
// ============================================================================

import type { ActionPriority, ActionEffort, ActionItemStatus } from '@prisma/client';

// ============================================================================
// Enum-adjacent Types (mirror Prisma enums for type-safe usage)
// ============================================================================

/** Maps to the RoadmapItemType Prisma enum */
export type RoadmapItemType =
  | 'TECHNICAL_ISSUE'
  | 'CONTENT_GAP'
  | 'KEYWORD_OPPORTUNITY'
  | 'DECAY'
  | 'INTERNAL_LINK'
  | 'COMPETITOR'
  | 'GEO'
  | 'LOCAL_SEO'
  | 'ECOMMERCE'
  | 'CRO'
  | 'REVENUE';

/** Maps to the RoadmapView Prisma enum */
export type RoadmapView =
  | 'TODAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'NINETY_DAYS'
  | 'LATER';

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * A single roadmap recommendation generated from a data source.
 * This is the internal representation before persistence to RoadmapItem.
 */
export interface RoadmapRecommendation {
  /** The type categorisation for this recommendation */
  type: RoadmapItemType;
  /** Source entity type (e.g. 'technical_issue', 'keyword', 'content_decay') */
  sourceType: string;
  /** Source entity ID for traceability */
  sourceId: string;
  /** Dutch title for the roadmap item */
  title: string;
  /** Dutch description with context */
  description: string;
  /** Priority level derived from source data */
  priority: ActionPriority;
  /** Effort estimation */
  effort: ActionEffort;
  /** Dutch impact assessment */
  impact: string;
  /** Dutch actionable recommendation */
  recommendation: string;
  /** Suggested timeline view */
  suggestedView: RoadmapView;
  /** Suggested scheduled date, derived from priority and effort */
  suggestedDate: Date | null;
}

/**
 * Configuration for a roadmap timeline view.
 * Each view has a Dutch label, description, and date range.
 */
export interface RoadmapViewConfig {
  /** The view identifier */
  view: RoadmapView;
  /** Dutch label for display */
  dutchLabel: string;
  /** Dutch description of what belongs in this view */
  dutchDescription: string;
  /** Date range that this view covers */
  dateRange: { start: Date; end: Date };
}

/**
 * Filters for querying roadmap items.
 */
export interface RoadmapFilters {
  /** Filter by item type */
  type?: RoadmapItemType;
  /** Filter by timeline view */
  view?: RoadmapView;
  /** Filter by status */
  status?: ActionItemStatus;
  /** Filter by priority */
  priority?: ActionPriority;
  /** Filter by assigned user */
  assignedTo?: string;
}

/**
 * Summary statistics for a project's roadmap.
 */
export interface RoadmapStats {
  /** Total items in the roadmap */
  total: number;
  /** Counts by item type */
  byType: Partial<Record<RoadmapItemType, number>>;
  /** Counts by priority */
  byPriority: Partial<Record<ActionPriority, number>>;
  /** Counts by status */
  byStatus: Partial<Record<ActionItemStatus, number>>;
  /** Counts by timeline view */
  byView: Partial<Record<RoadmapView, number>>;
}

/**
 * Parameters for updating a roadmap item.
 */
export interface RoadmapItemUpdate {
  title?: string;
  description?: string;
  priority?: ActionPriority;
  effort?: ActionEffort;
  impact?: string;
  status?: ActionItemStatus;
  assignedTo?: string | null;
  scheduledDate?: Date | null;
  dueDate?: Date | null;
  view?: RoadmapView;
  sortOrder?: number;
  recommendation?: string;
}

// ============================================================================
// Constants — Dutch Labels
// ============================================================================

/**
 * Dutch labels for each roadmap item type.
 */
export const ROADMAP_ITEM_TYPE_LABELS: Record<RoadmapItemType, string> = {
  TECHNICAL_ISSUE: 'Technisch probleem',
  CONTENT_GAP: 'Inhoudslacuune',
  KEYWORD_OPPORTUNITY: 'Zoekwoordkans',
  DECAY: 'Inhoudveroudering',
  INTERNAL_LINK: 'Interne link',
  COMPETITOR: 'Concurrent',
  GEO: 'GEO',
  LOCAL_SEO: 'Lokale SEO',
  ECOMMERCE: 'E-commerce',
  CRO: 'Conversieoptimalisatie',
  REVENUE: 'Omzet',
};

/**
 * Dutch labels for each priority level.
 */
export const PRIORITY_LABELS: Record<ActionPriority, string> = {
  LOW: 'Laag',
  MEDIUM: 'Gemiddeld',
  HIGH: 'Hoog',
  CRITICAL: 'Kritiek',
};

/**
 * Dutch labels for each effort level.
 */
export const EFFORT_LABELS: Record<ActionEffort, string> = {
  MINIMAL: 'Minimaal',
  LOW: 'Laag',
  MEDIUM: 'Gemiddeld',
  HIGH: 'Hoog',
};

/**
 * Dutch labels for each action item status.
 */
export const STATUS_LABELS: Record<ActionItemStatus, string> = {
  PENDING: 'Openstaand',
  IN_PROGRESS: 'In uitvoering',
  COMPLETED: 'Voltooid',
  SKIPPED: 'Overgeslagen',
};

// ============================================================================
// Timeline View Configuration Factory
// ============================================================================

/**
 * Generate roadmap view configurations with calculated date ranges
 * based on the current date. Call this function each time you need
 * current date ranges (don't store the result long-term).
 */
export function getRoadmapViewConfigs(now: Date = new Date()): RoadmapViewConfig[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const startOfWeek = new Date(startOfToday);
  // Week starts on Monday (Dutch convention)
  const dayOfWeek = startOfToday.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(startOfToday.getDate() + mondayOffset);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const startOfNinety = new Date(startOfToday);
  const endOfNinety = new Date(startOfToday);
  endOfNinety.setDate(endOfNinety.getDate() + 90);
  endOfNinety.setHours(23, 59, 59, 999);

  // LATER starts after 90 days, extends indefinitely
  const startOfLater = new Date(endOfNinety);
  startOfLater.setDate(startOfLater.getDate() + 1);
  startOfLater.setHours(0, 0, 0, 0);

  return [
    {
      view: 'TODAY',
      dutchLabel: 'Vandaag',
      dutchDescription: 'Acties die vandaag moeten worden uitgevoerd',
      dateRange: { start: startOfToday, end: endOfToday },
    },
    {
      view: 'THIS_WEEK',
      dutchLabel: 'Deze week',
      dutchDescription: 'Acties voor deze week',
      dateRange: { start: startOfWeek, end: endOfWeek },
    },
    {
      view: 'THIS_MONTH',
      dutchLabel: 'Deze maand',
      dutchDescription: 'Acties voor deze maand',
      dateRange: { start: startOfMonth, end: endOfMonth },
    },
    {
      view: 'NINETY_DAYS',
      dutchLabel: '90 dagen',
      dutchDescription: 'Acties voor de komende 90 dagen',
      dateRange: { start: startOfNinety, end: endOfNinety },
    },
    {
      view: 'LATER',
      dutchLabel: 'Later',
      dutchDescription: 'Acties voor later',
      dateRange: { start: startOfLater, end: new Date('2099-12-31T23:59:59.999Z') },
    },
  ];
}

/**
 * Convenience: get a single view config by its identifier.
 */
export function getRoadmapViewConfig(view: RoadmapView, now?: Date): RoadmapViewConfig {
  const configs = getRoadmapViewConfigs(now);
  const config = configs.find((c) => c.view === view);
  if (!config) {
    throw new Error(`Onbekende roadmap-weergave: ${view}`);
  }
  return config;
}
