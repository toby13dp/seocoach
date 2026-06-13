export type { AutomationCondition, AutomationAction } from './types';
export {
  TRIGGER_TYPE_LABELS,
  ACTION_TYPE_LABELS,
  RULE_STATUS_LABELS,
  HIGH_RISK_ACTIONS,
  isHighRiskAction,
} from './types';
export {
  createAutomationRule,
  updateAutomationRule,
  getAutomationRules,
  deleteAutomationRule,
  evaluateConditions,
  triggerRule,
  completeExecution,
  failExecution,
  getExecutionHistory,
} from './rule-manager';
