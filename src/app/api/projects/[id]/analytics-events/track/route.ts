import { NextRequest, NextResponse } from 'next/server';
import { trackEvent } from '@/lib/first-party-analytics';
import type { AnalyticsEventData } from '@/lib/first-party-analytics';

// POST /api/projects/[id]/analytics-events/track — Track a single analytics event
// Public endpoint — no auth required for client-side tracking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const body = await request.json();
    const { eventType, eventName, pageUrl, sessionId, consentState, deviceType,
            pageTitle, referrer, userId, utmSource, utmMedium, utmCampaign,
            utmTerm, utmContent, eventData, revenue, currency, browser, os,
            country, language } = body as {
      eventType?: string;
      eventName?: string;
      pageUrl?: string;
      sessionId?: string;
      consentState?: string;
      deviceType?: string;
      pageTitle?: string;
      referrer?: string;
      userId?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      utmTerm?: string;
      utmContent?: string;
      eventData?: string;
      revenue?: number;
      currency?: string;
      browser?: string;
      os?: string;
      country?: string;
      language?: string;
    };

    if (!eventType) {
      return NextResponse.json(
        { error: 'eventType is vereist' },
        { status: 400 }
      );
    }

    if (!consentState) {
      return NextResponse.json(
        { error: 'consentState is vereist' },
        { status: 400 }
      );
    }

    const validEventTypes = ['PAGE_VIEW', 'SESSION', 'EVENT', 'CONVERSION', 'REVENUE'];
    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `Ongeldig eventType. Geldige waarden: ${validEventTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const validConsentStates = ['GRANTED', 'DENIED', 'UNKNOWN'];
    if (!validConsentStates.includes(consentState)) {
      return NextResponse.json(
        { error: `Ongeldig consentState. Geldige waarden: ${validConsentStates.join(', ')}` },
        { status: 400 }
      );
    }

    const data: AnalyticsEventData = {
      eventType: eventType as AnalyticsEventData['eventType'],
      consentState: consentState as AnalyticsEventData['consentState'],
    };

    if (eventName) data.eventName = eventName;
    if (pageUrl) data.pageUrl = pageUrl;
    if (sessionId) data.sessionId = sessionId;
    if (deviceType) data.deviceType = deviceType;
    if (pageTitle) data.pageTitle = pageTitle;
    if (referrer) data.referrer = referrer;
    if (userId) data.userId = userId;
    if (utmSource) data.utmSource = utmSource;
    if (utmMedium) data.utmMedium = utmMedium;
    if (utmCampaign) data.utmCampaign = utmCampaign;
    if (utmTerm) data.utmTerm = utmTerm;
    if (utmContent) data.utmContent = utmContent;
    if (eventData) data.eventData = eventData;
    if (revenue !== undefined) data.revenue = revenue;
    if (currency) data.currency = currency;
    if (browser) data.browser = browser;
    if (os) data.os = os;
    if (country) data.country = country;
    if (language) data.language = language;

    const event = await trackEvent(projectId, data);

    return NextResponse.json({ data: event }, { status: 201 });
  } catch (error) {
    console.error('Track analytics event error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
