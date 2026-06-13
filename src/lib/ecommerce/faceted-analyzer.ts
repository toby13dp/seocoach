// ============================================================================
// Faceted Analyzer — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Analysis of faceted navigation issues in e-commerce sites. Detects:
//   - URLs with query parameters creating duplicate content
//   - Faceted pages with thin content
//   - Pagination without proper canonical tags
//   - Parameter-based URLs that should be noindexed
//
// Issues are detected from crawled Page data and stored in the
// FacetedNavigationIssue model. All messages are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import type { FacetedNavigationResult } from './types';

// ---------------------------------------------------------------------------
// Common facet parameter names
// ---------------------------------------------------------------------------

const FACET_PARAMETERS = [
  'color', 'kleur', 'size', 'maat', 'brand', 'merk',
  'price', 'prijs', 'material', 'materiaal', 'style', 'stijl',
  'category', 'categorie', 'filter', 'sort', 'order',
  'page', 'p', 'pag', 'pagina',
  'min_price', 'max_price', 'min_prijs', 'max_prijs',
  'availability', 'beschikbaarheid', 'rating', 'beoordeling',
];

// ---------------------------------------------------------------------------
// Detect faceted navigation issues from crawled pages
// ---------------------------------------------------------------------------

/**
 * Analyze a project's crawled pages to detect faceted navigation issues.
 * Looks at Page data to identify:
 *   1. Duplicate content from parameter-based URLs
 *   2. Thin content on faceted pages
 *   3. Missing canonical on paginated URLs
 *   4. Parameter URLs that should be noindexed
 */
export async function analyzeFacetedNavigation(
  projectId: string,
): Promise<FacetedNavigationResult[]> {
  const issues: FacetedNavigationResult[] = [];

  // Fetch crawled pages with query parameters
  const pagesWithParams = await db.page.findMany({
    where: {
      projectId,
      deletedAt: null,
      url: { contains: '?' },
    },
    select: {
      id: true,
      url: true,
      wordCount: true,
      canonicalUrl: true,
      indexability: true,
      metaRobots: true,
      contentHash: true,
    },
  });

  // Fetch pages without parameters for comparison (duplicate detection)
  const pagesWithoutParams = await db.page.findMany({
    where: {
      projectId,
      deletedAt: null,
      NOT: { url: { contains: '?' } },
    },
    select: {
      url: true,
      contentHash: true,
    },
  });

  // Build a map of content hashes for duplicate detection
  const hashToUrls = new Map<string, string[]>();
  for (const page of [...pagesWithParams, ...pagesWithoutParams]) {
    if (page.contentHash) {
      if (!hashToUrls.has(page.contentHash)) {
        hashToUrls.set(page.contentHash, []);
      }
      hashToUrls.get(page.contentHash)!.push(page.url);
    }
  }

  // Analyse each page with parameters
  for (const page of pagesWithParams) {
    const urlObj = tryParseUrl(page.url);
    if (!urlObj) continue;

    const params = urlObj.searchParams;
    const paramEntries = Array.from(params.entries());

    // Identify facet parameters
    const facetParams = paramEntries.filter(([key]) =>
      FACET_PARAMETERS.includes(key.toLowerCase()),
    );

    // 1. Duplicate content from parameter-based URLs
    if (page.contentHash && hashToUrls.has(page.contentHash)) {
      const duplicateUrls = hashToUrls.get(page.contentHash)!;
      if (duplicateUrls.length > 1) {
        // Find the canonical (non-parameter) URL
        const canonicalUrl = duplicateUrls.find((u) => !u.includes('?')) ?? duplicateUrls[0];
        const facetParam = facetParams[0];

        issues.push({
          url: page.url,
          issueType: 'duplicate_content',
          severity: 'error',
          description: `Deze facet-URL heeft identieke inhoud als ${duplicateUrls.length - 1} andere URL(s). Dit veroorzaakt dubbele content.`,
          recommendation: 'Stel een canonical URL in die verwijst naar de hoofdpagina, of voeg een noindex tag toe.',
          parameterName: facetParam?.[0],
          parameterValue: facetParam?.[1],
          canonicalUrl,
        });
      }
    }

    // 2. Thin content on faceted pages
    if (page.wordCount < 100 && facetParams.length > 0) {
      const facetParam = facetParams[0];
      issues.push({
        url: page.url,
        issueType: 'thin_content',
        severity: 'warning',
        description: `Facet-pagina bevat weinig content (${page.wordCount} woorden). Dit kan als dunne content worden gezien.`,
        recommendation: 'Voeg beschrijvende content toe aan facet-pagina\'s of sluit ze uit van indexering met noindex.',
        parameterName: facetParam?.[0],
        parameterValue: facetParam?.[1],
      });
    }

    // 3. Pagination without proper canonical
    const isPagination = params.has('page') || params.has('p') || params.has('pag') || params.has('pagina');
    if (isPagination && !page.canonicalUrl) {
      issues.push({
        url: page.url,
        issueType: 'crawled_facet',
        severity: 'warning',
        description: 'Paginering-URL zonder canonical tag. Dit kan leiden tot onnodige crawling en indexering.',
        recommendation: 'Voeg een canonical tag toe aan gepagineerde URL\'s die verwijst naar de huidige pagina (self-referencing canonical).',
        parameterName: params.has('page') ? 'page' : params.has('p') ? 'p' : params.has('pag') ? 'pag' : 'pagina',
        parameterValue: params.get('page') ?? params.get('p') ?? params.get('pag') ?? params.get('pagina') ?? undefined,
      });
    }

    // 4. Parameter URLs that should be noindexed
    if (
      facetParams.length > 0 &&
      page.indexability === 'INDEXABLE' &&
      (!page.metaRobots || !page.metaRobots.includes('noindex'))
    ) {
      // Don't flag if this is the only page with these params
      // (it might be a valid landing page)
      const isSortOrFilter = facetParams.some(([key]) =>
        ['sort', 'order', 'filter', 'price', 'prijs', 'min_price', 'max_price', 'rating'].includes(key.toLowerCase()),
      );

      if (isSortOrFilter) {
        issues.push({
          url: page.url,
          issueType: 'noindex_needed',
          severity: 'warning',
          description: 'Sorteer- of filter-URL is indexeerbaar. Deze pagina\'s voegen geen waarde toe in zoekresultaten.',
          recommendation: 'Voeg een noindex tag toe aan sorteer- en filter-URL\'s om crawling budget te besparen.',
          parameterName: facetParams[0]?.[0],
          parameterValue: facetParams[0]?.[1],
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// URL Parsing Helper
// ---------------------------------------------------------------------------

function tryParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Save Faceted Navigation Issues
// ---------------------------------------------------------------------------

/**
 * Save detected faceted navigation issues to the database.
 * Returns the number of issues saved.
 */
export async function saveFacetedIssues(
  projectId: string,
  issues: FacetedNavigationResult[],
): Promise<number> {
  if (issues.length === 0) return 0;

  const createPromises = issues.map((issue) =>
    db.facetedNavigationIssue.create({
      data: {
        projectId,
        url: issue.url,
        issueType: issue.issueType,
        severity: issue.severity,
        description: issue.description,
        recommendation: issue.recommendation,
        parameterName: issue.parameterName,
        parameterValue: issue.parameterValue,
        canonicalUrl: issue.canonicalUrl,
      },
    }),
  );

  await Promise.all(createPromises);
  return issues.length;
}

// ---------------------------------------------------------------------------
// Get Faceted Navigation Issues
// ---------------------------------------------------------------------------

/**
 * Retrieve existing faceted navigation issues with optional filters.
 */
export async function getFacetedIssues(
  projectId: string,
  filters?: {
    issueType?: string;
    severity?: string;
    isResolved?: boolean;
  },
) {
  const where: Record<string, unknown> = {
    projectId,
  };

  if (filters?.issueType) {
    where.issueType = filters.issueType;
  }

  if (filters?.severity) {
    where.severity = filters.severity;
  }

  if (filters?.isResolved !== undefined) {
    where.isResolved = filters.isResolved;
  }

  return db.facetedNavigationIssue.findMany({
    where,
    orderBy: { detectedAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Resolve a Faceted Navigation Issue
// ---------------------------------------------------------------------------

/**
 * Mark a faceted navigation issue as resolved.
 * Verifies projectId for tenant isolation.
 */
export async function resolveFacetedIssue(
  issueId: string,
  projectId: string,
) {
  const existing = await db.facetedNavigationIssue.findFirst({
    where: { id: issueId, projectId },
  });

  if (!existing) {
    throw new Error('Facet-navigatie probleem niet gevonden of geen toegang.');
  }

  return db.facetedNavigationIssue.update({
    where: { id: issueId },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
    },
  });
}
