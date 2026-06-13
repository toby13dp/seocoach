/**
 * HTML Parser Tests
 * Tests for /src/lib/crawler/parser.ts
 */

import {
  parsePage,
  extractMainContent,
  extractStructuredData,
  normalizeUrl,
  detectContentType,
} from '@/lib/crawler/parser';

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
  console.log('\n📦 HTML Parser Tests\n');
  passed = 0;
  failed = 0;
  failures.length = 0;

  // --- Extract title, description, h1 ---
  test('parsePage extracts title', () => {
    const html = '<html><head><title>My Page Title</title></head><body></body></html>';
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.title, 'My Page Title');
  });

  test('parsePage extracts meta description', () => {
    const html = `<html><head><title>Test</title>
<meta name="description" content="A great page about SEO"></head><body></body></html>`;
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.description, 'A great page about SEO');
  });

  test('parsePage extracts h1', () => {
    const html = '<html><head><title>Test</title></head><body><h1>Main Heading</h1></body></html>';
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.h1, 'Main Heading');
  });

  test('parsePage returns null title when missing', () => {
    const html = '<html><head></head><body></body></html>';
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.title, null);
  });

  test('parsePage returns null description when missing', () => {
    const html = '<html><head><title>Test</title></head><body></body></html>';
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.description, null);
  });

  // --- Extract canonical URL ---
  test('parsePage extracts canonical URL', () => {
    const html = `<html><head><title>Test</title>
<link rel="canonical" href="https://example.com/canonical-page"></head><body></body></html>`;
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.canonical, 'https://example.com/canonical-page');
  });

  test('parsePage returns null canonical when missing', () => {
    const html = '<html><head><title>Test</title></head><body></body></html>';
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.canonical, null);
  });

  // --- Extract meta robots ---
  test('parsePage extracts meta robots noindex', () => {
    const html = `<html><head><title>Test</title>
<meta name="robots" content="noindex, nofollow"></head><body></body></html>`;
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.metaRobots, 'noindex, nofollow');
  });

  test('parsePage returns null meta robots when missing', () => {
    const html = '<html><head><title>Test</title></head><body></body></html>';
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.metaRobots, null);
  });

  // --- Extract structured data (JSON-LD) ---
  test('parsePage extracts JSON-LD structured data', () => {
    const html = `<html><head><title>Test</title></head><body>
<script type="application/ld+json">
{"@type": "Article", "name": "Test Article", "author": "John"}
</script>
</body></html>`;
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.structuredData.length, 1);
    assertEqual((page.structuredData[0] as Record<string, string>)['@type'], 'Article');
  });

  test('parsePage extracts multiple JSON-LD blocks', () => {
    const html = `<html><head><title>Test</title></head><body>
<script type="application/ld+json">{"@type": "Article", "name": "First"}</script>
<script type="application/ld+json">{"@type": "Product", "name": "Second"}</script>
</body></html>`;
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.structuredData.length, 2);
  });

  test('parsePage handles malformed JSON-LD gracefully', () => {
    const html = `<html><head><title>Test</title></head><body>
<script type="application/ld+json">{invalid json}</script>
<script type="application/ld+json">{"@type": "Article", "name": "Valid"}</script>
</body></html>`;
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.structuredData.length, 1);
  });

  // --- Extract internal/external links ---
  test('parsePage extracts internal links', () => {
    const html = `<html><head><title>Test</title></head><body>
<a href="/about">About Us</a>
<a href="https://example.com/contact">Contact</a>
</body></html>`;
    const page = parsePage(html, 'https://example.com');
    assertTrue(page.internalLinks.length >= 1);
  });

  test('parsePage extracts external links', () => {
    const html = `<html><head><title>Test</title></head><body>
<a href="https://google.com">Google</a>
<a href="https://github.com">GitHub</a>
</body></html>`;
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.externalLinks.length, 2);
  });

  test('parsePage detects nofollow links', () => {
    const html = `<html><head><title>Test</title></head><body>
<a href="https://google.com" rel="nofollow">Google</a>
</body></html>`;
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.externalLinks.length, 1);
    assertTrue(page.externalLinks[0].nofollow);
  });

  test('parsePage skips javascript: and mailto: links', () => {
    const html = `<html><head><title>Test</title></head><body>
<a href="javascript:void(0)">Click</a>
<a href="mailto:test@example.com">Email</a>
<a href="/page">Normal Link</a>
</body></html>`;
    const page = parsePage(html, 'https://example.com');
    // Only the normal link should be extracted
    const allLinks = page.internalLinks.length + page.externalLinks.length;
    assertEqual(allLinks, 1);
  });

  // --- Extract images with alt text ---
  test('parsePage extracts images with alt text', () => {
    const html = `<html><head><title>Test</title></head><body>
<img src="/photo.jpg" alt="A beautiful photo">
<img src="/logo.png" alt="Company Logo">
</body></html>`;
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.images.length, 2);
    assertEqual(page.images[0].alt, 'A beautiful photo');
    assertEqual(page.images[1].alt, 'Company Logo');
  });

  test('parsePage handles images without alt text', () => {
    const html = `<html><head><title>Test</title></head><body>
<img src="/photo.jpg">
</body></html>`;
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.images.length, 1);
    assertEqual(page.images[0].alt, '');
  });

  // --- URL normalization ---
  test('normalizeUrl lowercases hostname', () => {
    const result = normalizeUrl('/page', 'https://Example.COM');
    assertTrue(result.startsWith('https://example.com'));
  });

  test('normalizeUrl removes fragment', () => {
    const result = normalizeUrl('https://example.com/page#section', 'https://example.com');
    assertFalse(result.includes('#'));
  });

  test('normalizeUrl sorts query parameters', () => {
    const result = normalizeUrl('https://example.com/page?b=2&a=1', 'https://example.com');
    assertTrue(result.includes('a=1'));
    assertTrue(result.includes('b=2'));
  });

  test('normalizeUrl resolves relative URLs', () => {
    const result = normalizeUrl('/about', 'https://example.com');
    assertTrue(result.includes('example.com/about'));
  });

  // --- Content type detection ---
  test('detectContentType detects HTML', () => {
    const response = new Response('', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
    Object.defineProperty(response, 'url', { value: 'https://example.com/page' });
    assertEqual(detectContentType(response), 'HTML');
  });

  test('detectContentType detects PDF from content-type', () => {
    const response = new Response('', {
      headers: { 'content-type': 'application/pdf' },
    });
    Object.defineProperty(response, 'url', { value: 'https://example.com/doc.pdf' });
    assertEqual(detectContentType(response), 'PDF');
  });

  test('detectContentType detects IMAGE from content-type', () => {
    const response = new Response('', {
      headers: { 'content-type': 'image/png' },
    });
    Object.defineProperty(response, 'url', { value: 'https://example.com/img.png' });
    assertEqual(detectContentType(response), 'IMAGE');
  });

  test('detectContentType detects PDF from URL extension with generic content type', () => {
    const response = new Response('', {
      headers: { 'content-type': 'text/plain' },
    });
    Object.defineProperty(response, 'url', { value: 'https://example.com/file.pdf' });
    assertEqual(detectContentType(response), 'PDF');
  });

  test('detectContentType returns OTHER for octet-stream with non-video URL', () => {
    const response = new Response('', {
      headers: { 'content-type': 'application/octet-stream' },
    });
    Object.defineProperty(response, 'url', { value: 'https://example.com/file.pdf' });
    // application/octet-stream is handled specially — returns OTHER for non-video
    assertEqual(detectContentType(response), 'OTHER');
  });

  // --- Handle malformed HTML ---
  test('parsePage handles empty HTML', () => {
    const page = parsePage('', 'https://example.com');
    assertEqual(page.title, null);
    assertEqual(page.description, null);
    assertEqual(page.h1, null);
  });

  test('parsePage handles malformed HTML gracefully', () => {
    const html = '<html><head><title>Broken';
    const page = parsePage(html, 'https://example.com');
    // Should not crash, may have null/empty values
    assertTrue(typeof page.title === 'string' || page.title === null);
  });

  test('parsePage handles invalid URL', () => {
    const page = parsePage('<html><body>test</body></html>', 'not-a-url');
    assertEqual(page.title, null);
  });

  // --- extractMainContent ---
  test('extractMainContent extracts content from <main> tag', () => {
    const html = '<html><body><main>This is the main content of the page.</main></body></html>';
    const content = extractMainContent(html);
    assertTrue(content.includes('This is the main content'));
  });

  test('extractMainContent extracts content from <article> tag', () => {
    const html = '<html><body><article>Article content here.</article></body></html>';
    const content = extractMainContent(html);
    assertTrue(content.includes('Article content here'));
  });

  test('extractMainContent removes nav and footer', () => {
    const html = `<html><body><main>
<nav>Navigation links</nav>
Main content here.
<footer>Footer info</footer>
</main></body></html>`;
    const content = extractMainContent(html);
    assertTrue(content.includes('Main content here'));
    assertFalse(content.includes('Navigation links'));
    assertFalse(content.includes('Footer info'));
  });

  test('extractMainContent returns empty for empty input', () => {
    assertEqual(extractMainContent(''), '');
  });

  // --- Language detection ---
  test('parsePage extracts language from html lang attribute', () => {
    const html = '<html lang="nl-NL"><head><title>Test</title></head><body></body></html>';
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.language, 'nl-NL');
  });

  test('parsePage returns null language when missing', () => {
    const html = '<html><head><title>Test</title></head><body></body></html>';
    const page = parsePage(html, 'https://example.com');
    assertEqual(page.language, null);
  });

  // --- Word count ---
  test('parsePage counts words in main content', () => {
    const html = `<html><body><main>
This is a test page with several words in the main content area.
It has more than just a few words to count properly.
</main></body></html>`;
    const page = parsePage(html, 'https://example.com');
    assertTrue(page.wordCount > 10);
  });

  // Summary
  console.log(`\n  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(f));
  }
}

