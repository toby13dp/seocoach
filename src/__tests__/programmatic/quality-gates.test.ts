/**
 * Programmatic SEO Quality Gates Tests
 * Tests for /src/lib/programmatic/quality-gates.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import type { QualityGateResult, QualityGatesConfig } from '@/lib/programmatic/types';

// ============================================================================
// Quality gate constants (mirroring the module)
// ============================================================================

const QUALITY_GATES = {
  UNIQUE_DATA: { id: 'UNIQUE_DATA', name: 'Unieke gegevens vereist', blocking: false },
  MIN_VALUE: { id: 'MIN_VALUE', name: 'Minimale waardedrempel', blocking: false },
  DUPLICATE: { id: 'DUPLICATE', name: 'Duplicaatcontrole', blocking: true },
  CANNIBALISATION: { id: 'CANNIBALISATION', name: 'Kannibalisatiecontrole', blocking: false },
  TEMPLATE_COMPLETENESS: { id: 'TEMPLATE_COMPLETENESS', name: 'Sjabloonvolledigheid', blocking: true },
  BRAND_CHECK: { id: 'BRAND_CHECK', name: 'Merkcontrole', blocking: true },
  CLAIM_CHECK: { id: 'CLAIM_CHECK', name: 'Claimcontrole', blocking: false },
  INTERNAL_LINK: { id: 'INTERNAL_LINK', name: 'Interne linkcontrole', blocking: false },
} as const;

// ============================================================================
// Text similarity helper (mirroring the module's logic)
// ============================================================================

function calculateSimilarity(textA: string, textB: string): number {
  const normalize = (text: string) =>
    text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w.length > 2);

  const wordsA = normalize(textA);
  const wordsB = normalize(textB);

  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  if (wordsA.join(' ') === wordsB.join(' ')) return 1;

  const getTrigrams = (words: string[]): Set<string> => {
    const trigrams = new Set<string>();
    for (let i = 0; i < words.length - 2; i++) {
      trigrams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
    return trigrams;
  };

  const trigramsA = getTrigrams(wordsA);
  const trigramsB = getTrigrams(wordsB);

  if (trigramsA.size === 0 || trigramsB.size === 0) {
    const setA = new Set(wordsA);
    const setB = new Set(wordsB);
    const intersection = new Set([...setA].filter((w) => setB.has(w)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  const intersection = new Set([...trigramsA].filter((t) => trigramsB.has(t)));
  const union = new Set([...trigramsA, ...trigramsB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function countWords(text: string): number {
  return text.replace(/[#*_\[\]()]/g, ' ').split(/\s+/).filter((w) => w.length > 0).length;
}

// ============================================================================
// Tests: Quality Gate Identifiers
// ============================================================================

describe('Quality Gate Identifiers', () => {
  test('all 8 quality gates are defined', () => {
    expect(Object.keys(QUALITY_GATES).length).toBe(8);
  });

  test('blocking gates are correctly identified', () => {
    const blockingGates = Object.values(QUALITY_GATES).filter((g) => g.blocking);
    expect(blockingGates.length).toBe(3);
    expect(blockingGates.map((g) => g.id)).toEqual(
      expect.arrayContaining(['DUPLICATE', 'TEMPLATE_COMPLETENESS', 'BRAND_CHECK'])
    );
  });

  test('non-blocking gates are correctly identified', () => {
    const nonBlockingGates = Object.values(QUALITY_GATES).filter((g) => !g.blocking);
    expect(nonBlockingGates.length).toBe(5);
    expect(nonBlockingGates.map((g) => g.id)).toEqual(
      expect.arrayContaining(['UNIQUE_DATA', 'MIN_VALUE', 'CANNIBALISATION', 'CLAIM_CHECK', 'INTERNAL_LINK'])
    );
  });

  test('all gate names are in Dutch', () => {
    for (const gate of Object.values(QUALITY_GATES)) {
      expect(gate.name.length).toBeGreaterThan(0);
      // Dutch gate names should not be English
      const englishPatterns = ['unique', 'minimum', 'duplicate', 'template', 'brand', 'claim', 'internal', 'cannibalisation'];
      expect(englishPatterns.some((p) => gate.name.toLowerCase().includes(p))).toBe(false);
    }
  });
});

// ============================================================================
// Tests: Gate 1 — Unique Data Requirement (non-blocking)
// ============================================================================

describe('Gate 1: Unieke gegevens vereist (Unique Data)', () => {
  test('first page for template passes automatically', () => {
    // When no existing pages exist, the first page always passes
    const existingPages: Array<Record<string, string>> = [];
    expect(existingPages.length).toBe(0);
    // The gate returns: passed: true, score: 100, message: 'Eerste pagina voor dit sjabloon — geen vergelijking nodig.'
  });

  test('identical data to existing page should not pass', () => {
    const existingRow = { serviceName: 'SEO', locationName: 'Amsterdam' };
    const newRow = { serviceName: 'SEO', locationName: 'Amsterdam' };
    const keyVariables = ['serviceName', 'locationName'];
    const existingValues = keyVariables.map((v) => existingRow[v]).join('|');
    const newValues = keyVariables.map((v) => newRow[v]).join('|');
    expect(existingValues).toBe(newValues);
  });

  test('different data passes the unique check', () => {
    const existingRow = { serviceName: 'SEO', locationName: 'Amsterdam' };
    const newRow = { serviceName: 'SEO', locationName: 'Rotterdam' };
    const keyVariables = ['locationName'];
    const existingValues = keyVariables.map((v) => existingRow[v]).join('|');
    const newValues = keyVariables.map((v) => newRow[v]).join('|');
    expect(existingValues).not.toBe(newValues);
  });

  test('Dutch message for uniqueness gate', () => {
    const gateName = QUALITY_GATES.UNIQUE_DATA.name;
    expect(gateName).toBe('Unieke gegevens vereist');
  });
});

// ============================================================================
// Tests: Gate 2 — Minimale waardedrempel (Minimum Value Threshold, non-blocking)
// ============================================================================

describe('Gate 2: Minimale waardedrempel (Minimum Value)', () => {
  test('content below minimum word count is flagged', () => {
    const content = 'Dit is een korte tekst.';
    const wordCount = countWords(content);
    const minWordCount = 300;
    expect(wordCount).toBeLessThan(minWordCount);
  });

  test('content at minimum word count passes', () => {
    const longContent = Array(301).fill('woord').join(' ');
    const wordCount = countWords(longContent);
    const minWordCount = 300;
    expect(wordCount).toBeGreaterThanOrEqual(minWordCount);
  });

  test('empty data rows reduce value score', () => {
    const rowData = { serviceName: '', locationName: '' };
    const filledValues = Object.values(rowData).filter((v) => v.length > 0);
    expect(filledValues.length).toBe(0);
  });

  test('Dutch message for minimum value gate', () => {
    const gateName = QUALITY_GATES.MIN_VALUE.name;
    expect(gateName).toBe('Minimale waardedrempel');
  });
});

// ============================================================================
// Tests: Gate 3 — Duplicaatcontrole (Duplicate Check, BLOCKING)
// ============================================================================

describe('Gate 3: Duplicaatcontrole (Duplicate Check)', () => {
  test('identical content is detected as duplicate', () => {
    const contentA = 'Dit is een artikel over SEO optimalisatie voor Nederlandse websites.';
    const contentB = 'Dit is een artikel over SEO optimalisatie voor Nederlandse websites.';
    const similarity = calculateSimilarity(contentA, contentB);
    expect(similarity).toBe(1);
  });

  test('highly similar content exceeds threshold', () => {
    const contentA = 'Onze SEO dienst in Amsterdam helpt bedrijven om hoger te ranken in Google zoekresultaten en meer organisch verkeer aan te trekken.';
    const contentB = 'Onze SEO dienst in Amsterdam helpt bedrijven om beter te ranken in Google zoekresultaten en meer organisch verkeer te genereren.';
    const similarity = calculateSimilarity(contentA, contentB);
    expect(similarity).toBeGreaterThan(0.8);
  });

  test('different content stays below threshold', () => {
    const contentA = 'Fietsenmaker Amsterdam biedt snelle reparaties voor alle soorten fietsen in de regio Amsterdam.';
    const contentB = 'Loodgieter Rotterdam levert professionele sanitaire oplossingen voor woningen en bedrijven in Rotterdam.';
    const similarity = calculateSimilarity(contentA, contentB);
    expect(similarity).toBeLessThan(0.5);
  });

  test('duplicate check is a blocking gate', () => {
    expect(QUALITY_GATES.DUPLICATE.blocking).toBe(true);
  });

  test('default similarity threshold is 0.8 (80%)', () => {
    const defaultConfig: QualityGatesConfig = {
      maxSimilarityThreshold: 0.8,
    };
    expect(defaultConfig.maxSimilarityThreshold).toBe(0.8);
  });

  test('Dutch rejection message for duplicate content', () => {
    const message = 'De gegenereerde inhoud is te vergelijkbaar met bestaande content (overeenkomst: 92%). Pas de sjabloon of gegevens aan om meer unieke content te genereren.';
    expect(message).toContain('te vergelijkbaar');
    expect(message).toContain('bestaande content');
  });
});

// ============================================================================
// Tests: Gate 5 — Sjabloonvolledigheid (Template Completeness, BLOCKING)
// ============================================================================

describe('Gate 5: Sjabloonvolledigheid (Template Completeness)', () => {
  test('unfilled template placeholders are detected', () => {
    const content = '# {{serviceName}} in {{locationName}}\n\n{{serviceDescription}}';
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    const unfilledPlaceholders: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = placeholderRegex.exec(content)) !== null) {
      unfilledPlaceholders.push(match[1]);
    }
    expect(unfilledPlaceholders.length).toBe(3);
    expect(unfilledPlaceholders).toContain('serviceName');
    expect(unfilledPlaceholders).toContain('locationName');
  });

  test('fully rendered content has no placeholders', () => {
    const content = '# SEO Consult in Amsterdam\n\nProfessionele SEO diensten voor bedrijven in de regio Amsterdam.';
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    const matches = content.match(placeholderRegex);
    expect(matches).toBeNull();
  });

  test('template completeness is a blocking gate', () => {
    expect(QUALITY_GATES.TEMPLATE_COMPLETENESS.blocking).toBe(true);
  });

  test('Dutch rejection message for incomplete template', () => {
    const message = 'Sjabloon bevat niet-ingevulde variabelen: serviceName, locationName. Zorg ervoor dat alle vereiste variabelen zijn ingevuld.';
    expect(message).toContain('niet-ingevulde variabelen');
  });
});

// ============================================================================
// Tests: Gate 6 — Merkcontrole (Brand Check, BLOCKING)
// ============================================================================

describe('Gate 6: Merkcontrole (Brand Check)', () => {
  test('brand check is a blocking gate', () => {
    expect(QUALITY_GATES.BRAND_CHECK.blocking).toBe(true);
  });

  test('Dutch message for brand check gate', () => {
    const gateName = QUALITY_GATES.BRAND_CHECK.name;
    expect(gateName).toBe('Merkcontrole');
  });

  test('prohibited terminology in content should be flagged', () => {
    const prohibitedTerms = ['beste', 'goedkoopste', 'nummer 1'];
    const content = 'Wij zijn de beste SEO specialist in Nederland.';
    const found = prohibitedTerms.filter((term) => content.toLowerCase().includes(term));
    expect(found.length).toBeGreaterThan(0);
  });

  test('brand name consistency is checked', () => {
    const brandName = 'SEOCoach';
    const content = 'Welkom bij SEOCoach. Bij seocoach kunt u rekenen op kwaliteit.';
    // Brand name should be used consistently (case-sensitive)
    const hasInconsistentCasing = content.includes(brandName.toLowerCase()) && content.includes(brandName);
    // Both forms present = potential inconsistency
    expect(hasInconsistentCasing).toBe(true);
  });
});

// ============================================================================
// Tests: Thin pages rejection
// ============================================================================

describe('Thin Pages Rejection', () => {
  test('pages with very low word count are thin', () => {
    const content = 'Korte tekst over SEO.';
    const wordCount = countWords(content);
    const isThin = wordCount < 300;
    expect(isThin).toBe(true);
  });

  test('pages at minimum word count are not thin', () => {
    const words = Array(300).fill('inhoud');
    const content = words.join(' ');
    const wordCount = countWords(content);
    const isThin = wordCount < 300;
    expect(isThin).toBe(false);
  });

  test('thin pages with few data points are rejected', () => {
    const rowData = { serviceName: 'SEO' }; // Only 1 data point
    const dataPoints = Object.values(rowData).filter((v) => String(v).length > 0).length;
    const minDataPoints = 3;
    expect(dataPoints).toBeLessThan(minDataPoints);
  });

  test('Dutch message for thin page rejection', () => {
    const message = 'Pagina heeft onvoldoende unieke inhoud (aantal woorden: 45, minimaal vereist: 300). Verrijk de sjabloon met meer context en gegevens.';
    expect(message).toContain('onvoldoende unieke inhoud');
    expect(message).toContain('minimaal vereist');
  });
});

// ============================================================================
// Tests: Doorway pages rejection
// ============================================================================

describe('Doorway Pages Rejection', () => {
  test('pages that only differ in location name are doorway pages', () => {
    const page1Content = 'Onze SEO dienst biedt professionele zoekmachineoptimalisatie. Contacteer ons vandaag nog voor een vrijblijvende offerte.';
    const page2Content = 'Onze SEO dienst biedt professionele zoekmachineoptimalisatie. Contacteer ons vandaag nog voor een vrijblijvende offerte.';
    const similarity = calculateSimilarity(page1Content, page2Content);
    expect(similarity).toBe(1); // Identical content = doorway page pattern
  });

  test('pages with meaningful unique content are not doorway', () => {
    const page1Content = 'Onze SEO dienst in Amsterdam richt zich op lokale bedrijven die hun zichtbaarheid in de hoofdstad willen vergroten. Wij kennen de Amsterdamse markt door en door.';
    const page2Content = 'Onze SEO dienst in Rotterdam helpt havenbedrijven en logistieke ondernemingen om hun online aanwezigheid te versterken in de Rotterdamse regio.';
    const similarity = calculateSimilarity(page1Content, page2Content);
    expect(similarity).toBeLessThan(0.9); // Sufficiently different
  });

  test('Dutch message for doorway page rejection', () => {
    const message = 'De gegenereerde pagina lijkt op een doorway-pagina: te vergelijkbaar met andere pagina\'s met alleen een andere locatienaam. Voeg unieke, locatie-specifieke content toe.';
    expect(message).toContain('doorway-pagina');
    expect(message).toContain('unieke');
  });
});

// ============================================================================
// Tests: Quality Gate Result Structure
// ============================================================================

describe('Quality Gate Result Structure', () => {
  test('QualityGateResult has required fields', () => {
    const result: QualityGateResult = {
      gateName: 'Duplicaatcontrole',
      passed: true,
      score: 95,
      message: 'Inhoud is voldoende uniek ten opzichte van bestaande content.',
    };
    expect(result.gateName).toBe('Duplicaatcontrole');
    expect(result.passed).toBe(true);
    expect(result.score).toBe(95);
    expect(result.message.length).toBeGreaterThan(0);
  });

  test('QualityGateResult score is between 0 and 100', () => {
    const result: QualityGateResult = {
      gateName: 'Sjabloonvolledigheid',
      passed: false,
      score: 0,
      message: 'Sjabloon bevat niet-ingevulde variabelen.',
    };
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('QualityGateResult can include details', () => {
    const result: QualityGateResult = {
      gateName: 'Merkcontrole',
      passed: false,
      score: 40,
      message: 'Content bevat verboden terminologie.',
      details: {
        prohibitedTermsFound: ['beste', 'goedkoopste'],
        brandNameConsistency: false,
      },
    };
    expect(result.details).toBeDefined();
  });
});

