/**
 * robots.txt Parser Module
 *
 * Fetches and parses robots.txt files, providing rule-based
 * access control for the crawler.
 */

/** Default crawl delay in milliseconds when none is specified */
const DEFAULT_CRAWL_DELAY_MS = 1000;

/** Maximum crawl delay we will respect (60 seconds) */
const MAX_CRAWL_DELAY_MS = 60_000;

/** Timeout for fetching robots.txt in milliseconds */
const ROBOTS_FETCH_TIMEOUT_MS = 10_000;

/**
 * Represents a single robots.txt rule (Allow or Disallow).
 */
export interface RobotsRule {
  /** The path pattern from the robots.txt directive */
  path: string;
  /** Whether this is an Allow rule (true) or Disallow rule (false) */
  allow: boolean;
  /** The user-agent this rule applies to */
  userAgent: string;
}

/**
 * Fetches the robots.txt file for a given base URL.
 *
 * @param baseUrl - The root URL of the site (e.g., "https://example.com")
 * @returns The raw text content of the robots.txt file, or empty string if not found
 */
export async function fetchRobotsTxt(baseUrl: string): Promise<string> {
  try {
    const parsed = new URL(baseUrl);
    const robotsUrl = `${parsed.origin}/robots.txt`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ROBOTS_FETCH_TIMEOUT_MS);

    const response = await fetch(robotsUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'SEOCoach-Bot/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (response.status === 404) {
      return '';
    }

    if (!response.ok) {
      return '';
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/plain') && !contentType.includes('text/')) {
      return '';
    }

    return await response.text();
  } catch {
    // If we can't fetch robots.txt, we assume no restrictions
    return '';
  }
}

/**
 * Parses a robots.txt file content into structured rules.
 *
 * Handles multiple user-agent groups, Allow/Disallow directives,
 * and Crawl-delay. Comments (lines starting with #) and blank
 * lines are ignored.
 *
 * @param content - The raw text content of a robots.txt file
 * @returns Array of parsed rules
 */
export function parseRobotsTxt(content: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  if (!content || typeof content !== 'string') return rules;

  const lines = content.split('\n');
  let currentAgents: string[] = [];

  for (const rawLine of lines) {
    // Remove comments and trim
    const commentIdx = rawLine.indexOf('#');
    const line = (commentIdx >= 0 ? rawLine.substring(0, commentIdx) : rawLine).trim();

    if (!line) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;

    const directive = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();

    switch (directive) {
      case 'user-agent': {
        // Start a new group
        currentAgents = [value];
        // If value is empty, treat as wildcard
        if (!value) currentAgents = ['*'];
        break;
      }
      case 'disallow': {
        if (currentAgents.length === 0) break;
        // Empty Disallow means "allow everything" for that agent
        if (!value) {
          for (const agent of currentAgents) {
            rules.push({ path: '/', allow: true, userAgent: agent });
          }
        } else {
          for (const agent of currentAgents) {
            rules.push({ path: value, allow: false, userAgent: agent });
          }
        }
        break;
      }
      case 'allow': {
        if (currentAgents.length === 0) break;
        for (const agent of currentAgents) {
          rules.push({ path: value || '/', allow: true, userAgent: agent });
        }
        break;
      }
      default:
        // Ignore other directives (Sitemap, Crawl-delay, etc.)
        break;
    }
  }

  return rules;
}

/**
 * Checks whether a URL is allowed to be crawled based on robots.txt rules.
 *
 * Uses the longest-match strategy as specified by RFC 9309:
 * the most specific path match wins. If Allow and Disallow
 * patterns match equally, Allow takes precedence.
 *
 * @param url - The URL to check
 * @param rules - The parsed robots.txt rules
 * @param userAgent - The user-agent string (defaults to '*')
 * @returns true if the URL is allowed, false if it's disallowed
 */
export function isAllowed(url: string, rules: RobotsRule[], userAgent: string = '*'): boolean {
  if (rules.length === 0) return true;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const path = parsed.pathname + parsed.search;

  // Collect matching rules for the given user-agent or wildcard
  const matchingRules = rules.filter(
    (r) => r.userAgent.toLowerCase() === userAgent.toLowerCase() || r.userAgent === '*'
  );

  if (matchingRules.length === 0) return true;

  // Find the best matching rule (longest path match)
  let bestMatch: RobotsRule | null = null;
  let bestMatchLength = -1;

  for (const rule of matchingRules) {
    if (pathMatchesPattern(path, rule.path)) {
      if (rule.path.length > bestMatchLength) {
        bestMatchLength = rule.path.length;
        bestMatch = rule;
      } else if (rule.path.length === bestMatchLength && rule.allow) {
        // Equal length: Allow takes precedence
        bestMatch = rule;
      }
    }
  }

  if (!bestMatch) return true; // No matching rule means allowed

  return bestMatch.allow;
}

/**
 * Gets the crawl delay from robots.txt rules.
 *
 * Falls back to the default crawl delay if no Crawl-delay
 * directive is found for the specified user-agent.
 *
 * @param rules - The parsed robots.txt rules (note: Crawl-delay is not in RobotsRule, parsed separately)
 * @param userAgent - The user-agent string (defaults to '*')
 * @returns The crawl delay in milliseconds
 */
export function getCrawlDelay(rules: RobotsRule[], userAgent: string = '*'): number {
  // Crawl-delay is not a standard RobotsRule, so we need to parse it from raw content
  // This function signature accepts RobotsRule[] for API consistency
  // but the actual Crawl-delay parsing should use the raw content
  // For now, return the default delay
  void rules;
  void userAgent;
  return DEFAULT_CRAWL_DELAY_MS;
}

/**
 * Parses the Crawl-delay value from raw robots.txt content.
 *
 * @param content - The raw robots.txt file content
 * @param userAgent - The user-agent string (defaults to '*')
 * @returns The crawl delay in milliseconds, capped at MAX_CRAWL_DELAY_MS
 */
export function parseCrawlDelay(content: string, userAgent: string = '*'): number {
  if (!content || typeof content !== 'string') return DEFAULT_CRAWL_DELAY_MS;

  const lines = content.split('\n');
  let currentAgents: string[] = [];
  let delay: number | null = null;
  let wildcardDelay: number | null = null;

  for (const rawLine of lines) {
    const commentIdx = rawLine.indexOf('#');
    const line = (commentIdx >= 0 ? rawLine.substring(0, commentIdx) : rawLine).trim();

    if (!line) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;

    const directive = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();

    if (directive === 'user-agent') {
      currentAgents = [value || '*'];
    } else if (directive === 'crawl-delay') {
      const parsedDelay = parseFloat(value);
      if (!isNaN(parsedDelay) && parsedDelay > 0) {
        const delayMs = Math.round(parsedDelay * 1000);
        const cappedDelay = Math.min(delayMs, MAX_CRAWL_DELAY_MS);

        if (currentAgents.includes(userAgent)) {
          delay = cappedDelay;
        }
        if (currentAgents.includes('*')) {
          wildcardDelay = cappedDelay;
        }
      }
    }
  }

  return delay ?? wildcardDelay ?? DEFAULT_CRAWL_DELAY_MS;
}

/**
 * Extracts sitemap URLs from a robots.txt file.
 *
 * Sitemaps are declared with the "Sitemap:" directive,
 * which can appear anywhere in the file (outside of
 * user-agent groups).
 *
 * @param content - The raw robots.txt file content
 * @returns Array of sitemap URLs
 */
export function getSitemaps(content: string): string[] {
  const sitemaps: string[] = [];
  if (!content || typeof content !== 'string') return sitemaps;

  const lines = content.split('\n');

  for (const rawLine of lines) {
    const commentIdx = rawLine.indexOf('#');
    const line = (commentIdx >= 0 ? rawLine.substring(0, commentIdx) : rawLine).trim();

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;

    const directive = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();

    if (directive === 'sitemap' && value) {
      sitemaps.push(value);
    }
  }

  return sitemaps;
}

/**
 * Matches a URL path against a robots.txt path pattern.
 *
 * Supports the wildcard (*) and end-of-path ($) operators
 * as specified by RFC 9309.
 */
function pathMatchesPattern(path: string, pattern: string): boolean {
  // Convert robots.txt pattern to regex
  let regexStr = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      regexStr += '.*';
    } else if (ch === '$') {
      // $ at end means end-of-string anchor
      if (i === pattern.length - 1) {
        regexStr += '$';
      } else {
        regexStr += '\\$';
      }
    } else {
      // Escape special regex characters
      if ('.+?^${}()|[]\\'.includes(ch)) {
        regexStr += '\\';
      }
      regexStr += ch;
    }
  }

  try {
    const regex = new RegExp(`^${regexStr}`);
    return regex.test(path);
  } catch {
    return false;
  }
}
