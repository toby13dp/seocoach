// ============================================================================
// SEOCoach Alert Engine — Notification Preference Management
// ============================================================================
//
// Manages alert notification preferences for users, including channel settings,
// quiet hours, and digest frequency. All user-facing text is in Dutch (nl-NL).
//
// Uses the AlertPreference model from Prisma.
// ---------------------------------------------------------------------------

import type { AlertType, AlertSeverity } from '@prisma/client';
import { db } from '@/lib/db';
import { generateDigest } from './engine';
import type { AlertDigest } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Settings for creating a new notification preference */
export interface NotificationPreferenceSettings {
  alertType?: AlertType | null;
  severity?: AlertSeverity | null;
  channel: string; // email, in_app, webhook
  isEnabled?: boolean;
  digestFrequency?: string | null; // none, daily, weekly
  quietHoursStart?: string | null; // "22:00"
  quietHoursEnd?: string | null; // "08:00"
}

/** Update payload for an existing preference */
export interface NotificationPreferenceUpdate {
  isEnabled?: boolean;
  digestFrequency?: string | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

/** Lightweight representation of an alert for notification checks */
export interface AlertForNotification {
  type: AlertType;
  severity: AlertSeverity;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Get all notification preferences for a user within a project.
 */
export async function getNotificationPreferences(
  projectId: string,
  userId: string
) {
  return db.alertPreference.findMany({
    where: { projectId, userId },
    orderBy: [{ channel: 'asc' }, { alertType: 'asc' }],
  });
}

/**
 * Create a new notification preference.
 *
 * Validates that the channel is one of the allowed values and that
 * quiet hours are in a valid format (HH:MM).
 */
export async function createNotificationPreference(
  projectId: string,
  userId: string,
  settings: NotificationPreferenceSettings
) {
  validateChannel(settings.channel);
  validateQuietHours(settings.quietHoursStart, settings.quietHoursEnd);

  return db.alertPreference.create({
    data: {
      projectId,
      userId,
      alertType: settings.alertType ?? null,
      severity: settings.severity ?? null,
      channel: settings.channel,
      isEnabled: settings.isEnabled ?? true,
      digestFrequency: settings.digestFrequency ?? null,
      quietHoursStart: settings.quietHoursStart ?? null,
      quietHoursEnd: settings.quietHoursEnd ?? null,
    },
  });
}

/**
 * Update an existing notification preference.
 */
export async function updateNotificationPreference(
  preferenceId: string,
  updates: NotificationPreferenceUpdate
) {
  validateQuietHours(updates.quietHoursStart, updates.quietHoursEnd);

  return db.alertPreference.update({
    where: { id: preferenceId },
    data: {
      ...(updates.isEnabled !== undefined && { isEnabled: updates.isEnabled }),
      ...(updates.digestFrequency !== undefined && {
        digestFrequency: updates.digestFrequency,
      }),
      ...(updates.quietHoursStart !== undefined && {
        quietHoursStart: updates.quietHoursStart,
      }),
      ...(updates.quietHoursEnd !== undefined && {
        quietHoursEnd: updates.quietHoursEnd,
      }),
    },
  });
}

// ---------------------------------------------------------------------------
// Notification decision logic
// ---------------------------------------------------------------------------

/**
 * Determine whether a notification should be sent for a given alert,
 * based on the user's preferences.
 *
 * Checks:
 *   1. Is the channel enabled?
 *   2. Does the alert type match the preference (or is the preference generic)?
 *   3. Does the severity match the preference (or is the preference generic)?
 *   4. Is the current time outside quiet hours?
 *
 * @param preference - The user's notification preference record
 * @param alert      - The alert that might trigger a notification
 * @returns true if the notification should be sent
 */
export function shouldNotify(
  preference: {
    alertType: AlertType | null;
    severity: AlertSeverity | null;
    isEnabled: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
  },
  alert: AlertForNotification
): boolean {
  // 1. Channel must be enabled
  if (!preference.isEnabled) {
    return false;
  }

  // 2. Alert type must match (null = all types)
  if (preference.alertType !== null && preference.alertType !== alert.type) {
    return false;
  }

  // 3. Severity must match (null = all severities)
  if (preference.severity !== null && preference.severity !== alert.severity) {
    return false;
  }

  // 4. Check quiet hours
  if (isInQuietHours(preference.quietHoursStart, preference.quietHoursEnd)) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Digest helpers
// ---------------------------------------------------------------------------

/**
 * Collect alerts for the daily digest.
 * Generates a digest covering the last 24 hours.
 */
export async function getDailyDigest(
  projectId: string
): Promise<AlertDigest> {
  return generateDigest(projectId, 'daily');
}

/**
 * Collect alerts for the weekly digest.
 * Generates a digest covering the last 7 days.
 */
export async function getWeeklyDigest(
  projectId: string
): Promise<AlertDigest> {
  return generateDigest(projectId, 'weekly');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a channel string is one of the allowed values.
 */
function validateChannel(channel: string): void {
  const allowed = ['email', 'in_app', 'webhook'];
  if (!allowed.includes(channel)) {
    throw new Error(
      `Ongeldig kanaal: "${channel}". Toegestane kanalen: ${allowed.join(', ')}`
    );
  }
}

/**
 * Validate that quiet hours strings are in HH:MM format, if provided.
 */
function validateQuietHours(
  start: string | null | undefined,
  end: string | null | undefined
): void {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (start !== null && start !== undefined && start !== '') {
    if (!timeRegex.test(start)) {
      throw new Error(
        `Ongeldig formaat voor stiltetijden start: "${start}". Gebruik HH:MM (bijv. "22:00").`
      );
    }
  }

  if (end !== null && end !== undefined && end !== '') {
    if (!timeRegex.test(end)) {
      throw new Error(
        `Ongeldig formaat voor stiltetijden einde: "${end}". Gebruik HH:MM (bijv. "08:00").`
      );
    }
  }
}

/**
 * Check whether the current time falls within the quiet hours window.
 *
 * Quiet hours can span midnight (e.g. 22:00 – 08:00).
 * Returns false if either boundary is not set.
 */
function isInQuietHours(
  quietHoursStart: string | null,
  quietHoursEnd: string | null
): boolean {
  if (!quietHoursStart || !quietHoursEnd) {
    return false;
  }

  const now = new Date();
  // Use Dutch timezone for quiet hours
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = quietHoursStart.split(':').map(Number);
  const [endHour, endMinute] = quietHoursEnd.split(':').map(Number);

  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g. 22:00 – 08:00)
  if (startTotalMinutes > endTotalMinutes) {
    // Current time is in quiet hours if it's after start OR before end
    return (
      currentTotalMinutes >= startTotalMinutes ||
      currentTotalMinutes <= endTotalMinutes
    );
  }

  // Same-day quiet hours (e.g. 12:00 – 13:00)
  return (
    currentTotalMinutes >= startTotalMinutes &&
    currentTotalMinutes <= endTotalMinutes
  );
}
