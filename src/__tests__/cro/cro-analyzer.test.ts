/**
 * CRO Analyzer Tests
 * Tests for /src/lib/cro/cro-analyzer.ts
 *
 * The pure analysis functions (analyzeScrollDepth, analyzeRageClicks, etc.)
 * take BehaviourRecord[] as input — no DB mocking needed for these.
 */

import { describe, test, expect } from 'bun:test';
import {
  analyzeScrollDepth,
  analyzeRageClicks,
  analyzeDeadClicks,
  analyzeFormAbandonment,
  analyzeDeviceEngagement,
} from '@/lib/cro/cro-analyzer';
import { BehaviourType, CROCategory, CROSeverity } from '@prisma/client';

// ============================================================================
// Helpers
// ============================================================================

/** Shape of a BehaviourRecord as returned by Prisma findMany */
interface MockBehaviourRecord {
  id: string;
  projectId: string;
  behaviourType: BehaviourType;
  pageUrl: string | null;
  element: string | null;
  value: number | null;
  metadata: string | null;
  sessionId: string | null;
  deviceType: string | null;
  recordedAt: Date;
}

/** Create a mock behaviour record */
function makeRecord(overrides: Partial<MockBehaviourRecord> = {}): MockBehaviourRecord {
  return {
    id: `rec-${Math.random().toString(36).slice(2, 8)}`,
    projectId: 'proj-1',
    behaviourType: BehaviourType.SCROLL_DEPTH,
    pageUrl: 'https://example.com/page',
    element: null,
    value: null,
    metadata: null,
    sessionId: null,
    deviceType: null,
    recordedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Test: analyzeScrollDepth
// ============================================================================

describe('analyzeScrollDepth', () => {
  test('avg < 25% → CRITICAL severity finding', () => {
    // 5 records with very low scroll depth (avg ~15%)
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({
        behaviourType: BehaviourType.SCROLL_DEPTH,
        pageUrl: 'https://example.com/page',
        value: 10 + i * 3, // 10, 13, 16, 19, 22 → avg = 16
      })
    );

    const findings = analyzeScrollDepth(records);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe(CROSeverity.CRITICAL);
    expect(findings[0].category).toBe(CROCategory.LANDING_PAGES);
    expect(findings[0].title).toContain('Lage scroll-diepte');
  });

  test('avg < 50% but >= 25% → HIGH severity finding', () => {
    // 5 records with moderate scroll depth (avg ~38%)
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({
        behaviourType: BehaviourType.SCROLL_DEPTH,
        pageUrl: 'https://example.com/page',
        value: 30 + i * 4, // 30, 34, 38, 42, 46 → avg = 38
      })
    );

    const findings = analyzeScrollDepth(records);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe(CROSeverity.HIGH);
    expect(findings[0].title).toContain('Gemiddelde scroll-diepte');
  });

  test('avg >= 50% → no findings', () => {
    // 5 records with good scroll depth (avg ~70%)
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({
        behaviourType: BehaviourType.SCROLL_DEPTH,
        pageUrl: 'https://example.com/page',
        value: 60 + i * 5, // 60, 65, 70, 75, 80 → avg = 70
      })
    );

    const findings = analyzeScrollDepth(records);

    expect(findings).toEqual([]);
  });

  test('fewer than 3 data points → no findings', () => {
    const records = [
      makeRecord({
        behaviourType: BehaviourType.SCROLL_DEPTH,
        pageUrl: 'https://example.com/page',
        value: 10,
      }),
    ];

    const findings = analyzeScrollDepth(records);

    expect(findings).toEqual([]);
  });

  test('no scroll depth records → no findings', () => {
    const records = [
      makeRecord({ behaviourType: BehaviourType.RAGE_CLICK, element: '#btn' }),
    ];

    const findings = analyzeScrollDepth(records);

    expect(findings).toEqual([]);
  });

  test('findings contain Dutch text (title, description, recommendation)', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({
        behaviourType: BehaviourType.SCROLL_DEPTH,
        pageUrl: 'https://example.com/page',
        value: 10 + i * 2, // avg ~12 → CRITICAL
      })
    );

    const findings = analyzeScrollDepth(records);

    expect(findings[0].title).toContain('scroll-diepte');
    expect(findings[0].description).toContain('scrollen');
    expect(findings[0].recommendation).toBeDefined();
    expect(findings[0].recommendation.length).toBeGreaterThan(10);
  });
});

// ============================================================================
// Test: analyzeRageClicks
// ============================================================================

describe('analyzeRageClicks', () => {
  test('multiple rage clicks on same element → HIGH severity CTA finding', () => {
    // 5 rage click records on same element
    const records = Array.from({ length: 5 }, () =>
      makeRecord({
        behaviourType: BehaviourType.RAGE_CLICK,
        pageUrl: 'https://example.com/checkout',
        element: '#checkout-btn',
      })
    );

    const findings = analyzeRageClicks(records);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe(CROSeverity.HIGH);
    expect(findings[0].category).toBe(CROCategory.CTA);
    expect(findings[0].title).toContain('Woedeklikken');
  });

  test('fewer than 3 rage click events on element → no findings', () => {
    const records = [
      makeRecord({
        behaviourType: BehaviourType.RAGE_CLICK,
        pageUrl: 'https://example.com/page',
        element: '#btn',
      }),
      makeRecord({
        behaviourType: BehaviourType.RAGE_CLICK,
        pageUrl: 'https://example.com/page',
        element: '#btn',
      }),
    ];

    const findings = analyzeRageClicks(records);

    expect(findings).toEqual([]);
  });

  test('no rage click records → no findings', () => {
    const records = [
      makeRecord({
        behaviourType: BehaviourType.SCROLL_DEPTH,
        value: 50,
      }),
    ];

    const findings = analyzeRageClicks(records);

    expect(findings).toEqual([]);
  });

  test('findings contain Dutch text', () => {
    const records = Array.from({ length: 5 }, () =>
      makeRecord({
        behaviourType: BehaviourType.RAGE_CLICK,
        pageUrl: 'https://example.com/page',
        element: '#submit-btn',
      })
    );

    const findings = analyzeRageClicks(records);

    expect(findings[0].description).toContain('Woedeklikken');
    expect(findings[0].recommendation).toBeDefined();
  });
});

// ============================================================================
// Test: analyzeDeadClicks
// ============================================================================

describe('analyzeDeadClicks', () => {
  test('dead clicks on element → MEDIUM severity CTA finding', () => {
    const records = Array.from({ length: 5 }, () =>
      makeRecord({
        behaviourType: BehaviourType.DEAD_CLICK,
        pageUrl: 'https://example.com/page',
        element: '.banner-image',
      })
    );

    const findings = analyzeDeadClicks(records);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe(CROSeverity.MEDIUM);
    expect(findings[0].category).toBe(CROCategory.CTA);
    expect(findings[0].title).toContain('Dode klik');
  });

  test('fewer than 3 dead clicks on element → no findings', () => {
    const records = [
      makeRecord({
        behaviourType: BehaviourType.DEAD_CLICK,
        pageUrl: 'https://example.com/page',
        element: '.img',
      }),
    ];

    const findings = analyzeDeadClicks(records);

    expect(findings).toEqual([]);
  });

  test('findings contain Dutch text', () => {
    const records = Array.from({ length: 4 }, () =>
      makeRecord({
        behaviourType: BehaviourType.DEAD_CLICK,
        pageUrl: 'https://example.com/page',
        element: '.card',
      })
    );

    const findings = analyzeDeadClicks(records);

    expect(findings[0].description).toContain('Dode klik');
    expect(findings[0].recommendation).toContain('cursor:pointer');
  });
});

// ============================================================================
// Test: analyzeFormAbandonment
// ============================================================================

describe('analyzeFormAbandonment', () => {
  test('high abandonment count → HIGH severity FORMS finding', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({
        behaviourType: BehaviourType.FORM_ABANDONMENT,
        pageUrl: 'https://example.com/contact',
        element: `#field-${i}`,
      })
    );

    const findings = analyzeFormAbandonment(records);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe(CROSeverity.HIGH);
    expect(findings[0].category).toBe(CROCategory.FORMS);
    expect(findings[0].title).toContain('Formulier-afbreking');
  });

  test('fewer than 2 abandonment records → no findings', () => {
    const records = [
      makeRecord({
        behaviourType: BehaviourType.FORM_ABANDONMENT,
        pageUrl: 'https://example.com/contact',
        element: '#email',
      }),
    ];

    const findings = analyzeFormAbandonment(records);

    expect(findings).toEqual([]);
  });

  test('findings contain Dutch text', () => {
    const records = Array.from({ length: 3 }, (_, i) =>
      makeRecord({
        behaviourType: BehaviourType.FORM_ABANDONMENT,
        pageUrl: 'https://example.com/signup',
        element: `#field-${i}`,
      })
    );

    const findings = analyzeFormAbandonment(records);

    expect(findings[0].description).toContain('braken het af');
    expect(findings[0].recommendation).toContain('Vereenvoudig');
  });
});

// ============================================================================
// Test: analyzeDeviceEngagement
// ============================================================================

describe('analyzeDeviceEngagement', () => {
  test('mobile engagement significantly lower → MOBILE_UX finding', () => {
    // Desktop engagement: high values (~80)
    const desktopRecords = Array.from({ length: 5 }, () =>
      makeRecord({
        behaviourType: BehaviourType.ENGAGEMENT,
        pageUrl: 'https://example.com/page',
        deviceType: 'desktop',
        value: 80,
      })
    );

    // Mobile engagement: low values (~30) → ~62.5% lower
    const mobileRecords = Array.from({ length: 5 }, () =>
      makeRecord({
        behaviourType: BehaviourType.ENGAGEMENT,
        pageUrl: 'https://example.com/page',
        deviceType: 'mobile',
        value: 30,
      })
    );

    const findings = analyzeDeviceEngagement([...desktopRecords, ...mobileRecords]);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].category).toBe(CROCategory.MOBILE_UX);
    expect(findings[0].title).toContain('Lage mobiele betrokkenheid');
  });

  test('similar engagement across devices → no finding', () => {
    // Both desktop and mobile ~80
    const desktopRecords = Array.from({ length: 5 }, () =>
      makeRecord({
        behaviourType: BehaviourType.ENGAGEMENT,
        pageUrl: 'https://example.com/page',
        deviceType: 'desktop',
        value: 80,
      })
    );

    const mobileRecords = Array.from({ length: 5 }, () =>
      makeRecord({
        behaviourType: BehaviourType.ENGAGEMENT,
        pageUrl: 'https://example.com/page',
        deviceType: 'mobile',
        value: 75,
      })
    );

    const findings = analyzeDeviceEngagement([...desktopRecords, ...mobileRecords]);

    expect(findings).toEqual([]);
  });

  test('fewer than 3 data points per device → no finding', () => {
    const desktopRecords = Array.from({ length: 2 }, () =>
      makeRecord({
        behaviourType: BehaviourType.ENGAGEMENT,
        pageUrl: 'https://example.com/page',
        deviceType: 'desktop',
        value: 80,
      })
    );

    const mobileRecords = Array.from({ length: 2 }, () =>
      makeRecord({
        behaviourType: BehaviourType.ENGAGEMENT,
        pageUrl: 'https://example.com/page',
        deviceType: 'mobile',
        value: 10,
      })
    );

    const findings = analyzeDeviceEngagement([...desktopRecords, ...mobileRecords]);

    expect(findings).toEqual([]);
  });

  test('findings contain Dutch text', () => {
    const desktopRecords = Array.from({ length: 5 }, () =>
      makeRecord({
        behaviourType: BehaviourType.ENGAGEMENT,
        pageUrl: 'https://example.com/page',
        deviceType: 'desktop',
        value: 90,
      })
    );

    const mobileRecords = Array.from({ length: 5 }, () =>
      makeRecord({
        behaviourType: BehaviourType.ENGAGEMENT,
        pageUrl: 'https://example.com/page',
        deviceType: 'mobile',
        value: 20,
      })
    );

    const findings = analyzeDeviceEngagement([...desktopRecords, ...mobileRecords]);

    expect(findings[0].recommendation).toContain('mobiele gebruikerservaring');
  });

  test('very large mobile gap (>50%) → HIGH severity', () => {
    const desktopRecords = Array.from({ length: 5 }, () =>
      makeRecord({
        behaviourType: BehaviourType.ENGAGEMENT,
        pageUrl: 'https://example.com/page',
        deviceType: 'desktop',
        value: 100,
      })
    );

    const mobileRecords = Array.from({ length: 5 }, () =>
      makeRecord({
        behaviourType: BehaviourType.ENGAGEMENT,
        pageUrl: 'https://example.com/page',
        deviceType: 'mobile',
        value: 20,
      })
    );

    const findings = analyzeDeviceEngagement([...desktopRecords, ...mobileRecords]);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe(CROSeverity.HIGH);
  });
});
