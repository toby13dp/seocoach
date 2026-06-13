# Task 2: Crawler Engine Library

## Agent: Crawler Engine Builder

## Task: Build Safe Crawler engine for SEOCoach

### Files Created

1. **`/home/z/my-project/src/lib/crawler/ssrf.ts`** - SSRF Protection Module
   - `isPrivateIP()` - Blocks RFC 1918, loopback, link-local, IPv6 unique-local/link-local
   - `isCloudMetadata()` - Blocks 169.254.169.254 and metadata endpoints
   - `isAllowedProtocol()` - Only allows http: and https:
   - `validateUrl()` - Comprehensive URL validation combining all SSRF checks
   - `checkRedirectSafety()` - Ensures redirects don't go to private IPs
   - `validateResponseSize()` - Max 10MB response size check
   - `checkDecompressionBomb()` - Detects suspicious content-encoding ratios
   - Internal helpers: `expandIPv6()`, `isIPv4()`, `isIPv6()`

2. **`/home/z/my-project/src/lib/crawler/robots.ts`** - robots.txt Parser Module
   - `fetchRobotsTxt()` - Fetches robots.txt with timeout and error handling
   - `parseRobotsTxt()` - Parses into RobotsRule[] with user-agent groups
   - `isAllowed()` - Longest-match strategy per RFC 9309, Allow precedence
   - `getCrawlDelay()` - Returns crawl delay from rules
   - `parseCrawlDelay()` - Extracts Crawl-delay from raw content with 60s cap
   - `getSitemaps()` - Extracts Sitemap: directives
   - Internal: `pathMatchesPattern()` - Supports wildcards and $ anchors

3. **`/home/z/my-project/src/lib/crawler/sitemap.ts`** - Sitemap Parser Module
   - `parseSitemapXml()` - Parses XML sitemap into SitemapUrl[] (loc, lastmod, changefreq, priority)
   - `parseSitemapIndex()` - Parses sitemap index into child URL list
   - `fetchSitemapUrls()` - Recursive fetching with depth limit (3) and URL cap (50k)
   - Internal: `isSitemapIndex()`, `extractXmlBlocks()`, `extractXmlValue()` - No DOM dependency

4. **`/home/z/my-project/src/lib/crawler/parser.ts`** - HTML Parser Module
   - `parsePage()` - Extracts all SEO data: title, description, h1, canonical, meta robots, hreflang, OG tags, JSON-LD, headings, internal/external links, images, main content, language, word count
   - `extractMainContent()` - Strips nav/footer/aside/header, prioritizes <main>/<article>
   - `extractStructuredData()` - Extracts all JSON-LD blocks
   - `normalizeUrl()` - Removes fragments, sorts params, trailing slash normalization
   - `detectContentType()` - Maps Content-Type header + URL extension to ContentType enum
   - Types: `ContentType`, `ExtractedLink`, `ExtractedImage`, `HeadingEntry`, `ParsedPage`

5. **`/home/z/my-project/src/lib/crawler/crawler.ts`** - Main Crawler
   - `Crawler` class with full crawl orchestration
   - Constructor: `CrawlerConfig` + projectId + crawlSessionId
   - `start()` - Full pipeline: robots.txt → sitemaps → queue processing → orphan detection → dedup
   - `cancel()` - Sets cancelled flag for graceful shutdown
   - Priority queue: sitemaps (0) > discovered links (10)
   - Set-based URL deduplication
   - Exponential backoff retry (max 3, base 1s)
   - Rate limiting with configurable + robots.txt Crawl-delay
   - Database: Creates CrawlSession, Page, PageSnapshot records
   - Progress updates every 10 pages
   - Content hash (djb2) for duplicate detection
   - Orphan page detection post-crawl
   - `startCrawl()` convenience function
   - Uses `fetch` for HTTP (no Playwright dependency)
   - Compatible with SQLite via Prisma

6. **`/home/z/my-project/src/lib/crawler/index.ts`** - Barrel Export
   - Re-exports all types, interfaces, and functions from all modules
   - Renames `isAllowed` → `isRobotsAllowed` to avoid name collision

### Design Decisions
- **No DOM dependency**: All HTML parsing uses regex-based extraction (lighter weight, no server-side DOM library needed)
- **Fetch-based**: Uses native `fetch` API, no Playwright dependency in the core crawler
- **SQLite compatible**: All database operations use Prisma with the existing schema
- **Background job ready**: Crawler is designed to be started from API routes and run asynchronously
- **SSRF-first**: All URL validation happens before any network request
- **Robots.txt compliance**: Respects Crawl-delay, handles wildcards and $ anchors per RFC 9309

### Lint Status
- All 6 crawler files pass ESLint with zero errors/warnings
- Pre-existing lint errors in `/src/lib/rules/` are unrelated to this task
