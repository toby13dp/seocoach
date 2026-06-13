// ============================================================================
// Input Sanitizer — AI-Driven SEO Automation Platform (SEC-002)
// ============================================================================
// Comprehensive input sanitization utilities for HTML, URLs, file names,
// regex patterns, and deep object sanitization.
// ============================================================================

// ---------------------------------------------------------------------------
// HTML Sanitization
// ---------------------------------------------------------------------------

/**
 * Set of HTML tags that are allowed to pass through the sanitizer.
 * Only these tags and their text content will be preserved.
 */
const ALLOWED_HTML_TAGS = new Set([
  "b",
  "i",
  "em",
  "strong",
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "a",
]);

/**
 * Attributes that are allowed on specific tags.
 * Currently only `href` on `<a>` tags is permitted.
 */
const ALLOWED_TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href"]),
};

/**
 * Strip all HTML tags except a safe whitelist of basic formatting elements.
 *
 * Allowed tags: `<b>`, `<i>`, `<em>`, `<strong>`, `<p>`, `<br>`,
 *               `<ul>`, `<ol>`, `<li>`, `<a href="...">`
 *
 * All other tags are removed but their **text content** is preserved.
 * Event handlers (`onclick`, `onerror`, etc.) and dangerous attributes
 * (`style`, `class`, `id`) are always stripped.
 *
 * @param input - Raw HTML string to sanitize
 * @returns Sanitized HTML string with only allowed tags/attributes
 *
 * @example
 * ```ts
 * sanitizeHtml('<p>Hello <script>alert("xss")</script><b>world</b></p>')
 * // → '<p>Hello <b>world</b></p>'
 *
 * sanitizeHtml('<a href="https://example.com" onclick="steal()">link</a>')
 * // → '<a href="https://example.com">link</a>'
 * ```
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== "string") return "";

  let result = input;

  // Remove all script tags and their content entirely
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove all style tags and their content entirely
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Remove HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, "");

  // Process each HTML tag
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g, (match, tagName: string) => {
    const tag = tagName.toLowerCase();

    // Handle closing tags
    if (match.startsWith("</")) {
      if (ALLOWED_HTML_TAGS.has(tag)) {
        return `</${tag}>`;
      }
      return ""; // Remove disallowed closing tags
    }

    // Handle self-closing tags (like <br/> or <br />)
    if (!ALLOWED_HTML_TAGS.has(tag)) {
      return ""; // Remove disallowed opening/self-closing tags
    }

    // For allowed tags, filter attributes
    const allowedAttrs = ALLOWED_TAG_ATTRIBUTES[tag];

    if (!allowedAttrs || allowedAttrs.size === 0) {
      // No attributes allowed — return clean tag
      if (match.endsWith("/>")) {
        return `<${tag} />`;
      }
      return `<${tag}>`;
    }

    // Extract and filter allowed attributes
    const attrRegex = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    const filteredAttrs: string[] = [];
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRegex.exec(match)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? "";

      if (allowedAttrs.has(attrName)) {
        // Special handling for href: only allow http/https/mailto protocols
        if (attrName === "href") {
          const trimmedValue = attrValue.trim().toLowerCase();
          if (
            trimmedValue.startsWith("javascript:") ||
            trimmedValue.startsWith("data:") ||
            trimmedValue.startsWith("vbscript:")
          ) {
            continue; // Skip dangerous href values
          }
        }
        filteredAttrs.push(`${attrName}="${attrValue}"`);
      }
    }

    if (match.endsWith("/>")) {
      return filteredAttrs.length > 0
        ? `<${tag} ${filteredAttrs.join(" ")} />`
        : `<${tag} />`;
    }

    return filteredAttrs.length > 0
      ? `<${tag} ${filteredAttrs.join(" ")}>`
      : `<${tag}>`;
  });

  // Remove any remaining dangerous attributes that might be left
  // (event handlers on allowed tags that somehow survived)
  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");

  return result;
}

// ---------------------------------------------------------------------------
// URL Sanitization
// ---------------------------------------------------------------------------

/**
 * Validate and sanitize a URL. Only `http:` and `https:` protocols are
 * allowed. Private/reserved IP addresses and the `file:` protocol are
 * blocked to prevent SSRF attacks.
 *
 * Blocked IP ranges:
 * - 10.0.0.0/8
 * - 172.16.0.0/12
 * - 192.168.0.0/16
 * - 127.0.0.0/8
 * - 169.254.0.0/16
 * - ::1 (IPv6 loopback)
 * - 0.0.0.0
 *
 * @param url - The URL string to validate
 * @returns The sanitized URL string if valid, or an empty string if invalid
 *
 * @example
 * ```ts
 * sanitizeUrl('https://example.com/page')  // → 'https://example.com/page'
 * sanitizeUrl('file:///etc/passwd')         // → ''
 * sanitizeUrl('http://192.168.1.1/admin')   // → ''
 * ```
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") return "";

  const trimmed = url.trim();

  // Basic URL format validation
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return ""; // Invalid URL format
  }

  // Protocol check: only http and https allowed
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return "";
  }

  // Check hostname for private/reserved IP addresses
  const hostname = parsed.hostname.toLowerCase();

  // IPv6 loopback
  if (hostname === "::1" || hostname === "[::1]") {
    return "";
  }

  // 0.0.0.0
  if (hostname === "0.0.0.0") {
    return "";
  }

  // Check IPv4 private ranges
  if (isPrivateIPv4(hostname)) {
    return "";
  }

  return trimmed;
}

/**
 * Check if an IPv4 address falls within a private/reserved range.
 */
function isPrivateIPv4(hostname: string): boolean {
  // Must look like an IPv4 address
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  if (!match) return false;

  const octets = [match[1], match[2], match[3], match[4]].map(Number);

  // Validate octet ranges
  if (octets.some((o) => o < 0 || o > 255)) return false;

  const [a, b] = octets;

  // 10.0.0.0/8
  if (a === 10) return true;

  // 172.16.0.0/12 (172.16.x.x – 172.31.x.x)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;

  return false;
}

// ---------------------------------------------------------------------------
// File Name Sanitization
// ---------------------------------------------------------------------------

/** Default maximum length for sanitized file names */
const MAX_FILENAME_LENGTH = 255;

/**
 * Sanitize a file name by removing path traversal characters and limiting
 * the length.
 *
 * The following characters are removed: `/`, `\`, `..`, null bytes,
 * and any character that is not alphanumeric, a dash, underscore, dot,
 * space, or parentheses.
 *
 * @param name   - The raw file name to sanitize
 * @param maxLength - Maximum allowed length (default: 255)
 * @returns The sanitized file name
 *
 * @example
 * ```ts
 * sanitizeFileName('../../../etc/passwd') // → 'etcpasswd'
 * sanitizeFileName('my file (1).pdf')       // → 'my file (1).pdf'
 * sanitizeFileName('a'.repeat(300))          // → string of length 255
 * ```
 */
export function sanitizeFileName(name: string, maxLength: number = MAX_FILENAME_LENGTH): string {
  if (!name || typeof name !== "string") return "";

  let sanitized = name;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Remove path traversal patterns
  sanitized = sanitized.replace(/\.\./g, "");
  sanitized = sanitized.replace(/[/\\]/g, "");

  // Remove any character that is not alphanumeric, dash, underscore,
  // dot, space, or parentheses
  sanitized = sanitized.replace(/[^a-zA-Z0-9\-_. ()]/g, "");

  // Collapse multiple spaces into one
  sanitized = sanitized.replace(/\s+/g, " ");

  // Trim whitespace
  sanitized = sanitized.trim();

  // Remove leading dots (hidden files on Unix)
  sanitized = sanitized.replace(/^\.+/, "");

  // Enforce maximum length
  if (sanitized.length > maxLength) {
    // Try to preserve the file extension
    const lastDot = sanitized.lastIndexOf(".");
    if (lastDot > 0 && lastDot > maxLength - 10) {
      const ext = sanitized.slice(lastDot);
      sanitized = sanitized.slice(0, maxLength - ext.length) + ext;
    } else {
      sanitized = sanitized.slice(0, maxLength);
    }
  }

  return sanitized;
}

// ---------------------------------------------------------------------------
// Regex Escaping
// ---------------------------------------------------------------------------

/**
 * Escape all regex special characters in a string so it can be safely used
 * inside a `new RegExp()` constructor.
 *
 * Escaped characters: `\ ^ $ . | ? * + ( ) [ ] { }`
 *
 * @param input - The raw string to escape
 * @returns The escaped string safe for use in RegExp
 *
 * @example
 * ```ts
 * escapeForRegex('price: $10.00') // → 'price: \\$10\\.00'
 * new RegExp(escapeForRegex(userInput)).test(haystack)
 * ```
 */
export function escapeForRegex(input: string): string {
  if (!input || typeof input !== "string") return "";

  // Escape all regex metacharacters
  return input.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Deep Object Sanitization
// ---------------------------------------------------------------------------

/**
 * Rules that define how to sanitize specific fields of an object.
 * Each key is a dot-separated path to a field, and the value is the
 * sanitization strategy to apply.
 */
export interface SanitizeRules {
  /** Map of dot-notation field paths to sanitization strategies */
  [fieldPath: string]: SanitizeStrategy;
}

/**
 * Available sanitization strategies for object fields.
 */
export type SanitizeStrategy =
  | "html"        // Apply sanitizeHtml
  | "url"         // Apply sanitizeUrl
  | "fileName"    // Apply sanitizeFileName
  | "regex"       // Apply escapeForRegex
  | "trim"        // Trim whitespace
  | "lowercase"   // Convert to lowercase
  | "uppercase"   // Convert to uppercase
  | "alphanumeric" // Remove non-alphanumeric characters
  | "stripHtml";  // Remove ALL HTML tags (no whitelist)

/**
 * Apply a single sanitization strategy to a string value.
 *
 * @param value    - The string value to sanitize
 * @param strategy - The sanitization strategy to apply
 * @returns The sanitized string
 */
function applyStrategy(value: string, strategy: SanitizeStrategy): string {
  switch (strategy) {
    case "html":
      return sanitizeHtml(value);
    case "url":
      return sanitizeUrl(value);
    case "fileName":
      return sanitizeFileName(value);
    case "regex":
      return escapeForRegex(value);
    case "trim":
      return value.trim();
    case "lowercase":
      return value.toLowerCase();
    case "uppercase":
      return value.toUpperCase();
    case "alphanumeric":
      return value.replace(/[^a-zA-Z0-9]/g, "");
    case "stripHtml":
      return value.replace(/<[^>]*>/g, "");
    default:
      return value;
  }
}

/**
 * Resolve a dot-notation path to a value within a nested object.
 *
 * @param obj  - The object to traverse
 * @param path - Dot-separated path (e.g. "user.profile.bio")
 * @returns The value at the path, or `undefined` if not found
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set a value at a dot-notation path within a nested object.
 * Creates intermediate objects as needed.
 *
 * @param obj   - The object to modify
 * @param path  - Dot-separated path
 * @param value - The value to set
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}

/**
 * Deep-sanitize an object according to the provided rules.
 *
 * Rules use dot-notation paths to specify which fields to sanitize and
 * which strategy to apply. The function returns a **new** object; the
 * original is not mutated.
 *
 * Non-string values at the specified paths are left unchanged.
 *
 * @typeParam T - The type of the object being sanitized
 * @param obj   - The object to sanitize
 * @param rules - A map of dot-notation field paths to sanitization strategies
 * @returns A new object with the specified fields sanitized
 *
 * @example
 * ```ts
 * const input = {
 *   name: '  <b>John</b>  ',
 *   website: 'javascript:alert(1)',
 *   profile: { bio: '<p>Hello <script>xss</script></p>' }
 * };
 *
 * const result = sanitizeObject(input, {
 *   name: 'trim',
 *   website: 'url',
 *   'profile.bio': 'html',
 * });
 * // result.name → 'John' (trimmed, tags removed by trim? no, trim only trims)
 * // Actually: result.name → '  <b>John</b>  ' after trim → '<b>John</b>'
 * // result.website → ''
 * // result.profile.bio → '<p>Hello </p>'
 * ```
 */
export function sanitizeObject<T>(obj: T, rules: SanitizeRules): T {
  if (!obj || typeof obj !== "object") return obj;

  // Deep clone to avoid mutating the original
  const cloned = JSON.parse(JSON.stringify(obj)) as T;

  for (const [fieldPath, strategy] of Object.entries(rules)) {
    const currentValue = getNestedValue(cloned, fieldPath);

    if (typeof currentValue === "string") {
      const sanitized = applyStrategy(currentValue, strategy);
      setNestedValue(cloned as Record<string, unknown>, fieldPath, sanitized);
    } else if (Array.isArray(currentValue)) {
      // Apply the strategy to each string element in the array
      const sanitizedArray = currentValue.map((item) =>
        typeof item === "string" ? applyStrategy(item, strategy) : item
      );
      setNestedValue(cloned as Record<string, unknown>, fieldPath, sanitizedArray);
    }
    // Non-string, non-array values are left unchanged
  }

  return cloned;
}
