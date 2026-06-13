/**
 * Category Quality Analyzer Tests
 * Tests for /src/lib/ecommerce/category-analyzer.ts
 */

import { describe, test, expect } from 'bun:test';
import { analyzeCategoryQuality } from '@/lib/ecommerce/category-analyzer';

// ============================================================================
// Helpers
// ============================================================================

/** Build a "perfect" category input that should score 100 */
function perfectCategory() {
  return {
    name: 'Heren Sneakers',
    description: 'Ontdek onze uitgebreide collectie heren sneakers van topmerken zoals Nike, Adidas, en Puma. Of je nu zoekt naar klassieke sneakers voor dagelijks gebruik of sportieve modellen voor je workout, bij ons vind je het perfecte paar. Onze sneakers combineren stijl met comfort en zijn beschikbaar in diverse kleuren, maten en materialen. Bekijk onze collectie en bestel vandaag nog jouw favoriete sneakers met gratis verzending.',
    productCount: 42,
    hasStructuredData: true,
    slug: 'heren-sneakers',
  };
}

// ============================================================================
// analyzeCategoryQuality — Perfect category
// ============================================================================

describe('analyzeCategoryQuality — perfect category', () => {
  test('perfect category scores maximum', () => {
    const result = analyzeCategoryQuality(perfectCategory());
    // 20 (desc) + 10 (desc > 50 words) + 10 (slug) + 20 (products) + 10 (> 5 products) + 15 (structured data) + 8 (baseline products desc) = 93
    // Note: pure function gives baseline 8 for "products have descriptions" since actual calculation requires DB
    expect(result.qualityScore).toBe(93);
    expect(result.hasDescription).toBe(true);
    expect(result.hasStructuredData).toBe(true);
  });

  test('perfect category has no critical issues', () => {
    const result = analyzeCategoryQuality(perfectCategory());
    // Pure function baseline gives no issues for a perfect category
    expect(result.issues.length).toBe(0);
  });
});

// ============================================================================
// analyzeCategoryQuality — No description
// ============================================================================

describe('analyzeCategoryQuality — no description reduces score', () => {
  test('missing description reduces score by 20+ points', () => {
    const category = { ...perfectCategory(), description: null };
    const perfectResult = analyzeCategoryQuality(perfectCategory());
    const result = analyzeCategoryQuality(category);
    // Loses 20 for no desc + 10 for no > 50 words = 30 pts
    expect(result.qualityScore).toBeLessThan(perfectResult.qualityScore);
    expect(result.qualityScore).toBe(perfectResult.qualityScore - 30);
  });

  test('missing description produces Dutch issue', () => {
    const category = { ...perfectCategory(), description: null };
    const result = analyzeCategoryQuality(category);
    expect(result.issues.some(i => i.includes('beschrijving'))).toBe(true);
  });

  test('hasDescription is false when no description', () => {
    const category = { ...perfectCategory(), description: null };
    const result = analyzeCategoryQuality(category);
    expect(result.hasDescription).toBe(false);
  });
});

// ============================================================================
// analyzeCategoryQuality — No products
// ============================================================================

describe('analyzeCategoryQuality — no products reduces score', () => {
  test('zero productCount reduces score', () => {
    const category = { ...perfectCategory(), productCount: 0 };
    const result = analyzeCategoryQuality(category);
    expect(result.qualityScore).toBeLessThan(60);
  });

  test('zero products produces Dutch issue about empty category', () => {
    const category = { ...perfectCategory(), productCount: 0 };
    const result = analyzeCategoryQuality(category);
    expect(result.issues.some(i => i.includes('geen producten') || i.includes('lege categorie'))).toBe(true);
  });

  test('few products (≤5) produces Dutch issue', () => {
    const category = { ...perfectCategory(), productCount: 3 };
    const result = analyzeCategoryQuality(category);
    expect(result.issues.some(i => i.includes('weinig producten'))).toBe(true);
  });
});

// ============================================================================
// analyzeCategoryQuality — No slug
// ============================================================================

describe('analyzeCategoryQuality — no slug reduces score', () => {
  test('missing slug reduces score', () => {
    const category = { ...perfectCategory(), slug: null };
    const perfectResult = analyzeCategoryQuality(perfectCategory());
    const result = analyzeCategoryQuality(category);
    expect(result.qualityScore).toBeLessThan(perfectResult.qualityScore);
  });

  test('missing slug produces Dutch issue', () => {
    const category = { ...perfectCategory(), slug: null };
    const result = analyzeCategoryQuality(category);
    expect(result.issues.some(i => i.includes('slug') || i.includes('URL'))).toBe(true);
  });
});

// ============================================================================
// analyzeCategoryQuality — No structured data
// ============================================================================

describe('analyzeCategoryQuality — no structured data reduces score', () => {
  test('no structured data reduces score by 15 points', () => {
    const category = { ...perfectCategory(), hasStructuredData: false };
    const perfectResult = analyzeCategoryQuality(perfectCategory());
    const result = analyzeCategoryQuality(category);
    expect(result.qualityScore).toBe(perfectResult.qualityScore - 15);
  });

  test('no structured data produces Dutch issue', () => {
    const category = { ...perfectCategory(), hasStructuredData: false };
    const result = analyzeCategoryQuality(category);
    expect(result.issues.some(i => i.includes('gestructureerde data') || i.includes('Schema.org'))).toBe(true);
  });
});

// ============================================================================
// analyzeCategoryQuality — Empty description
// ============================================================================

describe('analyzeCategoryQuality — empty description treated as no description', () => {
  test('whitespace-only description treated as missing', () => {
    const category = { ...perfectCategory(), description: '   ' };
    const result = analyzeCategoryQuality(category);
    expect(result.hasDescription).toBe(false);
  });

  test('empty string description treated as missing', () => {
    const category = { ...perfectCategory(), description: '' };
    const result = analyzeCategoryQuality(category);
    expect(result.hasDescription).toBe(false);
  });

  test('short description (< 50 words) produces Dutch issue about length', () => {
    const category = { ...perfectCategory(), description: 'Korte beschrijving van de categorie.' };
    const result = analyzeCategoryQuality(category);
    expect(result.issues.some(i => i.includes('kort') || i.includes('woorden'))).toBe(true);
  });
});
