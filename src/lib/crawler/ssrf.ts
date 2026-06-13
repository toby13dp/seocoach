/**
 * SSRF Protection Module
 *
 * Prevents Server-Side Request Forgery by validating URLs and IPs
 * before making any outbound HTTP requests during crawling.
 */

/** Maximum allowed response size in bytes (10 MB) */
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024;

/** Maximum compression ratio for decompression bomb detection */
const MAX_COMPRESSION_RATIO = 100;

/**
 * Checks whether an IP address belongs to a private or reserved range.
 *
 * Blocks:
 * - 10.0.0.0/8       (RFC 1918)
 * - 172.16.0.0/12    (RFC 1918)
 * - 192.168.0.0/16   (RFC 1918)
 * - 127.0.0.0/8      (Loopback)
 * - 0.0.0.0/8        (Current network)
 * - 169.254.0.0/16   (Link-local)
 * - fc00::/7         (IPv6 unique-local)
 * - ::1/128          (IPv6 loopback)
 * - fe80::/10        (IPv6 link-local)
 */
export function isPrivateIP(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  // IPv6 addresses
  if (normalized.includes(':')) {
    // ::1 — IPv6 loopback
    if (normalized === '::1' || normalized === '0000:0000:0000:0000:0000:0000:0000:0001') {
      return true;
    }

    // Expand shortened IPv6 for prefix checks
    const expanded = expandIPv6(normalized);

    // fc00::/7 — Unique local addresses (fc00:: and fd00::)
    const firstHex = expanded.split(':')[0].toLowerCase();
    if (firstHex.startsWith('fc') || firstHex.startsWith('fd')) {
      return true;
    }

    // fe80::/10 — Link-local addresses
    if (firstHex === 'fe80' || firstHex === 'fe81' || firstHex === 'fe82' ||
        firstHex === 'fe83' || firstHex === 'fe84' || firstHex === 'fe85' ||
        firstHex === 'fe86' || firstHex === 'fe87' || firstHex === 'fe88' ||
        firstHex === 'fe89' || firstHex === 'fe8a' || firstHex === 'fe8b' ||
        firstHex === 'fe8c' || firstHex === 'fe8d' || firstHex === 'fe8e' ||
        firstHex === 'fe8f') {
      return true;
    }

    return false;
  }

  // IPv4 addresses
  const parts = normalized.split('.');
  if (parts.length !== 4) return true; // Malformed IP is treated as private for safety

  const octets = parts.map((p) => {
    const n = parseInt(p, 10);
    return isNaN(n) ? -1 : n;
  });

  if (octets.some((o) => o < 0 || o > 255)) return true;

  const [a, b] = octets;

  // 10.0.0.0/8
  if (a === 10) return true;

  // 172.16.0.0/12 (172.16.x.x through 172.31.x.x)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 169.254.0.0/16 (Link-local)
  if (a === 169 && b === 254) return true;

  return false;
}

/**
 * Expands a shortened IPv6 address to its full 8-group form.
 * Used internally for prefix matching.
 */
function expandIPv6(ip: string): string {
  // Handle :: expansion
  if (ip === '::') {
    return '0000:0000:0000:0000:0000:0000:0000:0000';
  }

  let halves = ip.split('::');

  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    const middle = Array(missing).fill('0000');
    const groups = [...left, ...middle, ...right];
    return groups.map((g) => g.padStart(4, '0')).join(':');
  }

  return ip.split(':').map((g) => g.padStart(4, '0')).join(':');
}

/**
 * Checks whether a URL points to a cloud metadata endpoint.
 *
 * Blocks:
 * - 169.254.169.254 (AWS/GCP/Azure metadata)
 * - Any URL containing "metadata" in the hostname on link-local addresses
 */
export function isCloudMetadata(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // AWS/GCP/Azure metadata endpoint
    if (hostname === '169.254.169.254') return true;

    // Metadata endpoints on link-local
    if (hostname.includes('metadata') && hostname.includes('169.254')) return true;

    return false;
  } catch {
    return true;
  }
}

/**
 * Checks whether a URL uses an allowed protocol.
 *
 * Only http: and https: are permitted.
 */
export function isAllowedProtocol(url: string): boolean {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Comprehensive URL validation combining all SSRF checks.
 *
 * Returns an object with `valid` flag and optional `reason` for rejection.
 */
export function validateUrl(url: string): { valid: boolean; reason?: string } {
  // Basic URL format check
  if (!url || typeof url !== 'string') {
    return { valid: false, reason: 'URL is empty or not a string' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  // Protocol check
  if (!isAllowedProtocol(url)) {
    return { valid: false, reason: `Protocol "${parsed.protocol}" is not allowed` };
  }

  // Cloud metadata check
  if (isCloudMetadata(url)) {
    return { valid: false, reason: 'Cloud metadata endpoints are blocked' };
  }

  // Hostname resolution check
  const hostname = parsed.hostname;

  // Check if hostname is a direct IP address
  if (isIPv4(hostname) || isIPv6(hostname)) {
    if (isPrivateIP(hostname)) {
      return { valid: false, reason: 'Private IP addresses are not allowed' };
    }
  }

  // Block obvious internal hostnames
  const lowerHost = hostname.toLowerCase();
  const blockedHostnames = [
    'localhost',
    'localhost.localdomain',
    'ip6-localhost',
    'ip6-loopback',
  ];
  if (blockedHostnames.includes(lowerHost)) {
    return { valid: false, reason: 'Internal hostnames are not allowed' };
  }

  // Block .local, .internal, .localhost TLDs
  const tld = lowerHost.split('.').pop() ?? '';
  const blockedTlds = ['local', 'internal', 'localhost', 'intranet'];
  if (blockedTlds.includes(tld)) {
    return { valid: false, reason: `TLD ".${tld}" is not allowed` };
  }

  // Check for username/password in URL (common SSRF technique)
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'URLs with credentials are not allowed' };
  }

  return { valid: true };
}

/**
 * Checks whether a redirect URL is safe to follow.
 *
 * Ensures redirects don't point to private IPs or blocked endpoints.
 */
export function checkRedirectSafety(redirectUrl: string): boolean {
  const validation = validateUrl(redirectUrl);
  return validation.valid;
}

/**
 * Validates that a response size is within acceptable limits.
 *
 * @param contentLength - The Content-Length header value in bytes
 * @returns true if the response size is acceptable (≤ 10 MB)
 */
export function validateResponseSize(contentLength: number): boolean {
  if (typeof contentLength !== 'number' || isNaN(contentLength)) return false;
  if (contentLength < 0) return false;
  return contentLength <= MAX_RESPONSE_SIZE;
}

/**
 * Detects potential decompression bomb attacks by comparing
 * Content-Encoding with Content-Length.
 *
 * A suspicious response has a very small compressed size but
 * indicates a large potential decompressed output.
 */
export function checkDecompressionBomb(headers: Headers): boolean {
  const contentEncoding = headers.get('content-encoding');
  const contentLength = headers.get('content-length');

  if (!contentEncoding || !contentLength) return false;

  const encoding = contentEncoding.toLowerCase();
  const isCompressed = ['gzip', 'br', 'deflate', 'compress', 'zstd'].some(
    (enc) => encoding.includes(enc)
  );

  if (!isCompressed) return false;

  const length = parseInt(contentLength, 10);
  if (isNaN(length) || length <= 0) return false;

  // If compressed content is very small, estimate decompressed size
  // Common compression ratios: gzip ~3-10x, brotli ~5-15x
  // If the ratio would exceed MAX_COMPRESSION_RATIO, flag as suspicious
  const estimatedDecompressed = length * MAX_COMPRESSION_RATIO;
  if (estimatedDecompressed > MAX_RESPONSE_SIZE * 10) {
    return true;
  }

  return false;
}

/**
 * Checks whether a string is a valid IPv4 address.
 */
function isIPv4(s: string): boolean {
  const parts = s.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255 && p === String(n);
  });
}

/**
 * Checks whether a string is a valid IPv6 address.
 */
function isIPv6(s: string): boolean {
  if (!s.includes(':')) return false;
  // Simple heuristic: if it contains colons and can be expanded
  const expanded = expandIPv6(s);
  const groups = expanded.split(':');
  return groups.length === 8 && groups.every((g) => /^[0-9a-f]{4}$/i.test(g));
}
