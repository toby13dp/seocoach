/**
 * Robots.txt Parser Tests
 * Tests for /src/lib/crawler/robots.ts
 */

import {
  parseRobotsTxt,
  isAllowed,
  parseCrawlDelay,
  getSitemaps,
} from '@/lib/crawler/robots';

// ============================================================================
// Test Framework
// ============================================================================

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`  ✗ ${name}: ${msg}`);
    console.log(`  ✗ ${name}: ${msg}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, label?: string): void {
  if (actual !== expected) {
    throw new Error(
      `Expected ${label ? label + ': ' : ''}${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(value: boolean, label?: string): void {
  if (!value) throw new Error(`Expected true${label ? ` (${label})` : ''}, got false`);
}

function assertFalse(value: boolean, label?: string): void {
  if (value) throw new Error(`Expected false${label ? ` (${label})` : ''}, got true`);
}

// ============================================================================
// Tests
// ============================================================================

export function run(): void {
  console.log('\n📦 Robots.txt Parser Tests\n');
  passed = 0;
  failed = 0;
  failures.length = 0;

  // --- Parse Allow/Disallow rules ---
  test('parseRobotsTxt parses basic Disallow rule', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow: /admin/');
    assertEqual(rules.length, 1);
    assertEqual(rules[0].path, '/admin/');
    assertFalse(rules[0].allow);
    assertEqual(rules[0].userAgent, '*');
  });

  test('parseRobotsTxt parses basic Allow rule', () => {
    const rules = parseRobotsTxt('User-agent: *\nAllow: /public/');
    assertEqual(rules.length, 1);
    assertEqual(rules[0].path, '/public/');
    assertTrue(rules[0].allow);
  });

  test('parseRobotsTxt parses multiple rules for same agent', () => {
    const content = `User-agent: *
Disallow: /admin/
Disallow: /private/
Allow: /admin/public/`;
    const rules = parseRobotsTxt(content);
    assertEqual(rules.length, 3);
  });

  // --- Wildcard matching ---
  test('isAllowed handles wildcard * in path', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow: /*.pdf$');
    // A URL ending in .pdf should be disallowed
    assertFalse(isAllowed('https://example.com/document.pdf', rules));
  });

  test('isAllowed handles wildcard * in middle of path', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow: /admin/*');
    assertFalse(isAllowed('https://example.com/admin/secret/page', rules));
    assertTrue(isAllowed('https://example.com/public/page', rules));
  });

  // --- End-of-path anchor $ ---
  test('isAllowed handles $ anchor', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow: /folder$');
    // /folder exactly should be blocked
    assertFalse(isAllowed('https://example.com/folder', rules));
    // /folder/page should be allowed because $ only matches end
    assertTrue(isAllowed('https://example.com/folder/page', rules));
  });

  // --- User-agent matching ---
  test('isAllowed matches specific user-agent', () => {
    const content = `User-agent: GoogleBot
Disallow: /private/

User-agent: *
Allow: /`;
    const rules = parseRobotsTxt(content);
    // For GoogleBot, /private/ is disallowed
    assertFalse(isAllowed('https://example.com/private/page', rules, 'GoogleBot'));
    // For other agents, /private/ is allowed
    assertTrue(isAllowed('https://example.com/private/page', rules, 'OtherBot'));
  });

  test('isAllowed falls back to wildcard when specific agent not matched', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow: /admin/');
    assertTrue(isAllowed('https://example.com/public', rules, 'MyBot'));
    assertFalse(isAllowed('https://example.com/admin/secret', rules, 'MyBot'));
  });

  // --- Crawl-delay extraction ---
  test('parseCrawlDelay extracts crawl delay for wildcard agent', () => {
    const content = 'User-agent: *\nCrawl-delay: 5';
    const delay = parseCrawlDelay(content);
    assertEqual(delay, 5000); // 5 seconds in ms
  });

  test('parseCrawlDelay extracts crawl delay for specific agent', () => {
    const content = `User-agent: MyBot
Crawl-delay: 10

User-agent: *
Crawl-delay: 2`;
    const delay = parseCrawlDelay(content, 'MyBot');
    assertEqual(delay, 10000); // 10 seconds
  });

  test('parseCrawlDelay falls back to wildcard delay', () => {
    const content = 'User-agent: *\nCrawl-delay: 3';
    const delay = parseCrawlDelay(content, 'SomeOtherBot');
    assertEqual(delay, 3000);
  });

  test('parseCrawlDelay returns default when no delay specified', () => {
    const content = 'User-agent: *\nDisallow: /admin/';
    const delay = parseCrawlDelay(content);
    assertEqual(delay, 1000); // Default 1 second
  });

  test('parseCrawlDelay caps at max 60 seconds', () => {
    const content = 'User-agent: *\nCrawl-delay: 120';
    const delay = parseCrawlDelay(content);
    assertEqual(delay, 60000); // Capped at 60s
  });

  // --- Sitemap URL extraction ---
  test('getSitemaps extracts sitemap URLs', () => {
    const content = `User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/news-sitemap.xml`;
    const sitemaps = getSitemaps(content);
    assertEqual(sitemaps.length, 2);
    assertEqual(sitemaps[0], 'https://example.com/sitemap.xml');
    assertEqual(sitemaps[1], 'https://example.com/news-sitemap.xml');
  });

  test('getSitemaps returns empty array for no sitemaps', () => {
    const content = 'User-agent: *\nDisallow: /admin/';
    const sitemaps = getSitemaps(content);
    assertEqual(sitemaps.length, 0);
  });

  test('getSitemaps handles empty content', () => {
    const sitemaps = getSitemaps('');
    assertEqual(sitemaps.length, 0);
  });

  // --- Default allow when no rules match ---
  test('isAllowed returns true when no rules exist', () => {
    const rules = parseRobotsTxt('');
    assertTrue(isAllowed('https://example.com/any/path', rules));
  });

  test('isAllowed returns true for path with no matching rule', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow: /admin/');
    assertTrue(isAllowed('https://example.com/public/page', rules));
  });

  test('isAllowed with empty Disallow means allow everything', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow:');
    // Empty Disallow = allow everything
    assertTrue(isAllowed('https://example.com/any/path', rules));
  });

  // --- Comments handling ---
  test('parseRobotsTxt ignores comments', () => {
    const content = `# This is a comment
User-agent: *
# Another comment
Disallow: /admin/ # inline comment`;
    const rules = parseRobotsTxt(content);
    assertEqual(rules.length, 1);
    assertEqual(rules[0].path, '/admin/');
  });

  // --- Longest match wins ---
  test('isAllowed uses longest-match strategy', () => {
    const content = `User-agent: *
Disallow: /admin/
Allow: /admin/public/`;
    const rules = parseRobotsTxt(content);
    // /admin/public/ has longer match so it's allowed
    assertTrue(isAllowed('https://example.com/admin/public/page', rules));
    // /admin/secret/ matches Disallow and is shorter, so blocked
    assertFalse(isAllowed('https://example.com/admin/secret', rules));
  });

  // Summary
  console.log(`\n  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(f));
  }
}

