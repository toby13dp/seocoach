/**
 * Product SEO Analyzer Tests
 * Tests for /src/lib/ecommerce/product-analyzer.ts
 */

import { describe, test, expect } from 'bun:test';
import { analyzeProductSEO } from '@/lib/ecommerce/product-analyzer';

// ============================================================================
// Helpers
// ============================================================================

/** Build a "perfect" product input that maximizes all scoring dimensions */
function perfectProduct() {
  return {
    name: 'Nike Air Max 90 Heren Schoenen Zwart/Wit - Maat 43',
    description: 'De Nike Air Max 90 is een iconische sneaker die al decennialang de straat beheerst. Dit model combineert het klassieke design met moderne comfort-technologieën. De zichtbare Air-unit in de hak zorgt voor uitstekende demping, terwijl de mesh bovenkant zorgt voor optimale ventilatie. Het leer en synthetische materiaal maken de schoen duurzaam en stijlvol. Met een gewicht van slechts 340 g biedt deze schoen een lichte en comfortabele pasvorm. De rubberen buitenzool zorgt voor uitstekende grip op diverse ondergronden. Of je nu de stad verkent of een casual dag hebt, de Air Max 90 is de perfecte keuze. Beschikbaar in meerdere kleuren en maten. De binnenzool is verwijderbaar voor extra comfort aanpassing. De Nike Air Max 90 heeft een rijke geschiedenis die teruggaat tot 1990 toen het origineel werd ontworpen door Tinker Hatfield. Sindsdien is het een van de meest herkenbare en geliefde sneakers ter wereld geworden. Het iconische design met de zichtbare Air-bubbel in de hak was revolutionair voor zijn tijd en blijft tot op de dag van vandaag een onderscheidend kenmerk. De schoen is gemaakt van hoogwaardige materialen waaronder leer, mesh en synthetische overlays die zorgen voor zowel duurzaamheid als ademend vermogen. De tussenzool bevat schuim voor extra comfort en de wreefondersteuning zorgt voor een veilige pas. De zoolhoogte bedraagt ongeveer 3 cm en de schoen weegt 340 g per stuk. Geschikt voor dagelijks gebruik, casual gelegenheden en lichte sportieve activiteiten. Onderhoud is eenvoudig: veeg de schoen schoon met een vochtige doek en gebruik een speciaal lederreinigingsmiddel voor het leer. Vermijd wassen in de wasmachine om de materialen te beschermen. Bewaar de schoenen op een koele droge plaats uit direct zonlicht. Bestel vandaag nog en geniet van gratis verzending binnen Nederland. DeNike Air Max 90 is verkrijgbaar bij geautoriseerde retailers en via onze officiële webshop. Wij bieden een uitgebreide maattabel aan zodat je altijd de juiste maat kiest. Retourneren is gratis binnen dertig dagen na aankoop. Onze klantenservice staat klaar om al je vragen te beantwoorden over dit product en meer.',
    shortDescription: 'Iconische Nike Air Max 90 sneaker met zichtbare Air-unit en comfortabele pasvorm.',
    imageUrl: 'https://example.com/images/nike-air-max-90.jpg',
    imageAlt: 'Nike Air Max 90 Heren Schoenen Zwart/Wit - Maat 43',
    additionalImages: JSON.stringify([
      'https://example.com/images/nike-air-max-90-side.jpg',
      'https://example.com/images/nike-air-max-90-back.jpg',
      'https://example.com/images/nike-air-max-90-detail.jpg',
    ]),
    gtin: '8710101069123',
    mpn: 'CW4653-001',
    productType: 'Schoenen > Heren > Sneakers',
    brand: 'Nike',
    productUrl: 'https://example.com/nike-air-max-90',
  };
}

// ============================================================================
// analyzeProductSEO — Perfect product (max score)
// ============================================================================

describe('analyzeProductSEO — perfect product scores max', () => {
  test('overall score is 98 when all fields are present and of good length', () => {
    // descriptionQuality maxes at 90 (40 base + 30 for 300+ words + 10 bonus + 10 for details)
    // Overall = (100 + 90 + 100 + 100) * 25 / 100 = 97.5 → rounded to 98
    const result = analyzeProductSEO(perfectProduct());
    expect(result.titleQuality).toBe(100);
    expect(result.descriptionQuality).toBe(90);
    expect(result.structuredDataScore).toBe(100);
    expect(result.imageScore).toBe(100);
    expect(result.overallSeoScore).toBe(98);
  });

  test('perfect product has no issues', () => {
    const result = analyzeProductSEO(perfectProduct());
    expect(result.issues).toEqual([]);
  });
});

// ============================================================================
// analyzeProductSEO — Missing description
// ============================================================================

describe('analyzeProductSEO — missing description reduces score', () => {
  test('missing description yields 0 for descriptionQuality', () => {
    const product = { ...perfectProduct(), description: null, shortDescription: null };
    const result = analyzeProductSEO(product);
    expect(result.descriptionQuality).toBe(0);
    expect(result.overallSeoScore).toBeLessThan(100);
  });

  test('missing description produces Dutch error issue', () => {
    const product = { ...perfectProduct(), description: null, shortDescription: null };
    const result = analyzeProductSEO(product);
    const descIssues = result.issues.filter(i => i.field === 'description');
    expect(descIssues.length).toBeGreaterThan(0);
    expect(descIssues.some(i => i.message.includes('beschrijving'))).toBe(true);
  });

  test('only short description gives partial credit', () => {
    const product = {
      ...perfectProduct(),
      description: null,
      shortDescription: 'Korte beschrijving van het product',
    };
    const result = analyzeProductSEO(product);
    expect(result.descriptionQuality).toBe(25);
  });
});

// ============================================================================
// analyzeProductSEO — Short title
// ============================================================================

describe('analyzeProductSEO — short title reduces score', () => {
  test('title under 20 chars reduces titleQuality', () => {
    const product = { ...perfectProduct(), name: 'Schoen' };
    const result = analyzeProductSEO(product);
    expect(result.titleQuality).toBeLessThan(100);
  });

  test('short title produces Dutch issue about te kort', () => {
    const product = { ...perfectProduct(), name: 'Schoen' };
    const result = analyzeProductSEO(product);
    const titleIssues = result.issues.filter(i => i.field === 'title');
    expect(titleIssues.some(i => i.message.includes('te kort'))).toBe(true);
  });
});

// ============================================================================
// analyzeProductSEO — No image
// ============================================================================

describe('analyzeProductSEO — no image reduces score', () => {
  test('missing imageUrl reduces imageScore', () => {
    const product = { ...perfectProduct(), imageUrl: null };
    const result = analyzeProductSEO(product);
    expect(result.imageScore).toBeLessThan(100);
  });

  test('missing image produces Dutch error issue', () => {
    const product = { ...perfectProduct(), imageUrl: null };
    const result = analyzeProductSEO(product);
    const imageIssues = result.issues.filter(i => i.field === 'image');
    expect(imageIssues.some(i => i.message.includes('afbeelding') || i.message.includes('Geen'))).toBe(true);
  });

  test('missing image also reduces structuredDataScore', () => {
    const product = { ...perfectProduct(), imageUrl: null };
    const result = analyzeProductSEO(product);
    expect(result.structuredDataScore).toBeLessThan(100);
  });
});

// ============================================================================
// analyzeProductSEO — No GTIN/MPN
// ============================================================================

describe('analyzeProductSEO — no GTIN/MPN reduces structured data score', () => {
  test('missing GTIN and MPN reduces structuredDataScore', () => {
    const product = { ...perfectProduct(), gtin: null, mpn: null };
    const result = analyzeProductSEO(product);
    expect(result.structuredDataScore).toBeLessThan(100);
  });

  test('missing GTIN/MPN produces Dutch error about identifiers', () => {
    const product = { ...perfectProduct(), gtin: null, mpn: null };
    const result = analyzeProductSEO(product);
    const sdIssues = result.issues.filter(i => i.field === 'structured_data');
    expect(sdIssues.some(i => i.message.includes('GTIN') || i.message.includes('MPN'))).toBe(true);
  });

  test('having only GTIN is sufficient for structured data (no MPN needed)', () => {
    const product = { ...perfectProduct(), gtin: '8710101069123', mpn: null };
    const result = analyzeProductSEO(product);
    // Should have GTIN points (35) + brand (25) + productType (20) + image (20) = 100
    expect(result.structuredDataScore).toBe(100);
  });

  test('having only MPN is also sufficient for structured data', () => {
    const product = { ...perfectProduct(), gtin: null, mpn: 'CW4653-001' };
    const result = analyzeProductSEO(product);
    expect(result.structuredDataScore).toBe(100);
  });
});

// ============================================================================
// analyzeProductSEO — No image alt
// ============================================================================

describe('analyzeProductSEO — no image alt reduces image score', () => {
  test('missing imageAlt reduces imageScore', () => {
    const product = { ...perfectProduct(), imageAlt: null };
    const result = analyzeProductSEO(product);
    expect(result.imageScore).toBeLessThan(100);
  });

  test('missing alt text produces Dutch error issue', () => {
    const product = { ...perfectProduct(), imageAlt: null };
    const result = analyzeProductSEO(product);
    const imageIssues = result.issues.filter(i => i.field === 'image');
    expect(imageIssues.some(i => i.message.includes('alt-tekst'))).toBe(true);
  });
});

// ============================================================================
// analyzeProductSEO — Generic title
// ============================================================================

describe('analyzeProductSEO — generic title produces warning', () => {
  test('"Product" as title is flagged as generic', () => {
    const product = { ...perfectProduct(), name: 'Product' };
    const result = analyzeProductSEO(product);
    const titleIssues = result.issues.filter(i => i.field === 'title');
    expect(titleIssues.some(i => i.message.includes('algemeen') || i.message.includes('specifieke'))).toBe(true);
  });

  test('"Artikel" as title is flagged as generic', () => {
    const product = { ...perfectProduct(), name: 'Artikel' };
    const result = analyzeProductSEO(product);
    const titleIssues = result.issues.filter(i => i.field === 'title');
    expect(titleIssues.some(i => i.message.includes('algemeen'))).toBe(true);
  });

  test('generic title heavily reduces titleQuality', () => {
    const product = { ...perfectProduct(), name: 'Product' };
    const result = analyzeProductSEO(product);
    // -40 for generic + -30 for short (<20) + -5 for no number
    expect(result.titleQuality).toBeLessThanOrEqual(30);
  });
});

// ============================================================================
// analyzeProductSEO — Description same as short description
// ============================================================================

describe('analyzeProductSEO — description same as short description', () => {
  test('identical short and full description produces Dutch warning', () => {
    const sameDesc = 'Dit is een uitgebreide beschrijving van het product met veel details over de specificaties en het gebruik. Het product heeft vele voordelen voor de gebruiker en is verkrijgbaar in verschillende varianten. De kwaliteit is uitmuntend en de prijs is redelijk.';
    const product = {
      ...perfectProduct(),
      description: sameDesc,
      shortDescription: sameDesc,
    };
    const result = analyzeProductSEO(product);
    const descIssues = result.issues.filter(i => i.field === 'description');
    expect(descIssues.some(i => i.message.includes('identiek') || i.message.includes('dubbele'))).toBe(true);
  });

  test('identical descriptions reduces descriptionQuality score', () => {
    const sameDesc = 'Dit is een uitgebreide beschrijving van het product met veel details over de specificaties en het gebruik. Het product heeft vele voordelen voor de gebruiker en is verkrijgbaar in verschillende varianten. De kwaliteit is uitmuntend en de prijs is redelijk.';
    const productIdentical = {
      ...perfectProduct(),
      description: sameDesc,
      shortDescription: sameDesc,
    };
    const productDifferent = {
      ...perfectProduct(),
      description: sameDesc,
      shortDescription: 'Andere korte beschrijving',
    };
    const resultIdentical = analyzeProductSEO(productIdentical);
    const resultDifferent = analyzeProductSEO(productDifferent);
    expect(resultIdentical.descriptionQuality).toBeLessThan(resultDifferent.descriptionQuality);
  });
});

// ============================================================================
// analyzeProductSEO — No additional images
// ============================================================================

describe('analyzeProductSEO — no additional images produces Dutch info', () => {
  test('no additional images produces info-level issue in Dutch', () => {
    const product = { ...perfectProduct(), additionalImages: null };
    const result = analyzeProductSEO(product);
    const imageIssues = result.issues.filter(i => i.field === 'image');
    expect(imageIssues.some(i => i.message.includes('extra afbeeldingen') || i.message.includes('Geen extra'))).toBe(true);
  });

  test('empty additionalImages JSON array produces info issue', () => {
    const product = { ...perfectProduct(), additionalImages: '[]' };
    const result = analyzeProductSEO(product);
    const imageIssues = result.issues.filter(i => i.field === 'image');
    expect(imageIssues.some(i => i.message.includes('extra afbeeldingen') || i.message.includes('Geen extra'))).toBe(true);
  });
});

// ============================================================================
// analyzeProductSEO — Non-descriptive alt text
// ============================================================================

describe('analyzeProductSEO — non-descriptive alt text produces warning', () => {
  test('alt text "image" produces warning about not being descriptive', () => {
    const product = { ...perfectProduct(), imageAlt: 'image' };
    const result = analyzeProductSEO(product);
    const imageIssues = result.issues.filter(i => i.field === 'image');
    expect(imageIssues.some(i => i.message.includes('niet beschrijvend') || i.message.includes('beschrijvende alt-tekst'))).toBe(true);
  });

  test('alt text "foto" produces warning about not being descriptive', () => {
    const product = { ...perfectProduct(), imageAlt: 'foto' };
    const result = analyzeProductSEO(product);
    const imageIssues = result.issues.filter(i => i.field === 'image');
    expect(imageIssues.some(i => i.message.includes('niet beschrijvend') || i.message.includes('algemene'))).toBe(true);
  });

  test('generic alt text gives lower image score than descriptive alt text', () => {
    const productGeneric = { ...perfectProduct(), imageAlt: 'foto' };
    const productDescriptive = { ...perfectProduct(), imageAlt: 'Nike Air Max 90 Zwart/Wit Schoen' };
    const resultGeneric = analyzeProductSEO(productGeneric);
    const resultDescriptive = analyzeProductSEO(productDescriptive);
    expect(resultGeneric.imageScore).toBeLessThan(resultDescriptive.imageScore);
  });
});

// ============================================================================
// analyzeProductSEO — Empty name
// ============================================================================

describe('analyzeProductSEO — empty name', () => {
  test('empty name yields titleQuality of 0', () => {
    const product = { ...perfectProduct(), name: '' };
    const result = analyzeProductSEO(product);
    expect(result.titleQuality).toBe(0);
  });

  test('empty name produces Dutch error about missing title', () => {
    const product = { ...perfectProduct(), name: '' };
    const result = analyzeProductSEO(product);
    const titleIssues = result.issues.filter(i => i.field === 'title');
    expect(titleIssues.some(i => i.severity === 'error' && i.message.includes('titel'))).toBe(true);
  });
});
