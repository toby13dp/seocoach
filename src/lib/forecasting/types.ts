// ============================================================================
// Forecasting & Budget — Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Core types for the forecasting engine (3-scenario) and budget allocation.
// All user-facing text is in Dutch.
// ============================================================================

import type { ForecastScenario, BudgetCategory } from '@prisma/client';

// ============================================================================
// Dutch Labels
// ============================================================================

/**
 * Dutch labels for forecast scenarios.
 */
export const FORECAST_SCENARIO_LABELS: Record<ForecastScenario, string> = {
  CONSERVATIVE: 'Conservatief',
  REALISTIC: 'Realistisch',
  AMBITIOUS: 'Ambitieus',
};

/**
 * Dutch descriptions for forecast scenarios.
 */
export const FORECAST_SCENARIO_DESCRIPTIONS: Record<ForecastScenario, string> = {
  CONSERVATIVE:
    'Conservatieve prognose gebaseerd op bescheiden groeiaannames met hoge betrouwbaarheid.',
  REALISTIC:
    'Realistische prognose gebaseerd op gemiddelde groeiaannames met gemiddelde betrouwbaarheid.',
  AMBITIOUS:
    'Ambitieuze prognose gebaseerd op optimistische groeiaannames met lagere betrouwbaarheid.',
};

/**
 * Dutch labels for budget categories.
 */
export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  TECHNICAL_SEO: 'Technische SEO',
  CONTENT: 'Content',
  UPDATES: 'Updates',
  AUTHORITY: 'Autoriteit',
  DIGITAL_PR: 'Digitale PR',
  CRO: 'CRO',
  LOCAL_SEO: 'Lokale SEO',
  GEO: 'GEO',
  MONITORING: 'Monitoring',
  REPORTING: 'Rapportage',
};

/**
 * Dutch descriptions for budget categories.
 */
export const BUDGET_CATEGORY_DESCRIPTIONS: Record<BudgetCategory, string> = {
  TECHNICAL_SEO: 'Technische optimalisaties zoals laadsnelheid, indexeerbaarheid en crawlability.',
  CONTENT: 'Creatie en optimalisatie van content voor zoekmachines en gebruikers.',
  UPDATES: 'Onderhoud en updates van bestaande content en pagina\'s.',
  AUTHORITY: 'Linkbuilding en autoriteitsopbouw via backlinks en merkvermeldingen.',
  DIGITAL_PR: 'Digitale public relations en zichtbaarheid in online media.',
  CRO: 'Conversion Rate Optimization — het verbeteren van conversieratio\'s.',
  LOCAL_SEO: 'Optimalisatie voor lokale zoekresultaten en Google Business Profile.',
  GEO: 'Generative Engine Optimization — optimalisatie voor AI-zoekresultaten.',
  MONITORING: 'Monitoring van prestaties, rankings en technische gezondheid.',
  REPORTING: 'Rapportage en analyse van SEO-resultaten en KPI\'s.',
};

// ============================================================================
// Forecast Interfaces
// ============================================================================

/**
 * Input parameters for generating a forecast.
 */
export interface ForecastInput {
  /** Current monthly traffic (organic sessions) */
  currentTraffic: number;
  /** Current monthly clicks */
  currentClicks: number;
  /** Current monthly conversions */
  currentConversions: number;
  /** Current monthly revenue (in currency units) */
  currentRevenue: number;
  /** Current click-through rate (0-1) */
  currentCTR: number;
  /** Current average search position */
  avgPosition: number;
  /** Number of content pieces produced per month */
  contentOutputPerMonth: number;
  /** Number of months to forecast */
  targetMonths: number;
}

/**
 * Output of a forecast for a single month or final period.
 */
export interface ForecastOutput {
  /** Projected monthly traffic */
  traffic: number;
  /** Projected monthly clicks */
  clicks: number;
  /** Projected monthly leads */
  leads: number;
  /** Projected monthly conversions */
  conversions: number;
  /** Projected monthly revenue */
  revenue: number;
  /** Projected CTR improvement (percentage points) */
  ctrImprovement: number;
  /** Projected ranking improvement (positions) */
  rankingImprovement: number;
  /** Content pieces per month */
  contentOutput: number;
  /** Required effort description (Dutch) */
  requiredEffort: string;
}

/**
 * Range of forecast outputs (low/mid/high).
 * Reflects uncertainty in projections.
 */
export interface ForecastRange {
  low: ForecastOutput;
  mid: ForecastOutput;
  high: ForecastOutput;
}

/**
 * Monthly projection entry.
 */
export interface MonthlyProjection {
  month: number;
  traffic: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

// ============================================================================
// Budget Interfaces
// ============================================================================

/**
 * Data required to create a budget allocation.
 */
export interface BudgetAllocationData {
  /** Name of the budget allocation (Dutch) */
  name: string;
  /** Optional description (Dutch) */
  description?: string;
  /** Total budget amount */
  totalBudget: number;
  /** Currency code (default: EUR) */
  currency?: string;
  /** Category allocations (percentages, 0-100) */
  allocations: {
    technicalSeo: number;
    content: number;
    updates: number;
    authority: number;
    digitalPR: number;
    cro: number;
    localSeo: number;
    geo: number;
    monitoring: number;
    reporting: number;
  };
  /** Optional notes per category (JSON, Dutch) */
  allocationNotes?: string;
  /** Period start date */
  periodStart?: Date;
  /** Period end date */
  periodEnd?: Date;
}

/**
 * Budget recommendation for a category.
 */
export interface BudgetRecommendation {
  category: BudgetCategory;
  recommendedPercentage: number;
  reason: string;
}

/**
 * Filters for querying forecasts.
 */
export interface ForecastFilters {
  scenario?: ForecastScenario;
}

// Re-export Prisma enums
export type { ForecastScenario, BudgetCategory };
