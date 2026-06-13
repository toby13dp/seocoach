// ============================================================================
// Product Feeds — Feed Parser (XML / CSV / TSV)
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Parse XML (Google Merchant Center RSS), CSV, and TSV product feeds into
// a uniform FeedItemData[] structure. Supports Dutch and English column names.
// ============================================================================

import type { FeedItemData } from './types';

// ============================================================================
// CSV Column Mappings (Dutch / English)
// ============================================================================

/**
 * Maps FeedItemData field names to an array of possible CSV column names.
 * Both Dutch and English variants are supported.
 */
const CSV_FIELD_MAPPINGS: Record<keyof FeedItemData, string[]> = {
  title: [
    'titel', 'title', 'naam', 'name', 'producttitel',
    'product_title', 'product naam', 'productnaam',
  ],
  description: [
    'beschrijving', 'description', 'omschrijving',
    'productbeschrijving', 'product_description',
  ],
  gtin: ['gtin', 'ean', 'upc', 'isbn', 'barcode'],
  mpn: ['mpn', 'manufacturer_part_number', 'fabrikantnummer'],
  sku: ['sku', 'artikelnummer', 'artikel_id', 'product_id', 'id'],
  brand: ['merk', 'brand', 'fabrikant', 'manufacturer'],
  category: [
    'categorie', 'category', 'product_categorie',
    'product_category', 'google_product_category',
  ],
  productType: ['product_type', 'producttype', 'soort'],
  price: ['prijs', 'price', 'verkoopprijs', 'sale_price', 'regular_price'],
  salePrice: ['aanbiedingsprijs', 'sale_price', 'actieprijs'],
  currency: ['valuta', 'currency', 'munt'],
  availability: ['beschikbaarheid', 'availability', 'voorraad', 'stock', 'in_stock'],
  link: ['link', 'url', 'product_url', 'producturl', 'product-url'],
  imageLink: [
    'afbeelding', 'image_link', 'image', 'image_url',
    'imageurl', 'foto', 'image link',
  ],
};

// ============================================================================
// XML Field Mapping
// ============================================================================

/**
 * Maps XML element names (without namespace prefix) to FeedItemData field names.
 * Handles Google Merchant Center `g:` prefixed names as well as bare names.
 */
const XML_FIELD_MAP: Record<string, keyof FeedItemData> = {
  title: 'title',
  description: 'description',
  gtin: 'gtin',
  ean: 'gtin',
  upc: 'gtin',
  isbn: 'gtin',
  mpn: 'mpn',
  sku: 'sku',
  id: 'sku',
  brand: 'brand',
  category: 'category',
  product_category: 'category',
  google_product_category: 'category',
  product_type: 'productType',
  price: 'price',
  sale_price: 'salePrice',
  currency: 'currency',
  availability: 'availability',
  link: 'link',
  url: 'link',
  image_link: 'imageLink',
  image: 'imageLink',
  image_url: 'imageLink',
};

/**
 * Map an XML element name to a FeedItemData field name.
 * Strips namespace prefixes (e.g. "g:title" → "title") and normalises.
 */
function mapXMLField(elementName: string): keyof FeedItemData | null {
  // Strip namespace prefix (e.g. "g:title" → "title")
  const bare = elementName.replace(/^[a-zA-Z0-9_]+:/, '');
  const normalised = bare.toLowerCase().trim();
  return XML_FIELD_MAP[normalised] ?? null;
}

// ============================================================================
// CSV Column Mapping Helper
// ============================================================================

/**
 * Build a mapping from CSV column index to FeedItemData field name.
 * Uses case-insensitive matching and strips whitespace.
 */
function buildCSVColumnMap(headers: string[]): Map<number, keyof FeedItemData> {
  const map = new Map<number, keyof FeedItemData>();

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const header = headers[colIdx].toLowerCase().trim().replace(/['"]/g, '');

    for (const [field, aliases] of Object.entries(CSV_FIELD_MAPPINGS)) {
      if (aliases.includes(header)) {
        map.set(colIdx, field as keyof FeedItemData);
        break; // First match wins
      }
    }
  }

  return map;
}

// ============================================================================
// Price Parsing
// ============================================================================

/**
 * Parse a price string, stripping currency symbols and whitespace.
 * Handles formats like "EUR 29.99", "€29,99", "29.99 EUR", "29,99".
 *
 * @returns Parsed number or undefined if invalid
 */
function parsePrice(raw: string): number | undefined {
  if (!raw || raw.trim() === '') return undefined;

  // Remove common currency symbols and codes
  let cleaned = raw
    .replace(/[€$£¥]/g, '')
    .replace(/\b(EUR|USD|GBP|CHF|JPY)\b/gi, '')
    .trim();

  // Handle European decimal notation: "29,99" → "29.99"
  // But only if there's a comma followed by exactly 2 digits at the end
  cleaned = cleaned.replace(/,(\d{2})$/, '.$1');

  // Remove any remaining thousands separators
  cleaned = cleaned.replace(/\.(?=\d{3})/g, '').replace(/,(?=\d{3})/g, '');

  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

// ============================================================================
// XML Feed Parser
// ============================================================================

/**
 * Parse an XML feed in Google Merchant Center RSS format.
 * Handles `<rss><channel><item>` structure with `g:` namespaced elements
 * and CDATA sections.
 *
 * @param xmlContent - Raw XML string
 * @returns Array of parsed feed items
 */
export function parseXMLFeed(xmlContent: string): FeedItemData[] {
  const items: FeedItemData[] = [];

  // Extract all <item> blocks
  const itemRegex = /<item[\s>]/gi;
  const itemMatches: { index: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xmlContent)) !== null) {
    itemMatches.push({ index: match.index });
  }

  for (let i = 0; i < itemMatches.length; i++) {
    const startIdx = itemMatches[i].index;
    // Find the closing </item>
    const closeTag = '</item>';
    const closeIdx = xmlContent.indexOf(closeTag, startIdx);
    if (closeIdx === -1) continue;

    const itemXml = xmlContent.substring(startIdx, closeIdx + closeTag.length);
    const feedItem = parseXMLItem(itemXml);
    if (feedItem) {
      items.push(feedItem);
    }
  }

  return items;
}

/**
 * Parse a single <item> XML block into FeedItemData.
 */
function parseXMLItem(itemXml: string): FeedItemData | null {
  const data: FeedItemData = {};
  let hasData = false;

  // Match all elements within the item, including self-closing and namespaced
  // Handles: <g:title>value</g:title>, <title>value</title>, <g:price>29.99 EUR</g:price>
  const elementRegex = /<(?:[a-zA-Z0-9_]+:)?([a-zA-Z0-9_]+)(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?[a-zA-Z0-9_]+>/g;

  let elMatch: RegExpExecArray | null;
  while ((elMatch = elementRegex.exec(itemXml)) !== null) {
    const elementName = elMatch[1];
    let value = elMatch[2];

    if (!value) continue;

    // Strip CDATA wrappers
    value = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    if (value === '') continue;

    const fieldName = mapXMLField(elementName);
    if (!fieldName) continue;

    if (fieldName === 'price' || fieldName === 'salePrice') {
      const parsed = parsePrice(value);
      if (parsed !== undefined) {
        data[fieldName] = parsed;
        hasData = true;
      }
    } else {
      (data as Record<string, string | number | undefined>)[fieldName] = value;
      hasData = true;
    }
  }

  return hasData ? data : null;
}

// ============================================================================
// CSV Feed Parser
// ============================================================================

/**
 * Parse a CSV feed into FeedItemData items.
 * Supports Dutch and English column names via CSV_FIELD_MAPPINGS.
 *
 * @param csvContent - Raw CSV string (first line = headers)
 * @returns Array of parsed feed items
 */
export function parseCSVFeed(csvContent: string): FeedItemData[] {
  return parseDelimitedFeed(csvContent, ',');
}

// ============================================================================
// TSV Feed Parser
// ============================================================================

/**
 * Parse a TSV (tab-separated) feed into FeedItemData items.
 * Supports Dutch and English column names via CSV_FIELD_MAPPINGS.
 *
 * @param tsvContent - Raw TSV string (first line = headers)
 * @returns Array of parsed feed items
 */
export function parseTSVFeed(tsvContent: string): FeedItemData[] {
  return parseDelimitedFeed(tsvContent, '\t');
}

// ============================================================================
// Delimited Feed Parser (internal)
// ============================================================================

/**
 * Parse a delimited feed (CSV or TSV) into FeedItemData items.
 */
function parseDelimitedFeed(content: string, delimiter: string): FeedItemData[] {
  const lines = splitLines(content);
  if (lines.length < 2) return []; // Need at least header + 1 data row

  const headers = parseDelimitedLine(lines[0], delimiter);
  const columnMap = buildCSVColumnMap(headers);

  if (columnMap.size === 0) return []; // No recognised columns

  const items: FeedItemData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;

    const values = parseDelimitedLine(line, delimiter);
    const data: FeedItemData = {};
    let hasData = false;

    for (const entry of Array.from(columnMap.entries())) {
    const [colIdx, fieldName] = entry;
      const rawValue = (values[colIdx] ?? '').trim();
      if (rawValue === '') continue;

      if (fieldName === 'price' || fieldName === 'salePrice') {
        const parsed = parsePrice(rawValue);
        if (parsed !== undefined) {
          data[fieldName] = parsed;
          hasData = true;
        }
      } else {
        (data as Record<string, string | number | undefined>)[fieldName] = rawValue;
        hasData = true;
      }
    }

    if (hasData) {
      items.push(data);
    }
  }

  return items;
}

// ============================================================================
// Line Splitting & Parsing Helpers
// ============================================================================

/**
 * Split content into lines, handling both \r\n and \n line endings.
 */
function splitLines(content: string): string[] {
  return content.replace(/\r\n/g, '\n').split('\n');
}

/**
 * Parse a single delimited line, respecting quoted fields.
 * Handles: "value, with, commas", simple_value
 */
function parseDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  // Push the last field
  fields.push(current);

  return fields;
}

// ============================================================================
// Auto-Detect & Parse
// ============================================================================

/**
 * Auto-detect the feed format and parse it into FeedItemData items.
 *
 * Detection logic:
 * - If format is specified, use that
 * - If content starts with `<?xml` or `<rss`, treat as XML
 * - If content contains a tab character in the first line, treat as TSV
 * - Otherwise, treat as CSV
 *
 * @param content - Raw feed content
 * @param format - Optional explicit format override
 * @returns Array of parsed feed items
 */
export function parseFeed(
  content: string,
  format?: 'xml' | 'csv' | 'tsv'
): FeedItemData[] {
  const trimmed = content.trim();

  if (format === 'xml') {
    return parseXMLFeed(trimmed);
  }
  if (format === 'csv') {
    return parseCSVFeed(trimmed);
  }
  if (format === 'tsv') {
    return parseTSVFeed(trimmed);
  }

  // Auto-detect
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<rss')) {
    return parseXMLFeed(trimmed);
  }

  const firstLine = trimmed.split('\n')[0] ?? '';
  if (firstLine.includes('\t')) {
    return parseTSVFeed(trimmed);
  }

  return parseCSVFeed(trimmed);
}

// ============================================================================
// Map CSV Field (public for testing)
// ============================================================================

/**
 * Map a CSV column header name to a FeedItemData field name.
 * Returns null if no mapping is found.
 */
export function mapCSVField(columnName: string): string | null {
  const normalised = columnName.toLowerCase().trim().replace(/['"]/g, '');

  for (const [field, aliases] of Object.entries(CSV_FIELD_MAPPINGS)) {
    if (aliases.includes(normalised)) {
      return field;
    }
  }

  return null;
}
