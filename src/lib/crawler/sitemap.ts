/**
 * Sitemap Parser Module
 *
 * Parses XML sitemaps and sitemap indexes, supporting
 * recursive fetching of nested sitemap structures.
 */

/** Timeout for fetching sitemap files in milliseconds */
const SITEMAP_FETCH_TIMEOUT_MS = 15_000;

/** Maximum recursion depth for sitemap index resolution */
const MAX_SITEMAP_DEPTH = 3;

/** Maximum number of URLs to collect from all sitemaps */
const MAX_SITEMAP_URLS = 50_000;

/**
 * Represents a URL entry from a sitemap.
 */
export interface SitemapUrl {
  /** The URL of the page */
  loc: string;
  /** Last modification date (ISO 8601 string) */
  lastmod?: string;
  /** How frequently the page is expected to change */
  changefreq?: string;
  /** Priority of this URL relative to others (0.0 to 1.0) */
  priority?: number;
}

/**
 * Parses an XML sitemap and extracts URL entries.
 *
 * Supports the standard sitemap protocol as defined by
 * sitemaps.org, including <url>, <loc>, <lastmod>,
 * <changefreq>, and <priority> elements.
 *
 * @param xml - The raw XML content of a sitemap
 * @returns Array of parsed sitemap URL entries
 */
export function parseSitemapXml(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = [];
  if (!xml || typeof xml !== 'string') return urls;

  // Simple XML parsing without DOM dependency
  // Extract all <url> blocks
  const urlBlocks = extractXmlBlocks(xml, 'url');

  for (const block of urlBlocks) {
    const loc = extractXmlValue(block, 'loc');
    if (!loc) continue;

    const url: SitemapUrl = { loc: loc.trim() };

    const lastmod = extractXmlValue(block, 'lastmod');
    if (lastmod) url.lastmod = lastmod.trim();

    const changefreq = extractXmlValue(block, 'changefreq');
    if (changefreq) url.changefreq = changefreq.trim();

    const priority = extractXmlValue(block, 'priority');
    if (priority) {
      const p = parseFloat(priority);
      if (!isNaN(p) && p >= 0 && p <= 1) {
        url.priority = p;
      }
    }

    urls.push(url);
  }

  return urls;
}

/**
 * Parses a sitemap index file and returns the URLs of
 * child sitemaps.
 *
 * @param xml - The raw XML content of a sitemap index
 * @returns Array of sitemap URLs from the index
 */
export function parseSitemapIndex(xml: string): string[] {
  const sitemaps: string[] = [];
  if (!xml || typeof xml !== 'string') return sitemaps;

  const sitemapBlocks = extractXmlBlocks(xml, 'sitemap');

  for (const block of sitemapBlocks) {
    const loc = extractXmlValue(block, 'loc');
    if (loc) {
      sitemaps.push(loc.trim());
    }
  }

  return sitemaps;
}

/**
 * Fetches and parses a sitemap URL, handling sitemap indexes
 * recursively. If the URL points to a sitemap index, all
 * child sitemaps are fetched and parsed.
 *
 * @param url - The URL of the sitemap or sitemap index
 * @param depth - Current recursion depth (default 0)
 * @returns Array of all SitemapUrl entries from the sitemap(s)
 */
export async function fetchSitemapUrls(
  url: string,
  depth: number = 0
): Promise<SitemapUrl[]> {
  if (depth > MAX_SITEMAP_DEPTH) return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SITEMAP_FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'SEOCoach-Bot/1.0',
        'Accept': 'application/xml, text/xml, */*',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const contentType = response.headers.get('content-type') ?? '';
    if (
      !contentType.includes('xml') &&
      !contentType.includes('text/plain') &&
      !contentType.includes('octet-stream')
    ) {
      // Still try to parse; some servers send wrong content-type
    }

    const xml = await response.text();

    // Check if it's a sitemap index
    if (isSitemapIndex(xml)) {
      const indexUrls = parseSitemapIndex(xml);
      const allUrls: SitemapUrl[] = [];

      for (const sitemapUrl of indexUrls) {
        if (allUrls.length >= MAX_SITEMAP_URLS) break;

        const childUrls = await fetchSitemapUrls(sitemapUrl, depth + 1);
        allUrls.push(...childUrls.slice(0, MAX_SITEMAP_URLS - allUrls.length));
      }

      return allUrls;
    }

    // Regular sitemap
    return parseSitemapXml(xml);
  } catch {
    return [];
  }
}

/**
 * Determines whether an XML document is a sitemap index
 * (as opposed to a regular URL sitemap).
 */
function isSitemapIndex(xml: string): boolean {
  // A sitemap index uses <sitemapindex> as root element
  // while a regular sitemap uses <urlset>
  const stripped = xml.replace(/<\?xml[^?]*\?>/g, '').trim();
  return stripped.startsWith('<sitemapindex') || stripped.includes('<sitemapindex');
}

/**
 * Extracts all blocks of a given XML element from the content.
 *
 * For example, extractXmlBlocks(xml, 'url') returns an array
 * of the inner content of each <url>...</url> element.
 */
function extractXmlBlocks(xml: string, tagName: string): string[] {
  const blocks: string[] = [];
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;

  let searchStart = 0;

  while (searchStart < xml.length) {
    const openIdx = xml.indexOf(openTag, searchStart);
    if (openIdx < 0) break;

    // Find the end of the opening tag (could have attributes or be self-closing)
    const tagEndIdx = xml.indexOf('>', openIdx);
    if (tagEndIdx < 0) break;

    // Self-closing tag
    if (xml[tagEndIdx - 1] === '/') {
      blocks.push('');
      searchStart = tagEndIdx + 1;
      continue;
    }

    const closeIdx = xml.indexOf(closeTag, tagEndIdx);
    if (closeIdx < 0) break;

    blocks.push(xml.substring(tagEndIdx + 1, closeIdx));
    searchStart = closeIdx + closeTag.length;
  }

  return blocks;
}

/**
 * Extracts the text content of an XML element.
 *
 * Handles namespace prefixes (e.g., <ns:loc>) and
 * returns the trimmed text content.
 */
function extractXmlValue(xml: string, tagName: string): string | null {
  // Try with namespace prefix (e.g., <ns:loc>)
  const nsMatch = xml.match(new RegExp(`<[^:>]*:${tagName}[^>]*>([^<]*)</[^:>]*:${tagName}>`));
  if (nsMatch) return nsMatch[1].trim();

  // Standard match
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`));
  return match ? match[1].trim() : null;
}
