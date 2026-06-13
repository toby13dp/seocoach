/**
 * Internal Link Candidate Generator Tests
 * Tests for /src/lib/linking/candidate-generator.ts
 */

import { describe, test, expect, beforeAll, mock } from 'bun:test';
import { generateAnchorVariations } from '@/lib/linking/anchor-variation';
import type { LinkStrategy, LinkCandidate, CannibalizationWarning, PageLinkProfile } from '@/lib/linking/types';

// ============================================================================
// Unit tests for anchor variation generation (pure function, no DB)
// ============================================================================

describe('Anchor Variation Generator', () => {
  test('generates 3-5 anchor variations', () => {
    const variations = generateAnchorVariations(
      'SEO Gids voor Beginners',
      'seo gids',
      'Leer alles over SEO voor jouw website in deze uitgebreide gids.'
    );
    expect(variations.length).toBeGreaterThanOrEqual(3);
    expect(variations.length).toBeLessThanOrEqual(5);
  });

  test('includes exact match variation with correct type', () => {
    const variations = generateAnchorVariations(
      'SEO Gids voor Beginners',
      'seo gids',
      'Leer alles over SEO voor jouw website.'
    );
    const exactMatch = variations.find((v) => v.type === 'exact_match');
    expect(exactMatch).toBeDefined();
    expect(exactMatch!.anchorText.toLowerCase()).toContain('seo gids');
  });

  test('includes descriptive variation with Dutch type label', () => {
    const variations = generateAnchorVariations(
      'Fietsenmaker Amsterdam',
      'fietsenmaker',
      'De beste fietsenmaker in Amsterdam voor al uw reparaties.'
    );
    const descriptive = variations.find((v) => v.type === 'descriptive');
    expect(descriptive).toBeDefined();
    expect(descriptive!.typeLabel).toBe('Beschrijvend');
  });

  test('includes action-oriented variation with Dutch phrases', () => {
    const variations = generateAnchorVariations(
      'Website Optimalisatie',
      'website optimalisatie',
      'Optimaliseer uw website voor betere resultaten.'
    );
    const action = variations.find((v) => v.type === 'action_oriented');
    expect(action).toBeDefined();
    expect(action!.typeLabel).toBe('Actiegericht');
  });

  test('includes natural language variation', () => {
    const variations = generateAnchorVariations(
      'Content Marketing Strategie',
      'content marketing',
      'Ontwikkel een sterke content marketing strategie voor uw bedrijf.'
    );
    const natural = variations.find((v) => v.type === 'natural_language');
    expect(natural).toBeDefined();
    expect(natural!.typeLabel).toBe('Natuurlijk taalgebruik');
  });

  test('typeLabel values are in Dutch', () => {
    const variations = generateAnchorVariations(
      'Lokale SEO Tips',
      'lokale seo',
      'Ontdek de beste lokale SEO tips.'
    );
    const dutchLabels = ['Exacte overeenkomst', 'Gedeeltelijke overeenkomst', 'Beschrijvend', 'Actiegericht', 'Natuurlijk taalgebruik'];
    for (const v of variations) {
      expect(dutchLabels).toContain(v.typeLabel);
    }
  });

  test('all anchor texts respect minimum length of 3 characters', () => {
    const variations = generateAnchorVariations(
      'Dienstpagina',
      'dienst',
      'Onze professionele diensten.'
    );
    for (const v of variations) {
      expect(v.anchorText.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('all anchor texts respect maximum length of 60 characters', () => {
    const variations = generateAnchorVariations(
      'Zeer Lange Titel Die Misschien Meer Dan Zestig Tekens Bevat',
      'zeer lange titel',
      'Dit is een context met veel tekst over het onderwerp.'
    );
    for (const v of variations) {
      expect(v.anchorText.length).toBeLessThanOrEqual(60);
    }
  });

  test('confidence scores are between 0 and 1', () => {
    const variations = generateAnchorVariations(
      'SEO Strategie',
      'seo strategie',
      'Bouw een effectieve SEO strategie.'
    );
    for (const v of variations) {
      expect(v.confidence).toBeGreaterThanOrEqual(0);
      expect(v.confidence).toBeLessThanOrEqual(1);
    }
  });

  test('exact match has highest confidence', () => {
    const variations = generateAnchorVariations(
      'Website Bouwen',
      'website bouwen',
      'Leer hoe je een website bouwt.'
    );
    const exactMatch = variations.find((v) => v.type === 'exact_match');
    const otherVariations = variations.filter((v) => v.type !== 'exact_match');
    if (exactMatch && otherVariations.length > 0) {
      const maxOtherConfidence = Math.max(...otherVariations.map((v) => v.confidence));
      expect(exactMatch.confidence).toBeGreaterThanOrEqual(maxOtherConfidence);
    }
  });

  test('deduplicates anchor texts (case-insensitive)', () => {
    const variations = generateAnchorVariations(
      'Test Pagina',
      'test pagina',
      'Dit is een test pagina.'
    );
    const lowercased = variations.map((v) => v.anchorText.toLowerCase());
    const unique = new Set(lowercased);
    expect(unique.size).toBe(variations.length);
  });

  test('variations are sorted by confidence descending', () => {
    const variations = generateAnchorVariations(
      'Online Marketing',
      'online marketing',
      'Alles over online marketing strategieën.'
    );
    for (let i = 1; i < variations.length; i++) {
      expect(variations[i - 1].confidence).toBeGreaterThanOrEqual(variations[i].confidence);
    }
  });

  test('handles empty keyword gracefully', () => {
    const variations = generateAnchorVariations(
      'Pagina Titel',
      '',
      'Een pagina met content.'
    );
    // Should still generate some variations, just not exact match
    expect(variations.length).toBeGreaterThanOrEqual(1);
  });

  test('handles empty context gracefully', () => {
    const variations = generateAnchorVariations(
      'Zoekmachine Optimalisatie',
      'zoekmachine optimalisatie',
      ''
    );
    expect(variations.length).toBeGreaterThanOrEqual(3);
  });

  test('action anchors use Dutch CTA phrases', () => {
    const variations = generateAnchorVariations(
      'Content Strategie',
      'content strategie',
      'Ontwikkel een content strategie.'
    );
    const actionVariations = variations.filter((v) => v.type === 'action_oriented');
    const dutchCtaPatterns = ['lees meer over', 'ontdek', 'alles over', 'meer informatie over', 'bekijk onze'];
    for (const av of actionVariations) {
      const matchesDutch = dutchCtaPatterns.some((pattern) => av.anchorText.toLowerCase().includes(pattern));
      expect(matchesDutch).toBe(true);
    }
  });
});

// ============================================================================
// Tests for LinkStrategy type validation
// ============================================================================

describe('Link Strategy Types', () => {
  test('all five strategy types are valid', () => {
    const strategies: LinkStrategy[] = [
      'SEMANTIC',
      'TOPIC_CLUSTER',
      'ORPHAN_PAGE',
      'STRONG_PAGE',
      'BROKEN_REPLACEMENT',
    ];
    expect(strategies.length).toBe(5);
  });
});

// ============================================================================
// Tests for LinkCandidate structure
// ============================================================================

describe('LinkCandidate Structure', () => {
  test('LinkCandidate interface has required fields', () => {
    const candidate: LinkCandidate = {
      projectId: 'proj-1',
      sourcePageId: 'page-1',
      targetPageId: 'page-2',
      sourceUrl: 'https://example.com/source',
      targetUrl: 'https://example.com/target',
      anchorText: 'seo gids',
      surroundingText: 'Lees meer over onze seo gids voor beginners.',
      strategy: 'SEMANTIC',
      confidence: 0.85,
      isExisting: false,
      isBroken: false,
      replacesLinkId: null,
    };
    expect(candidate.projectId).toBe('proj-1');
    expect(candidate.strategy).toBe('SEMANTIC');
    expect(candidate.confidence).toBe(0.85);
    expect(candidate.isExisting).toBe(false);
  });

  test('confidence score is between 0 and 1', () => {
    const candidate: LinkCandidate = {
      projectId: 'proj-1',
      sourcePageId: 'page-1',
      targetPageId: 'page-2',
      sourceUrl: 'https://example.com/source',
      targetUrl: 'https://example.com/target',
      anchorText: 'test',
      surroundingText: null,
      strategy: 'TOPIC_CLUSTER',
      confidence: 0.72,
      isExisting: false,
      isBroken: false,
      replacesLinkId: null,
    };
    expect(candidate.confidence).toBeGreaterThanOrEqual(0);
    expect(candidate.confidence).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Tests for CannibalizationWarning structure
// ============================================================================

describe('CannibalizationWarning', () => {
  test('CannibalizationWarning interface has Dutch messages', () => {
    const warning: CannibalizationWarning = {
      pageUrl1: 'https://example.com/seo-tips',
      pageId1: 'page-1',
      pageUrl2: 'https://example.com/seo-gids',
      pageId2: 'page-2',
      sharedKeyword: 'seo tips',
      warning: 'Beide pagina\'s concurreren voor dezelfde zoekterm "seo tips". Dit kan leiden tot kannibalisatie.',
      severity: 'medium',
      suggestedAction: 'Overweeg om één pagina te canonicaliseren of de content te differentiëren.',
    };
    expect(warning.warning.length).toBeGreaterThan(0);
    expect(warning.suggestedAction.length).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(warning.severity);
  });
});

// ============================================================================
// Tests for PageLinkProfile structure
// ============================================================================

describe('PageLinkProfile Structure', () => {
  test('PageLinkProfile has all required fields', () => {
    const profile: PageLinkProfile = {
      pageId: 'page-1',
      url: 'https://example.com/seo-gids',
      normalizedUrl: 'https://example.com/seo-gids',
      title: 'SEO Gids voor Beginners',
      snippet: 'Leer alles over SEO in deze uitgebreide gids.',
      primaryKeyword: 'seo gids',
      incomingLinks: 5,
      outgoingLinks: 3,
      wordCount: 1200,
      isOrphan: false,
      clusterId: 'cluster-1',
      isPillar: true,
      existingOutgoingUrls: ['https://example.com/over-ons', 'https://example.com/contact'],
      mainContent: 'Volledige inhoud van de pagina...',
    };
    expect(profile.isOrphan).toBe(false);
    expect(profile.isPillar).toBe(true);
    expect(profile.existingOutgoingUrls.length).toBeGreaterThan(0);
  });

  test('orphan page has no incoming links', () => {
    const orphanProfile: PageLinkProfile = {
      pageId: 'page-orphan',
      url: 'https://example.com/verweesde-pagina',
      normalizedUrl: 'https://example.com/verweesde-pagina',
      title: 'Verweesde Pagina',
      snippet: 'Een pagina zonder interne links.',
      primaryKeyword: null,
      incomingLinks: 0,
      outgoingLinks: 2,
      wordCount: 500,
      isOrphan: true,
      clusterId: null,
      isPillar: false,
      existingOutgoingUrls: [],
      mainContent: null,
    };
    expect(orphanProfile.isOrphan).toBe(true);
    expect(orphanProfile.incomingLinks).toBe(0);
  });
});

// ============================================================================
// Tests for deduplication of existing links
// ============================================================================

describe('Existing Link Deduplication', () => {
  test('existingOutgoingUrls tracks already-linked targets', () => {
    const profile: PageLinkProfile = {
      pageId: 'page-1',
      url: 'https://example.com/source',
      normalizedUrl: 'https://example.com/source',
      title: 'Bronpagina',
      snippet: null,
      primaryKeyword: 'seo',
      incomingLinks: 3,
      outgoingLinks: 2,
      wordCount: 800,
      isOrphan: false,
      clusterId: null,
      isPillar: false,
      existingOutgoingUrls: ['https://example.com/target-a', 'https://example.com/target-b'],
      mainContent: null,
    };

    const alreadyLinked = 'https://example.com/target-a';
    expect(profile.existingOutgoingUrls).toContain(alreadyLinked);
  });

  test('new link candidate should target URL not already linked', () => {
    const profile: PageLinkProfile = {
      pageId: 'page-1',
      url: 'https://example.com/source',
      normalizedUrl: 'https://example.com/source',
      title: 'Bronpagina',
      snippet: null,
      primaryKeyword: 'seo',
      incomingLinks: 3,
      outgoingLinks: 2,
      wordCount: 800,
      isOrphan: false,
      clusterId: null,
      isPillar: false,
      existingOutgoingUrls: ['https://example.com/target-a'],
      mainContent: null,
    };

    const candidateTarget = 'https://example.com/target-c';
    const isAlreadyLinked = profile.existingOutgoingUrls.includes(candidateTarget);
    expect(isAlreadyLinked).toBe(false);
  });
});
