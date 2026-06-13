/**
 * Crawler Engine - Barrel Export
 *
 * Re-exports all types, interfaces, and functions from the
 * crawler engine modules.
 */

// ============================================================================
// SSRF Protection
// ============================================================================
export {
  isPrivateIP,
  isCloudMetadata,
  isAllowedProtocol,
  validateUrl,
  checkRedirectSafety,
  validateResponseSize,
  checkDecompressionBomb,
} from './ssrf';

// ============================================================================
// robots.txt Parser
// ============================================================================
export {
  fetchRobotsTxt,
  parseRobotsTxt,
  isAllowed as isRobotsAllowed,
  getCrawlDelay,
  parseCrawlDelay,
  getSitemaps,
  type RobotsRule,
} from './robots';

// ============================================================================
// Sitemap Parser
// ============================================================================
export {
  parseSitemapXml,
  parseSitemapIndex,
  fetchSitemapUrls,
  type SitemapUrl,
} from './sitemap';

// ============================================================================
// HTML Parser
// ============================================================================
export {
  parsePage,
  extractMainContent,
  extractStructuredData,
  normalizeUrl,
  detectContentType,
  type ContentType,
  type ExtractedLink,
  type ExtractedImage,
  type HeadingEntry,
  type ParsedPage,
} from './parser';

// ============================================================================
// Main Crawler
// ============================================================================
export {
  Crawler,
  startCrawl,
  type CrawlerConfig,
} from './crawler';
