/**
 * SSRF Protection Tests
 * Tests for /src/lib/crawler/ssrf.ts
 */

import {
  isPrivateIP,
  isCloudMetadata,
  isAllowedProtocol,
  validateUrl,
  checkRedirectSafety,
  validateResponseSize,
} from '@/lib/crawler/ssrf';

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
  if (!value) {
    throw new Error(`Expected true${label ? ` (${label})` : ''}, got false`);
  }
}

function assertFalse(value: boolean, label?: string): void {
  if (value) {
    throw new Error(`Expected false${label ? ` (${label})` : ''}, got true`);
  }
}

// ============================================================================
// Tests
// ============================================================================

export function run(): void {
  console.log('\n📦 SSRF Protection Tests\n');
  passed = 0;
  failed = 0;
  failures.length = 0;

  // --- isPrivateIP blocks private IPv4 ---
  test('isPrivateIP blocks 10.0.0.1 (RFC 1918)', () => {
    assertTrue(isPrivateIP('10.0.0.1'));
  });

  test('isPrivateIP blocks 172.16.0.1 (RFC 1918)', () => {
    assertTrue(isPrivateIP('172.16.0.1'));
  });

  test('isPrivateIP blocks 172.31.255.255 (RFC 1918 upper)', () => {
    assertTrue(isPrivateIP('172.31.255.255'));
  });

  test('isPrivateIP blocks 192.168.1.1 (RFC 1918)', () => {
    assertTrue(isPrivateIP('192.168.1.1'));
  });

  test('isPrivateIP blocks 127.0.0.1 (loopback)', () => {
    assertTrue(isPrivateIP('127.0.0.1'));
  });

  test('isPrivateIP blocks 0.0.0.0 (current network)', () => {
    assertTrue(isPrivateIP('0.0.0.0'));
  });

  test('isPrivateIP blocks 169.254.169.254 (link-local)', () => {
    assertTrue(isPrivateIP('169.254.169.254'));
  });

  test('isPrivateIP blocks 169.254.0.1 (link-local)', () => {
    assertTrue(isPrivateIP('169.254.0.1'));
  });

  // --- isPrivateIP allows public IPv4 ---
  test('isPrivateIP allows 8.8.8.8 (Google DNS)', () => {
    assertFalse(isPrivateIP('8.8.8.8'));
  });

  test('isPrivateIP allows 1.1.1.1 (Cloudflare)', () => {
    assertFalse(isPrivateIP('1.1.1.1'));
  });

  test('isPrivateIP allows 142.250.80.46 (public)', () => {
    assertFalse(isPrivateIP('142.250.80.46'));
  });

  test('isPrivateIP allows 172.15.0.1 (just outside 172.16 range)', () => {
    assertFalse(isPrivateIP('172.15.0.1'));
  });

  test('isPrivateIP allows 172.32.0.1 (just outside 172.31 range)', () => {
    assertFalse(isPrivateIP('172.32.0.1'));
  });

  // --- isPrivateIP blocks private IPv6 ---
  test('isPrivateIP blocks ::1 (IPv6 loopback)', () => {
    assertTrue(isPrivateIP('::1'));
  });

  test('isPrivateIP blocks fc00::1 (IPv6 unique-local)', () => {
    assertTrue(isPrivateIP('fc00::1'));
  });

  test('isPrivateIP blocks fd00::1 (IPv6 unique-local fd)', () => {
    assertTrue(isPrivateIP('fd00::1'));
  });

  test('isPrivateIP blocks fe80::1 (IPv6 link-local)', () => {
    assertTrue(isPrivateIP('fe80::1'));
  });

  // --- isPrivateIP allows public IPv6 ---
  test('isPrivateIP allows 2001:4860:4860::8888 (Google DNS IPv6)', () => {
    assertFalse(isPrivateIP('2001:4860:4860::8888'));
  });

  // --- isCloudMetadata ---
  test('isCloudMetadata blocks 169.254.169.254', () => {
    assertTrue(isCloudMetadata('http://169.254.169.254/latest/meta-data/'));
  });

  test('isCloudMetadata allows normal URL', () => {
    assertFalse(isCloudMetadata('http://example.com/page'));
  });

  test('isCloudMetadata returns true for invalid URL', () => {
    assertTrue(isCloudMetadata('not-a-url'));
  });

  // --- isAllowedProtocol ---
  test('isAllowedProtocol allows http', () => {
    assertTrue(isAllowedProtocol('http://example.com'));
  });

  test('isAllowedProtocol allows https', () => {
    assertTrue(isAllowedProtocol('https://example.com'));
  });

  test('isAllowedProtocol blocks ftp', () => {
    assertFalse(isAllowedProtocol('ftp://example.com/file'));
  });

  test('isAllowedProtocol blocks javascript:', () => {
    assertFalse(isAllowedProtocol('javascript:alert(1)'));
  });

  test('isAllowedProtocol blocks data:', () => {
    assertFalse(isAllowedProtocol('data:text/html,<h1>test</h1>'));
  });

  test('isAllowedProtocol blocks file:', () => {
    assertFalse(isAllowedProtocol('file:///etc/passwd'));
  });

  // --- validateUrl ---
  test('validateUrl accepts valid https URL', () => {
    const result = validateUrl('https://example.com/page');
    assertTrue(result.valid);
  });

  test('validateUrl rejects private IP', () => {
    const result = validateUrl('http://192.168.1.1/admin');
    assertFalse(result.valid);
    assertTrue((result.reason ?? '').includes('Private'));
  });

  test('validateUrl rejects localhost', () => {
    const result = validateUrl('http://localhost:3000/api');
    assertFalse(result.valid);
    assertTrue((result.reason ?? '').includes('Internal'));
  });

  test('validateUrl rejects non-HTTP protocol', () => {
    const result = validateUrl('ftp://example.com/file');
    assertFalse(result.valid);
    assertTrue((result.reason ?? '').includes('Protocol'));
  });

  test('validateUrl rejects .local TLD', () => {
    const result = validateUrl('http://myserver.local/page');
    assertFalse(result.valid);
    assertTrue((result.reason ?? '').includes('TLD'));
  });

  test('validateUrl rejects .internal TLD', () => {
    const result = validateUrl('http://service.internal/api');
    assertFalse(result.valid);
  });

  test('validateUrl rejects URLs with credentials', () => {
    const result = validateUrl('http://user:pass@example.com/page');
    assertFalse(result.valid);
    assertTrue((result.reason ?? '').includes('credentials'));
  });

  test('validateUrl rejects empty string', () => {
    const result = validateUrl('');
    assertFalse(result.valid);
  });

  test('validateUrl rejects invalid URL format', () => {
    const result = validateUrl('not-a-url');
    assertFalse(result.valid);
  });

  // --- checkRedirectSafety ---
  test('checkRedirectSafety blocks redirect to private IP', () => {
    assertFalse(checkRedirectSafety('http://10.0.0.1/secret'));
  });

  test('checkRedirectSafety allows redirect to public URL', () => {
    assertTrue(checkRedirectSafety('https://example.com/page'));
  });

  test('checkRedirectSafety blocks redirect to localhost', () => {
    assertFalse(checkRedirectSafety('http://localhost:8080/admin'));
  });

  // --- validateResponseSize ---
  test('validateResponseSize accepts 1MB response', () => {
    assertTrue(validateResponseSize(1 * 1024 * 1024));
  });

  test('validateResponseSize accepts exactly 10MB', () => {
    assertTrue(validateResponseSize(10 * 1024 * 1024));
  });

  test('validateResponseSize rejects > 10MB', () => {
    assertFalse(validateResponseSize(10 * 1024 * 1024 + 1));
  });

  test('validateResponseSize rejects negative size', () => {
    assertFalse(validateResponseSize(-1));
  });

  test('validateResponseSize rejects NaN', () => {
    assertFalse(validateResponseSize(NaN));
  });

  test('validateResponseSize accepts 0', () => {
    assertTrue(validateResponseSize(0));
  });

  // Summary
  console.log(`\n  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(f));
  }
}

