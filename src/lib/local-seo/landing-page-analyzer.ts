// ============================================================================
// Local SEO — Landing Page Analyzer
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Analyzes landing page quality (8 elements, 100 total points)
// and generates LocalBusiness JSON-LD structured data.
// ============================================================================

import { db } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

export interface LandingPageQualityInput {
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  openingHours?: string | Record<string, unknown> | null;
}

export interface QualityIssue {
  element: string;
  pointsLost: number;
  description: string;
}

export interface LandingPageQualityResult {
  qualityScore: number;
  hasStructuredData: boolean;
  hasNAP: boolean;
  hasMap: boolean;
  hasOpeningHours: boolean;
  issues: QualityIssue[];
}

export interface StructuredDataInput {
  name?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  openingHours?: string | Record<string, unknown> | null;
  businessType?: string;
}

export interface StructuredDataResult {
  jsonLd: string;
}

// ============================================================================
// Quality Scoring Elements (8 elements, 100 total points)
// ============================================================================

const QUALITY_ELEMENTS = [
  { element: 'title', label: 'Titel', maxPoints: 15 },
  { element: 'metaDescription', label: 'Meta-omschrijving', maxPoints: 10 },
  { element: 'h1', label: 'H1-kop', maxPoints: 10 },
  { element: 'wordCount', label: 'Woordenaantal', maxPoints: 15 },
  { element: 'hasStructuredData', label: 'Gestructureerde gegevens', maxPoints: 15 },
  { element: 'hasNAP', label: 'NAP-vermelding', maxPoints: 15 },
  { element: 'hasMap', label: 'Kaart/embed', maxPoints: 10 },
  { element: 'hasOpeningHours', label: 'Openingstijden', maxPoints: 10 },
] as const;

// ============================================================================
// Analyze Landing Page Quality
// ============================================================================

/**
 * Analyze the quality of a landing page based on 8 elements.
 * Total possible score: 100 points.
 * Each missing element reduces the score by its point value.
 * Issues contain Dutch descriptions of what's missing.
 *
 * @param url - The landing page URL (used for reference, not fetched)
 * @param locationData - Location data to check against
 * @param pageData - Optional page data overrides
 * @returns Quality analysis result
 */
export async function analyzeLandingPageQuality(
  url: string,
  locationData: LandingPageQualityInput,
  pageData?: {
    title?: string;
    metaDescription?: string;
    h1?: string;
    wordCount?: number;
    hasStructuredData?: boolean;
    hasNAP?: boolean;
    hasMap?: boolean;
    hasOpeningHours?: boolean;
  }
): Promise<LandingPageQualityResult> {
  let qualityScore = 100;
  const issues: QualityIssue[] = [];

  // Check each quality element
  // For now, we infer presence from location data and page data

  // Title
  if (!pageData?.title) {
    qualityScore -= 15;
    issues.push({
      element: 'title',
      pointsLost: 15,
      description: 'Geen titel (title tag) gevonden op de pagina.',
    });
  }

  // Meta description
  if (!pageData?.metaDescription) {
    qualityScore -= 10;
    issues.push({
      element: 'metaDescription',
      pointsLost: 10,
      description: 'Geen meta-omschrijving gevonden op de pagina.',
    });
  }

  // H1
  if (!pageData?.h1) {
    qualityScore -= 10;
    issues.push({
      element: 'h1',
      pointsLost: 10,
      description: 'Geen H1-kop gevonden op de pagina.',
    });
  }

  // Word count
  if (!pageData?.wordCount || pageData.wordCount < 300) {
    qualityScore -= 15;
    issues.push({
      element: 'wordCount',
      pointsLost: 15,
      description: pageData?.wordCount
        ? `Woordenaantal is ${pageData.wordCount}, minimum is 300 woorden.`
        : 'Onvoldoende woordenaantal (minimum 300 woorden vereist).',
    });
  }

  // Structured data
  const hasStructuredData = pageData?.hasStructuredData ?? false;
  if (!hasStructuredData) {
    qualityScore -= 15;
    issues.push({
      element: 'hasStructuredData',
      pointsLost: 15,
      description: 'Geen gestructureerde gegevens (JSON-LD) gevonden op de pagina.',
    });
  }

  // NAP presence — check if location has name + address + phone
  const hasNAP =
    pageData?.hasNAP ??
    (!!locationData.name && !!locationData.address && !!locationData.phone);
  if (!hasNAP) {
    qualityScore -= 15;
    issues.push({
      element: 'hasNAP',
      pointsLost: 15,
      description:
        'NAP-vermelding (Naam, Adres, Telefoon) ontbreekt op de pagina.',
    });
  }

  // Map
  const hasMap = pageData?.hasMap ?? false;
  if (!hasMap) {
    qualityScore -= 10;
    issues.push({
      element: 'hasMap',
      pointsLost: 10,
      description: 'Geen kaart (Google Maps embed) gevonden op de pagina.',
    });
  }

  // Opening hours
  const hasOpeningHours =
    pageData?.hasOpeningHours ?? !!locationData.openingHours;
  if (!hasOpeningHours) {
    qualityScore -= 10;
    issues.push({
      element: 'hasOpeningHours',
      pointsLost: 10,
      description: 'Geen openingstijden gevonden op de pagina.',
    });
  }

  // Ensure score is in 0-100 range
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  return {
    qualityScore,
    hasStructuredData,
    hasNAP,
    hasMap,
    hasOpeningHours,
    issues,
  };
}

// ============================================================================
// Generate Local Structured Data (JSON-LD)
// ============================================================================

/**
 * Generate JSON-LD structured data for a local business.
 * Only includes fields that have values — never includes null/undefined.
 * Uses the correct @type based on businessType.
 *
 * @param data - Location data for structured data generation
 * @returns JSON-LD string
 */
export async function generateLocalStructuredData(
  data: StructuredDataInput
): Promise<StructuredDataResult> {
  const businessType = data.businessType || 'LocalBusiness';

  // Map businessType to Schema.org types
  const typeMapping: Record<string, string> = {
    restaurant: 'Restaurant',
    dentist: 'Dentist',
    doctor: 'Physician',
    lawyer: 'Attorney',
    hotel: 'Hotel',
    store: 'Store',
    bakery: 'Bakery',
    cafe: 'CafeOrCoffeeShop',
    gym: 'HealthClub',
    salon: 'SalonOrSpa',
    garage: 'AutoRepair',
    plumber: 'Plumber',
    electrician: 'Electrician',
    real_estate: 'RealEstateAgent',
    insurance: 'InsuranceAgency',
    bank: 'BankOrCreditUnion',
  };

  const schemaType = typeMapping[businessType.toLowerCase()] || 'LocalBusiness';

  // Build structured data object — only include non-null/undefined values
  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
  };

  if (data.name) {
    structuredData['name'] = data.name;
  }

  // Address — only add if at least one address field exists
  if (data.address || data.city || data.postalCode || data.country) {
    const address: Record<string, unknown> = {
      '@type': 'PostalAddress',
    };
    if (data.address) address['streetAddress'] = data.address;
    if (data.city) address['addressLocality'] = data.city;
    if (data.postalCode) address['postalCode'] = data.postalCode;
    if (data.country) address['addressCountry'] = data.country;
    structuredData['address'] = address;
  }

  if (data.phone) {
    structuredData['telephone'] = data.phone;
  }

  if (data.email) {
    structuredData['email'] = data.email;
  }

  if (data.website) {
    structuredData['url'] = data.website;
  }

  // Geo coordinates
  if (data.latitude != null && data.longitude != null) {
    structuredData['geo'] = {
      '@type': 'GeoCoordinates',
      latitude: data.latitude,
      longitude: data.longitude,
    };
  }

  // Opening hours
  if (data.openingHours) {
    let hoursValue = data.openingHours;
    if (typeof hoursValue === 'string') {
      try {
        hoursValue = JSON.parse(hoursValue);
      } catch {
        // Keep as string if not valid JSON
      }
    }

    if (typeof hoursValue === 'object' && hoursValue !== null) {
      // Convert from {"mon":{"open":"09:00","close":"18:00"},...}
      // to Schema.org OpeningHoursSpecification
      const specs: Record<string, unknown>[] = [];
      const dayMapping: Record<string, string> = {
        mon: 'Monday',
        tue: 'Tuesday',
        wed: 'Wednesday',
        thu: 'Thursday',
        fri: 'Friday',
        sat: 'Saturday',
        sun: 'Sunday',
      };

      for (const [day, hours] of Object.entries(hoursValue)) {
        const daySpec = hours as { open?: string; close?: string } | null;
        if (daySpec?.open && daySpec?.close) {
          specs.push({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: dayMapping[day] || day,
            opens: daySpec.open,
            closes: daySpec.close,
          });
        }
      }

      if (specs.length > 0) {
        structuredData['openingHoursSpecification'] = specs;
      }
    }
  }

  return {
    jsonLd: JSON.stringify(structuredData, null, 2),
  };
}

// ============================================================================
// Save Landing Page Analysis
// ============================================================================

/**
 * Save the landing page analysis result to the database.
 * This is a convenience function used by the API route.
 */
export async function saveLandingPageAnalysis(
  projectId: string,
  locationId: string,
  url: string,
  analysis: LandingPageQualityResult,
  pageData?: {
    title?: string;
    metaDescription?: string;
    h1?: string;
    wordCount?: number;
  }
) {
  return db.localLandingPage.create({
    data: {
      projectId,
      locationId,
      url,
      title: pageData?.title ?? null,
      metaDescription: pageData?.metaDescription ?? null,
      h1: pageData?.h1 ?? null,
      wordCount: pageData?.wordCount ?? 0,
      hasStructuredData: analysis.hasStructuredData,
      hasNAP: analysis.hasNAP,
      hasMap: analysis.hasMap,
      hasOpeningHours: analysis.hasOpeningHours,
      qualityScore: analysis.qualityScore,
      issues: JSON.stringify(analysis.issues),
    },
  });
}
