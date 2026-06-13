/**
 * Feed Validator Tests
 * Tests for /src/lib/product-feeds/feed-validator.ts
 */

import { describe, test, expect } from 'bun:test';
import { FeedType, FeedValidationStatus, FeedIssueSeverity } from '@prisma/client';
import { validateFeedItem } from '@/lib/product-feeds/feed-validator';

// ============================================================================
// Helpers
// ============================================================================

/** Build a complete merchant feed item that should pass validation */
function completeMerchantItem() {
  return {
    title: 'Nike Air Max 90 Heren Schoenen Zwart',
    description: 'Iconische Nike Air Max 90 sneaker met zichtbare Air-unit en comfortabele pasvorm voor dagelijks gebruik.',
    gtin: '8710101069123',
    mpn: 'CW4653-001',
    sku: 'NIKE-AM90-BW',
    brand: 'Nike',
    category: 'Schoenen > Heren > Sneakers',
    productType: 'Schoenen',
    price: 149.99,
    salePrice: 119.99,
    currency: 'EUR',
    availability: 'in stock',
    link: 'https://example.com/nike-air-max-90',
    imageLink: 'https://example.com/images/nike-air-max-90.jpg',
  };
}

// ============================================================================
// validateFeedItem — Complete item is VALID
// ============================================================================

describe('validateFeedItem — complete merchant feed item is VALID', () => {
  test('complete item with all fields passes validation', () => {
    const result = validateFeedItem(completeMerchantItem(), FeedType.MERCHANT);
    expect(result.validationStatus).toBe(FeedValidationStatus.VALID);
    expect(result.issues).toEqual([]);
  });
});

// ============================================================================
// validateFeedItem — Missing title (required)
// ============================================================================

describe('validateFeedItem — missing title produces ERROR in Dutch', () => {
  test('missing title on merchant feed produces ERROR', () => {
    const item = { ...completeMerchantItem(), title: undefined };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    expect(result.validationStatus).toBe(FeedValidationStatus.INVALID);
    const titleIssues = result.issues.filter(i => i.field === 'title');
    expect(titleIssues.some(i => i.severity === FeedIssueSeverity.ERROR)).toBe(true);
  });

  test('error message is in Dutch', () => {
    const item = { ...completeMerchantItem(), title: undefined };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const titleIssues = result.issues.filter(i => i.field === 'title');
    expect(titleIssues.some(i => i.message.includes('verplicht'))).toBe(true);
  });
});

// ============================================================================
// validateFeedItem — Title too long (>150)
// ============================================================================

describe('validateFeedItem — title too long produces ERROR in Dutch', () => {
  test('title over 150 characters produces ERROR', () => {
    const item = {
      ...completeMerchantItem(),
      title: 'A'.repeat(151),
    };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const titleIssues = result.issues.filter(i => i.field === 'title' && i.ruleName === 'maxLength');
    expect(titleIssues.length).toBeGreaterThan(0);
    expect(titleIssues[0].severity).toBe(FeedIssueSeverity.ERROR);
  });

  test('Dutch message about title length', () => {
    const item = {
      ...completeMerchantItem(),
      title: 'A'.repeat(151),
    };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const titleIssues = result.issues.filter(i => i.field === 'title' && i.ruleName === 'maxLength');
    expect(titleIssues[0].message).toContain('te lang');
  });
});

// ============================================================================
// validateFeedItem — Title too short (<10)
// ============================================================================

describe('validateFeedItem — title too short produces WARNING in Dutch', () => {
  test('title under 10 characters produces WARNING', () => {
    const item = {
      ...completeMerchantItem(),
      title: 'Short',
    };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const titleIssues = result.issues.filter(i => i.field === 'title' && i.ruleName === 'minLength');
    expect(titleIssues.length).toBeGreaterThan(0);
    expect(titleIssues[0].severity).toBe(FeedIssueSeverity.WARNING);
  });

  test('Dutch message about short title', () => {
    const item = {
      ...completeMerchantItem(),
      title: 'Short',
    };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const titleIssues = result.issues.filter(i => i.field === 'title' && i.ruleName === 'minLength');
    expect(titleIssues[0].message).toContain('te kort');
  });
});

// ============================================================================
// validateFeedItem — Promotional text in title
// ============================================================================

describe('validateFeedItem — promotional text in title produces WARNING in Dutch', () => {
  test('"beste" in title produces promotional text warning', () => {
    const item = {
      ...completeMerchantItem(),
      title: 'De beste Nike Air Max 90 Schoenen',
    };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const promoIssues = result.issues.filter(i => i.ruleName === 'promotionalText');
    expect(promoIssues.length).toBeGreaterThan(0);
    expect(promoIssues[0].severity).toBe(FeedIssueSeverity.WARNING);
  });

  test('"goedkoopste" in title produces promotional text warning', () => {
    const item = {
      ...completeMerchantItem(),
      title: 'De goedkoopste Nike Air Max 90 Schoenen',
    };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const promoIssues = result.issues.filter(i => i.ruleName === 'promotionalText');
    expect(promoIssues.length).toBeGreaterThan(0);
  });

  test('Dutch warning about promotional text', () => {
    const item = {
      ...completeMerchantItem(),
      title: 'De beste schoenen ooit',
    };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const promoIssues = result.issues.filter(i => i.ruleName === 'promotionalText');
    expect(promoIssues[0].message).toContain('promotionele');
  });
});

// ============================================================================
// validateFeedItem — Missing GTIN for merchant feed
// ============================================================================

describe('validateFeedItem — missing GTIN for merchant produces ERROR in Dutch', () => {
  test('missing GTIN on merchant feed produces ERROR', () => {
    const item = { ...completeMerchantItem(), gtin: undefined };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const gtinIssues = result.issues.filter(i => i.field === 'gtin');
    expect(gtinIssues.some(i => i.severity === FeedIssueSeverity.ERROR)).toBe(true);
  });

  test('Dutch error message about GTIN required for merchant', () => {
    const item = { ...completeMerchantItem(), gtin: undefined };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const gtinIssues = result.issues.filter(i => i.field === 'gtin');
    expect(gtinIssues.some(i => i.message.includes('verplicht'))).toBe(true);
  });

  test('missing GTIN on non-merchant feed produces INFO, not ERROR', () => {
    const item = { ...completeMerchantItem(), gtin: undefined };
    const result = validateFeedItem(item, FeedType.COMPARISON);
    const gtinIssues = result.issues.filter(i => i.field === 'gtin');
    expect(gtinIssues.some(i => i.severity === FeedIssueSeverity.INFO)).toBe(true);
  });
});

// ============================================================================
// validateFeedItem — Invalid GTIN format
// ============================================================================

describe('validateFeedItem — invalid GTIN format produces ERROR in Dutch', () => {
  test('GTIN with wrong digit count produces ERROR', () => {
    const item = { ...completeMerchantItem(), gtin: '12345' };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const gtinIssues = result.issues.filter(i => i.field === 'gtin' && i.ruleName === 'pattern');
    expect(gtinIssues.length).toBeGreaterThan(0);
    expect(gtinIssues[0].severity).toBe(FeedIssueSeverity.ERROR);
  });

  test('Dutch message about invalid GTIN format', () => {
    const item = { ...completeMerchantItem(), gtin: 'ABCDEF' };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const gtinIssues = result.issues.filter(i => i.field === 'gtin' && i.ruleName === 'pattern');
    expect(gtinIssues[0].message).toContain('ongeldig');
  });

  test('valid 13-digit EAN passes GTIN validation', () => {
    const item = { ...completeMerchantItem(), gtin: '8710101069123' };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const gtinIssues = result.issues.filter(i => i.field === 'gtin' && i.ruleName === 'pattern');
    expect(gtinIssues.length).toBe(0);
  });
});

// ============================================================================
// validateFeedItem — Missing price
// ============================================================================

describe('validateFeedItem — missing price produces ERROR in Dutch', () => {
  test('missing price on merchant feed produces ERROR', () => {
    const item = { ...completeMerchantItem(), price: undefined };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const priceRequiredIssues = result.issues.filter(i => i.field === 'price' && i.ruleName === 'required');
    expect(priceRequiredIssues.length).toBeGreaterThan(0);
    expect(priceRequiredIssues[0].severity).toBe(FeedIssueSeverity.ERROR);
  });
});

// ============================================================================
// validateFeedItem — Negative price
// ============================================================================

describe('validateFeedItem — negative price produces ERROR in Dutch', () => {
  test('negative price produces ERROR', () => {
    const item = { ...completeMerchantItem(), price: -10 };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const priceIssues = result.issues.filter(i => i.field === 'price' && i.ruleName === 'negative');
    expect(priceIssues.length).toBeGreaterThan(0);
    expect(priceIssues[0].severity).toBe(FeedIssueSeverity.ERROR);
  });

  test('Dutch error about negative price', () => {
    const item = { ...completeMerchantItem(), price: -10 };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const priceIssues = result.issues.filter(i => i.field === 'price' && i.ruleName === 'negative');
    expect(priceIssues[0].message).toContain('negatief');
  });
});

// ============================================================================
// validateFeedItem — Sale price > regular price
// ============================================================================

describe('validateFeedItem — sale price > regular price produces ERROR in Dutch', () => {
  test('sale price higher than regular price produces ERROR', () => {
    const item = { ...completeMerchantItem(), price: 100, salePrice: 150 };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const saleIssues = result.issues.filter(i => i.field === 'salePrice' && i.ruleName === 'saleGreaterThanRegular');
    expect(saleIssues.length).toBeGreaterThan(0);
    expect(saleIssues[0].severity).toBe(FeedIssueSeverity.ERROR);
  });

  test('Dutch error about sale price exceeding regular price', () => {
    const item = { ...completeMerchantItem(), price: 100, salePrice: 150 };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const saleIssues = result.issues.filter(i => i.field === 'salePrice' && i.ruleName === 'saleGreaterThanRegular');
    expect(saleIssues[0].message).toContain('hoger');
  });
});

// ============================================================================
// validateFeedItem — Missing image for merchant
// ============================================================================

describe('validateFeedItem — missing image for merchant produces INFO (recommended)', () => {
  test('missing imageLink on merchant feed produces INFO (recommended field)', () => {
    const item = { ...completeMerchantItem(), imageLink: undefined };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const imageIssues = result.issues.filter(i => i.field === 'imageLink');
    // imageLink is recommended (not required) for MERCHANT
    expect(imageIssues.some(i => i.ruleName === 'recommended')).toBe(true);
  });

  test('missing imageLink on META_CATALOGUE feed produces ERROR (required field)', () => {
    const item = { ...completeMerchantItem(), imageLink: undefined };
    const result = validateFeedItem(item, FeedType.META_CATALOGUE);
    const imageIssues = result.issues.filter(i => i.field === 'imageLink');
    expect(imageIssues.some(i => i.severity === FeedIssueSeverity.ERROR)).toBe(true);
  });
});

// ============================================================================
// validateFeedItem — Missing link
// ============================================================================

describe('validateFeedItem — missing link produces ERROR in Dutch', () => {
  test('missing link on merchant feed produces ERROR', () => {
    const item = { ...completeMerchantItem(), link: undefined };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const linkIssues = result.issues.filter(i => i.field === 'link' && i.ruleName === 'required');
    expect(linkIssues.length).toBeGreaterThan(0);
    expect(linkIssues[0].severity).toBe(FeedIssueSeverity.ERROR);
  });
});

// ============================================================================
// validateFeedItem — Invalid URL format
// ============================================================================

describe('validateFeedItem — invalid URL format produces ERROR in Dutch', () => {
  test('invalid URL produces ERROR', () => {
    const item = { ...completeMerchantItem(), link: 'not-a-valid-url' };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const linkIssues = result.issues.filter(i => i.field === 'link' && i.ruleName === 'invalidUrl');
    expect(linkIssues.length).toBeGreaterThan(0);
    expect(linkIssues[0].severity).toBe(FeedIssueSeverity.ERROR);
  });

  test('Dutch error about invalid URL format', () => {
    const item = { ...completeMerchantItem(), link: 'not-a-valid-url' };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const linkIssues = result.issues.filter(i => i.field === 'link' && i.ruleName === 'invalidUrl');
    expect(linkIssues[0].message).toContain('URL-formaat is ongeldig');
  });
});

// ============================================================================
// validateFeedItem — Missing availability for merchant
// ============================================================================

describe('validateFeedItem — missing availability for merchant produces ERROR in Dutch', () => {
  test('missing availability on merchant feed produces ERROR', () => {
    const item = { ...completeMerchantItem(), availability: undefined };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const availIssues = result.issues.filter(i => i.field === 'availability');
    expect(availIssues.some(i => i.severity === FeedIssueSeverity.ERROR)).toBe(true);
  });

  test('Dutch error about required availability', () => {
    const item = { ...completeMerchantItem(), availability: undefined };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const availIssues = result.issues.filter(i => i.field === 'availability');
    expect(availIssues.some(i => i.message.includes('verplicht'))).toBe(true);
  });

  test('missing availability on COMPARISON feed does NOT produce error (not required)', () => {
    const item = { ...completeMerchantItem(), availability: undefined };
    const result = validateFeedItem(item, FeedType.COMPARISON);
    const availIssues = result.issues.filter(i => i.field === 'availability');
    expect(availIssues.length).toBe(0);
  });
});

// ============================================================================
// validateFeedItem — Different feed types have different required fields
// ============================================================================

describe('validateFeedItem — different feed types have different required fields', () => {
  test('MERCHANT requires title, link, price, availability (and GTIN via specific validator)', () => {
    const minimalItem = { title: 'Test Product', link: 'https://example.com', price: 10, availability: 'in stock', gtin: '8710101069123' };
    const result = validateFeedItem(minimalItem, FeedType.MERCHANT);
    const requiredIssues = result.issues.filter(i => i.ruleName === 'required');
    expect(requiredIssues.length).toBe(0);
  });

  test('META_CATALOGUE requires title, link, price, imageLink', () => {
    const itemNoImage = { title: 'Test Product', link: 'https://example.com', price: 10 };
    const result = validateFeedItem(itemNoImage, FeedType.META_CATALOGUE);
    const imageRequired = result.issues.filter(i => i.field === 'imageLink' && i.ruleName === 'required');
    expect(imageRequired.length).toBeGreaterThan(0);
  });

  test('COMPARISON requires only title, price, link', () => {
    const minimalItem = { title: 'Test Product', link: 'https://example.com', price: 10 };
    const result = validateFeedItem(minimalItem, FeedType.COMPARISON);
    const requiredIssues = result.issues.filter(i => i.ruleName === 'required');
    expect(requiredIssues.length).toBe(0);
  });

  test('MARKETPLACE requires title, price, availability, link', () => {
    const itemNoAvail = { title: 'Test Product', link: 'https://example.com', price: 10 };
    const result = validateFeedItem(itemNoAvail, FeedType.MARKETPLACE);
    const availRequired = result.issues.filter(i => i.field === 'availability' && i.ruleName === 'required');
    expect(availRequired.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// validateFeedItem — Description same as title
// ============================================================================

describe('validateFeedItem — description same as title produces WARNING in Dutch', () => {
  test('duplicate description produces warning', () => {
    const item = {
      ...completeMerchantItem(),
      description: 'Nike Air Max 90 Heren Schoenen Zwart',
    };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const descIssues = result.issues.filter(i => i.field === 'description' && i.ruleName === 'duplicateOfTitle');
    expect(descIssues.length).toBeGreaterThan(0);
    expect(descIssues[0].severity).toBe(FeedIssueSeverity.WARNING);
  });

  test('Dutch warning about duplicate description', () => {
    const item = {
      ...completeMerchantItem(),
      description: 'Nike Air Max 90 Heren Schoenen Zwart',
    };
    const result = validateFeedItem(item, FeedType.MERCHANT);
    const descIssues = result.issues.filter(i => i.field === 'description' && i.ruleName === 'duplicateOfTitle');
    expect(descIssues[0].message).toContain('zelfde als de titel');
  });
});
