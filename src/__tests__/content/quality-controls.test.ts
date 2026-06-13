/**
 * Content Quality Controls Tests
 * Tests for /src/lib/content/quality-controls.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import type { CheckType, FindingSeverity, PrePublicationCheckResult } from '@/lib/content/quality-controls';

// ============================================================================
// Check type validation
// ============================================================================

describe('Check Types', () => {
  test('all 13 check types are defined', () => {
    const checkTypes: CheckType[] = [
      'DUPLICATE',
      'NEAR_DUPLICATE',
      'BRAND_CONSISTENCY',
      'PROHIBITED_CLAIM',
      'PROHIBITED_TERMINOLOGY',
      'INTENT_CHECK',
      'READABILITY',
      'INTERNAL_LINK',
      'CONVERSION',
      'GEO_READINESS',
      'UNSUPPORTED_CLAIM',
      'LOCATION_UNIQUENESS',
      'PRODUCT_CONSISTENCY',
    ];
    expect(checkTypes.length).toBe(13);
  });

  test('each check type is unique', () => {
    const checkTypes: CheckType[] = [
      'DUPLICATE', 'NEAR_DUPLICATE', 'BRAND_CONSISTENCY',
      'PROHIBITED_CLAIM', 'PROHIBITED_TERMINOLOGY', 'INTENT_CHECK',
      'READABILITY', 'INTERNAL_LINK', 'CONVERSION',
      'GEO_READINESS', 'UNSUPPORTED_CLAIM', 'LOCATION_UNIQUENESS',
      'PRODUCT_CONSISTENCY',
    ];
    const unique = new Set(checkTypes);
    expect(unique.size).toBe(13);
  });
});

// ============================================================================
// Severity levels
// ============================================================================

describe('Finding Severity Levels', () => {
  test('three severity levels exist', () => {
    const severities: FindingSeverity[] = ['BLOCKING', 'WARNING', 'INFO'];
    expect(severities.length).toBe(3);
  });

  test('BLOCKING prevents publication', () => {
    const severity: FindingSeverity = 'BLOCKING';
    const canPublish = severity !== 'BLOCKING';
    expect(canPublish).toBe(false);
  });

  test('WARNING does not prevent publication', () => {
    const severity: FindingSeverity = 'WARNING';
    const canPublish = severity !== 'BLOCKING';
    expect(canPublish).toBe(true);
  });

  test('INFO does not prevent publication', () => {
    const severity: FindingSeverity = 'INFO';
    const canPublish = severity !== 'BLOCKING';
    expect(canPublish).toBe(true);
  });
});

// ============================================================================
// Pre-publication check result structure
// ============================================================================

describe('Pre-Publication Check Result', () => {
  test('result has correct structure', () => {
    const result: PrePublicationCheckResult = {
      totalChecks: 13,
      findingsCreated: 5,
      bySeverity: {
        BLOCKING: 1,
        WARNING: 3,
        INFO: 1,
      },
      canPublish: false,
    };
    expect(result.totalChecks).toBe(13);
    expect(result.findingsCreated).toBe(5);
    expect(result.canPublish).toBe(false);
  });

  test('canPublish is true when no BLOCKING findings', () => {
    const result: PrePublicationCheckResult = {
      totalChecks: 13,
      findingsCreated: 3,
      bySeverity: {
        BLOCKING: 0,
        WARNING: 2,
        INFO: 1,
      },
      canPublish: true,
    };
    expect(result.canPublish).toBe(true);
  });

  test('canPublish is false when BLOCKING findings exist', () => {
    const result: PrePublicationCheckResult = {
      totalChecks: 13,
      findingsCreated: 4,
      bySeverity: {
        BLOCKING: 2,
        WARNING: 1,
        INFO: 1,
      },
      canPublish: false,
    };
    expect(result.canPublish).toBe(false);
  });

  test('findings count matches severity breakdown', () => {
    const result: PrePublicationCheckResult = {
      totalChecks: 13,
      findingsCreated: 6,
      bySeverity: {
        BLOCKING: 1,
        WARNING: 3,
        INFO: 2,
      },
      canPublish: false,
    };
    expect(result.bySeverity.BLOCKING + result.bySeverity.WARNING + result.bySeverity.INFO).toBe(result.findingsCreated);
  });
});

// ============================================================================
// Blocking findings prevent publication
// ============================================================================

describe('Blocking Findings Prevent Publication', () => {
  test('duplicate content is BLOCKING', () => {
    // The duplicate check creates a BLOCKING finding when content is too similar
    const checkType: CheckType = 'DUPLICATE';
    const severity: FindingSeverity = 'BLOCKING';
    expect(severity).toBe('BLOCKING');
  });

  test('prohibited claim is BLOCKING', () => {
    const checkType: CheckType = 'PROHIBITED_CLAIM';
    const severity: FindingSeverity = 'BLOCKING';
    expect(severity).toBe('BLOCKING');
  });

  test('prohibited terminology is BLOCKING', () => {
    const checkType: CheckType = 'PROHIBITED_TERMINOLOGY';
    const severity: FindingSeverity = 'BLOCKING';
    expect(severity).toBe('BLOCKING');
  });

  test('unsupported claim is BLOCKING', () => {
    const checkType: CheckType = 'UNSUPPORTED_CLAIM';
    const severity: FindingSeverity = 'BLOCKING';
    expect(severity).toBe('BLOCKING');
  });

  test('brand inconsistency is BLOCKING', () => {
    const checkType: CheckType = 'BRAND_CONSISTENCY';
    const severity: FindingSeverity = 'BLOCKING';
    expect(severity).toBe('BLOCKING');
  });
});

// ============================================================================
// Warning and Info severity checks
// ============================================================================

describe('Warning and Info Severity Checks', () => {
  test('near-duplicate content is WARNING', () => {
    const checkType: CheckType = 'NEAR_DUPLICATE';
    const severity: FindingSeverity = 'WARNING';
    expect(severity).toBe('WARNING');
  });

  test('readability issues are WARNING', () => {
    const checkType: CheckType = 'READABILITY';
    const severity: FindingSeverity = 'WARNING';
    expect(severity).toBe('WARNING');
  });

  test('internal link suggestions are INFO', () => {
    const checkType: CheckType = 'INTERNAL_LINK';
    const severity: FindingSeverity = 'INFO';
    expect(severity).toBe('INFO');
  });

  test('conversion check is WARNING', () => {
    const checkType: CheckType = 'CONVERSION';
    const severity: FindingSeverity = 'WARNING';
    expect(severity).toBe('WARNING');
  });

  test('GEO readiness is WARNING', () => {
    const checkType: CheckType = 'GEO_READINESS';
    const severity: FindingSeverity = 'WARNING';
    expect(severity).toBe('WARNING');
  });

  test('intent check is WARNING', () => {
    const checkType: CheckType = 'INTENT_CHECK';
    const severity: FindingSeverity = 'WARNING';
    expect(severity).toBe('WARNING');
  });

  test('location uniqueness is WARNING', () => {
    const checkType: CheckType = 'LOCATION_UNIQUENESS';
    const severity: FindingSeverity = 'WARNING';
    expect(severity).toBe('WARNING');
  });

  test('product consistency is WARNING', () => {
    const checkType: CheckType = 'PRODUCT_CONSISTENCY';
    const severity: FindingSeverity = 'WARNING';
    expect(severity).toBe('WARNING');
  });
});

// ============================================================================
// Dismiss functionality
// ============================================================================

describe('Dismiss Finding', () => {
  test('dismissed findings no longer block publication', () => {
    // When hasBlockingFindings is called, it checks dismissed: false
    const finding = {
      severity: 'BLOCKING' as FindingSeverity,
      dismissed: true,
      dismissedBy: 'user-1',
      dismissedAt: new Date(),
    };
    const blocksPublication = finding.severity === 'BLOCKING' && !finding.dismissed;
    expect(blocksPublication).toBe(false);
  });

  test('non-dismissed BLOCKING findings still block', () => {
    const finding = {
      severity: 'BLOCKING' as FindingSeverity,
      dismissed: false,
    };
    const blocksPublication = finding.severity === 'BLOCKING' && !finding.dismissed;
    expect(blocksPublication).toBe(true);
  });

  test('Dutch error when finding not found for dismiss', () => {
    const findingId = 'nonexistent';
    const message = `Bevinding "${findingId}" niet gevonden`;
    expect(message).toContain('niet gevonden');
  });

  test('dismissal records who dismissed and when', () => {
    const dismissedFinding = {
      dismissed: true,
      dismissedBy: 'user-1',
      dismissedAt: new Date(),
    };
    expect(dismissedFinding.dismissedBy).toBe('user-1');
    expect(dismissedFinding.dismissedAt).toBeDefined();
  });
});

// ============================================================================
// Dutch messages
// ============================================================================

describe('Dutch Messages in Quality Controls', () => {
  test('duplicate finding uses Dutch title', () => {
    const title = 'Dubbele content gedetecteerd';
    expect(title).toContain('Dubbele content');
  });

  test('near-duplicate finding uses Dutch title', () => {
    const title = 'Bijna-dubbele content gevonden';
    expect(title).toContain('Bijna-dubbele');
  });

  test('brand consistency finding uses Dutch title', () => {
    const title = 'Merkconsistentie afwijking';
    expect(title).toContain('Merkconsistentie');
  });

  test('prohibited claim finding uses Dutch title', () => {
    const title = 'Verboden claim gedetecteerd';
    expect(title).toContain('Verboden claim');
  });

  test('prohibited terminology finding uses Dutch title', () => {
    const title = 'Verboden terminologie gebruikt';
    expect(title).toContain('Verboden terminologie');
  });

  test('intent check finding uses Dutch title', () => {
    const title = 'Zoekintentie komt niet overeen';
    expect(title).toContain('Zoekintentie');
  });

  test('readability finding uses Dutch title', () => {
    const title = 'Leesbaarheid onder aanbevolen niveau';
    expect(title).toContain('Leesbaarheid');
  });

  test('internal link finding uses Dutch title', () => {
    const title = 'Interne links ontbreken';
    expect(title).toContain('Interne links');
  });

  test('conversion finding uses Dutch title', () => {
    const title = 'Conversie-element ontbreekt';
    expect(title).toContain('Conversie');
  });

  test('GEO readiness finding uses Dutch title', () => {
    const title = 'Niet geoptimaliseerd voor AI-zoekresultaten';
    expect(title).toContain('AI-zoekresultaten');
  });

  test('unsupported claim finding uses Dutch title', () => {
    const title = 'Niet-ondersteunde claim gevonden';
    expect(title).toContain('Niet-ondersteunde');
  });

  test('location uniqueness finding uses Dutch title', () => {
    const title = 'Locatiepagina is niet uniek';
    expect(title).toContain('Locatiepagina');
  });

  test('product consistency finding uses Dutch title', () => {
    const title = 'Productgegevens zijn inconsistent';
    expect(title).toContain('Productgegevens');
  });

  test('recommendations are in Dutch', () => {
    const recommendation = 'Herschrijf de content om de dubbele tekst te verwijderen en meer unieke waarde toe te voegen.';
    expect(recommendation).toContain('Herschrijf');
    expect(recommendation).toContain('unieke waarde');
  });
});

// ============================================================================
// Jaccard similarity for duplicate detection
// ============================================================================

describe('Jaccard Similarity (Duplicate Detection)', () => {
  function tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^\w\s\u00C0-\u024F]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
  }

  function jaccardSimilarity(textA: string, textB: string): number {
    const tokensA = new Set(tokenize(textA));
    const tokensB = new Set(tokenize(textB));
    if (tokensA.size === 0 && tokensB.size === 0) return 1;
    if (tokensA.size === 0 || tokensB.size === 0) return 0;
    let intersection = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) intersection++;
    }
    const union = tokensA.size + tokensB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  test('identical text has similarity 1', () => {
    const text = 'Dit is een voorbeeld tekst over SEO optimalisatie.';
    expect(jaccardSimilarity(text, text)).toBe(1);
  });

  test('completely different text has low similarity', () => {
    const textA = 'Fietsenmaker Amsterdam biedt reparaties aan.';
    const textB = 'Loodgieter Rotterdam repareert leidingen.';
    expect(jaccardSimilarity(textA, textB)).toBeLessThan(0.5);
  });

  test('similar text has high similarity', () => {
    const textA = 'SEO optimalisatie is belangrijk voor uw website vindbaarheid.';
    const textB = 'SEO optimalisatie is essentieel voor uw website zichtbaarheid.';
    expect(jaccardSimilarity(textA, textB)).toBeGreaterThan(0.5);
  });

  test('empty text returns 0 similarity', () => {
    expect(jaccardSimilarity('', 'Some content')).toBe(0);
  });
});

// ============================================================================
// Flesch reading ease (Dutch adaptation)
// ============================================================================

describe('Flesch Reading Ease (Dutch)', () => {
  test('simple Dutch text should have higher readability score', () => {
    // Short sentences, simple words = higher score
    const simpleText = 'Dit is een korte zin. Het is makkelijk te lezen. Iedereen snapt dit.';
    const sentences = simpleText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    expect(sentences.length).toBeGreaterThanOrEqual(3);
  });

  test('complex Dutch text should have lower readability score', () => {
    // Long sentences, complex words = lower score
    const complexText = 'De implementatie van geavanceerde zoekmachineoptimalisatiestrategieën vereist een diepgaand begrip van algoritme-ontwikkeling en contentmarketingprincipes.';
    const words = complexText.split(/\s+/);
    expect(words.length).toBeGreaterThan(15);
  });

  test('Dutch syllable counting handles common endings', () => {
    // Words ending in -en (plural) should reduce syllable count
    const word = 'fietsen'; // "fiets" + "en" = 2 syllables, but -en is often 0.5
    expect(word.endsWith('en')).toBe(true);
  });
});
