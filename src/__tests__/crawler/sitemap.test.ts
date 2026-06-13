/**
 * Sitemap Parser Tests
 * Tests for /src/lib/crawler/sitemap.ts
 */

import {
  parseSitemapXml,
  parseSitemapIndex,
} from '@/lib/crawler/sitemap';

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

// ============================================================================
// Tests
// ============================================================================

export function run(): void {
  console.log('\n📦 Sitemap Parser Tests\n');
  passed = 0;
  failed = 0;
  failures.length = 0;

  // --- Parse basic sitemap XML ---
  test('parseSitemapXml extracts URLs from basic sitemap', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
  </url>
  <url>
    <loc>https://example.com/about</loc>
  </url>
  <url>
    <loc>https://example.com/contact</loc>
  </url>
</urlset>`;
    const urls = parseSitemapXml(xml);
    assertEqual(urls.length, 3);
    assertEqual(urls[0].loc, 'https://example.com/');
    assertEqual(urls[1].loc, 'https://example.com/about');
    assertEqual(urls[2].loc, 'https://example.com/contact');
  });

  // --- Parse sitemap with lastmod, changefreq, priority ---
  test('parseSitemapXml extracts lastmod', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-15</lastmod>
  </url>
</urlset>`;
    const urls = parseSitemapXml(xml);
    assertEqual(urls.length, 1);
    assertEqual(urls[0].lastmod, '2024-01-15');
  });

  test('parseSitemapXml extracts changefreq', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/blog</loc>
    <changefreq>daily</changefreq>
  </url>
</urlset>`;
    const urls = parseSitemapXml(xml);
    assertEqual(urls[0].changefreq, 'daily');
  });

  test('parseSitemapXml extracts priority', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <priority>0.8</priority>
  </url>
</urlset>`;
    const urls = parseSitemapXml(xml);
    assertEqual(urls[0].priority, 0.8);
  });

  test('parseSitemapXml extracts all fields together', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page</loc>
    <lastmod>2024-03-01T12:00:00+00:00</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
    const urls = parseSitemapXml(xml);
    assertEqual(urls.length, 1);
    assertEqual(urls[0].loc, 'https://example.com/page');
    assertEqual(urls[0].lastmod, '2024-03-01T12:00:00+00:00');
    assertEqual(urls[0].changefreq, 'weekly');
    assertEqual(urls[0].priority, 1.0);
  });

  test('parseSitemapXml ignores invalid priority values', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page</loc>
    <priority>2.5</priority>
  </url>
</urlset>`;
    const urls = parseSitemapXml(xml);
    // Priority > 1 should be ignored
    assertEqual(urls[0].priority, undefined);
  });

  // --- Parse sitemap index ---
  test('parseSitemapIndex extracts child sitemap URLs', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-posts.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-pages.xml</loc>
  </sitemap>
</sitemapindex>`;
    const sitemaps = parseSitemapIndex(xml);
    assertEqual(sitemaps.length, 2);
    assertEqual(sitemaps[0], 'https://example.com/sitemap-posts.xml');
    assertEqual(sitemaps[1], 'https://example.com/sitemap-pages.xml');
  });

  test('parseSitemapIndex returns empty for regular sitemap', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
  </url>
</urlset>`;
    const sitemaps = parseSitemapIndex(xml);
    assertEqual(sitemaps.length, 0);
  });

  // --- Handle malformed XML gracefully ---
  test('parseSitemapXml handles malformed XML gracefully', () => {
    const xml = '<not-valid-xml><url><loc>https://example.com/</loc></url>';
    // Should not throw, may return partial results
    const urls = parseSitemapXml(xml);
    // At least should not crash
    assertTrue(Array.isArray(urls));
  });

  test('parseSitemapXml handles XML with unclosed tags', () => {
    const xml = `<?xml version="1.0"?>
<urlset>
  <url>
    <loc>https://example.com/page1</loc>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
</urlset>`;
    const urls = parseSitemapXml(xml);
    assertTrue(urls.length >= 1);
  });

  test('parseSitemapXml returns empty for completely invalid input', () => {
    const urls = parseSitemapXml('this is not xml at all');
    assertEqual(urls.length, 0);
  });

  // --- Handle empty sitemap ---
  test('parseSitemapXml handles empty urlset', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
    const urls = parseSitemapXml(xml);
    assertEqual(urls.length, 0);
  });

  test('parseSitemapXml handles empty string', () => {
    const urls = parseSitemapXml('');
    assertEqual(urls.length, 0);
  });

  test('parseSitemapXml handles null-like input', () => {
    const urls = parseSitemapXml(null as unknown as string);
    assertEqual(urls.length, 0);
  });

  test('parseSitemapIndex handles empty string', () => {
    const sitemaps = parseSitemapIndex('');
    assertEqual(sitemaps.length, 0);
  });

  // --- Skip URLs without loc ---
  test('parseSitemapXml skips URL entries without loc', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <lastmod>2024-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/valid</loc>
  </url>
</urlset>`;
    const urls = parseSitemapXml(xml);
    assertEqual(urls.length, 1);
    assertEqual(urls[0].loc, 'https://example.com/valid');
  });

  // Summary
  console.log(`\n  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(f));
  }
}

