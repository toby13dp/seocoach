// ============================================================================
// SEOCoach Alert Engine — Barrel Export
// ============================================================================

// Types
export type {
  AlertRule,
  AlertEvaluation,
  AlertDigest,
  DigestAlertItem,
  AlertFilters,
  AlertSummary,
  AlertType,
  AlertSeverity,
  AlertStatus,
} from './types';

// Rules
export {
  ALERT_RULES,
  getAlertRule,
  getAllAlertRules,
  getAlertRulesBySeverity,
  getAlertRulesByDirection,
} from './rules';

// Anomaly detection
export { detectAnomaly, detectAnomalyBest } from './anomaly';
export type { AnomalyResult } from './anomaly';

// Engine
export {
  evaluateMetricAlert,
  runAllAlertChecks,
  acknowledgeAlert,
  snoozeAlert,
  resolveAlert,
  dismissAlert,
  assignAlert,
  getActiveAlerts,
  getAlertSummary,
  generateDigest,
} from './engine';

// Notifications
export {
  getNotificationPreferences,
  createNotificationPreference,
  updateNotificationPreference,
  shouldNotify,
  getDailyDigest,
  getWeeklyDigest,
} from './notifications';

export type {
  NotificationPreferenceSettings,
  NotificationPreferenceUpdate,
  AlertForNotification,
} from './notifications';
