/**
 * HTML Parser Module
 *
 * Extracts SEO-relevant data from HTML pages including
 * meta tags, headings, links, images, structured data,
 * and main content.
 */

/**
 * Content type detected from HTTP response.
 */
export type ContentType = 'HTML' | 'PDF' | 'IMAGE' | 'VIDEO' | 'OTHER';

/**
 * Represents a link extracted from an HTML page.
 */
export interface ExtractedLink {
  /** The href value of the link */
  href: string;
  /** The link text (anchor content) */
  text: string;
  /** Whether the link has rel="nofollow" */
  nofollow: boolean;
  /** Whether the link opens in a new window */
  external: boolean;
}

/**
 * Represents an image extracted from an HTML page.
 */
export interface ExtractedImage {
  /** The source URL of the image */
  src: string;
  /** The alt text of the image (empty string if missing) */
  alt: string;
}

/**
 * Represents a heading element extracted from the page.
 */
export interface HeadingEntry {
  /** The heading level (1-6) */
  level: number;
  /** The heading text content */
  text: string;
}

/**
 * Represents a fully parsed HTML page with all SEO-relevant data.
 */
export interface ParsedPage {
  /** The page title from <title> tag */
  title: string | null;
  /** The meta description */
  description: string | null;
  /** The first <h1> heading text */
  h1: string | null;
  /** The canonical URL from <link rel="canonical"> */
  canonical: string | null;
  /** The meta robots directive (e.g., "noindex, nofollow") */
  metaRobots: string | null;
  /** hreflang entries: language code to URL mapping */
  hreflang: Record<string, string>;
  /** Open Graph tags */
  ogTags: Record<string, string>;
  /** All JSON-LD structured data blocks */
  structuredData: object[];
  /** Heading structure (h1-h6) */
  headings: HeadingEntry[];
  /** Internal links (same domain) */
  internalLinks: ExtractedLink[];
  /** External links (different domain) */
  externalLinks: ExtractedLink[];
  /** Images with alt text information */
  images: ExtractedImage[];
  /** The main content of the page (stripped of nav/footer/aside) */
  mainContent: string;
  /** Detected language of the page */
  language: string | null;
  /** Word count of the main content */
  wordCount: number;
}

/**
 * Parses an HTML page and extracts all SEO-relevant data.
 *
 * @param html - The raw HTML content of the page
 * @param url - The URL of the page (used for resolving relative links)
 * @returns A fully parsed page object
 */
export function parsePage(html: string, url: string): ParsedPage {
  if (!html || typeof html !== 'string') {
    return createEmptyParsedPage();
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(url);
  } catch {
    return createEmptyParsedPage();
  }

  const title = extractTitle(html);
  const description = extractMetaContent(html, 'description');
  const h1 = extractFirstTag(html, 'h1');
  const canonical = extractLinkHref(html, 'canonical');
  const metaRobots = extractMetaContent(html, 'robots');
  const hreflang = extractHreflang(html);
  const ogTags = extractOgTags(html);
  const structuredData = extractStructuredData(html);
  const headings = extractHeadings(html);
  const mainContent = extractMainContent(html);
  const language = extractLanguage(html);
  const wordCount = countWords(mainContent);

  const allLinks = extractLinks(html, baseUrl);
  const internalLinks = allLinks.filter((l) => !l.external);
  const externalLinks = allLinks.filter((l) => l.external);

  const images = extractImages(html);

  return {
    title,
    description,
    h1,
    canonical,
    metaRobots,
    hreflang,
    ogTags,
    structuredData,
    headings,
    internalLinks,
    externalLinks,
    images,
    mainContent,
    language,
    wordCount,
  };
}

/**
 * Extracts the main content from an HTML page by stripping
 * navigation, footer, aside, header, and script/style elements.
 *
 * Prioritizes <main>, <article>, or [role="main"] content.
 * Falls back to <body> content if no main content area is found.
 *
 * @param html - The raw HTML content
 * @returns The text content of the main area, stripped of HTML tags
 */
export function extractMainContent(html: string): string {
  if (!html) return '';

  // Try to find main content area
  const mainPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<[^>]*role\s*=\s*["']main["'][^>]*>([\s\S]*?)<\/\w+>/i,
    /<body[^>]*>([\s\S]*?)<\/body>/i,
  ];

  let content = '';

  for (const pattern of mainPatterns) {
    const match = html.match(pattern);
    if (match) {
      content = match[1];
      break;
    }
  }

  // If no main content area found, use entire HTML
  if (!content) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    content = bodyMatch ? bodyMatch[1] : html;
  }

  // Remove non-content elements
  content = removeElements(content, [
    'nav', 'footer', 'aside', 'header', 'script', 'style',
    'noscript', 'iframe', 'svg', 'form', 'button',
  ]);

  // Strip remaining HTML tags
  content = stripHtmlTags(content);

  // Decode HTML entities
  content = decodeHtmlEntities(content);

  // Normalize whitespace
  content = content.replace(/\s+/g, ' ').trim();

  return content;
}

/**
 * Extracts all JSON-LD structured data blocks from an HTML page.
 *
 * @param html - The raw HTML content
 * @returns Array of parsed JSON-LD objects
 */
export function extractStructuredData(html: string): object[] {
  const results: object[] = [];
  if (!html) return results;

  const pattern = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const json = match[1].trim();
      if (json) {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          results.push(...parsed);
        } else {
          results.push(parsed);
        }
      }
    } catch {
      // Skip malformed JSON-LD blocks
    }
  }

  return results;
}

/**
 * Normalizes a URL by removing fragments, sorting query parameters,
 * and normalizing trailing slashes.
 *
 * @param url - The URL to normalize
 * @param baseUrl - The base URL for resolving relative URLs
 * @returns The normalized absolute URL
 */
export function normalizeUrl(url: string, baseUrl: string): string {
  try {
    // Resolve relative URLs
    const resolved = new URL(url, baseUrl);

    // Remove fragment
    resolved.hash = '';

    // Sort query parameters for consistent comparison
    resolved.searchParams.sort();

    // Get the normalized URL string
    let normalized = resolved.toString();

    // Remove trailing slash for non-root paths
    if (normalized.length > 0 && normalized.endsWith('/') && !isRootPath(resolved.pathname)) {
      normalized = normalized.slice(0, -1);
    }

    // Lowercase the hostname
    const urlObj = new URL(normalized);
    urlObj.hostname = urlObj.hostname.toLowerCase();

    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Detects the content type of an HTTP response based on
 * the Content-Type header and URL extension.
 *
 * @param response - The HTTP Response object
 * @returns The detected content type
 */
export function detectContentType(response: Response): ContentType {
  const contentType = response.headers.get('content-type') ?? '';
  const ct = contentType.toLowerCase();

  if (ct.includes('text/html') || ct.includes('application/xhtml')) {
    return 'HTML';
  }

  if (ct.includes('application/pdf')) {
    return 'PDF';
  }

  if (ct.startsWith('image/')) {
    return 'IMAGE';
  }

  if (ct.startsWith('video/') || ct.includes('application/octet-stream')) {
    // Check URL extension for video
    try {
      const url = new URL(response.url);
      const ext = url.pathname.split('.').pop()?.toLowerCase() ?? '';
      const videoExts = ['mp4', 'webm', 'avi', 'mov', 'wmv', 'flv', 'mkv'];
      if (videoExts.includes(ext)) return 'VIDEO';
    } catch {
      // Ignore
    }
    if (ct.startsWith('video/')) return 'VIDEO';
    if (ct.includes('octet-stream')) return 'OTHER';
  }

  // Fallback: check URL extension
  try {
    const url = new URL(response.url);
    const ext = url.pathname.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return 'PDF';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'IMAGE';
    if (['mp4', 'webm', 'avi', 'mov'].includes(ext)) return 'VIDEO';
    if (['html', 'htm', 'php', 'asp', 'aspx', 'jsp'].includes(ext) || ext === '') return 'HTML';
  } catch {
    // Ignore
  }

  return 'OTHER';
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Creates an empty ParsedPage with all fields set to null/empty.
 */
function createEmptyParsedPage(): ParsedPage {
  return {
    title: null,
    description: null,
    h1: null,
    canonical: null,
    metaRobots: null,
    hreflang: {},
    ogTags: {},
    structuredData: [],
    headings: [],
    internalLinks: [],
    externalLinks: [],
    images: [],
    mainContent: '',
    language: null,
    wordCount: 0,
  };
}

/**
 * Extracts the <title> tag content.
 */
function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return decodeHtmlEntities(stripHtmlTags(match[1])).trim();
}

/**
 * Extracts the content of a <meta> tag by name.
 */
function extractMetaContent(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*name\\s*=\\s*["']${escapeRegex(name)}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*name\\s*=\\s*["']${escapeRegex(name)}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtmlEntities(match[1]).trim();
  }

  return null;
}

/**
 * Extracts the text content of the first occurrence of a tag.
 */
function extractFirstTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return null;
  return decodeHtmlEntities(stripHtmlTags(match[1])).trim();
}

/**
 * Extracts the href from a <link> tag by rel attribute.
 */
function extractLinkHref(html: string, rel: string): string | null {
  const patterns = [
    new RegExp(`<link[^>]*rel\\s*=\\s*["']${escapeRegex(rel)}["'][^>]*href\\s*=\\s*["']([^"']*)["']`, 'i'),
    new RegExp(`<link[^>]*href\\s*=\\s*["']([^"']*)["'][^>]*rel\\s*=\\s*["']${escapeRegex(rel)}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

/**
 * Extracts all hreflang link entries from the page.
 */
function extractHreflang(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /<link[^>]*rel\s*=\s*["']alternate["'][^>]*hreflang\s*=\s*["']([^"']*)["'][^>]*href\s*=\s*["']([^"']*)["'][^>]*\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    result[match[1]] = match[2];
  }

  // Also try the reverse order (href before hreflang)
  const pattern2 = /<link[^>]*href\s*=\s*["']([^"']*)["'][^>]*hreflang\s*=\s*["']([^"']*)["'][^>]*\/?>/gi;
  while ((match = pattern2.exec(html)) !== null) {
    result[match[2]] = match[1];
  }

  return result;
}

/**
 * Extracts all Open Graph meta tags from the page.
 */
function extractOgTags(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /<meta[^>]*property\s*=\s*["'](og:[^"']*)["'][^>]*content\s*=\s*["']([^"']*)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    result[match[1]] = decodeHtmlEntities(match[2]).trim();
  }

  // Also try content before property
  const pattern2 = /<meta[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["'](og:[^"']*)["']/gi;
  while ((match = pattern2.exec(html)) !== null) {
    result[match[2]] = decodeHtmlEntities(match[1]).trim();
  }

  return result;
}

/**
 * Extracts all heading elements (h1-h6) from the page.
 */
function extractHeadings(html: string): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  const pattern = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const level = parseInt(match[1][1], 10);
    const text = decodeHtmlEntities(stripHtmlTags(match[2])).trim();
    if (text) {
      headings.push({ level, text });
    }
  }

  return headings;
}

/**
 * Extracts all links from the page and categorizes them
 * as internal or external based on the base URL.
 */
function extractLinks(html: string, baseUrl: URL): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const pattern = /<a[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const href = match[1].trim();
    const text = decodeHtmlTags(match[2]).trim();

    // Skip empty, javascript:, mailto:, tel: links
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      continue;
    }

    // Determine if nofollow
    const nofollow = /rel\s*=\s*["'][^"']*nofollow[^"']*["']/i.test(match[0]);

    // Resolve and determine if external
    let isExternal = false;
    try {
      const resolved = new URL(href, baseUrl);
      isExternal = resolved.hostname.toLowerCase() !== baseUrl.hostname.toLowerCase();
    } catch {
      // Invalid URL, skip
      continue;
    }

    links.push({
      href,
      text,
      nofollow,
      external: isExternal,
    });
  }

  return links;
}

/**
 * Extracts all images from the page with their alt text.
 */
function extractImages(html: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const pattern = /<img[^>]*src\s*=\s*["']([^"']*)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const src = match[1].trim();
    if (!src) continue;

    // Extract alt text
    const altMatch = match[0].match(/alt\s*=\s*["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';

    images.push({ src, alt });
  }

  return images;
}

/**
 * Extracts the language of the page from the <html> tag's lang attribute.
 */
function extractLanguage(html: string): string | null {
  const match = html.match(/<html[^>]*lang\s*=\s*["']([^"']*)["']/i);
  return match ? match[1].trim() : null;
}

/**
 * Counts the number of words in a text string.
 */
function countWords(text: string): number {
  if (!text) return 0;
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

/**
 * Removes specified HTML elements and their content.
 */
function removeElements(html: string, tags: string[]): string {
  let result = html;
  for (const tag of tags) {
    const pattern = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    result = result.replace(pattern, '');
    // Self-closing
    const selfClosing = new RegExp(`<${tag}[^>]*\\/>`, 'gi');
    result = result.replace(selfClosing, '');
  }
  return result;
}

/**
 * Strips all HTML tags from a string.
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Decodes common HTML entities.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Decodes HTML tags within link text, handling nested elements.
 */
function decodeHtmlTags(html: string): string {
  return stripHtmlTags(html).trim();
}

/**
 * Escapes a string for use in a regular expression.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks whether a pathname represents a root path.
 */
function isRootPath(pathname: string): boolean {
  return pathname === '/' || pathname === '';
}
