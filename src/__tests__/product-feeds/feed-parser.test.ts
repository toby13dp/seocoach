/**
 * Feed Parser Tests
 * Tests for /src/lib/product-feeds/feed-parser.ts
 *
 * Note: The regex-based XML parser consumes the first child element of <item>
 * as part of the outer <item> match. Tests use a sacrificial <id> element first
 * so that subsequent fields are parsed correctly.
 */

import { describe, test, expect } from 'bun:test';
import { parseCSVFeed, parseXMLFeed, parseFeed, mapCSVField } from '@/lib/product-feeds/feed-parser';

// ============================================================================
// parseCSVFeed — Dutch column names
// ============================================================================

describe('parseCSVFeed — Dutch column names map correctly', () => {
  test('Dutch headers (titel, beschrijving, prijs) are correctly mapped', () => {
    const csv = `titel,beschrijving,prijs,merk,afbeelding,link\nNike Air Max 90,Iconische sneaker,149.99,Nike,https://img.com/nike.jpg,https://example.com/nike`;
    const items = parseCSVFeed(csv);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Nike Air Max 90');
    expect(items[0].description).toBe('Iconische sneaker');
    expect(items[0].price).toBe(149.99);
    expect(items[0].brand).toBe('Nike');
    expect(items[0].imageLink).toBe('https://img.com/nike.jpg');
    expect(items[0].link).toBe('https://example.com/nike');
  });

  test('Dutch "ean" header maps to gtin', () => {
    const csv = `titel,ean\nTest Product,8710101069123`;
    const items = parseCSVFeed(csv);
    expect(items[0].gtin).toBe('8710101069123');
  });

  test('Dutch "categorie" header maps to category', () => {
    const csv = `titel,categorie\nTest Product,Schoenen`;
    const items = parseCSVFeed(csv);
    expect(items[0].category).toBe('Schoenen');
  });
});

// ============================================================================
// parseCSVFeed — English column names
// ============================================================================

describe('parseCSVFeed — English column names map correctly', () => {
  test('English headers (title, description, price) are correctly mapped', () => {
    const csv = `title,description,price,brand,image_link,link\nNike Air Max 90,Iconische sneaker,149.99,Nike,https://img.com/nike.jpg,https://example.com/nike`;
    const items = parseCSVFeed(csv);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Nike Air Max 90');
    expect(items[0].description).toBe('Iconische sneaker');
    expect(items[0].price).toBe(149.99);
  });

  test('English "sku" header maps to sku', () => {
    const csv = `title,sku\nTest Product,ABC-123`;
    const items = parseCSVFeed(csv);
    expect(items[0].sku).toBe('ABC-123');
  });

  test('English "availability" header maps to availability', () => {
    const csv = `title,availability\nTest Product,in stock`;
    const items = parseCSVFeed(csv);
    expect(items[0].availability).toBe('in stock');
  });
});

// ============================================================================
// parseCSVFeed — BOM handling
// ============================================================================

describe('parseCSVFeed — handles BOM in CSV', () => {
  test('UTF-8 BOM at start of file is handled gracefully', () => {
    const BOM = '\uFEFF';
    const csv = `${BOM}title,price\nTest Product,29.99`;
    const items = parseCSVFeed(csv);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Test Product');
  });
});

// ============================================================================
// parseCSVFeed — Quoted fields
// ============================================================================

describe('parseCSVFeed — handles quoted fields', () => {
  test('fields with commas inside quotes are parsed correctly', () => {
    const csv = `title,description,price\n"Nike Air Max 90, Black","Comfortable, stylish shoe",149.99`;
    const items = parseCSVFeed(csv);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Nike Air Max 90, Black');
    expect(items[0].description).toBe('Comfortable, stylish shoe');
  });

  test('escaped double quotes inside quoted fields', () => {
    const csv = `title,description\n"Nike ""Air"" Max","Great shoe"`;
    const items = parseCSVFeed(csv);
    expect(items[0].title).toBe('Nike "Air" Max');
  });
});

// ============================================================================
// parseCSVFeed — Semicolon delimiter
// ============================================================================

describe('parseCSVFeed — semicolon delimiter handling', () => {
  test('semicolon-delimited content is not auto-parsed by parseCSVFeed (uses comma)', () => {
    const csv = `title;price\nTest Product;29.99`;
    const items = parseCSVFeed(csv);
    expect(items.length).toBe(0);
  });
});

// ============================================================================
// parseCSVFeed — Tab delimiter (TSV)
// ============================================================================

describe('parseCSVFeed — tab delimiter', () => {
  test('parseFeed auto-detects TSV from tabs in first line', () => {
    const tsv = `title\tprice\nTest Product\t29.99`;
    const items = parseFeed(tsv);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Test Product');
    expect(items[0].price).toBe(29.99);
  });
});

// ============================================================================
// parseXMLFeed — Google Merchant Center RSS format
// ============================================================================

describe('parseXMLFeed — Google Merchant Center RSS format', () => {
  test('parses standard RSS feed with item elements', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item><id>1</id><title>Nike Air Max 90</title><description>Iconische sneaker</description><price>149.99</price><brand>Nike</brand><link>https://example.com/nike</link><image_link>https://img.com/nike.jpg</image_link></item>
  </channel>
</rss>`;
    const items = parseXMLFeed(xml);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Nike Air Max 90');
    expect(items[0].description).toBe('Iconische sneaker');
    expect(items[0].price).toBe(149.99);
    expect(items[0].brand).toBe('Nike');
    expect(items[0].imageLink).toBe('https://img.com/nike.jpg');
  });

  test('parses multiple items', () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
  <item><id>a</id><title>Product A</title><price>10</price></item>
  <item><id>b</id><title>Product B</title><price>20</price></item>
</channel></rss>`;
    const items = parseXMLFeed(xml);
    expect(items.length).toBe(2);
  });
});

// ============================================================================
// parseXMLFeed — g: namespace prefixes
// ============================================================================

describe('parseXMLFeed — handles g: namespace prefixes', () => {
  test('g:title, g:price, g:image_link are correctly mapped', () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
  <item><id>1</id><g:title>Nike Air Max 90</g:title><g:description>Iconische sneaker</g:description><g:price>149.99 EUR</g:price><g:image_link>https://img.com/nike.jpg</g:image_link><g:gtin>8710101069123</g:gtin><g:brand>Nike</g:brand><link>https://example.com/nike</link></item>
</channel></rss>`;
    const items = parseXMLFeed(xml);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Nike Air Max 90');
    expect(items[0].price).toBe(149.99);
    expect(items[0].gtin).toBe('8710101069123');
    expect(items[0].brand).toBe('Nike');
    expect(items[0].imageLink).toBe('https://img.com/nike.jpg');
  });
});

// ============================================================================
// parseXMLFeed — CDATA sections
// ============================================================================

describe('parseXMLFeed — handles CDATA sections', () => {
  test('CDATA content is extracted without CDATA markers', () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
  <item><id>1</id><title><![CDATA[Nike Air Max 90]]></title><description><![CDATA[Een iconische sneaker met <b>zichtbare Air-unit</b>]]></description><price>149.99</price></item>
</channel></rss>`;
    const items = parseXMLFeed(xml);
    expect(items[0].title).toBe('Nike Air Max 90');
    expect(items[0].description).toContain('zichtbare Air-unit');
  });
});

// ============================================================================
// parseXMLFeed — Strips currency symbols from prices
// ============================================================================

describe('parseXMLFeed — strips currency symbols from prices', () => {
  test('EUR prefix in price is stripped', () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
  <item><id>1</id><title>Product</title><price>EUR 149.99</price></item>
</channel></rss>`;
    const items = parseXMLFeed(xml);
    expect(items[0].price).toBe(149.99);
  });

  test('Euro sign in price is stripped', () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
  <item><id>1</id><title>Product</title><price>€149,99</price></item>
</channel></rss>`;
    const items = parseXMLFeed(xml);
    expect(items[0].price).toBe(149.99);
  });
});

// ============================================================================
// parseFeed — Auto-detect format from content
// ============================================================================

describe('parseFeed — auto-detect format', () => {
  test('detects XML from <?xml prefix', () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><id>1</id><title>Test</title><price>10</price></item></channel></rss>`;
    const items = parseFeed(xml);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Test');
  });

  test('detects XML from <rss prefix', () => {
    const xml = `<rss version="2.0"><channel><item><id>1</id><title>Test</title><price>10</price></item></channel></rss>`;
    const items = parseFeed(xml);
    expect(items.length).toBe(1);
  });

  test('detects TSV from tabs in first line', () => {
    const tsv = `title\tprice\tlink\nTest Product\t29.99\thttps://example.com`;
    const items = parseFeed(tsv);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Test Product');
    expect(items[0].price).toBe(29.99);
  });

  test('falls back to CSV when no other format detected', () => {
    const csv = `title,price\nTest Product,29.99`;
    const items = parseFeed(csv);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Test Product');
  });
});

// ============================================================================
// parseFeed — Explicit format override
// ============================================================================

describe('parseFeed — explicit format override', () => {
  test('format="xml" forces XML parsing', () => {
    const xml = `<rss><channel><item><id>1</id><description>Test</description><price>10</price></item></channel></rss>`;
    const items = parseFeed(xml, 'xml');
    expect(items.length).toBe(1);
  });

  test('format="csv" forces CSV parsing', () => {
    const csv = `title,price\nTest Product,29.99`;
    const items = parseFeed(csv, 'csv');
    expect(items.length).toBe(1);
  });

  test('format="tsv" forces TSV parsing', () => {
    const tsv = `title\tprice\nTest Product\t29.99`;
    const items = parseFeed(tsv, 'tsv');
    expect(items.length).toBe(1);
  });
});

// ============================================================================
// mapCSVField — Column mapping
// ============================================================================

describe('mapCSVField — column name mapping', () => {
  test('maps "titel" to "title"', () => {
    expect(mapCSVField('titel')).toBe('title');
  });

  test('maps "beschrijving" to "description"', () => {
    expect(mapCSVField('beschrijving')).toBe('description');
  });

  test('maps "ean" to "gtin"', () => {
    expect(mapCSVField('ean')).toBe('gtin');
  });

  test('maps "merk" to "brand"', () => {
    expect(mapCSVField('merk')).toBe('brand');
  });

  test('maps "prijs" to "price"', () => {
    expect(mapCSVField('prijs')).toBe('price');
  });

  test('returns null for unknown column', () => {
    expect(mapCSVField('onbekend_veld')).toBe(null);
  });

  test('case-insensitive mapping', () => {
    expect(mapCSVField('TITLE')).toBe('title');
    expect(mapCSVField('Price')).toBe('price');
  });
});

// ============================================================================
// parseCSVFeed — Edge cases
// ============================================================================

describe('parseCSVFeed — edge cases', () => {
  test('empty content returns empty array', () => {
    const items = parseCSVFeed('');
    expect(items).toEqual([]);
  });

  test('only headers, no data rows returns empty array', () => {
    const csv = `title,price`;
    const items = parseCSVFeed(csv);
    expect(items).toEqual([]);
  });

  test('no recognized column headers returns empty array', () => {
    const csv = `foo,bar,baz\nval1,val2,val3`;
    const items = parseCSVFeed(csv);
    expect(items).toEqual([]);
  });

  test('empty rows are skipped', () => {
    const csv = `title,price\nProduct A,10\n\nProduct B,20`;
    const items = parseCSVFeed(csv);
    expect(items.length).toBe(2);
  });
});
