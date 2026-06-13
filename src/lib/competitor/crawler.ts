// ============================================================================
// Competitor Intelligence — Crawler
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Respectful public crawl of competitor websites using existing crawler
// infrastructure. Respects robots.txt and crawl delays.
// Creates CompetitorSnapshot records and detects changes.
//
// CRITICAL: Does NOT invent traffic or revenue data for competitors.
// ============================================================================

import { db } from '@/lib/db';
import { validateUrl } from '@/lib/crawler/ssrf';
import { fetchRobotsTxt, parseRobotsTxt, isAllowed, parseCrawlDelay } from '@/lib/crawler/robots';
import { parsePage, normalizeUrl } from '@/lib/crawler/parser';
import type { CompetitorChangeType } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface SnapshotData {
  url: string;
  title: string | null;
  headings: string[] | null;
  topics: string[] | null;
  services: string[] | null;
  categories: string[] | null;
  locations: string[] | null;
  structuredData: unknown[] | null;
  internalLinks: { count: number; key: string[] } | null;
  publicPrices: unknown[] | null;
  metaDescription: string | null;
  wordCount: number;
}

// ============================================================================
// Respectful Crawl
// ============================================================================

/** User agent for competitor crawling */
const COMPETITOR_USER_AGENT = 'SEOCoach-CompetitorMonitor/1.0';

/** Default crawl delay for competitor monitoring (2 seconds) */
const DEFAULT_COMPETITOR_CRAWL_DELAY = 2000;

/** Fetch timeout in milliseconds */
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Crawl a competitor's website respectfully.
 *
 * Respects:
 * - robots.txt rules
 * - Crawl-delay directives
 * - SSRF protection from existing crawler module
 * - Rate limiting with configurable delays
 *
 * Creates CompetitorSnapshot records for each crawled page.
 *
 * @param competitorId - The competitor to crawl
 * @returns Number of snapshots created
 */
export async function crawlCompetitor(competitorId: string): Promise<number> {
  // Get competitor info
  const competitor = await db.competitor.findUnique({
    where: { id: competitorId },
  });

  if (!competitor || competitor.deletedAt) {
    throw new Error('Concurrent niet gevonden of verwijderd.');
  }

  if (!competitor.isActive) {
    throw new Error('Concurrent is inactief. Activeer de concurrent om te crawlen.');
  }

  const baseUrl = competitor.websiteUrl;

  // Validate URL with SSRF protection
  const urlValidation = validateUrl(baseUrl);
  if (!urlValidation.valid) {
    throw new Error(`URL validatiefout: ${urlValidation.reason ?? 'onbekend'}`);
  }

  // Check robots.txt
  const robotsTxt = await fetchRobotsTxt(baseUrl);
  const robotsRules = parseRobotsTxt(robotsTxt);
  const crawlAllowed = isAllowed(baseUrl, robotsRules, COMPETITOR_USER_AGENT);

  if (!crawlAllowed) {
    throw new Error(
      `Crawlen van ${baseUrl} is niet toegestaan door robots.txt. Respecteer de wensen van de website-eigenaar.`
    );
  }

  // Get crawl delay from robots.txt or use default
  const crawlDelay = parseCrawlDelay(robotsTxt, COMPETITOR_USER_AGENT)
    ?? DEFAULT_COMPETITOR_CRAWL_DELAY;

  // Crawl the main page
  let snapshotCount = 0;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(baseUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': COMPETITOR_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: kon ${baseUrl} niet ophalen.`);
    }

    const html = await response.text();

    // Parse the page using existing parser (2 args: html, url)
    const parsed = parsePage(html, baseUrl);

    // Extract structured data from parsed page (already object[])
    const structuredDataArray: unknown[] | null =
      parsed.structuredData && parsed.structuredData.length > 0
        ? parsed.structuredData
        : null;

    // Convert HeadingEntry[] to string[] for storage
    const headingsAsStrings: string[] | null =
      parsed.headings && parsed.headings.length > 0
        ? parsed.headings.map((h) => `${'#'.repeat(h.level)} ${h.text}`)
        : null;

    // Convert ExtractedLink[] to internal links summary
    const internalLinksSummary: { count: number; key: string[] } | null =
      parsed.internalLinks && parsed.internalLinks.length > 0
        ? {
            count: parsed.internalLinks.length,
            key: parsed.internalLinks.slice(0, 20).map((l) => l.href),
          }
        : null;

    // Build snapshot data
    const snapshotData: SnapshotData = {
      url: normalizeUrl(baseUrl, baseUrl),
      title: parsed.title,
      headings: headingsAsStrings,
      topics: extractTopics(parsed.mainContent ?? ''),
      services: extractServices(parsed.mainContent ?? ''),
      categories: null, // Would require more sophisticated extraction
      locations: extractLocations(parsed.mainContent ?? ''),
      structuredData: structuredDataArray,
      internalLinks: internalLinksSummary,
      publicPrices: extractPrices(parsed.mainContent ?? ''),
      metaDescription: parsed.description,
      wordCount: parsed.wordCount,
    };

    // Create snapshot record
    await db.competitorSnapshot.create({
      data: {
        competitorId,
        url: snapshotData.url,
        title: snapshotData.title,
        headings: snapshotData.headings ? JSON.stringify(snapshotData.headings) : null,
        topics: snapshotData.topics ? JSON.stringify(snapshotData.topics) : null,
        services: snapshotData.services ? JSON.stringify(snapshotData.services) : null,
        categories: snapshotData.categories ? JSON.stringify(snapshotData.categories) : null,
        locations: snapshotData.locations ? JSON.stringify(snapshotData.locations) : null,
        structuredData: snapshotData.structuredData ? JSON.stringify(snapshotData.structuredData) : null,
        internalLinks: snapshotData.internalLinks ? JSON.stringify(snapshotData.internalLinks) : null,
        publicPrices: snapshotData.publicPrices ? JSON.stringify(snapshotData.publicPrices) : null,
        metaDescription: snapshotData.metaDescription,
        wordCount: snapshotData.wordCount,
      },
    });

    snapshotCount++;

    // Update competitor's lastCrawledAt
    await db.competitor.update({
      where: { id: competitorId },
      data: { lastCrawledAt: new Date() },
    });

    // Respect crawl delay before processing additional pages
    if (crawlDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, crawlDelay));
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Fout bij crawlen van ${baseUrl}: ${msg}`);
  }

  return snapshotCount;
}

// ============================================================================
// Change Detection
// ============================================================================

/**
 * Compare the latest two snapshots of a competitor to detect changes.
 * Creates CompetitorChange records with Dutch summaries.
 *
 * CRITICAL: Does NOT invent traffic or revenue data.
 * Only detects changes based on actual crawled content.
 *
 * @param competitorId - The competitor to check for changes
 * @returns Array of detected changes
 */
export async function detectChanges(competitorId: string) {
  // Get the latest two snapshots
  const snapshots = await db.competitorSnapshot.findMany({
    where: { competitorId },
    orderBy: { crawledAt: 'desc' },
    take: 2,
  });

  if (snapshots.length < 2) {
    // Need at least 2 snapshots to compare
    return [];
  }

  const [current, previous] = snapshots;
  const changes: Array<{
    changeType: CompetitorChangeType;
    url: string | null;
    previousValue: string | null;
    newValue: string | null;
    changeSummary: string;
    impactSuggestion: string | null;
    recommendedResponse: string | null;
  }> = [];

  // Compare titles
  if (current.title !== previous.title) {
    changes.push({
      changeType: 'TITLE_CHANGE',
      url: current.url,
      previousValue: previous.title,
      newValue: current.title,
      changeSummary: `Titel gewijzigd van "${previous.title ?? '(leeg)'}" naar "${current.title ?? '(leeg)'}".`,
      impactSuggestion: 'Een titelwijziging kan de SEO-positionering en klikfrequentie beïnvloeden.',
      recommendedResponse: 'Controleer of uw eigen titels nog concurrerend zijn voor dezelfde zoektermen.',
    });
  }

  // Compare meta descriptions
  if (current.metaDescription !== previous.metaDescription) {
    changes.push({
      changeType: 'TITLE_CHANGE', // Using TITLE_CHANGE as meta desc change is similar
      url: current.url,
      previousValue: previous.metaDescription,
      newValue: current.metaDescription,
      changeSummary: `Meta-beschrijving gewijzigd op ${current.url}.`,
      impactSuggestion: 'Een gewijzigde meta-beschrijving kan de CTR in zoekresultaten beïnvloeden.',
      recommendedResponse: 'Vergelijk de nieuwe beschrijving met uw eigen meta-beschrijvingen.',
    });
  }

  // Compare headings
  const currentHeadings = safeJsonParse<string[]>(current.headings) ?? [];
  const previousHeadings = safeJsonParse<string[]>(previous.headings) ?? [];
  const headingDiff = findAddedOrRemoved(previousHeadings, currentHeadings);
  if (headingDiff.added.length > 0 || headingDiff.removed.length > 0) {
    changes.push({
      changeType: 'HEADING_CHANGE',
      url: current.url,
      previousValue: previous.headings,
      newValue: current.headings,
      changeSummary: formatDiffSummary('Koppen', headingDiff),
      impactSuggestion: 'Kopwijzigingen beïnvloeden de contentstructuur en relevantiesignalen.',
      recommendedResponse: 'Controleer of de nieuwe koppen relevant zijn voor uw eigen contentstrategie.',
    });
  }

  // Compare topics
  const currentTopics = safeJsonParse<string[]>(current.topics) ?? [];
  const previousTopics = safeJsonParse<string[]>(previous.topics) ?? [];
  const topicDiff = findAddedOrRemoved(previousTopics, currentTopics);
  if (topicDiff.added.length > 0 || topicDiff.removed.length > 0) {
    changes.push({
      changeType: 'TOPIC_CHANGE',
      url: current.url,
      previousValue: previous.topics,
      newValue: current.topics,
      changeSummary: formatDiffSummary('Onderwerpen', topicDiff),
      impactSuggestion: 'Nieuwe onderwerpen kunnen duiden op een veranderende strategie of nieuwe marktsegmenten.',
      recommendedResponse: 'Overweeg of u vergelijkbare onderwerpen moet toevoegen aan uw eigen content.',
    });
  }

  // Compare services
  const currentServices = safeJsonParse<string[]>(current.services) ?? [];
  const previousServices = safeJsonParse<string[]>(previous.services) ?? [];
  const serviceDiff = findAddedOrRemoved(previousServices, currentServices);
  if (serviceDiff.added.length > 0 || serviceDiff.removed.length > 0) {
    changes.push({
      changeType: 'SERVICE_CHANGE',
      url: current.url,
      previousValue: previous.services,
      newValue: current.services,
      changeSummary: formatDiffSummary('Diensten', serviceDiff),
      impactSuggestion: 'Nieuwe of verwijderde diensten kunnen directe concurrentie-impact hebben.',
      recommendedResponse: 'Evalueer of de gewijzigde diensten overlappen met uw aanbod.',
    });
  }

  // Compare locations
  const currentLocations = safeJsonParse<string[]>(current.locations) ?? [];
  const previousLocations = safeJsonParse<string[]>(previous.locations) ?? [];
  const locationDiff = findAddedOrRemoved(previousLocations, currentLocations);
  if (locationDiff.added.length > 0 || locationDiff.removed.length > 0) {
    changes.push({
      changeType: 'LOCATION_CHANGE',
      url: current.url,
      previousValue: previous.locations,
      newValue: current.locations,
      changeSummary: formatDiffSummary('Locaties', locationDiff),
      impactSuggestion: 'Locatiewijzigingen zijn relevant voor lokale SEO en geografische dekking.',
      recommendedResponse: 'Controleer of uw locatie-dekking nog toereikend is.',
    });
  }

  // Compare structured data
  if (current.structuredData !== previous.structuredData) {
    const currentSD = safeJsonParse<unknown[]>(current.structuredData) ?? [];
    const previousSD = safeJsonParse<unknown[]>(previous.structuredData) ?? [];
    if (JSON.stringify(currentSD) !== JSON.stringify(previousSD)) {
      changes.push({
        changeType: 'STRUCTURED_DATA_CHANGE',
        url: current.url,
        previousValue: previous.structuredData,
        newValue: current.structuredData,
        changeSummary: 'Gestructureerde data is gewijzigd op deze pagina.',
        impactSuggestion: 'Wijzigingen in gestructureerde data beïnvloeden rich results en AI-interpreteerbaarheid.',
        recommendedResponse: 'Controleer of uw eigen gestructureerde data up-to-date is.',
      });
    }
  }

  // Compare internal links
  const currentLinks = safeJsonParse<{ count: number }>(current.internalLinks) ?? { count: 0 };
  const previousLinks = safeJsonParse<{ count: number }>(previous.internalLinks) ?? { count: 0 };
  if (Math.abs((currentLinks.count ?? 0) - (previousLinks.count ?? 0)) > 5) {
    changes.push({
      changeType: 'INTERNAL_LINK_CHANGE',
      url: current.url,
      previousValue: previous.internalLinks,
      newValue: current.internalLinks,
      changeSummary: `Aantal interne links gewijzigd van ${previousLinks.count ?? 0} naar ${currentLinks.count ?? 0}.`,
      impactSuggestion: 'Een significante verandering in interne links beïnvloedt de sitestructuur en paginawicht.',
      recommendedResponse: 'Controleer uw eigen interne linkstructuur voor vergelijkbare optimalisaties.',
    });
  }

  // Compare prices (if publicly visible)
  const currentPrices = safeJsonParse<unknown[]>(current.publicPrices) ?? [];
  const previousPrices = safeJsonParse<unknown[]>(previous.publicPrices) ?? [];
  if (JSON.stringify(currentPrices) !== JSON.stringify(previousPrices) && currentPrices.length > 0) {
    changes.push({
      changeType: 'PRICE_CHANGE',
      url: current.url,
      previousValue: previous.publicPrices,
      newValue: current.publicPrices,
      changeSummary: 'Prijswijzigingen gedetecteerd op de website van de concurrent.',
      impactSuggestion: 'Prijswijzigingen bij concurrenten beïnvloeden uw prijspositie.',
      recommendedResponse: 'Evalueer of uw eigen prijsstelling concurrentiekrachtig blijft.',
    });
  }

  // Save detected changes to database
  const competitor = await db.competitor.findUnique({
    where: { id: competitorId },
    select: { projectId: true },
  });

  if (!competitor) return [];

  const savedChanges = await Promise.all(
    changes.map((change) =>
      db.competitorChange.create({
        data: {
          competitorId,
          projectId: competitor.projectId,
          changeType: change.changeType,
          url: change.url,
          previousValue: change.previousValue,
          newValue: change.newValue,
          changeSummary: change.changeSummary,
          impactSuggestion: change.impactSuggestion,
          recommendedResponse: change.recommendedResponse,
        },
      })
    )
  );

  return savedChanges;
}

// ============================================================================
// Content Extraction Helpers
// ============================================================================

/**
 * Extract topics from content based on keyword patterns.
 */
function extractTopics(content: string): string[] | null {
  if (!content || content.length < 50) return null;

  const topics: string[] = [];

  const topicPatterns = [
    /(?:onze expertise|onze specialiteiten|we bieden|wij bieden|onze diensten)[:\s]*([^\n.]+)/gi,
    /(?:gespecialiseerd in|expert in|specialist in)[:\s]*([^\n.]+)/gi,
  ];

  for (const pattern of topicPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const extracted = match[1]?.trim();
      if (extracted && extracted.length > 2 && extracted.length < 200) {
        topics.push(extracted);
      }
    }
  }

  return topics.length > 0 ? topics : null;
}

/**
 * Extract service names from content.
 */
function extractServices(content: string): string[] | null {
  if (!content || content.length < 50) return null;

  const services: string[] = [];

  const servicePatterns = [
    /(?:dienst|service|behandeling|consult)[:\s]+([^\n,;]{3,80})/gi,
    /(?:we bieden|wij bieden|onze diensten omvatten)[:\s]*([^\n.]+)/gi,
  ];

  for (const pattern of servicePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const extracted = match[1]?.trim();
      if (extracted && extracted.length > 2 && extracted.length < 200) {
        services.push(extracted);
      }
    }
  }

  return services.length > 0 ? services : null;
}

/**
 * Extract location mentions from content.
 */
function extractLocations(content: string): string[] | null {
  if (!content || content.length < 50) return null;

  const locations: string[] = [];

  const locationPatterns = [
    /(?:in|te|bij|vanuit)\s+([A-Z][a-zäëïöüéèêA-Z\s-]{2,30})/g,
    /(?:locatie|vestiging|kantoor|praktijk)\s*(?:in|te)?\s*([A-Z][a-zäëïöüéèêA-Z\s-]{2,30})/gi,
  ];

  for (const pattern of locationPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const extracted = match[1]?.trim();
      if (extracted && extracted.length > 2 && extracted.length < 60) {
        locations.push(extracted);
      }
    }
  }

  // Deduplicate
  const unique = [...new Set(locations.map((l) => l.toLowerCase()))];
  return unique.length > 0 ? unique : null;
}

/**
 * Extract price information from content.
 * Only extracts what is publicly visible on the page.
 */
function extractPrices(content: string): unknown[] | null {
  if (!content) return null;

  const prices: Array<{ amount: string; context: string }> = [];

  const pricePatterns = [
    /€\s*(\d+(?:[.,]\d{2})?)/g,
    /(\d+(?:[.,]\d{2})?)\s*(?:euro|EUR)/gi,
    /(?:vanaf|van|prijs|kosten|tarief)[:\s]*€?\s*(\d+(?:[.,]\d{2})?)/gi,
  ];

  for (const pattern of pricePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(content.length, match.index + match[0].length + 30);
      prices.push({
        amount: match[1] ?? match[0],
        context: content.slice(start, end),
      });
    }
  }

  return prices.length > 0 ? prices : null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Safely parse a JSON string, returning null if invalid.
 */
function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Find items added and removed between two string arrays.
 */
function findAddedOrRemoved(
  previous: string[],
  current: string[]
): { added: string[]; removed: string[] } {
  const prevSet = new Set(previous.map((s) => s.toLowerCase()));
  const currSet = new Set(current.map((s) => s.toLowerCase()));

  const added = current.filter((s) => !prevSet.has(s.toLowerCase()));
  const removed = previous.filter((s) => !currSet.has(s.toLowerCase()));

  return { added, removed };
}

/**
 * Format a diff summary in Dutch.
 */
function formatDiffSummary(
  label: string,
  diff: { added: string[]; removed: string[] }
): string {
  const parts: string[] = [];
  if (diff.added.length > 0) {
    parts.push(`${diff.added.length} nieuw(e): ${diff.added.slice(0, 3).join(', ')}${diff.added.length > 3 ? '...' : ''}`);
  }
  if (diff.removed.length > 0) {
    parts.push(`${diff.removed.length} verwijderd: ${diff.removed.slice(0, 3).join(', ')}${diff.removed.length > 3 ? '...' : ''}`);
  }
  return `${label} gewijzigd — ${parts.join('; ')}.`;
}
