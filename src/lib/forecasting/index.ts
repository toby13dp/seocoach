// ============================================================================
// Forecasting & Budget — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================

// Types
export type {
  ForecastInput,
  ForecastOutput,
  ForecastRange,
  MonthlyProjection,
  BudgetAllocationData,
  BudgetRecommendation,
  ForecastFilters,
  ForecastScenario,
  BudgetCategory,
} from './types';

export {
  FORECAST_SCENARIO_LABELS,
  FORECAST_SCENARIO_DESCRIPTIONS,
  BUDGET_CATEGORY_LABELS,
  BUDGET_CATEGORY_DESCRIPTIONS,
} from './types';

// Forecast Engine
export {
  generateForecast,
  generateAssumptions,
  calculateForecastRanges,
  getForecasts,
  getForecast,
  deleteForecast,
} from './forecast-engine';

// Budget Manager
export {
  createBudget,
  updateBudget,
  getBudget,
  listBudgets,
  deleteBudget,
  getBudgetRecommendations,
} from './budget-manager';
