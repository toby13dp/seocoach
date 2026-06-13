// ============================================================================
// Local SEO — Health Checker
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Runs health checks for local SEO across 10 categories, calculates scores,
// and provides Dutch-language titles, descriptions, and recommendations.
// ============================================================================

import { db } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

export interface HealthCheckResult {
  category: string;
  status: 'PASSING' | 'NEEDS_IMPROVEMENT' | 'FAILING' | 'NOT_CHECKED';
  score: number;
  title: string;
  description: string;
  recommendation?: string;
  evidence?: Record<string, unknown>;
}

// ============================================================================
// Health Check Category Metadata (Dutch)
// ============================================================================

const CATEGORY_META: Record<
  string,
  {
    title: string;
    passingDescription: string;
    needsImprovementDescription: string;
    failingDescription: string;
    notCheckedDescription: string;
    passingRecommendation?: string;
    needsImprovementRecommendation: string;
    failingRecommendation: string;
  }
> = {
  NAP_CONSISTENCY: {
    title: 'NAP-consistentie',
    passingDescription: 'Naam, adres en telefoonnummer zijn consistent.',
    needsImprovementDescription: 'NAP-gegevens zijn gedeeltelijk aanwezig.',
    failingDescription: 'NAP-gegevens ontbreken of zijn inconsistent.',
    notCheckedDescription: 'Niet gecontroleerd',
    failingRecommendation:
      'Zorg dat naam, adres en telefoonnummer overal consistent zijn.',
    needsImprovementRecommendation:
      'Controleer NAP-gegevens op consistentie en vul ontbrekende velden aan.',
  },
  OPENING_HOURS: {
    title: 'Openingstijden',
    passingDescription: 'Openingstijden zijn ingesteld.',
    needsImprovementDescription: 'Openingstijden zijn gedeeltelijk ingesteld.',
    failingDescription: 'Geen openingstijden ingesteld.',
    notCheckedDescription: 'Niet gecontroleerd',
    failingRecommendation:
      'Voeg openingstijden toe voor alle dagen van de week.',
    needsImprovementRecommendation:
      'Controleer of alle dagen van de week openingstijden hebben.',
  },
  LOCAL_STRUCTURED_DATA: {
    title: 'Lokale gestructureerde gegevens',
    passingDescription: 'Lokale gestructureerde gegevens (JSON-LD) zijn aanwezig.',
    needsImprovementDescription:
      'Lokale gestructureerde gegevens zijn gedeeltelijk aanwezig.',
    failingDescription: 'Geen lokale gestructureerde gegevens gevonden.',
    notCheckedDescription: 'Niet gecontroleerd',
    failingRecommendation:
      'Voeg LocalBusiness JSON-LD toe aan de locatiepagina.',
    needsImprovementRecommendation:
      'Controleer de gestructureerde gegevens op volledigheid.',
  },
  LANDING_PAGES: {
    title: 'Landingpagina\'s',
    passingDescription: 'Landingpagina\'s zijn aanwezig met goede kwaliteit.',
    needsImprovementDescription:
      'Landingpagina\'s zijn aanwezig maar de kwaliteit kan beter.',
    failingDescription: 'Geen landingpagina\'s gevonden.',
    notCheckedDescription: 'Niet gecontroleerd',
    failingRecommendation:
      'Maak landingpagina\'s aan voor deze locatie.',
    needsImprovementRecommendation:
      'Verbeter de kwaliteit van de bestaande landingpagina\'s.',
  },
  LOCAL_KEYWORDS: {
    title: 'Lokale zoekwoorden',
    passingDescription: 'Lokale zoekwoorden zijn gekoppeld met rangposities.',
    needsImprovementDescription:
      'Lokale zoekwoorden zijn aanwezig maar zonder rangposities.',
    failingDescription: 'Geen lokale zoekwoorden gevonden.',
    notCheckedDescription: 'Niet gecontroleerd',
    failingRecommendation:
      'Voeg lokale zoekwoorden toe en koppel rangposities.',
    needsImprovementRecommendation:
      'Koppel rangposities aan de bestaande lokale zoekwoorden.',
  },
  REVIEWS: {
    title: 'Beoordelingen',
    passingDescription: 'Voldoende beoordelingen met goede gemiddelde score.',
    needsImprovementDescription:
      'Beoordelingen zijn aanwezig maar kunnen beter.',
    failingDescription: 'Onvoldoende beoordelingen of lage score.',
    notCheckedDescription: 'Niet gecontroleerd',
    failingRecommendation:
      'Verzamel meer beoordelingen en werk aan klanttevredenheid.',
    needsImprovementRecommendation:
      'Moedig klanten aan om beoordelingen achter te laten.',
  },
  GOOGLE_BUSINESS_PROFILE: {
    title: 'Google Bedrijfsprofiel',
    passingDescription: 'Google Bedrijfsprofiel is verbonden.',
    needsImprovementDescription: 'Google Bedrijfsprofiel is niet verbonden.',
    failingDescription: 'Google Bedrijfsprofiel is niet geconfigureerd.',
    notCheckedDescription: 'Niet gecontroleerd',
    failingRecommendation:
      'Configureer en verbind uw Google Bedrijfsprofiel.',
    needsImprovementRecommendation:
      'Verbind uw Google Bedrijfsprofiel voor betere zichtbaarheid.',
  },
  LOCAL_LINKS: {
    title: 'Lokale links',
    passingDescription: 'Lokale links zijn aanwezig.',
    needsImprovementDescription: 'Lokale links zijn gedeeltelijk aanwezig.',
    failingDescription: 'Geen lokale links gevonden.',
    notCheckedDescription: 'Niet gecontroleerd',
    failingRecommendation:
      'Bouw lokale links op via directories en samenwerkingen.',
    needsImprovementRecommendation:
      'Breid uw lokale linkprofiel uit.',
  },
  PHOTOS: {
    title: 'Foto\'s',
    passingDescription: 'Voldoende foto\'s aanwezig.',
    needsImprovementDescription: 'Meer foto\'s gewenst.',
    failingDescription: 'Geen foto\'s gevonden.',
    notCheckedDescription: 'Niet gecontroleerd',
    failingRecommendation:
      'Voeg foto\'s toe aan uw locatieprofiel.',
    needsImprovementRecommendation:
      'Voeg meer foto\'s toe voor betere betrokkenheid.',
  },
  SERVICE_AREAS: {
    title: 'Servicegebieden',
    passingDescription: 'Servicegebieden zijn ingesteld.',
    needsImprovementDescription: 'Servicegebieden zijn niet ingesteld.',
    failingDescription: 'Geen servicegebieden geconfigureerd.',
    notCheckedDescription: 'Niet gecontroleerd',
    failingRecommendation:
      'Stel servicegebieden in voor uw locatie.',
    needsImprovementRecommendation:
      'Definieer de servicegebieden voor betere lokale vindbaarheid.',
  },
};

// ============================================================================
// Individual Health Checks
// ============================================================================

function checkNAPConsistency(location: Record<string, unknown>): HealthCheckResult {
  const meta = CATEGORY_META.NAP_CONSISTENCY;
  const hasName = !!location.name;
  const hasAddress = !!location.address;
  const hasPhone = !!location.phone;
  const filled = [hasName, hasAddress, hasPhone].filter(Boolean).length;

  if (filled === 3) {
    return {
      category: 'NAP_CONSISTENCY',
      status: 'PASSING',
      score: 100,
      title: meta.title,
      description: meta.passingDescription,
      recommendation: meta.passingRecommendation,
    };
  } else if (filled >= 1) {
    return {
      category: 'NAP_CONSISTENCY',
      status: 'FAILING',
      score: Math.round((filled / 3) * 100),
      title: meta.title,
      description: meta.failingDescription,
      recommendation: meta.failingRecommendation,
    };
  }

  return {
    category: 'NAP_CONSISTENCY',
    status: 'FAILING',
    score: 0,
    title: meta.title,
    description: meta.failingDescription,
    recommendation: meta.failingRecommendation,
  };
}

function checkOpeningHours(location: Record<string, unknown>): HealthCheckResult {
  const meta = CATEGORY_META.OPENING_HOURS;
  const hasHours = !!location.openingHours;

  if (hasHours) {
    return {
      category: 'OPENING_HOURS',
      status: 'PASSING',
      score: 100,
      title: meta.title,
      description: meta.passingDescription,
      recommendation: meta.passingRecommendation,
    };
  }

  return {
    category: 'OPENING_HOURS',
    status: 'FAILING',
    score: 0,
    title: meta.title,
    description: meta.failingDescription,
    recommendation: meta.failingRecommendation,
  };
}

function checkLocalStructuredData(location: Record<string, unknown>): HealthCheckResult {
  const meta = CATEGORY_META.LOCAL_STRUCTURED_DATA;
  const hasStructuredData = !!location.localStructuredData;

  if (hasStructuredData) {
    return {
      category: 'LOCAL_STRUCTURED_DATA',
      status: 'PASSING',
      score: 100,
      title: meta.title,
      description: meta.passingDescription,
      recommendation: meta.passingRecommendation,
    };
  }

  return {
    category: 'LOCAL_STRUCTURED_DATA',
    status: 'FAILING',
    score: 0,
    title: meta.title,
    description: meta.failingDescription,
    recommendation: meta.failingRecommendation,
  };
}

function checkLandingPages(
  landingPages: Record<string, unknown>[]
): HealthCheckResult {
  const meta = CATEGORY_META.LANDING_PAGES;

  if (landingPages.length === 0) {
    return {
      category: 'LANDING_PAGES',
      status: 'FAILING',
      score: 0,
      title: meta.title,
      description: meta.failingDescription,
      recommendation: meta.failingRecommendation,
    };
  }

  const avgScore =
    landingPages.reduce((sum, p) => sum + ((p.qualityScore as number) ?? 0), 0) /
    landingPages.length;

  if (avgScore >= 70) {
    return {
      category: 'LANDING_PAGES',
      status: 'PASSING',
      score: Math.round(avgScore),
      title: meta.title,
      description: meta.passingDescription,
      recommendation: meta.passingRecommendation,
    };
  }

  return {
    category: 'LANDING_PAGES',
    status: 'NEEDS_IMPROVEMENT',
    score: Math.round(avgScore),
    title: meta.title,
    description: meta.needsImprovementDescription,
    recommendation: meta.needsImprovementRecommendation,
  };
}

function checkLocalKeywords(
  keywords: Record<string, unknown>[]
): HealthCheckResult {
  const meta = CATEGORY_META.LOCAL_KEYWORDS;

  if (keywords.length === 0) {
    return {
      category: 'LOCAL_KEYWORDS',
      status: 'FAILING',
      score: 0,
      title: meta.title,
      description: meta.failingDescription,
      recommendation: meta.failingRecommendation,
    };
  }

  const withRank = keywords.filter((k) => k.currentRank != null);
  if (withRank.length > 0) {
    return {
      category: 'LOCAL_KEYWORDS',
      status: 'PASSING',
      score: Math.round((withRank.length / keywords.length) * 100),
      title: meta.title,
      description: meta.passingDescription,
      recommendation: meta.passingRecommendation,
    };
  }

  return {
    category: 'LOCAL_KEYWORDS',
    status: 'NEEDS_IMPROVEMENT',
    score: 30,
    title: meta.title,
    description: meta.needsImprovementDescription,
    recommendation: meta.needsImprovementRecommendation,
  };
}

function checkReviews(location: Record<string, unknown>): HealthCheckResult {
  const meta = CATEGORY_META.REVIEWS;
  const avgRating = (location.avgRating as number) ?? 0;
  const reviewCount = (location.reviewCount as number) ?? 0;

  if (reviewCount > 0 && avgRating >= 4.0) {
    return {
      category: 'REVIEWS',
      status: 'PASSING',
      score: Math.min(100, Math.round((avgRating / 5) * 100)),
      title: meta.title,
      description: meta.passingDescription,
      recommendation: meta.passingRecommendation,
    };
  }

  if (reviewCount > 0) {
    return {
      category: 'REVIEWS',
      status: 'NEEDS_IMPROVEMENT',
      score: Math.round((avgRating / 5) * 100),
      title: meta.title,
      description: meta.needsImprovementDescription,
      recommendation: meta.needsImprovementRecommendation,
    };
  }

  return {
    category: 'REVIEWS',
    status: 'FAILING',
    score: 0,
    title: meta.title,
    description: meta.failingDescription,
    recommendation: meta.failingRecommendation,
  };
}

function checkGBP(location: Record<string, unknown>): HealthCheckResult {
  const meta = CATEGORY_META.GOOGLE_BUSINESS_PROFILE;
  const gbpStatus = location.gbpStatus as string;

  if (gbpStatus === 'connected') {
    return {
      category: 'GOOGLE_BUSINESS_PROFILE',
      status: 'PASSING',
      score: 100,
      title: meta.title,
      description: meta.passingDescription,
      recommendation: meta.passingRecommendation,
    };
  }

  return {
    category: 'GOOGLE_BUSINESS_PROFILE',
    status: 'NEEDS_IMPROVEMENT',
    score: 20,
    title: meta.title,
    description: meta.needsImprovementDescription,
    recommendation: meta.needsImprovementRecommendation,
  };
}

function checkServiceAreas(location: Record<string, unknown>): HealthCheckResult {
  const meta = CATEGORY_META.SERVICE_AREAS;
  const hasServiceArea = !!location.serviceArea;

  if (hasServiceArea) {
    return {
      category: 'SERVICE_AREAS',
      status: 'PASSING',
      score: 100,
      title: meta.title,
      description: meta.passingDescription,
      recommendation: meta.passingRecommendation,
    };
  }

  return {
    category: 'SERVICE_AREAS',
    status: 'NEEDS_IMPROVEMENT',
    score: 0,
    title: meta.title,
    description: meta.needsImprovementDescription,
    recommendation: meta.needsImprovementRecommendation,
  };
}

function checkNotChecked(category: string): HealthCheckResult {
  const meta = CATEGORY_META[category];
  return {
    category,
    status: 'NOT_CHECKED',
    score: 0,
    title: meta?.title ?? category,
    description: meta?.notCheckedDescription ?? 'Niet gecontroleerd',
    recommendation: undefined,
  };
}

// ============================================================================
// Run All Health Checks
// ============================================================================

/**
 * Run all 10 health check categories for a location.
 * Fetches location data, related keywords, and landing pages from the database.
 *
 * @param projectId - The project ID (for data isolation)
 * @param locationId - The location ID to check
 * @returns Array of health check results
 */
export async function runLocationHealthChecks(
  projectId: string,
  locationId: string
): Promise<HealthCheckResult[]> {
  // Fetch location
  const location = await db.location.findUnique({
    where: { id: locationId, deletedAt: null },
  });

  if (!location || location.projectId !== projectId) {
    throw new Error('Locatie niet gevonden of behoort niet tot dit project.');
  }

  // Fetch related data
  const [keywords, landingPages] = await Promise.all([
    db.localKeyword.findMany({
      where: { locationId, deletedAt: null },
      take: 100,
    }),
    db.localLandingPage.findMany({
      where: { locationId, deletedAt: null },
      take: 50,
    }),
  ]);

  const locationData = location as unknown as Record<string, unknown>;

  // Run all checks
  const results: HealthCheckResult[] = [
    checkNAPConsistency(locationData),
    checkOpeningHours(locationData),
    checkLocalStructuredData(locationData),
    checkLandingPages(landingPages as unknown as Record<string, unknown>[]),
    checkLocalKeywords(keywords as unknown as Record<string, unknown>[]),
    checkReviews(locationData),
    checkGBP(locationData),
    checkServiceAreas(locationData),
    // Placeholders — always NOT_CHECKED
    checkNotChecked('LOCAL_LINKS'),
    checkNotChecked('PHOTOS'),
  ];

  return results;
}

// ============================================================================
// Save Health Checks
// ============================================================================

/**
 * Save health check results to the database.
 * Creates a LocationHealthCheck record for each result.
 *
 * @param projectId - The project ID
 * @param locationId - The location ID
 * @param results - Health check results to save
 * @returns The saved health check records
 */
export async function saveHealthChecks(
  projectId: string,
  locationId: string,
  results: HealthCheckResult[]
) {
  const saved: Record<string, unknown>[] = [];

  for (const result of results) {
    const record = await db.locationHealthCheck.create({
      data: {
        projectId,
        locationId,
        category: result.category as any,
        status: result.status as any,
        score: result.score,
        title: result.title,
        description: result.description,
        recommendation: result.recommendation ?? null,
        evidence: result.evidence ? JSON.stringify(result.evidence) : null,
      },
    });
    saved.push(record);
  }

  // Update location health score
  const overallScore = calculateOverallHealthScore(results);
  await db.location.update({
    where: { id: locationId },
    data: { localHealthScore: overallScore },
  });

  return saved;
}

// ============================================================================
// Calculate Overall Health Score
// ============================================================================

/**
 * Calculate the weighted average health score across all categories.
 * Weights reflect the relative importance of each category.
 *
 * @param results - Array of health check results
 * @returns Weighted average score (0-100)
 */
export function calculateOverallHealthScore(
  results: HealthCheckResult[]
): number {
  if (results.length === 0) return 0;

  const weights: Record<string, number> = {
    NAP_CONSISTENCY: 20,
    OPENING_HOURS: 5,
    LOCAL_STRUCTURED_DATA: 10,
    LANDING_PAGES: 15,
    LOCAL_KEYWORDS: 15,
    REVIEWS: 15,
    GOOGLE_BUSINESS_PROFILE: 10,
    LOCAL_LINKS: 5,
    PHOTOS: 2.5,
    SERVICE_AREAS: 2.5,
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const result of results) {
    const weight = weights[result.category] ?? 5;
    weightedSum += result.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

// ============================================================================
// Get Location Health Checks
// ============================================================================

/**
 * Retrieve existing health checks for a location.
 * Returns the most recent checks, ordered by checkedAt descending.
 *
 * @param locationId - The location ID
 * @returns Array of health check records
 */
export async function getLocationHealthChecks(locationId: string) {
  return db.locationHealthCheck.findMany({
    where: { locationId },
    orderBy: { checkedAt: 'desc' },
  });
}
