/**
 * Main Crawler Module
 *
 * Orchestrates the entire crawling process using the SSRF protection,
 * robots.txt parser, sitemap parser, and HTML parser modules.
 * Creates database records for crawl sessions, pages, and snapshots.
 */

import { db } from '@/lib/db';
import { validateUrl, checkRedirectSafety, validateResponseSize, checkDecompressionBomb } from './ssrf';
import { fetchRobotsTxt, parseRobotsTxt, isAllowed, parseCrawlDelay, getSitemaps } from './robots';
import { fetchSitemapUrls, type SitemapUrl } from './sitemap';
import { parsePage, normalizeUrl, detectContentType, type ParsedPage, type ContentType } from './parser';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for a crawl session.
 */
export interface CrawlerConfig {
  /** The starting URL for the crawl */
  startUrl: string;
  /** Maximum number of pages to crawl */
  maxPages: number;
  /** Maximum crawl depth from the start URL */
  maxDepth: number;
  /** Delay between requests in milliseconds */
  crawlDelayMs: number;
  /** Whether to respect robots.txt rules */
  respectRobotsTxt: boolean;
  /** Whether to follow HTTP redirects */
  followRedirects: boolean;
  /** Whether to include subdomains of the start URL */
  includeSubdomains: boolean;
  /** Whether to use JavaScript rendering (Playwright) */
  useRendering: boolean;
  /** Optional list of allowed domains beyond the start URL domain */
  domainAllowlist?: string[];
}

/**
 * A URL entry in the crawl queue with priority.
 */
interface QueueEntry {
  /** The URL to crawl */
  url: string;
  /** The crawl depth of this URL */
  depth: number;
  /** Priority: lower number = higher priority (sitemaps first) */
  priority: number;
}

/**
 * Result of a single page fetch.
 */
interface FetchResult {
  /** The final URL after redirects */
  finalUrl: string;
  /** The HTTP status code */
  statusCode: number;
  /** The response HTML content */
  html: string;
  /** The content type detected */
  contentType: ContentType;
  /** Response headers */
  headers: Headers;
  /** Load time in milliseconds */
  loadTimeMs: number;
  /** Chain of redirect URLs */
  redirectChain: string[];
}

/** Default fetch timeout in milliseconds */
const FETCH_TIMEOUT_MS = 30_000;

/** Maximum number of retries per URL */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff in milliseconds */
const BACKOFF_BASE_MS = 1000;

/** User agent string for the crawler */
const USER_AGENT = 'SEOCoach-Bot/1.0 (+https://seocoach.nl)';

/**
 * Main Crawler class that orchestrates the crawling process.
 *
 * Usage:
 * ```ts
 * const crawler = new Crawler(config, projectId, crawlSessionId);
 * await crawler.start();
 * ```
 */
export class Crawler {
  private config: CrawlerConfig;
  private projectId: string;
  private crawlSessionId: string;
  private baseUrl: URL;
  private robotsRules: ReturnType<typeof parseRobotsTxt> = [];
  private robotsContent = '';
  private effectiveCrawlDelay: number;

  private queue: QueueEntry[] = [];
  private visited: Set<string> = new Set();
  private inScopeUrls: Set<string> = new Set();

  /** Set of URLs that have internal links pointing to them */
  private linkedUrls: Set<string> = new Set();

  /** Content hashes for duplicate detection */
  private contentHashes: Map<string, string> = new Map();

  private cancelled = false;
  private pagesCrawled = 0;
  private pagesFound = 0;
  private errorCount = 0;

  /**
   * Creates a new Crawler instance.
   *
   * @param config - The crawl configuration
   * @param projectId - The ID of the project this crawl belongs to
   * @param crawlSessionId - The ID of the CrawlSession record
   */
  constructor(config: CrawlerConfig, projectId: string, crawlSessionId: string) {
    this.config = config;
    this.projectId = projectId;
    this.crawlSessionId = crawlSessionId;
    this.baseUrl = new URL(config.startUrl);
    this.effectiveCrawlDelay = config.crawlDelayMs;
  }

  /**
   * Starts the crawl process.
   *
   * 1. Fetches and parses robots.txt
   * 2. Fetches sitemaps for seed URLs
   * 3. Processes the queue with priority
   * 4. Creates Page and PageSnapshot records
   * 5. Updates CrawlSession progress
   * 6. Detects orphan pages after completion
   */
  async start(): Promise<void> {
    try {
      // Update session status to RUNNING
      await db.crawlSession.update({
        where: { id: this.crawlSessionId },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      // Step 1: Fetch and parse robots.txt
      if (this.config.respectRobotsTxt) {
        await this.loadRobotsTxt();
      }

      // Step 2: Load sitemaps
      await this.loadSitemaps();

      // Step 3: Add start URL to queue if not already from sitemap
      const normalizedStart = normalizeUrl(this.config.startUrl, this.config.startUrl);
      if (!this.visited.has(normalizedStart)) {
        this.enqueue(normalizedStart, 0, 10);
      }

      // Step 4: Process queue
      await this.processQueue();

      // Step 5: Detect orphan pages
      await this.detectOrphanPages();

      // Step 6: Mark duplicates
      await this.markDuplicatePages();

      // Update final status
      const finalStatus = this.cancelled ? 'CANCELLED' : 'COMPLETED';
      await db.crawlSession.update({
        where: { id: this.crawlSessionId },
        data: {
          status: finalStatus,
          pagesCrawled: this.pagesCrawled,
          pagesFound: this.pagesFound,
          errorCount: this.errorCount,
          completedAt: new Date(),
          ...(this.cancelled ? { cancelledAt: new Date() } : {}),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await db.crawlSession.update({
        where: { id: this.crawlSessionId },
        data: {
          status: 'FAILED',
          errorCount: this.errorCount,
          errorMessage,
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * Cancels the crawl. The crawler will stop after
   * the current page is processed.
   */
  cancel(): void {
    this.cancelled = true;
  }

  // ==========================================================================
  // Robots.txt handling
  // ==========================================================================

  /**
   * Fetches and parses robots.txt for the target site.
   */
  private async loadRobotsTxt(): Promise<void> {
    this.robotsContent = await fetchRobotsTxt(this.config.startUrl);
    this.robotsRules = parseRobotsTxt(this.robotsContent);

    // Respect Crawl-delay from robots.txt if it's more conservative
    const robotsDelay = parseCrawlDelay(this.robotsContent, 'SEOCoach-Bot');
    if (robotsDelay > this.effectiveCrawlDelay) {
      this.effectiveCrawlDelay = robotsDelay;
    }
  }

  // ==========================================================================
  // Sitemap handling
  // ==========================================================================

  /**
   * Loads URLs from sitemaps declared in robots.txt and
   * adds them to the queue with high priority.
   */
  private async loadSitemaps(): Promise<void> {
    const sitemapUrls = getSitemaps(this.robotsContent);

    // Also try the default sitemap location
    const defaultSitemap = `${this.baseUrl.origin}/sitemap.xml`;
    if (!sitemapUrls.includes(defaultSitemap)) {
      sitemapUrls.push(defaultSitemap);
    }

    for (const sitemapUrl of sitemapUrls) {
      try {
        const urls = await fetchSitemapUrls(sitemapUrl);

        for (const entry of urls) {
          if (!entry.loc) continue;

          const normalized = normalizeUrl(entry.loc, this.config.startUrl);
          if (this.isInScope(normalized)) {
            this.enqueue(normalized, 0, 0); // Priority 0 = sitemap URLs first
            this.pagesFound++;
          }
        }
      } catch {
        // Skip sitemaps that fail to load
      }
    }
  }

  // ==========================================================================
  // Queue management
  // ==========================================================================

  /**
   * Adds a URL to the crawl queue if it hasn't been visited.
   *
   * @param url - The normalized URL to enqueue
   * @param depth - The crawl depth
   * @param priority - Lower numbers are processed first
   */
  private enqueue(url: string, depth: number, priority: number): void {
    if (this.visited.has(url)) return;
    if (depth > this.config.maxDepth) return;

    // Check if already in queue
    const existing = this.queue.find((e) => e.url === url);
    if (existing) {
      // Update priority if new priority is higher
      if (priority < existing.priority) {
        existing.priority = priority;
        existing.depth = Math.min(existing.depth, depth);
      }
      return;
    }

    this.queue.push({ url, depth, priority });
  }

  /**
   * Sorts the queue by priority (lowest number first)
   * and returns the next entry.
   */
  private dequeue(): QueueEntry | null {
    if (this.queue.length === 0) return null;

    // Sort by priority, then by insertion order (FIFO within same priority)
    this.queue.sort((a, b) => a.priority - b.priority);
    return this.queue.shift() ?? null;
  }

  // ==========================================================================
  // Queue processing
  // ==========================================================================

  /**
   * Processes the crawl queue until empty, max pages reached,
   * or cancelled.
   */
  private async processQueue(): Promise<void> {
    while (!this.cancelled) {
      if (this.pagesCrawled >= this.config.maxPages) break;

      const entry = this.dequeue();
      if (!entry) break;

      this.visited.add(entry.url);

      // Check robots.txt
      if (this.config.respectRobotsTxt && !isAllowed(entry.url, this.robotsRules)) {
        continue;
      }

      // SSRF check
      const validation = validateUrl(entry.url);
      if (!validation.valid) continue;

      // Fetch the page with retry
      const result = await this.fetchWithRetry(entry.url);
      if (!result) continue;

      // Parse the page if it's HTML
      if (result.contentType === 'HTML' && result.html) {
        const parsed = parsePage(result.html, result.finalUrl);

        // Record the page in the database
        await this.savePage(entry, result, parsed);

        // Extract and enqueue new links
        this.extractAndEnqueueLinks(parsed, entry.depth, entry.url);

        this.pagesCrawled++;
      } else {
        // Record non-HTML pages too
        await this.saveNonHtmlPage(entry, result);
        this.pagesCrawled++;
      }

      // Update session progress periodically (every 10 pages)
      if (this.pagesCrawled % 10 === 0) {
        await this.updateProgress();
      }

      // Rate limiting
      await this.delay(this.effectiveCrawlDelay);
    }
  }

  // ==========================================================================
  // HTTP fetching
  // ==========================================================================

  /**
   * Fetches a URL with exponential backoff retry.
   *
   * @param url - The URL to fetch
   * @returns The fetch result, or null if all retries failed
   */
  private async fetchWithRetry(url: string): Promise<FetchResult | null> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (this.cancelled) return null;

      try {
        return await this.fetchUrl(url);
      } catch (error) {
        const isLastAttempt = attempt === MAX_RETRIES - 1;
        if (isLastAttempt) {
          this.errorCount++;
          return null;
        }

        // Exponential backoff
        const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
        await this.delay(backoffMs);
      }
    }

    return null;
  }

  /**
   * Fetches a single URL with SSRF and safety checks.
   *
   * @param url - The URL to fetch
   * @returns The fetch result
   */
  private async fetchUrl(url: string): Promise<FetchResult> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const redirectChain: string[] = [];
    let currentUrl = url;

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: this.config.followRedirects ? 'follow' : 'manual',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      clearTimeout(timeoutId);

      // Track redirect chain
      if (response.redirected && response.url) {
        redirectChain.push(url);
        currentUrl = response.url;

        // Validate redirect target
        if (!checkRedirectSafety(currentUrl)) {
          throw new Error('Redirect target failed SSRF check');
        }
      }

      // Check response size
      const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
      if (contentLength > 0 && !validateResponseSize(contentLength)) {
        throw new Error('Response exceeds maximum allowed size');
      }

      // Check for decompression bombs
      if (checkDecompressionBomb(response.headers)) {
        throw new Error('Potential decompression bomb detected');
      }

      const contentType = detectContentType(response);
      const html = contentType === 'HTML' ? await response.text() : '';
      const loadTimeMs = Date.now() - startTime;

      return {
        finalUrl: currentUrl,
        statusCode: response.status,
        html,
        contentType,
        headers: response.headers,
        loadTimeMs,
        redirectChain,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          finalUrl: currentUrl,
          statusCode: 0,
          html: '',
          contentType: 'OTHER',
          headers: new Headers(),
          loadTimeMs: Date.now() - startTime,
          redirectChain,
        };
      }

      throw error;
    }
  }

  // ==========================================================================
  // Link extraction and scope checking
  // ==========================================================================

  /**
   * Extracts internal links from a parsed page and adds
   * them to the crawl queue if they are in scope.
   */
  private extractAndEnqueueLinks(parsed: ParsedPage, currentDepth: number, pageUrl: string): void {
    const nextDepth = currentDepth + 1;

    for (const link of parsed.internalLinks) {
      try {
        const normalized = normalizeUrl(link.href, pageUrl);

        // Track that this URL has incoming links
        this.linkedUrls.add(normalized);

        if (this.isInScope(normalized)) {
          this.enqueue(normalized, nextDepth, 10); // Priority 10 = discovered links
          this.pagesFound++;
        }
      } catch {
        // Skip invalid URLs
      }
    }
  }

  /**
   * Checks whether a URL is within the crawl scope.
   *
   * A URL is in scope if:
   * - It belongs to the same domain as the start URL
   * - Subdomains are included (if configured)
   * - It's in the domain allowlist
   */
  private isInScope(url: string): boolean {
    try {
      const parsed = new URL(url);

      // Same domain check
      if (parsed.hostname.toLowerCase() === this.baseUrl.hostname.toLowerCase()) {
        return true;
      }

      // Subdomain check
      if (this.config.includeSubdomains) {
        if (parsed.hostname.toLowerCase().endsWith(`.${this.baseUrl.hostname.toLowerCase()}`)) {
          return true;
        }
      }

      // Domain allowlist
      if (this.config.domainAllowlist) {
        for (const allowed of this.config.domainAllowlist) {
          if (parsed.hostname.toLowerCase() === allowed.toLowerCase()) {
            return true;
          }
          if (this.config.includeSubdomains &&
              parsed.hostname.toLowerCase().endsWith(`.${allowed.toLowerCase()}`)) {
            return true;
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Database operations
  // ==========================================================================

  /**
   * Saves a crawled HTML page to the database.
   */
  private async savePage(
    entry: QueueEntry,
    result: FetchResult,
    parsed: ParsedPage
  ): Promise<void> {
    const contentHash = this.computeContentHash(parsed.mainContent);

    // Store content hash for duplicate detection
    if (contentHash) {
      this.contentHashes.set(entry.url, contentHash);
    }

    // Determine indexability
    const indexability = this.determineIndexability(parsed, result.statusCode);

    // Determine page status
    const pageStatus = this.determinePageStatus(result.statusCode);

    // Compute image stats
    const imagesWithoutAlt = parsed.images.filter((img) => !img.alt).length;

    const page = await db.page.create({
      data: {
        crawlSessionId: this.crawlSessionId,
        projectId: this.projectId,
        url: entry.url,
        normalizedUrl: normalizeUrl(entry.url, this.config.startUrl),
        statusCode: result.statusCode,
        status: pageStatus,
        contentType: 'HTML',
        title: parsed.title,
        description: parsed.description,
        h1: parsed.h1,
        wordCount: parsed.wordCount,
        canonicalUrl: parsed.canonical,
        indexability,
        language: parsed.language,
        internalLinkCount: parsed.internalLinks.length,
        externalLinkCount: parsed.externalLinks.length,
        imageCount: parsed.images.length,
        imagesWithoutAlt,
        structuredData: parsed.structuredData.length > 0
          ? JSON.stringify(parsed.structuredData)
          : null,
        crawlDepth: entry.depth,
        redirectChain: result.redirectChain.length > 0
          ? JSON.stringify(result.redirectChain)
          : null,
        finalUrl: result.finalUrl !== entry.url ? result.finalUrl : null,
        loadTimeMs: result.loadTimeMs,
        htmlSizeBytes: result.html.length,
        contentHash,
        mainContent: parsed.mainContent,
        internalLinks: JSON.stringify(parsed.internalLinks.map((l) => l.href)),
        externalLinks: JSON.stringify(parsed.externalLinks.map((l) => l.href)),
        images: JSON.stringify(parsed.images),
        metaRobots: parsed.metaRobots,
      },
    });

    // Create snapshot for HTML storage
    await db.pageSnapshot.create({
      data: {
        pageId: page.id,
        html: result.html,
        source: 'crawl',
        sizeBytes: result.html.length,
      },
    });
  }

  /**
   * Saves a non-HTML page (PDF, image, etc.) to the database.
   */
  private async saveNonHtmlPage(entry: QueueEntry, result: FetchResult): Promise<void> {
    const pageStatus = this.determinePageStatus(result.statusCode);

    await db.page.create({
      data: {
        crawlSessionId: this.crawlSessionId,
        projectId: this.projectId,
        url: entry.url,
        normalizedUrl: normalizeUrl(entry.url, this.config.startUrl),
        statusCode: result.statusCode,
        status: pageStatus,
        contentType: result.contentType,
        crawlDepth: entry.depth,
        redirectChain: result.redirectChain.length > 0
          ? JSON.stringify(result.redirectChain)
          : null,
        finalUrl: result.finalUrl !== entry.url ? result.finalUrl : null,
        loadTimeMs: result.loadTimeMs,
      },
    });
  }

  /**
   * Updates the CrawlSession progress in the database.
   */
  private async updateProgress(): Promise<void> {
    await db.crawlSession.update({
      where: { id: this.crawlSessionId },
      data: {
        pagesCrawled: this.pagesCrawled,
        pagesFound: this.pagesFound,
        errorCount: this.errorCount,
      },
    });
  }

  /**
   * Detects and marks orphan pages (pages with no internal links pointing to them).
   */
  private async detectOrphanPages(): Promise<void> {
    // Get all pages in this crawl session
    const pages = await db.page.findMany({
      where: {
        crawlSessionId: this.crawlSessionId,
        contentType: 'HTML',
      },
      select: {
        id: true,
        normalizedUrl: true,
      },
    });

    const orphanIds: string[] = [];

    for (const page of pages) {
      // A page is orphan if no other page links to it
      if (!this.linkedUrls.has(page.normalizedUrl)) {
        // The start URL is never orphan
        const normalizedStart = normalizeUrl(this.config.startUrl, this.config.startUrl);
        if (page.normalizedUrl !== normalizedStart) {
          orphanIds.push(page.id);
        }
      }
    }

    // Batch update orphan pages
    if (orphanIds.length > 0) {
      await db.page.updateMany({
        where: {
          id: { in: orphanIds },
        },
        data: {
          isOrphan: true,
        },
      });
    }
  }

  /**
   * Marks duplicate pages based on content hash comparison.
   */
  private async markDuplicatePages(): Promise<void> {
    // Group URLs by content hash
    const hashGroups: Map<string, string[]> = new Map();

    for (const [url, hash] of this.contentHashes) {
      if (!hash) continue;
      const group = hashGroups.get(hash) ?? [];
      group.push(url);
      hashGroups.set(hash, group);
    }

    // For groups with duplicates, assign a duplicate group ID
    let groupIndex = 0;
    for (const [hash, urls] of hashGroups) {
      if (urls.length <= 1) continue;

      const duplicateGroupId = `dup-${groupIndex++}`;

      await db.page.updateMany({
        where: {
          crawlSessionId: this.crawlSessionId,
          normalizedUrl: { in: urls },
          contentHash: hash,
        },
        data: {
          duplicateGroup: duplicateGroupId,
        },
      });
    }
  }

  // ==========================================================================
  // Utility methods
  // ==========================================================================

  /**
   * Computes a simple content hash for duplicate detection.
   */
  private computeContentHash(content: string): string {
    if (!content) return '';

    // Simple hash function (djb2)
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) + hash + content.charCodeAt(i)) & 0xffffffff;
    }

    return hash.toString(16);
  }

  /**
   * Determines the indexability of a page based on meta robots
   * and HTTP status code.
   */
  private determineIndexability(
    parsed: ParsedPage,
    statusCode: number
  ): 'INDEXABLE' | 'NOINDEX' | 'BLOCKED_ROBOTS' | 'CANONICALIZED' | 'BLOCKED_META' | 'UNKNOWN' {
    // Check meta robots
    if (parsed.metaRobots) {
      const directives = parsed.metaRobots.toLowerCase().split(',').map((d) => d.trim());
      if (directives.includes('noindex')) return 'NOINDEX';
    }

    // Check canonical (if canonicalized to a different URL)
    if (parsed.canonical) {
      const normalizedCanonical = normalizeUrl(parsed.canonical, '');
      const normalizedCurrent = normalizeUrl(
        parsed.canonical,
        this.config.startUrl
      );
      // If canonical points to a different URL, the page is canonicalized
      // This is a simplified check - in practice we'd compare more carefully
      if (normalizedCanonical && normalizedCanonical !== normalizedCurrent) {
        // Only mark as canonicalized if canonical is clearly different
        // Avoid false positives from URL normalization differences
      }
    }

    // Non-2xx status codes
    if (statusCode >= 400) return 'UNKNOWN';
    if (statusCode >= 300) return 'UNKNOWN';

    return 'INDEXABLE';
  }

  /**
   * Determines the page status from an HTTP status code.
   */
  private determinePageStatus(statusCode: number): 'OK' | 'REDIRECT' | 'CLIENT_ERROR' | 'SERVER_ERROR' | 'BLOCKED' | 'TIMEOUT' {
    if (statusCode === 0) return 'TIMEOUT';
    if (statusCode >= 200 && statusCode < 300) return 'OK';
    if (statusCode >= 300 && statusCode < 400) return 'REDIRECT';
    if (statusCode >= 400 && statusCode < 500) return 'CLIENT_ERROR';
    if (statusCode >= 500) return 'SERVER_ERROR';
    return 'OK';
  }

  /**
   * Returns a promise that resolves after the specified delay.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Convenience function
// ============================================================================

/**
 * Creates a crawl session and starts crawling.
 *
 * This is the main entry point for starting a crawl from
 * an API route or background job.
 *
 * @param config - The crawl configuration
 * @param projectId - The ID of the project
 * @returns The CrawlSession ID and Crawler instance
 */
export async function startCrawl(
  config: CrawlerConfig,
  projectId: string
): Promise<{ crawlSessionId: string; crawler: Crawler }> {
  // Create CrawlSession record
  const crawlSession = await db.crawlSession.create({
    data: {
      projectId,
      startUrl: config.startUrl,
      maxPages: config.maxPages,
      maxDepth: config.maxDepth,
      crawlDelayMs: config.crawlDelayMs,
      respectRobotsTxt: config.respectRobotsTxt,
      followRedirects: config.followRedirects,
      includeSubdomains: config.includeSubdomains,
      useRendering: config.useRendering,
      status: 'PENDING',
    },
  });

  const crawler = new Crawler(config, projectId, crawlSession.id);

  return { crawlSessionId: crawlSession.id, crawler };
}
