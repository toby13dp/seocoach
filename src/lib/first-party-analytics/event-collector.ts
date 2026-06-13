// ============================================================================
// First-party Analytics — Event Collector
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Privacy-friendly event collection with cookieless session support.
// Ingests page views, custom events, conversions, and revenue events.
// All error messages are in Dutch. All functions verify projectId for
// tenant isolation.
// ============================================================================

import { db } from '@/lib/db';
import { AnalyticsEventType, ConsentState } from '@prisma/client';
import type { AnalyticsEventData } from './types';

// ============================================================================
// Cookieless Session ID Generation
// ============================================================================

/**
 * Generate a fingerprint-based session ID when no sessionId is provided.
 * Uses a simple hash of pageUrl + timestamp + deviceType.
 * This is NOT a tracking fingerprint — it's a best-effort session grouping
 * that avoids cookies entirely.
 *
 * @param pageUrl - The page URL
 * @param deviceType - The device type (desktop/mobile/tablet)
 * @returns A cookieless session ID prefixed with "cls-"
 */
function generateCookielessSessionId(
  pageUrl: string,
  deviceType?: string
): string {
  const timestamp = Date.now();
  const raw = `${pageUrl}|${timestamp}|${deviceType ?? 'unknown'}`;

  // Simple hash function for generating a deterministic-looking ID
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0; // Convert to 32-bit int
  }

  // Produce a hex string similar to a UUID format
  const hashStr = Math.abs(hash).toString(16).padStart(8, '0');
  const timeHex = (timestamp % 0xffffffff).toString(16).padStart(8, '0');

  return `cls-${hashStr}-${timeHex}-${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================================
// Project Verification
// ============================================================================

/**
 * Verify that a project exists and is not soft-deleted.
 * Throws an error in Dutch if the project is not found.
 *
 * @param projectId - The project ID to verify
 */
async function verifyProject(projectId: string): Promise<void> {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });

  if (!project) {
    throw new Error(`Project met ID "${projectId}" niet gevonden of verwijderd.`);
  }
}

// ============================================================================
// Core Event Tracking
// ============================================================================

/**
 * Ingest a single analytics event.
 * If sessionId is not provided, generates a cookieless session ID and
 * marks the event as cookieless.
 *
 * @param projectId - The project ID for tenant isolation
 * @param data - The analytics event data
 * @returns The created AnalyticsEvent record
 */
export async function trackEvent(
  projectId: string,
  data: AnalyticsEventData
) {
  await verifyProject(projectId);

  // Cookieless mode: generate session ID if not provided
  let sessionId = data.sessionId ?? null;
  let isCookieless = false;

  if (!sessionId) {
    sessionId = generateCookielessSessionId(
      data.pageUrl ?? '',
      data.deviceType
    );
    isCookieless = true;
  }

  const event = await db.analyticsEvent.create({
    data: {
      projectId,
      eventType: data.eventType,
      eventName: data.eventName ?? null,
      pageUrl: data.pageUrl ?? null,
      pageTitle: data.pageTitle ?? null,
      referrer: data.referrer ?? null,
      sessionId,
      userId: data.userId ?? null,
      utmSource: data.utmSource ?? null,
      utmMedium: data.utmMedium ?? null,
      utmCampaign: data.utmCampaign ?? null,
      utmTerm: data.utmTerm ?? null,
      utmContent: data.utmContent ?? null,
      eventData: data.eventData ?? null,
      revenue: data.revenue ?? null,
      currency: data.currency ?? 'EUR',
      consentState: data.consentState,
      deviceType: data.deviceType ?? null,
      browser: data.browser ?? null,
      os: data.os ?? null,
      country: data.country ?? null,
      language: data.language ?? null,
    },
  });

  // Update or create the associated session
  if (sessionId) {
    await upsertSessionFromEvent(projectId, sessionId, data, isCookieless);
  }

  return event;
}

// ============================================================================
// Convenience: Page View
// ============================================================================

/**
 * Convenience method for tracking page views.
 * Automatically sets eventType to PAGE_VIEW.
 *
 * @param projectId - The project ID for tenant isolation
 * @param data - Page view data (pageUrl required)
 * @returns The created AnalyticsEvent record
 */
export async function trackPageView(
  projectId: string,
  data: {
    pageUrl: string;
    pageTitle?: string;
    referrer?: string;
    sessionId?: string;
    consentState: ConsentState;
    deviceType?: string;
    browser?: string;
    os?: string;
    country?: string;
    language?: string;
    userId?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
  }
) {
  return trackEvent(projectId, {
    eventType: AnalyticsEventType.PAGE_VIEW,
    ...data,
  });
}

// ============================================================================
// Convenience: Conversion
// ============================================================================

/**
 * Convenience method for tracking conversions.
 * Automatically sets eventType to CONVERSION.
 *
 * @param projectId - The project ID for tenant isolation
 * @param data - Conversion data (revenue optional)
 * @returns The created AnalyticsEvent record
 */
export async function trackConversion(
  projectId: string,
  data: {
    pageUrl?: string;
    sessionId?: string;
    revenue?: number;
    currency?: string;
    consentState: ConsentState;
    eventName?: string;
    deviceType?: string;
    browser?: string;
    os?: string;
    country?: string;
    language?: string;
    userId?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    eventData?: string;
  }
) {
  return trackEvent(projectId, {
    eventType: AnalyticsEventType.CONVERSION,
    ...data,
  });
}

// ============================================================================
// Bulk Event Import
// ============================================================================

/**
 * Bulk import multiple analytics events.
 * Each event is validated and ingested individually.
 * Events that fail are reported in the errors array but do not
 * prevent other events from being imported.
 *
 * @param projectId - The project ID for tenant isolation
 * @param events - Array of analytics event data
 * @returns Count of imported events and any errors
 */
export async function bulkTrackEvents(
  projectId: string,
  events: AnalyticsEventData[]
): Promise<{ imported: number; errors: string[] }> {
  await verifyProject(projectId);

  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < events.length; i++) {
    try {
      const data = events[i];

      // Cookieless mode
      let sessionId = data.sessionId ?? null;
      let isCookieless = false;

      if (!sessionId) {
        sessionId = generateCookielessSessionId(
          data.pageUrl ?? '',
          data.deviceType
        );
        isCookieless = true;
      }

      await db.analyticsEvent.create({
        data: {
          projectId,
          eventType: data.eventType,
          eventName: data.eventName ?? null,
          pageUrl: data.pageUrl ?? null,
          pageTitle: data.pageTitle ?? null,
          referrer: data.referrer ?? null,
          sessionId,
          userId: data.userId ?? null,
          utmSource: data.utmSource ?? null,
          utmMedium: data.utmMedium ?? null,
          utmCampaign: data.utmCampaign ?? null,
          utmTerm: data.utmTerm ?? null,
          utmContent: data.utmContent ?? null,
          eventData: data.eventData ?? null,
          revenue: data.revenue ?? null,
          currency: data.currency ?? 'EUR',
          consentState: data.consentState,
          deviceType: data.deviceType ?? null,
          browser: data.browser ?? null,
          os: data.os ?? null,
          country: data.country ?? null,
          language: data.language ?? null,
        },
      });

      // Update or create the associated session
      if (sessionId) {
        await upsertSessionFromEvent(projectId, sessionId, data, isCookieless);
      }

      imported++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(
        `Fout bij importeren gebeurtenis op rij ${i + 1}: ${msg}`
      );
    }
  }

  return { imported, errors };
}

// ============================================================================
// Session Upsert Helper
// ============================================================================

/**
 * Create or update an AnalyticsSession based on an incoming event.
 * This keeps the session data in sync as events are tracked.
 *
 * @param projectId - The project ID for tenant isolation
 * @param sessionId - The session identifier
 * @param data - The event data that triggered this update
 * @param isCookieless - Whether this is a cookieless session
 */
async function upsertSessionFromEvent(
  projectId: string,
  sessionId: string,
  data: AnalyticsEventData,
  isCookieless: boolean
): Promise<void> {
  const existing = await db.analyticsSession.findFirst({
    where: {
      projectId_sessionId: { projectId, sessionId },
    },
  });

  if (existing) {
    // Update existing session
    const updateData: Record<string, unknown> = {
      lastActivityAt: new Date(),
    };

    if (data.eventType === AnalyticsEventType.PAGE_VIEW) {
      updateData.pageViews = existing.pageViews + 1;
      updateData.exitPage = data.pageUrl ?? existing.exitPage;
    }

    if (data.eventType === AnalyticsEventType.EVENT) {
      updateData.events = existing.events + 1;
    }

    if (data.eventType === AnalyticsEventType.CONVERSION) {
      updateData.conversions = existing.conversions + 1;
    }

    if (
      data.eventType === AnalyticsEventType.REVENUE &&
      data.revenue != null
    ) {
      updateData.revenue = (existing.revenue ?? 0) + data.revenue;
    }

    await db.analyticsSession.update({
      where: { id: existing.id },
      data: updateData,
    });
  } else {
    // Create new session
    await db.analyticsSession.create({
      data: {
        projectId,
        sessionId,
        entryPage: data.pageUrl ?? null,
        exitPage: data.pageUrl ?? null,
        pageViews:
          data.eventType === AnalyticsEventType.PAGE_VIEW ? 1 : 0,
        events: data.eventType === AnalyticsEventType.EVENT ? 1 : 0,
        conversions:
          data.eventType === AnalyticsEventType.CONVERSION ? 1 : 0,
        revenue:
          data.eventType === AnalyticsEventType.REVENUE && data.revenue != null
            ? data.revenue
            : 0,
        source: data.utmSource ?? null,
        medium: data.utmMedium ?? null,
        campaign: data.utmCampaign ?? null,
        deviceType: data.deviceType ?? null,
        browser: data.browser ?? null,
        os: data.os ?? null,
        country: data.country ?? null,
        consentState: data.consentState,
        isCookieless,
      },
    });
  }
}
