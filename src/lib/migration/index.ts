// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Migration Types — Phase 12

export type { MigrationCheckStatus as MigrationCheckStatus } from '@prisma/client';
export type { MigrationProjectStatus as MigrationProjectStatus } from '@prisma/client';
export {
  MIGRATION_CHECK_STATUS_LABELS,
  MIGRATION_PROJECT_STATUS_LABELS,
} from './migration-manager';
export {
  createMigrationProject,
  updateMigrationProject,
  getMigrationProjects,
  createUrlMapping,
  bulkCreateUrlMappings,
  updateUrlMapping,
  createPreLaunchCheck,
  updatePreLaunchCheck,
  createLaunchBlocker,
  resolveLaunchBlocker,
  isLaunchReady,
  validateRedirect,
} from './migration-manager';
