/**
 * Event Collector Tests
 * Tests for /src/lib/first-party-analytics/event-collector.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// ============================================================================
// DB Mock Setup — must come BEFORE importing the module under test
// ============================================================================

const mockProjectFindUnique = mock(() => Promise.resolve({ id: 'proj-1' }));
const mockEventCreate = mock(() => Promise.resolve({ id: 'evt-1' }));
const mockSessionFindUnique = mock(() => Promise.resolve(null));
const mockSessionCreate = mock(() => Promise.resolve({ id: 'sess-1' }));
const mockSessionUpdate = mock(() => Promise.resolve({ id: 'sess-1' }));

mock.module('@/lib/db', () => ({
  db: {
    project: {
      findUnique: mockProjectFindUnique,
    },
    analyticsEvent: {
      create: mockEventCreate,
    },
    analyticsSession: {
      findUnique: mockSessionFindUnique,
      create: mockSessionCreate,
      update: mockSessionUpdate,
    },
  },
}));

import {
  trackEvent,
  trackPageView,
  trackConversion,
  bulkTrackEvents,
} from '@/lib/first-party-analytics/event-collector';
import { AnalyticsEventType, ConsentState } from '@prisma/client';

// ============================================================================
// Helpers
// ============================================================================

/** Create a basic event data object for testing */
function baseEventData(overrides: Record<string, any> = {}) {
  return {
    eventType: AnalyticsEventType.EVENT,
    consentState: ConsentState.UNKNOWN,
    ...overrides,
  };
}

/** Reset all mocks before each test */
function resetMocks() {
  mockProjectFindUnique.mockReset();
  mockEventCreate.mockReset();
  mockSessionFindUnique.mockReset();
  mockSessionCreate.mockReset();
  mockSessionUpdate.mockReset();

  // Default: project exists
  mockProjectFindUnique.mockImplementation(() => Promise.resolve({ id: 'proj-1' }));
  mockEventCreate.mockImplementation((args: any) => Promise.resolve({ id: 'evt-1', ...args.data }));
  mockSessionFindUnique.mockImplementation(() => Promise.resolve(null));
  mockSessionCreate.mockImplementation((args: any) => Promise.resolve({ id: 'sess-1', ...args.data }));
  mockSessionUpdate.mockImplementation((args: any) => Promise.resolve({ id: 'sess-1' }));
}

// ============================================================================
// Test: trackEvent
// ============================================================================

describe('trackEvent', () => {
  beforeEach(resetMocks);

  test('creates event with correct projectId', async () => {
    await trackEvent('proj-1', baseEventData());

    expect(mockEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: 'proj-1' }),
      })
    );
  });

  test('creates event with correct eventType', async () => {
    await trackEvent('proj-1', baseEventData({ eventType: AnalyticsEventType.PAGE_VIEW }));

    expect(mockEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: AnalyticsEventType.PAGE_VIEW }),
      })
    );
  });

  test('creates event with all optional fields set to null when not provided', async () => {
    await trackEvent('proj-1', baseEventData());

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.eventName).toBeNull();
    expect(callArgs.data.pageUrl).toBeNull();
    expect(callArgs.data.referrer).toBeNull();
    expect(callArgs.data.userId).toBeNull();
  });

  test('creates event with provided optional fields', async () => {
    await trackEvent('proj-1', baseEventData({
      eventName: 'button_click',
      pageUrl: 'https://example.com/page',
      pageTitle: 'Test Page',
      referrer: 'https://google.com',
    }));

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.eventName).toBe('button_click');
    expect(callArgs.data.pageUrl).toBe('https://example.com/page');
    expect(callArgs.data.pageTitle).toBe('Test Page');
    expect(callArgs.data.referrer).toBe('https://google.com');
  });

  test('defaults currency to EUR when not provided', async () => {
    await trackEvent('proj-1', baseEventData());

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.currency).toBe('EUR');
  });

  test('uses provided currency when specified', async () => {
    await trackEvent('proj-1', baseEventData({ currency: 'USD' }));

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.currency).toBe('USD');
  });

  test('throws Dutch error when project not found', async () => {
    mockProjectFindUnique.mockImplementation(() => Promise.resolve(null));

    await expect(trackEvent('bad-proj', baseEventData())).rejects.toThrow(
      'Project met ID "bad-proj" niet gevonden of verwijderd'
    );
  });
});

// ============================================================================
// Test: trackPageView
// ============================================================================

describe('trackPageView', () => {
  beforeEach(resetMocks);

  test('creates PAGE_VIEW event type automatically', async () => {
    await trackPageView('proj-1', {
      pageUrl: 'https://example.com/home',
      consentState: ConsentState.GRANTED,
    });

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.eventType).toBe(AnalyticsEventType.PAGE_VIEW);
  });

  test('passes pageUrl and pageTitle correctly', async () => {
    await trackPageView('proj-1', {
      pageUrl: 'https://example.com/home',
      pageTitle: 'Home Page',
      consentState: ConsentState.GRANTED,
    });

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.pageUrl).toBe('https://example.com/home');
    expect(callArgs.data.pageTitle).toBe('Home Page');
  });
});

// ============================================================================
// Test: trackConversion
// ============================================================================

describe('trackConversion', () => {
  beforeEach(resetMocks);

  test('creates CONVERSION event type automatically', async () => {
    await trackConversion('proj-1', {
      consentState: ConsentState.GRANTED,
    });

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.eventType).toBe(AnalyticsEventType.CONVERSION);
  });

  test('includes revenue when provided', async () => {
    await trackConversion('proj-1', {
      consentState: ConsentState.GRANTED,
      revenue: 99.99,
      currency: 'EUR',
    });

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.revenue).toBe(99.99);
  });

  test('includes eventName for conversion', async () => {
    await trackConversion('proj-1', {
      consentState: ConsentState.GRANTED,
      eventName: 'purchase',
    });

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.eventName).toBe('purchase');
  });
});

// ============================================================================
// Test: Cookieless Mode
// ============================================================================

describe('Cookieless mode — generates session ID when none provided', () => {
  beforeEach(resetMocks);

  test('generates cookieless session ID prefixed with "cls-" when sessionId is omitted', async () => {
    await trackEvent('proj-1', baseEventData({ sessionId: undefined }));

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.sessionId).toMatch(/^cls-/);
  });

  test('uses provided sessionId when present', async () => {
    await trackEvent('proj-1', baseEventData({ sessionId: 'user-session-123' }));

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.sessionId).toBe('user-session-123');
  });

  test('creates new session record when no existing session found (cookieless)', async () => {
    mockSessionFindUnique.mockImplementation(() => Promise.resolve(null));

    await trackEvent('proj-1', baseEventData({ sessionId: undefined }));

    expect(mockSessionCreate).toHaveBeenCalled();
    const sessionArgs = mockSessionCreate.mock.calls[0][0] as any;
    expect(sessionArgs.data.isCookieless).toBe(true);
  });
});

// ============================================================================
// Test: Consent State
// ============================================================================

describe('Consent state', () => {
  beforeEach(resetMocks);

  test('defaults to UNKNOWN consentState when specified', async () => {
    await trackEvent('proj-1', baseEventData({ consentState: ConsentState.UNKNOWN }));

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.consentState).toBe(ConsentState.UNKNOWN);
  });

  test('stores GRANTED consentState when provided', async () => {
    await trackEvent('proj-1', baseEventData({ consentState: ConsentState.GRANTED }));

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.consentState).toBe(ConsentState.GRANTED);
  });

  test('stores DENIED consentState when provided', async () => {
    await trackEvent('proj-1', baseEventData({ consentState: ConsentState.DENIED }));

    const callArgs = mockEventCreate.mock.calls[0][0] as any;
    expect(callArgs.data.consentState).toBe(ConsentState.DENIED);
  });
});

// ============================================================================
// Test: bulkTrackEvents
// ============================================================================

describe('bulkTrackEvents', () => {
  beforeEach(resetMocks);

  test('imports all events and returns correct count', async () => {
    const events = [
      baseEventData({ eventType: AnalyticsEventType.PAGE_VIEW }),
      baseEventData({ eventType: AnalyticsEventType.EVENT }),
      baseEventData({ eventType: AnalyticsEventType.CONVERSION }),
    ];

    const result = await bulkTrackEvents('proj-1', events);

    expect(result.imported).toBe(3);
    expect(result.errors).toEqual([]);
  });

  test('continues importing after individual event errors', async () => {
    // First event succeeds, second throws, third succeeds
    let callCount = 0;
    mockEventCreate.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.reject(new Error('DB error'));
      }
      return Promise.resolve({ id: `evt-${callCount}` });
    });

    const events = [
      baseEventData({ eventType: AnalyticsEventType.PAGE_VIEW }),
      baseEventData({ eventType: AnalyticsEventType.EVENT }),
      baseEventData({ eventType: AnalyticsEventType.CONVERSION }),
    ];

    const result = await bulkTrackEvents('proj-1', events);

    expect(result.imported).toBe(2);
    expect(result.errors.length).toBe(1);
    // Dutch error message
    expect(result.errors[0]).toContain('Fout bij importeren gebeurtenis');
  });

  test('returns Dutch error message for failed events', async () => {
    mockEventCreate.mockImplementation(() => Promise.reject(new Error('DB connection failed')));

    const events = [baseEventData()];

    const result = await bulkTrackEvents('proj-1', events);

    expect(result.imported).toBe(0);
    expect(result.errors[0]).toContain('Fout bij importeren gebeurtenis op rij 1');
    expect(result.errors[0]).toContain('DB connection failed');
  });

  test('throws Dutch error when project not found', async () => {
    mockProjectFindUnique.mockImplementation(() => Promise.resolve(null));

    await expect(bulkTrackEvents('bad-proj', [baseEventData()])).rejects.toThrow(
      'Project met ID "bad-proj" niet gevonden of verwijderd'
    );
  });
});
