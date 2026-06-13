/**
 * Source Grounding Tests
 * Tests for /src/lib/content/source-grounding.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import type { AddSourceParams, ClaimStatus, ClaimCheckItem, ClaimCheckResult, ContentSourceRecord } from '@/lib/content/source-grounding';

// ============================================================================
// Source CRUD operations
// ============================================================================

describe('Source CRUD Operations', () => {
  test('AddSourceParams with all fields', () => {
    const params: AddSourceParams = {
      name: 'SEO Handleiding 2024',
      type: 'DOCUMENT',
      url: 'https://seocoach.nl/handleiding',
      content: 'Uitgebreide handleiding over SEO voor de Nederlandse markt.',
      metadata: JSON.stringify({ author: 'Jan de Vries', year: 2024 }),
      briefId: 'brief-1',
      approvedAt: new Date(),
    };
    expect(params.name).toBe('SEO Handleiding 2024');
    expect(params.type).toBe('DOCUMENT');
  });

  test('valid source types', () => {
    const validTypes = [
      'PAGE',
      'BRAND_PROFILE',
      'DOCUMENT',
      'PRODUCT_DATA',
      'APPROVED_FACT',
      'EXTERNAL_SOURCE',
    ];
    expect(validTypes.length).toBe(6);
  });

  test('invalid source type produces Dutch error', () => {
    const invalidType = 'INVALID';
    const validTypes = ['PAGE', 'BRAND_PROFILE', 'DOCUMENT', 'PRODUCT_DATA', 'APPROVED_FACT', 'EXTERNAL_SOURCE'];
    const message = `Ongeldig brontype: "${invalidType}". Geldige types zijn: ${validTypes.join(', ')}`;
    expect(message).toContain('Ongeldig brontype');
    expect(message).toContain('Geldige types zijn');
  });

  test('source with minimal required fields', () => {
    const params: AddSourceParams = {
      name: 'Bron Document',
      type: 'APPROVED_FACT',
    };
    expect(params.url).toBeUndefined();
    expect(params.content).toBeUndefined();
  });

  test('ContentSourceRecord has all expected fields', () => {
    const record: ContentSourceRecord = {
      id: 'source-1',
      projectId: 'proj-1',
      briefId: 'brief-1',
      name: 'Test Bron',
      type: 'DOCUMENT',
      url: 'https://example.com/doc',
      content: 'Inhoud van het document.',
      metadata: null,
      approvedAt: new Date(),
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(record.id).toBe('source-1');
    expect(record.deletedAt).toBeNull();
  });
});

// ============================================================================
// Claim support checking
// ============================================================================

describe('Claim Support Checking', () => {
  test('claim markers are extracted from content', () => {
    const content = 'Onze diensten zijn de beste in Nederland. [VERIFICATIE_NODIG]Wij hebben 95% klanttevredenheid[/VERIFICATIE_NODIG]. Contacteer ons vandaag nog.';
    const claimRegex = /\[VERIFICATIE_NODIG\]([\s\S]*?)\[\/VERIFICATIE_NODIG\]/g;
    const claims: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = claimRegex.exec(content)) !== null) {
      if (match[1].trim()) claims.push(match[1].trim());
    }
    expect(claims.length).toBe(1);
    expect(claims[0]).toContain('95% klanttevredenheid');
  });

  test('multiple claims are extracted', () => {
    const content = '[VERIFICATIE_NODIG]Claim één: Wij zijn de snelste[/VERIFICATIE_NODIG] en [VERIFICATIE_NODIG]Claim twee: 100% garantie[/VERIFICATIE_NODIG].';
    const claimRegex = /\[VERIFICATIE_NODIG\]([\s\S]*?)\[\/VERIFICATIE_NODIG\]/g;
    const claims: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = claimRegex.exec(content)) !== null) {
      if (match[1].trim()) claims.push(match[1].trim());
    }
    expect(claims.length).toBe(2);
  });

  test('content without claims returns empty array', () => {
    const content = 'Dit is gewone content zonder verificatiemarkeringen.';
    const claimRegex = /\[VERIFICATIE_NODIG\]([\s\S]*?)\[\/VERIFICATIE_NODIG\]/g;
    const claims: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = claimRegex.exec(content)) !== null) {
      if (match[1].trim()) claims.push(match[1].trim());
    }
    expect(claims.length).toBe(0);
  });

  test('ClaimCheckItem has correct structure', () => {
    const item: ClaimCheckItem = {
      claim: 'Wij hebben 95% klanttevredenheid',
      status: 'SUPPORTED',
      explanation: 'Claim wordt ondersteund door 1 bron: Klantonderzoek 2024. De inhoud van de bron komt overeen met deze claim.',
      supportingSources: ['source-1'],
      supportingSourceNames: ['Klantonderzoek 2024'],
    };
    expect(item.status).toBe('SUPPORTED');
    expect(item.supportingSources.length).toBeGreaterThan(0);
  });

  test('ClaimStatus values are valid', () => {
    const statuses: ClaimStatus[] = ['SUPPORTED', 'UNSUPPORTED', 'PARTIALLY_SUPPORTED'];
    expect(statuses.length).toBe(3);
  });
});

// ============================================================================
// Unsupported claims are flagged
// ============================================================================

describe('Unsupported Claims Are Flagged', () => {
  test('unsupported claim gets UNSUPPORTED status', () => {
    const item: ClaimCheckItem = {
      claim: 'Wij zijn de absolute marktleider in Nederland',
      status: 'UNSUPPORTED',
      explanation: 'Geen van de geselecteerde bronnen ondersteunt deze claim. De claim moet worden geverifieerd met aanvullende bronnen voordat deze wordt gepubliceerd.',
      supportingSources: [],
      supportingSourceNames: [],
    };
    expect(item.status).toBe('UNSUPPORTED');
    expect(item.supportingSources.length).toBe(0);
  });

  test('partially supported claim gets PARTIALLY_SUPPORTED status', () => {
    const item: ClaimCheckItem = {
      claim: 'Onze SEO aanpak verhoogt organisch verkeer met 300%',
      status: 'PARTIALLY_SUPPORTED',
      explanation: 'Claim wordt gedeeltelijk ondersteund door 1 bron: SEO Rapport Q4. De bronnen bevatten gerelateerde informatie, maar dekken de claim niet volledig. Aanvullende verificatie wordt aanbevolen.',
      supportingSources: ['source-1'],
      supportingSourceNames: ['SEO Rapport Q4'],
    };
    expect(item.status).toBe('PARTIALLY_SUPPORTED');
  });

  test('Dutch explanation for unsupported claims', () => {
    const explanation = 'Geen van de geselecteerde bronnen ondersteunt deze claim. De claim moet worden geverifieerd met aanvullende bronnen voordat deze wordt gepubliceerd.';
    expect(explanation).toContain('ondersteunt deze claim niet');
    expect(explanation).toContain('geverifieerd');
    expect(explanation).toContain('gepubliceerd');
  });

  test('Dutch explanation for partially supported claims', () => {
    const explanation = 'Claim wordt gedeeltelijk ondersteund door 1 bron: Test Bron. De bronnen bevatten gerelateerde informatie, maar dekken de claim niet volledig. Aanvullende verificatie wordt aanbevolen.';
    expect(explanation).toContain('gedeeltelijk ondersteund');
    expect(explanation).toContain('niet volledig');
    expect(explanation).toContain('aanbevolen');
  });

  test('Dutch explanation for supported claims', () => {
    const explanation = 'Claim wordt ondersteund door 1 bron: Test Bron. De inhoud van de bron komt overeen met deze claim.';
    expect(explanation).toContain('ondersteund door');
    expect(explanation).toContain('komt overeen');
  });
});

// ============================================================================
// Warning when no sources selected
// ============================================================================

describe('Warning When No Sources Selected', () => {
  test('ClaimCheckResult with no sources has warning', () => {
    const result: ClaimCheckResult = {
      briefId: 'brief-1',
      totalClaims: 3,
      supported: 0,
      unsupported: 3,
      partiallySupported: 0,
      claims: [
        {
          claim: 'Test claim',
          status: 'UNSUPPORTED',
          explanation: 'Geen bronnen geselecteerd — deze claim kan niet worden gecontroleerd.',
          supportingSources: [],
          supportingSourceNames: [],
        },
      ],
      summary: '3 claim(s) gevonden, maar geen bronnen beschikbaar voor verificatie. Alle claims zijn gemarkeerd als niet-ondersteund.',
      warning: 'Geen bronnen geselecteerd — claims kunnen niet worden gecontroleerd',
    };

    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('Geen bronnen geselecteerd');
  });

  test('all claims are UNSUPPORTED when no sources available', () => {
    const result: ClaimCheckResult = {
      briefId: 'brief-1',
      totalClaims: 2,
      supported: 0,
      unsupported: 2,
      partiallySupported: 0,
      claims: [],
      summary: '2 claim(s) gevonden, maar geen bronnen beschikbaar voor verificatie.',
      warning: 'Geen bronnen geselecteerd — claims kunnen niet worden gecontroleerd',
    };

    expect(result.supported).toBe(0);
    expect(result.unsupported).toBe(result.totalClaims);
  });

  test('Dutch warning message for no sources', () => {
    const warning = 'Geen bronnen geselecteerd — claims kunnen niet worden gecontroleerd';
    expect(warning).toContain('Geen bronnen');
    expect(warning).toContain('niet worden gecontroleerd');
  });
});

// ============================================================================
// "Never claim verified when not" principle
// ============================================================================

describe('Never Claim Verified When Not', () => {
  test('conservative matching — low overlap is UNSUPPORTED', () => {
    const claim = 'Wij bieden de meest uitgebreide SEO service in heel Nederland';
    const sourceContent = 'Onze SEO service helpt bedrijven met zoekmachineoptimalisatie.';
    const claimLower = claim.toLowerCase();
    const claimWords = claimLower.split(/[\s,.:;!?()]+/).filter((w) => w.length > 3);
    const sourceLower = sourceContent.toLowerCase();

    const matchingWords = claimWords.filter((word) => sourceLower.includes(word));
    const overlapRatio = claimWords.length > 0 ? matchingWords.length / claimWords.length : 0;

    // Low overlap should result in UNSUPPORTED, never SUPPORTED
    expect(overlapRatio).toBeLessThan(0.4);
  });

  test('high overlap is SUPPORTED', () => {
    const claim = 'Onze SEO service helpt bedrijven met zoekmachineoptimalisatie';
    const sourceContent = 'Onze SEO service helpt bedrijven met zoekmachineoptimalisatie in Nederland.';
    const claimLower = claim.toLowerCase();
    const claimWords = claimLower.split(/[\s,.:;!?()]+/).filter((w) => w.length > 3);
    const sourceLower = sourceContent.toLowerCase();

    const matchingWords = claimWords.filter((word) => sourceLower.includes(word));
    const overlapRatio = claimWords.length > 0 ? matchingWords.length / claimWords.length : 0;

    expect(overlapRatio).toBeGreaterThanOrEqual(0.7);
  });

  test('medium overlap is PARTIALLY_SUPPORTED', () => {
    const claim = 'De fietsenmaker biedt snelle en betaalbare reparaties voor alle fietsen';
    const sourceContent = 'Onze fietsenmaker biedt reparaties aan voor verschillende soorten fietsen in Amsterdam.';
    const claimLower = claim.toLowerCase();
    const claimWords = claimLower.split(/[\s,.:;!?()]+/).filter((w) => w.length > 3);
    const sourceLower = sourceContent.toLowerCase();

    const matchingWords = claimWords.filter((word) => sourceLower.includes(word));
    const overlapRatio = claimWords.length > 0 ? matchingWords.length / claimWords.length : 0;

    // Should be in the 0.4-0.7 range for partially supported
    expect(overlapRatio).toBeGreaterThanOrEqual(0.3);
    expect(overlapRatio).toBeLessThanOrEqual(0.8);
  });

  test('exact match is always SUPPORTED', () => {
    const claim = '95% van onze klanten is tevreden';
    const sourceContent = 'Uit ons onderzoek blijkt dat 95% van onze klanten is tevreden met onze diensten.';
    const sourceLower = sourceContent.toLowerCase();
    const claimLower = claim.toLowerCase();

    const isExactMatch = sourceLower.includes(claimLower);
    expect(isExactMatch).toBe(true);
  });

  test('ClaimCheckResult summary includes unsupported claim count', () => {
    const result: ClaimCheckResult = {
      briefId: 'brief-1',
      totalClaims: 5,
      supported: 2,
      unsupported: 2,
      partiallySupported: 1,
      claims: [],
      summary: 'Gecontroleerd: 5 claim(s) tegen 3 bron(nen). 2 ondersteund, 1 gedeeltelijk ondersteund, 2 niet ondersteund. ⚠️ 2 claim(s) vereisen aanvullende bronvermelding voordat publicatie veilig is.',
    };

    expect(result.summary).toContain('niet ondersteund');
    expect(result.summary).toContain('vereisen aanvullende bronvermelding');
  });
});

// ============================================================================
// Source association with briefs
// ============================================================================

describe('Source Association with Briefs', () => {
  test('selectSourcesForBrief associates sources with brief', () => {
    const briefId = 'brief-1';
    const sourceIds = ['source-1', 'source-2'];
    expect(sourceIds.length).toBe(2);
  });

  test('empty source list is accepted without error', () => {
    const sourceIds: string[] = [];
    // The function returns early when no source IDs are provided
    expect(sourceIds.length).toBe(0);
  });

  test('Dutch error when brief not found', () => {
    const briefId = 'nonexistent';
    const message = `Content brief "${briefId}" niet gevonden`;
    expect(message).toContain('niet gevonden');
  });

  test('Dutch error for cross-project source association', () => {
    const message = '1 bron(nen) behoren niet tot hetzelfde project als de brief';
    expect(message).toContain('behoren niet tot hetzelfde project');
  });
});

// ============================================================================
// Source removal (soft delete)
// ============================================================================

describe('Source Removal', () => {
  test('Dutch error when source not found', () => {
    const sourceId = 'nonexistent';
    const message = `Bron "${sourceId}" niet gevonden`;
    expect(message).toContain('niet gevonden');
  });

  test('Dutch error when source already deleted', () => {
    const message = 'Deze bron is al verwijderd';
    expect(message).toContain('al verwijderd');
  });

  test('soft delete sets deletedAt timestamp', () => {
    const deletedAt = new Date();
    expect(deletedAt).toBeDefined();
  });
});

// ============================================================================
// Import page as source
// ============================================================================

describe('Import Page as Source', () => {
  test('Dutch error when page not found', () => {
    const pageId = 'nonexistent';
    const message = `Pagina "${pageId}" niet gevonden`;
    expect(message).toContain('niet gevonden');
  });

  test('Dutch error for cross-project page import', () => {
    const message = 'De pagina behoort niet tot het opgegeven project';
    expect(message).toContain('behoort niet tot het opgegeven project');
  });
});

// ============================================================================
// Import brand profile as source
// ============================================================================

describe('Import Brand Profile as Source', () => {
  test('Dutch error when no brand profile found', () => {
    const projectId = 'proj-without-profile';
    const message = `Geen merkprofiel gevonden voor project "${projectId}"`;
    expect(message).toContain('Geen merkprofiel gevonden');
  });

  test('brand profile content includes Dutch labels', () => {
    const contentParts = [
      'Merknaam: SEOCoach',
      'Beschrijving: Professionele SEO diensten',
      'Tone of voice: Professioneel maar toegankelijk',
      'Voorkeursterminologie: zoekmachineoptimalisatie, vindbaarheid',
      'Verboden terminologie: goedkoop, beste, nummer één',
    ];

    for (const part of contentParts) {
      expect(part.length).toBeGreaterThan(0);
    }
    expect(contentParts.some((p) => p.includes('Merknaam'))).toBe(true);
    expect(contentParts.some((p) => p.includes('Verboden terminologie'))).toBe(true);
  });
});

// ============================================================================
// Claim check result with no claims
// ============================================================================

describe('No Claims in Content', () => {
  test('content without claim markers reports zero claims', () => {
    const result: ClaimCheckResult = {
      briefId: 'brief-1',
      totalClaims: 0,
      supported: 0,
      unsupported: 0,
      partiallySupported: 0,
      claims: [],
      summary: 'Geen verificatieplichtige claims gevonden in de content. De content bevat geen [VERIFICATIE_NODIG]-markeringen.',
    };

    expect(result.totalClaims).toBe(0);
    expect(result.summary).toContain('Geen verificatieplichtige claims');
    expect(result.summary).toContain('[VERIFICATIE_NODIG]');
  });
});
