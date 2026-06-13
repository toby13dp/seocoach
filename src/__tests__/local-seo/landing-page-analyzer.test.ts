/**
 * Landing Page Analyzer Tests
 * Tests for /src/lib/local-seo/landing-page-analyzer.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock the Prisma client
const mockLandingPageCreate = mock(() => Promise.resolve({ id: 'lp-1' }));

mock.module('@/lib/db', () => ({
  db: {
    localLandingPage: {
      create: mockLandingPageCreate,
    },
  },
}));

// Import AFTER mock.module
import {
  analyzeLandingPageQuality,
  generateLocalStructuredData,
} from '@/lib/local-seo';

// ============================================================================
// Test: analyzeLandingPageQuality
// ============================================================================

describe('analyzeLandingPageQuality', () => {
  test('full quality page gets 100 points', async () => {
    const result = await analyzeLandingPageQuality(
      'https://example.nl/amsterdam',
      {
        name: 'Amsterdam Centraal',
        address: 'Stationsplein 1',
        phone: '+31 20 1234567',
        openingHours: '{"mon":{"open":"09:00","close":"18:00"}}',
      },
      {
        title: 'Restaurant Amsterdam Centraal',
        metaDescription: 'De beste restaurantervaring in Amsterdam.',
        h1: 'Welkom bij Amsterdam Centraal',
        wordCount: 500,
        hasStructuredData: true,
        hasNAP: true,
        hasMap: true,
        hasOpeningHours: true,
      }
    );

    expect(result.qualityScore).toBe(100);
    expect(result.issues.length).toBe(0);
  });

  test('missing title reduces score by 15 points', async () => {
    const result = await analyzeLandingPageQuality(
      'https://example.nl/amsterdam',
      { name: 'Test' },
      {
        metaDescription: 'Desc',
        h1: 'Heading',
        wordCount: 500,
        hasStructuredData: true,
        hasNAP: true,
        hasMap: true,
        hasOpeningHours: true,
      }
    );

    expect(result.qualityScore).toBe(85);
    expect(result.issues.some((i) => i.element === 'title')).toBe(true);
    expect(result.issues.find((i) => i.element === 'title')!.pointsLost).toBe(15);
  });

  test('missing meta description reduces score by 10 points', async () => {
    const result = await analyzeLandingPageQuality(
      'https://example.nl/amsterdam',
      { name: 'Test' },
      {
        title: 'Title',
        h1: 'Heading',
        wordCount: 500,
        hasStructuredData: true,
        hasNAP: true,
        hasMap: true,
        hasOpeningHours: true,
      }
    );

    expect(result.qualityScore).toBe(90);
    expect(result.issues.some((i) => i.element === 'metaDescription')).toBe(true);
  });

  test('low word count reduces score by 15 points', async () => {
    const result = await analyzeLandingPageQuality(
      'https://example.nl/amsterdam',
      { name: 'Test' },
      {
        title: 'Title',
        metaDescription: 'Desc',
        h1: 'Heading',
        wordCount: 150,
        hasStructuredData: true,
        hasNAP: true,
        hasMap: true,
        hasOpeningHours: true,
      }
    );

    expect(result.qualityScore).toBe(85);
    expect(result.issues.some((i) => i.element === 'wordCount')).toBe(true);
  });

  test('missing structured data reduces score by 15 points', async () => {
    const result = await analyzeLandingPageQuality(
      'https://example.nl/amsterdam',
      { name: 'Test' },
      {
        title: 'Title',
        metaDescription: 'Desc',
        h1: 'Heading',
        wordCount: 500,
        hasStructuredData: false,
        hasNAP: true,
        hasMap: true,
        hasOpeningHours: true,
      }
    );

    expect(result.qualityScore).toBe(85);
    expect(result.issues.some((i) => i.element === 'hasStructuredData')).toBe(true);
  });

  test('missing NAP reduces score by 15 points', async () => {
    const result = await analyzeLandingPageQuality(
      'https://example.nl/amsterdam',
      { name: 'Test' },
      {
        title: 'Title',
        metaDescription: 'Desc',
        h1: 'Heading',
        wordCount: 500,
        hasStructuredData: true,
        hasNAP: false,
        hasMap: true,
        hasOpeningHours: true,
      }
    );

    expect(result.qualityScore).toBe(85);
    expect(result.issues.some((i) => i.element === 'hasNAP')).toBe(true);
  });

  test('missing map reduces score by 10 points', async () => {
    const result = await analyzeLandingPageQuality(
      'https://example.nl/amsterdam',
      { name: 'Test' },
      {
        title: 'Title',
        metaDescription: 'Desc',
        h1: 'Heading',
        wordCount: 500,
        hasStructuredData: true,
        hasNAP: true,
        hasMap: false,
        hasOpeningHours: true,
      }
    );

    expect(result.qualityScore).toBe(90);
    expect(result.issues.some((i) => i.element === 'hasMap')).toBe(true);
  });

  test('missing opening hours reduces score by 10 points', async () => {
    const result = await analyzeLandingPageQuality(
      'https://example.nl/amsterdam',
      { name: 'Test' },
      {
        title: 'Title',
        metaDescription: 'Desc',
        h1: 'Heading',
        wordCount: 500,
        hasStructuredData: true,
        hasNAP: true,
        hasMap: true,
        hasOpeningHours: false,
      }
    );

    expect(result.qualityScore).toBe(90);
    expect(result.issues.some((i) => i.element === 'hasOpeningHours')).toBe(true);
  });

  test('completely empty page gets 0 points', async () => {
    const result = await analyzeLandingPageQuality(
      'https://example.nl/empty',
      {}
    );

    expect(result.qualityScore).toBe(0);
    expect(result.issues.length).toBe(8);
  });

  test('issues list has Dutch descriptions', async () => {
    const result = await analyzeLandingPageQuality(
      'https://example.nl/amsterdam',
      {}
    );

    for (const issue of result.issues) {
      expect(issue.description.length).toBeGreaterThan(0);
      // Check that descriptions contain Dutch words, not just English
      const hasDutchWords =
        issue.description.includes('Geen') ||
        issue.description.includes('ontbreekt') ||
        issue.description.includes('Onvoldoende') ||
        issue.description.includes('minimum') ||
        issue.description.includes('vereist');
      expect(hasDutchWords).toBe(true);
    }
  });

  test('score is clamped to 0-100 range', async () => {
    // Even with all elements missing, score should not go below 0
    const result = await analyzeLandingPageQuality(
      'https://example.nl/amsterdam',
      {}
    );

    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.qualityScore).toBeLessThanOrEqual(100);
  });

  test('infers hasNAP from location data when pageData not provided', async () => {
    const result = await analyzeLandingPageQuality(
      'https://example.nl/amsterdam',
      {
        name: 'Amsterdam Centraal',
        address: 'Stationsplein 1',
        phone: '+31 20 1234567',
      },
      {
        title: 'Title',
        metaDescription: 'Desc',
        h1: 'Heading',
        wordCount: 500,
        hasStructuredData: true,
        hasMap: true,
        hasOpeningHours: true,
        // hasNAP not provided — should infer from location data
      }
    );

    // NAP should be inferred as true from location data
    expect(result.hasNAP).toBe(true);
    expect(result.issues.some((i) => i.element === 'hasNAP')).toBe(false);
  });

  test('infers hasOpeningHours from location data when pageData not provided', async () => {
    const result = await analyzeLandingPageQuality(
      'https://example.nl/amsterdam',
      {
        name: 'Test',
        openingHours: '{"mon":{"open":"09:00","close":"18:00"}}',
      },
      {
        title: 'Title',
        metaDescription: 'Desc',
        h1: 'Heading',
        wordCount: 500,
        hasStructuredData: true,
        hasNAP: true,
        hasMap: true,
        // hasOpeningHours not provided — should infer from location data
      }
    );

    expect(result.hasOpeningHours).toBe(true);
    expect(result.issues.some((i) => i.element === 'hasOpeningHours')).toBe(false);
  });
});

// ============================================================================
// Test: generateLocalStructuredData
// ============================================================================

describe('generateLocalStructuredData', () => {
  test('generates valid JSON-LD with correct @context and @type', async () => {
    const result = await generateLocalStructuredData({
      name: 'Amsterdam Centraal',
      businessType: 'restaurant',
    });

    const parsed = JSON.parse(result.jsonLd);

    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('Restaurant');
  });

  test('defaults to LocalBusiness @type when no businessType provided', async () => {
    const result = await generateLocalStructuredData({
      name: 'Test Business',
    });

    const parsed = JSON.parse(result.jsonLd);

    expect(parsed['@type']).toBe('LocalBusiness');
  });

  test('maps businessType to correct Schema.org type', async () => {
    const mappings: Record<string, string> = {
      dentist: 'Dentist',
      hotel: 'Hotel',
      bakery: 'Bakery',
      gym: 'HealthClub',
      garage: 'AutoRepair',
    };

    for (const [input, expected] of Object.entries(mappings)) {
      const result = await generateLocalStructuredData({
        name: 'Test',
        businessType: input,
      });
      const parsed = JSON.parse(result.jsonLd);
      expect(parsed['@type']).toBe(expected);
    }
  });

  test('never includes null or undefined values in JSON-LD', async () => {
    const result = await generateLocalStructuredData({
      name: 'Amsterdam Centraal',
      address: 'Stationsplein 1',
      city: 'Amsterdam',
      // phone, email, website, etc. are all undefined
    });

    const parsed = JSON.parse(result.jsonLd);
    const jsonStr = result.jsonLd;

    expect(jsonStr).not.toContain('null');
    expect(jsonStr).not.toContain('undefined');
    expect(parsed.telephone).toBeUndefined();
    expect(parsed.email).toBeUndefined();
    expect(parsed.url).toBeUndefined();
  });

  test('includes address as PostalAddress when address fields are present', async () => {
    const result = await generateLocalStructuredData({
      name: 'Amsterdam Centraal',
      address: 'Stationsplein 1',
      city: 'Amsterdam',
      postalCode: '1012AB',
      country: 'NL',
    });

    const parsed = JSON.parse(result.jsonLd);

    expect(parsed.address).toBeDefined();
    expect(parsed.address['@type']).toBe('PostalAddress');
    expect(parsed.address.streetAddress).toBe('Stationsplein 1');
    expect(parsed.address.addressLocality).toBe('Amsterdam');
    expect(parsed.address.postalCode).toBe('1012AB');
    expect(parsed.address.addressCountry).toBe('NL');
  });

  test('includes geo coordinates when latitude and longitude are provided', async () => {
    const result = await generateLocalStructuredData({
      name: 'Amsterdam Centraal',
      latitude: 52.3791,
      longitude: 4.9003,
    });

    const parsed = JSON.parse(result.jsonLd);

    expect(parsed.geo).toBeDefined();
    expect(parsed.geo['@type']).toBe('GeoCoordinates');
    expect(parsed.geo.latitude).toBe(52.3791);
    expect(parsed.geo.longitude).toBe(4.9003);
  });

  test('does not include geo when only latitude is provided', async () => {
    const result = await generateLocalStructuredData({
      name: 'Amsterdam Centraal',
      latitude: 52.3791,
    });

    const parsed = JSON.parse(result.jsonLd);
    expect(parsed.geo).toBeUndefined();
  });

  test('converts opening hours to OpeningHoursSpecification', async () => {
    const result = await generateLocalStructuredData({
      name: 'Amsterdam Centraal',
      openingHours: {
        mon: { open: '09:00', close: '18:00' },
        tue: { open: '09:00', close: '18:00' },
        wed: { open: '09:00', close: '17:00' },
      },
    });

    const parsed = JSON.parse(result.jsonLd);

    expect(parsed.openingHoursSpecification).toBeDefined();
    expect(parsed.openingHoursSpecification.length).toBe(3);
    expect(parsed.openingHoursSpecification[0]['@type']).toBe(
      'OpeningHoursSpecification'
    );
    expect(parsed.openingHoursSpecification[0].dayOfWeek).toBe('Monday');
    expect(parsed.openingHoursSpecification[0].opens).toBe('09:00');
    expect(parsed.openingHoursSpecification[0].closes).toBe('18:00');
  });

  test('parses opening hours from JSON string', async () => {
    const result = await generateLocalStructuredData({
      name: 'Amsterdam Centraal',
      openingHours: '{"fri":{"open":"10:00","close":"20:00"}}',
    });

    const parsed = JSON.parse(result.jsonLd);

    expect(parsed.openingHoursSpecification).toBeDefined();
    expect(parsed.openingHoursSpecification[0].dayOfWeek).toBe('Friday');
    expect(parsed.openingHoursSpecification[0].opens).toBe('10:00');
    expect(parsed.openingHoursSpecification[0].closes).toBe('20:00');
  });

  test('includes all contact fields when provided', async () => {
    const result = await generateLocalStructuredData({
      name: 'Amsterdam Centraal',
      phone: '+31 20 1234567',
      email: 'info@example.nl',
      website: 'https://example.nl',
    });

    const parsed = JSON.parse(result.jsonLd);

    expect(parsed.telephone).toBe('+31 20 1234567');
    expect(parsed.email).toBe('info@example.nl');
    expect(parsed.url).toBe('https://example.nl');
  });

  test('generates minimal JSON-LD with only name', async () => {
    const result = await generateLocalStructuredData({
      name: 'Minimal Business',
    });

    const parsed = JSON.parse(result.jsonLd);

    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('LocalBusiness');
    expect(parsed.name).toBe('Minimal Business');
    expect(Object.keys(parsed).length).toBe(3); // @context, @type, name
  });
});
