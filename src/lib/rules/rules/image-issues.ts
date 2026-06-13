// ============================================================================
// Rule: Image Issues — Missing alt text, oversized images
// ============================================================================

import type { TechnicalRule, PageAnalysis, TechnicalIssueResult } from '../types';

// ---------------------------------------------------------------------------
// Missing alt text
// ---------------------------------------------------------------------------
export const missingAltTextRule: TechnicalRule = {
  id: 'images-missing-alt',
  name: 'Afbeeldingen zonder beschrijvende tekst',
  description: 'Afbeeldingen op de pagina missen alt-tekst',
  severity: 'WARNING',
  priority: 'MEDIUM',
  effort: 'LOW',
  category: 'content',
};

export function checkMissingAltText(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null;
  if (page.imagesWithoutAlt <= 0) return null;

  const count = page.imagesWithoutAlt;
  const affectedImages = page.images
    ?.filter(img => img.alt === null || img.alt.trim() === '')
    .map(img => img.src) ?? [];

  return {
    ruleId: missingAltTextRule.id,
    ruleName: missingAltTextRule.name,
    dutchExplanation: `${count} afbeeldingen op deze pagina hebben geen beschrijvende tekst (alt-tekst). Dit is belangrijk voor toegankelijkheid en voor zoekmachines om de afbeelding te begrijpen.`,
    technicalDetails: `${count} images without alt text on ${page.url}`,
    evidence: [
      { field: 'imagesWithoutAlt', value: count },
      { field: 'affectedImages', value: affectedImages.slice(0, 10).join(', ') },
    ],
    severity: 'WARNING',
    priority: 'MEDIUM',
    impact: 'Zonder alt-tekst kunnen zoekmachines de afbeeldingen niet begrijpen. Ook voor bezoekers met een visuele beperking is alt-tekst belangrijk.',
    effort: 'LOW',
    affectedUrls: [page.url],
    recommendedAction: 'Voeg voor elke afbeelding een beschrijvende alt-tekst toe die uitlegt wat er op de afbeelding te zien is.',
    autoFixAvailable: false,
    confidence: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Oversized images
// ---------------------------------------------------------------------------
export const oversizedImagesRule: TechnicalRule = {
  id: 'images-oversized',
  name: 'Te grote afbeeldingen',
  description: 'Afbeeldingen op de pagina zijn te groot in bestandsgrootte',
  severity: 'WARNING',
  priority: 'MEDIUM',
  effort: 'LOW',
  category: 'content',
};

const OVERSIZED_IMAGE_BYTES = 500_000; // 500KB

export function checkOversizedImages(page: PageAnalysis): TechnicalIssueResult | null {
  if (page.contentType !== 'HTML' && page.contentType !== 'text/html') return null;
  if (page.statusCode !== null && page.statusCode >= 400) return null;
  if (!page.images || page.images.length === 0) return null;

  const oversized = page.images.filter(
    img => img.sizeBytes !== undefined && img.sizeBytes > OVERSIZED_IMAGE_BYTES
  );

  if (oversized.length === 0) return null;

  const count = oversized.length;
  const totalSizeMB = (oversized.reduce((sum, img) => sum + (img.sizeBytes ?? 0), 0) / 1_000_000).toFixed(1);

  return {
    ruleId: oversizedImagesRule.id,
    ruleName: oversizedImagesRule.name,
    dutchExplanation: `${count} afbeeldingen zijn erg groot (${totalSizeMB}MB). Dit maakt je pagina traag. Verklein afbeeldingen voordat je ze uploadt.`,
    technicalDetails: `${count} oversized images on ${page.url} (threshold: ${OVERSIZED_IMAGE_BYTES / 1000}KB)`,
    evidence: oversized.slice(0, 10).map(img => ({
      field: 'imageSize',
      value: `${img.src}: ${(img.sizeBytes! / 1_000_000).toFixed(2)}MB`,
      expected: `Minder dan ${OVERSIZED_IMAGE_BYTES / 1000}KB`,
    })),
    severity: 'WARNING',
    priority: 'MEDIUM',
    impact: 'Grote afbeeldingen vertragen het laden van je pagina. Trage pagina\'s scoren lager in zoekmachines en bezoekers vertrekken sneller.',
    effort: 'LOW',
    affectedUrls: [page.url],
    recommendedAction: 'Verklein afbeeldingen voordat je ze uploadt. Gebruik een compressietool of sla afbeeldingen op in een efficiënter formaat zoals WebP.',
    autoFixAvailable: false,
    confidence: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const imageIssueRules = [
  { definition: missingAltTextRule, check: checkMissingAltText },
  { definition: oversizedImagesRule, check: checkOversizedImages },
];
