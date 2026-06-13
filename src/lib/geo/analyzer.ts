// ============================================================================
// GEO Readiness — Analyzer
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Analyzes crawled pages for GEO (Generative Engine Optimization) readiness
// across 15 categories. Uses existing Page, TechnicalIssue, StructuredData,
// and BrandProfile data.
//
// CRITICAL: This analysis is about CONTENT READINESS for AI interpretation.
// It does NOT represent measured external AI visibility.
// ============================================================================
import { db } from '@/lib/db';
import type {
  GeoCheckResult,
  GeoReadinessConfig,
  GeoCheckCategory,
} from './types';
import {
  GEO_CHECK_CATEGORIES,
  DEFAULT_GEO_CONFIG,
} from './types';
import type { GeoCheckStatus } from '@prisma/client';

// ============================================================================
// Helper: Content Analysis
// ============================================================================

/**
 * Check if content contains answer-style paragraphs (sentences starting with
 * definitive language patterns).
 */
function hasAnswerParagraphs(content: string, minWordCount: number): {
  found: boolean;
  count: number;
  evidence: string[];
} {
  if (!content || content.split(/\s+/).length < minWordCount) {
    return { found: false, count: 0, evidence: [] };
  }

  const answerPatterns = [
    /(?:het antwoord is|de oplossing is|korte antwoord|samenvattend|kortom)\s/i,
    /(?:dat is|dit is|hierbij|volgens)\s.*(?:een|de|het)\s/i,
    /(?:^[A-Z][^.]*\.\s){2,}/m, // Multiple short definitive sentences
  ];

  const paragraphs = content.split(/\n\s*\n/);
  const matchingParagraphs: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 20) continue;
    for (const pattern of answerPatterns) {
      if (pattern.test(trimmed)) {
        matchingParagraphs.push(trimmed.slice(0, 200));
        break;
      }
    }
  }

  return {
    found: matchingParagraphs.length > 0,
    count: matchingParagraphs.length,
    evidence: matchingParagraphs.slice(0, 5),
  };
}

/**
 * Check if content contains definition-style content ("X is een Y").
 */
function hasDefinitions(content: string): {
  found: boolean;
  count: number;
  evidence: string[];
} {
  if (!content) return { found: false, count: 0, evidence: [] };

  const definitionPatterns = [
    /(?:is een|is een soort|is een vorm van|betekent|verwijst naar|omvat)\s/i,
    /(?:wordt gedefinieerd als|staat voor|is het)\s/i,
  ];

  const lines = content.split('\n');
  const matches: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 10) continue;
    for (const pattern of definitionPatterns) {
      if (pattern.test(trimmed)) {
        matches.push(trimmed.slice(0, 200));
        break;
      }
    }
  }

  return {
    found: matches.length > 0,
    count: matches.length,
    evidence: matches.slice(0, 5),
  };
}

/**
 * Check if content has FAQ-style Q&A sections.
 */
function hasFaqBlocks(content: string): {
  found: boolean;
  count: number;
  evidence: string[];
} {
  if (!content) return { found: false, count: 0, evidence: [] };

  const faqPatterns = [
    /(?:veelgestelde vragen|faq|vragen en antwoorden)/i,
    /(?:V:|Vraag:|Q:)\s/i,
    /(?:A:|Antwoord:|A:)\s/i,
  ];

  const matches: string[] = [];
  for (const pattern of faqPatterns) {
    if (pattern.test(content)) {
      const matchResult = content.match(pattern);
      if (matchResult) {
        matches.push(matchResult[0]);
      }
    }
  }

  // Count Q&A pairs
  const questionCount = (content.match(/(?:V:|Vraag:|Q:)\s/gi) || []).length;

  return {
    found: questionCount >= 1 || matches.length > 0,
    count: questionCount || matches.length,
    evidence: matches.slice(0, 5),
  };
}

/**
 * Check if content has citation-style source references.
 */
function hasCitations(content: string): {
  found: boolean;
  count: number;
  evidence: string[];
} {
  if (!content) return { found: false, count: 0, evidence: [] };

  const citationPatterns = [
    /(?:bron:|source:|volgens|referentie:|geciteerd in)/i,
    /(?:\[\d+\]|\(\d{4}\))/, // [1] or (2024) style
    /(?:https?:\/\/[^\s]+\s*(?:bron|source|referentie))/i,
  ];

  const matches: string[] = [];
  for (const pattern of citationPatterns) {
    const regex = new RegExp(pattern.source, 'gi');
    let match;
    while ((match = regex.exec(content)) !== null) {
      matches.push(match[0].slice(0, 200));
      if (matches.length >= 10) break;
    }
  }

  return {
    found: matches.length > 0,
    count: matches.length,
    evidence: matches.slice(0, 5),
  };
}

/**
 * Check for citable facts (statistics, numbers, data points).
 */
function hasCitableFacts(content: string): {
  found: boolean;
  count: number;
  evidence: string[];
} {
  if (!content) return { found: false, count: 0, evidence: [] };

  const factPatterns = [
    /(?:\d+(?:[.,]\d+)?\s*(?:%|procent|procent|per jaar|jaarlijks|per maand))/i,
    /(?:gemiddeld|totaal|stijging|daling|toename|afname)\s+\d+/i,
    /(?:\d+(?:[.,]\d+)?\s*(?:miljoen|miljard|duizend|euro|EUR|USD))/i,
  ];

  const matches: string[] = [];
  for (const pattern of factPatterns) {
    const regex = new RegExp(pattern.source, 'gi');
    let match;
    while ((match = regex.exec(content)) !== null) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(content.length, match.index + match[0].length + 30);
      matches.push(content.slice(start, end));
      if (matches.length >= 10) break;
    }
  }

  return {
    found: matches.length > 0,
    count: matches.length,
    evidence: matches.slice(0, 5),
  };
}

// ============================================================================
// Category Check Functions
// ============================================================================

interface PageForGeo {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  h1: string | null;
  wordCount: number;
  mainContent: string | null;
  indexability: string;
  metaRobots: string | null;
  publicationDate: Date | null;
  modificationDate: Date | null;
  structuredData: string | null;
}

interface StructuredDataForGeo {
  id: string;
  type: string;
  data: string;
  isValid: boolean;
  url: string | null;
}

/**
 * Run a single category check against all pages.
 */
function checkCategory(
  category: GeoCheckCategory,
  pages: PageForGeo[],
  structuredDataRecords: StructuredDataForGeo[],
  brandProfile: { brandName: string | null } | null,
  config: Required<GeoReadinessConfig>
): GeoCheckResult[] {
  const results: GeoCheckResult[] = [];
  const categoryInfo = GEO_CHECK_CATEGORIES[category];

  switch (category) {
    case 'DIRECT_ANSWERS': {
      for (const page of pages) {
        const content = page.mainContent ?? '';
        const analysis = hasAnswerParagraphs(content, config.minWordCountForAnswers);
        const status: GeoCheckStatus = analysis.found
          ? 'PASSING'
          : page.wordCount >= config.minWordCountForAnswers
            ? 'NEEDS_IMPROVEMENT'
            : 'FAILING';
        const score = analysis.found
          ? Math.min(100, analysis.count * 20)
          : page.wordCount >= config.minWordCountForAnswers
            ? 30
            : 0;

        results.push({
          category,
          status,
          score,
          title: `${categoryInfo.label}: ${page.title ?? page.url}`,
          description: analysis.found
            ? `${analysis.count} antwoordparagraaf(ven) gevonden op deze pagina.`
            : page.wordCount >= config.minWordCountForAnswers
              ? 'Pagina heeft voldoende content maar bevat geen duidelijke antwoordparagrafen.'
              : 'Pagina heeft onvoldoende content voor antwoordparagrafen.',
          recommendation:
            status !== 'PASSING'
              ? 'Voeg duidelijke antwoordparagrafen toe met samenvattingen bovenaan de pagina.'
              : null,
          evidence: analysis.evidence.length > 0
            ? { matchingParagraphs: analysis.evidence }
            : null,
          pageId: page.id,
          url: page.url,
        });
      }
      break;
    }

    case 'DEFINITIONS': {
      for (const page of pages) {
        const content = page.mainContent ?? '';
        const analysis = hasDefinitions(content);
        const status: GeoCheckStatus = analysis.found
          ? 'PASSING'
          : 'NEEDS_IMPROVEMENT';
        const score = analysis.found ? Math.min(100, analysis.count * 25) : 20;

        results.push({
          category,
          status,
          score,
          title: `${categoryInfo.label}: ${page.title ?? page.url}`,
          description: analysis.found
            ? `${analysis.count} definitie(s) gevonden op deze pagina.`
            : 'Geen definitie-achtige content gevonden op deze pagina.',
          recommendation:
            status !== 'PASSING'
              ? 'Voeg definitie-achtige zinnen toe, bijvoorbeeld: "[Term] is een [categorie] die [beschrijving]".'
              : null,
          evidence: analysis.evidence.length > 0
            ? { definitions: analysis.evidence }
            : null,
          pageId: page.id,
          url: page.url,
        });
      }
      break;
    }

    case 'ANSWER_BLOCKS': {
      for (const page of pages) {
        const content = page.mainContent ?? '';
        const analysis = hasFaqBlocks(content);
        const status: GeoCheckStatus = analysis.found
          ? 'PASSING'
          : 'NEEDS_IMPROVEMENT';
        const score = analysis.found
          ? Math.min(100, analysis.count * 15)
          : 10;

        results.push({
          category,
          status,
          score,
          title: `${categoryInfo.label}: ${page.title ?? page.url}`,
          description: analysis.found
            ? `${analysis.count} FAQ-stijl vraag-en-antwoord blok(ken) gevonden.`
            : 'Geen FAQ-stijl vraag-en-antwoord secties gevonden.',
          recommendation:
            status !== 'PASSING'
              ? 'Voeg FAQ-secties toe met vragen en antwoorden in gestructureerd formaat.'
              : null,
          evidence: analysis.evidence.length > 0
            ? { faqMatches: analysis.evidence }
            : null,
          pageId: page.id,
          url: page.url,
        });
      }
      break;
    }

    case 'ENTITY_CLARITY': {
      const entityTypes = new Set<string>();
      for (const sd of structuredDataRecords) {
        if (sd.isValid && (sd.type === 'ORGANIZATION' || sd.type === 'PERSON')) {
          entityTypes.add(sd.type);
        }
      }
      const hasOrg = entityTypes.has('ORGANIZATION');
      const hasPerson = entityTypes.has('PERSON');
      const status: GeoCheckStatus =
        hasOrg && hasPerson ? 'PASSING' : hasOrg || hasPerson ? 'NEEDS_IMPROVEMENT' : 'FAILING';
      const score = (hasOrg ? 50 : 0) + (hasPerson ? 50 : 0);

      results.push({
        category,
        status,
        score,
        title: categoryInfo.label,
        description:
          entityTypes.size > 0
            ? `Entiteiten gevonden: ${Array.from(entityTypes).join(', ')}.`
            : 'Geen organisatie- of persoonsentiteiten gevonden in gestructureerde data.',
        recommendation:
          status !== 'PASSING'
            ? 'Voeg Organization en Person schema markup toe aan de relevante pagina\'s.'
            : null,
        evidence: entityTypes.size > 0 ? { entityTypes: Array.from(entityTypes) } : null,
      });
      break;
    }

    case 'ORGANISATION_CLARITY': {
      const orgSchemas = structuredDataRecords.filter(
        (sd) => sd.isValid && sd.type === 'ORGANIZATION'
      );
      const status: GeoCheckStatus =
        orgSchemas.length > 0 ? 'PASSING' : 'FAILING';
      const score = orgSchemas.length > 0 ? 100 : 0;

      results.push({
        category,
        status,
        score,
        title: categoryInfo.label,
        description:
          orgSchemas.length > 0
            ? `${orgSchemas.length} Organization-schema(s) gevonden.`
            : 'Geen Organization-schema gevonden. AI-modellen kunnen uw bedrijf niet duidelijk identificeren.',
        recommendation:
          status !== 'PASSING'
            ? 'Voeg Organization schema markup toe met bedrijfsnaam, adres en contactgegevens.'
            : null,
        evidence:
          orgSchemas.length > 0
            ? { count: orgSchemas.length }
            : null,
      });
      break;
    }

    case 'AUTHOR_INFORMATION': {
      const authorSchemas = structuredDataRecords.filter(
        (sd) => sd.isValid && sd.type === 'PERSON'
      );
      const aboutPages = pages.filter(
        (p) =>
          p.url.toLowerCase().includes('/over') ||
          p.url.toLowerCase().includes('/team') ||
          p.url.toLowerCase().includes('/about') ||
          (p.title ?? '').toLowerCase().includes('over ons') ||
          (p.h1 ?? '').toLowerCase().includes('over ons')
      );
      const hasAuthorSchema = authorSchemas.length > 0;
      const hasAboutPage = aboutPages.length > 0;
      const status: GeoCheckStatus =
        hasAuthorSchema && hasAboutPage
          ? 'PASSING'
          : hasAuthorSchema || hasAboutPage
            ? 'NEEDS_IMPROVEMENT'
            : 'FAILING';
      const score = (hasAuthorSchema ? 60 : 0) + (hasAboutPage ? 40 : 0);

      results.push({
        category,
        status,
        score,
        title: categoryInfo.label,
        description: `Auteur-markup: ${hasAuthorSchema ? 'aanwezig' : 'ontbreekt'}. Over-pagina: ${hasAboutPage ? 'aanwezig' : 'ontbreekt'}.`,
        recommendation:
          status !== 'PASSING'
            ? 'Voeg auteur-markup (Person schema) toe en zorg voor een over-ons pagina met teaminformatie.'
            : null,
        evidence: {
          authorSchemaCount: authorSchemas.length,
          aboutPageCount: aboutPages.length,
        },
      });
      break;
    }

    case 'SOURCE_TRANSPARENCY': {
      let pagesWithCitations = 0;
      const details: { url: string; citationCount: number }[] = [];

      for (const page of pages) {
        const content = page.mainContent ?? '';
        const analysis = hasCitations(content);
        if (analysis.found) {
          pagesWithCitations++;
          details.push({ url: page.url, citationCount: analysis.count });
        }
      }

      const citationRate = pages.length > 0 ? pagesWithCitations / pages.length : 0;
      const status: GeoCheckStatus =
        citationRate >= 0.3
          ? 'PASSING'
          : citationRate > 0
            ? 'NEEDS_IMPROVEMENT'
            : 'FAILING';
      const score = Math.round(citationRate * 100);

      results.push({
        category,
        status,
        score,
        title: categoryInfo.label,
        description: `${pagesWithCitations} van ${pages.length} pagina's bevatten bronvermeldingen (${Math.round(citationRate * 100)}%).`,
        recommendation:
          status !== 'PASSING'
            ? 'Voeg bronvermeldingen, citaten en verwijzingen naar originele bronnen toe aan uw content.'
            : null,
        evidence: details.length > 0 ? { pagesWithCitations: details.slice(0, 10) } : null,
      });
      break;
    }

    case 'DATES': {
      let pagesWithDates = 0;
      let pagesWithModified = 0;
      for (const page of pages) {
        if (page.publicationDate) pagesWithDates++;
        if (page.modificationDate) pagesWithModified++;
      }
      const pubRate = pages.length > 0 ? pagesWithDates / pages.length : 0;
      const modRate = pages.length > 0 ? pagesWithModified / pages.length : 0;
      const status: GeoCheckStatus =
        pubRate >= 0.5 ? 'PASSING' : pubRate > 0 ? 'NEEDS_IMPROVEMENT' : 'FAILING';
      const score = Math.round(pubRate * 70 + modRate * 30);

      results.push({
        category,
        status,
        score,
        title: categoryInfo.label,
        description: `${pagesWithDates} van ${pages.length} pagina's hebben een publicatiedatum. ${pagesWithModified} hebben een wijzigingsdatum.`,
        recommendation:
          status !== 'PASSING'
            ? 'Voeg publicatie- en wijzigingsdatums toe aan uw pagina\'s, bij voorkeur via gestructureerde data.'
            : null,
        evidence: { pagesWithDates, pagesWithModified, totalPages: pages.length },
      });
      break;
    }

    case 'STRUCTURED_DATA': {
      const validSD = structuredDataRecords.filter((sd) => sd.isValid);
      const invalidSD = structuredDataRecords.filter((sd) => !sd.isValid);
      const pagesWithSD = new Set(
        structuredDataRecords.map((sd) => sd.url).filter(Boolean)
      ).size;
      const sdRate = pages.length > 0 ? pagesWithSD / pages.length : 0;
      const status: GeoCheckStatus =
        sdRate >= 0.5 && invalidSD.length === 0
          ? 'PASSING'
          : sdRate > 0
            ? 'NEEDS_IMPROVEMENT'
            : 'FAILING';
      const score =
        invalidSD.length > 0
          ? Math.round(sdRate * 50)
          : Math.round(sdRate * 100);

      results.push({
        category,
        status,
        score,
        title: categoryInfo.label,
        description: `${validSD.length} valide en ${invalidSD.length} invalide gestructureerde data items gevonden. ${pagesWithSD} van ${pages.length} pagina's hebben gestructureerde data.`,
        recommendation:
          status !== 'PASSING'
            ? invalidSD.length > 0
              ? 'Repareer invalide gestructureerde data en voeg JSON-LD markup toe aan meer pagina\'s.'
              : 'Voeg gestructureerde data (JSON-LD) toe aan uw pagina\'s voor betere AI-interpreteerbaarheid.'
            : null,
        evidence: {
          validCount: validSD.length,
          invalidCount: invalidSD.length,
          pagesWithSD,
          totalPages: pages.length,
        },
      });
      break;
    }

    case 'FAQS': {
      const faqSchemas = structuredDataRecords.filter(
        (sd) => sd.isValid && sd.type === 'FAQ_PAGE'
      );
      let faqPages = 0;
      const faqDetails: { url: string; count: number }[] = [];

      for (const page of pages) {
        const content = page.mainContent ?? '';
        const analysis = hasFaqBlocks(content);
        if (analysis.found) {
          faqPages++;
          faqDetails.push({ url: page.url, count: analysis.count });
        }
      }

      const totalFaqPresence = faqSchemas.length + faqPages;
      const status: GeoCheckStatus =
        totalFaqPresence >= config.minFaqItems
          ? 'PASSING'
          : totalFaqPresence > 0
            ? 'NEEDS_IMPROVEMENT'
            : 'FAILING';
      const score = Math.min(100, totalFaqPresence * 20);

      results.push({
        category,
        status,
        score,
        title: categoryInfo.label,
        description: `${faqSchemas.length} FAQ-schema's en ${faqPages} pagina's met FAQ-secties gevonden.`,
        recommendation:
          status !== 'PASSING'
            ? 'Maak FAQ-pagina\'s met FAQ-schema markup. Zorg voor minimaal 3 vragen en antwoorden per pagina.'
            : null,
        evidence:
          faqDetails.length > 0
            ? { faqSchemas: faqSchemas.length, faqPages: faqDetails.slice(0, 10) }
            : { faqSchemas: faqSchemas.length },
      });
      break;
    }

    case 'UNIQUE_INFORMATION': {
      // Check for unique content by looking at word count diversity and specific signals
      let pagesWithUniqueSignals = 0;
      const uniqueDetails: { url: string; signals: string[] }[] = [];

      for (const page of pages) {
        const content = page.mainContent ?? '';
        const signals: string[] = [];

        // Original research/case study signals
        if (/(?:onderzoek|research|studie|case study|casestudy|onderzoeksresultaten)/i.test(content)) {
          signals.push('original_research');
        }
        // Proprietary data signals
        if (/(?:onze gegevens|onze data|eigen onderzoek|exclusief|uniek)/i.test(content)) {
          signals.push('proprietary_data');
        }
        // Expert opinion signals
        if (/(?:volgens onze expert|in onze ervaring|uit onze praktijk|onze bevindingen)/i.test(content)) {
          signals.push('expert_opinion');
        }

        if (signals.length > 0) {
          pagesWithUniqueSignals++;
          uniqueDetails.push({ url: page.url, signals });
        }
      }

      const uniqueRate = pages.length > 0 ? pagesWithUniqueSignals / pages.length : 0;
      const status: GeoCheckStatus =
        uniqueRate >= 0.2
          ? 'PASSING'
          : uniqueRate > 0
            ? 'NEEDS_IMPROVEMENT'
            : 'FAILING';
      const score = Math.round(uniqueRate * 100);

      results.push({
        category,
        status,
        score,
        title: categoryInfo.label,
        description: `${pagesWithUniqueSignals} van ${pages.length} pagina's bevatten signalen van unieke informatie.`,
        recommendation:
          status !== 'PASSING'
            ? 'Voeg origineel onderzoek, eigen data of expertmeningen toe om onderscheidende content te creëren.'
            : null,
        evidence:
          uniqueDetails.length > 0
            ? { pagesWithUniqueSignals: uniqueDetails.slice(0, 10) }
            : null,
      });
      break;
    }

    case 'CITABLE_FACTS': {
      let pagesWithFacts = 0;
      const factDetails: { url: string; factCount: number }[] = [];

      for (const page of pages) {
        const content = page.mainContent ?? '';
        const analysis = hasCitableFacts(content);
        if (analysis.found) {
          pagesWithFacts++;
          factDetails.push({ url: page.url, factCount: analysis.count });
        }
      }

      const factRate = pages.length > 0 ? pagesWithFacts / pages.length : 0;
      const status: GeoCheckStatus =
        factRate >= 0.3
          ? 'PASSING'
          : factRate > 0
            ? 'NEEDS_IMPROVEMENT'
            : 'FAILING';
      const score = Math.round(factRate * 100);

      results.push({
        category,
        status,
        score,
        title: categoryInfo.label,
        description: `${pagesWithFacts} van ${pages.length} pagina's bevatten citeerbare feiten en statistieken.`,
        recommendation:
          status !== 'PASSING'
            ? 'Voeg statistieken, cijfers en onderbouwde claims toe die AI-modellen kunnen citeren.'
            : null,
        evidence:
          factDetails.length > 0
            ? { pagesWithFacts: factDetails.slice(0, 10) }
            : null,
      });
      break;
    }

    case 'CRAWLABILITY': {
      // Check for crawl-blocking technical issues
      const blockingIssues = pages.filter(
        (p) => p.metaRobots?.includes('nofollow') === true
      );
      const status: GeoCheckStatus =
        blockingIssues.length === 0 ? 'PASSING' : 'NEEDS_IMPROVEMENT';
      const score =
        pages.length > 0
          ? Math.round(((pages.length - blockingIssues.length) / pages.length) * 100)
          : 0;

      results.push({
        category,
        status,
        score,
        title: categoryInfo.label,
        description:
          blockingIssues.length === 0
            ? 'Geen crawl-blokkerende issues gevonden.'
            : `${blockingIssues.length} pagina's met mogelijke crawl-beperkingen gevonden.`,
        recommendation:
          status !== 'PASSING'
            ? 'Controleer robots.txt en meta-robots tags. Zorg dat belangrijke pagina\'s crawlbaar zijn.'
            : null,
        evidence: {
          totalPages: pages.length,
          blockingCount: blockingIssues.length,
        },
      });
      break;
    }

    case 'INDEXABILITY': {
      const nonIndexablePages = pages.filter(
        (p) =>
          p.indexability !== 'INDEXABLE' ||
          p.metaRobots?.includes('noindex') === true
      );
      const indexableCount = pages.length - nonIndexablePages.length;
      const indexRate = pages.length > 0 ? indexableCount / pages.length : 0;
      const status: GeoCheckStatus =
        indexRate >= 0.9
          ? 'PASSING'
          : indexRate >= 0.7
            ? 'NEEDS_IMPROVEMENT'
            : 'FAILING';
      const score = Math.round(indexRate * 100);

      results.push({
        category,
        status,
        score,
        title: categoryInfo.label,
        description: `${indexableCount} van ${pages.length} pagina's zijn indexeerbaar (${Math.round(indexRate * 100)}%).`,
        recommendation:
          status !== 'PASSING'
            ? 'Verwijder noindex-tags van pagina\'s die geïndexeerd moeten worden. Controleer canonical-tags.'
            : null,
        evidence: {
          indexableCount,
          nonIndexableCount: nonIndexablePages.length,
          totalPages: pages.length,
        },
      });
      break;
    }

    case 'BRAND_CONSISTENCY': {
      const brandName = brandProfile?.brandName;
      if (!brandName) {
        results.push({
          category,
          status: 'NOT_CHECKED',
          score: 0,
          title: categoryInfo.label,
          description: 'Geen merknaam gevonden in het merkprofiel. Controle kan niet worden uitgevoerd.',
          recommendation:
            'Stel een merknaam in bij het merkprofiel om consistentiecontrole mogelijk te maken.',
          evidence: null,
        });
        break;
      }

      let pagesWithBrand = 0;
      const brandLower = brandName.toLowerCase();
      for (const page of pages) {
        const titleMatch = (page.title ?? '').toLowerCase().includes(brandLower);
        const h1Match = (page.h1 ?? '').toLowerCase().includes(brandLower);
        const descMatch = (page.description ?? '').toLowerCase().includes(brandLower);
        if (titleMatch || h1Match || descMatch) {
          pagesWithBrand++;
        }
      }

      const brandRate = pages.length > 0 ? pagesWithBrand / pages.length : 0;
      const status: GeoCheckStatus =
        brandRate >= 0.5
          ? 'PASSING'
          : brandRate > 0
            ? 'NEEDS_IMPROVEMENT'
            : 'FAILING';
      const score = Math.round(brandRate * 100);

      results.push({
        category,
        status,
        score,
        title: categoryInfo.label,
        description: `Merknaam "${brandName}" gevonden op ${pagesWithBrand} van ${pages.length} pagina's (${Math.round(brandRate * 100)}%).`,
        recommendation:
          status !== 'PASSING'
            ? `Gebruik de merknaam "${brandName}" consistent in titels, H1-koppen en beschrijvingen.`
            : null,
        evidence: { brandName, pagesWithBrand, totalPages: pages.length },
      });
      break;
    }
  }

  return results;
}

// ============================================================================
// Main Analyzer
// ============================================================================

/**
 * Analyze GEO readiness for a project across all 15 categories.
 *
 * This function:
 * - Retrieves crawled pages, structured data, technical issues, and brand profile
 * - Runs category-specific checks against the data
 * - Creates GeoReadinessCheck records for each check result
 * - Updates the GeoReadinessSummary with aggregated scores
 * - Returns the summary
 *
 * CRITICAL: This does NOT represent measured external AI visibility.
 * It analyzes content readiness for AI interpretation only.
 *
 * @param projectId - The project to analyze
 * @param config - Optional configuration for the analysis
 * @returns The updated GeoReadinessSummary
 */
export async function analyzeGeoReadiness(
  projectId: string,
  config?: GeoReadinessConfig
) {
  const effectiveConfig: Required<GeoReadinessConfig> = {
    ...DEFAULT_GEO_CONFIG,
    ...config,
  };

  // Fetch project data
  const [pages, structuredDataRecords, brandProfile] = await Promise.all([
    db.page.findMany({
      where: {
        projectId,
        deletedAt: null,
        status: 'OK',
      },
      select: {
        id: true,
        url: true,
        title: true,
        description: true,
        h1: true,
        wordCount: true,
        mainContent: true,
        indexability: true,
        metaRobots: true,
        publicationDate: true,
        modificationDate: true,
        structuredData: true,
      },
      take: 500, // Limit for performance
    }),
    db.structuredData.findMany({
      where: {
        projectId,
      },
      select: {
        id: true,
        type: true,
        data: true,
        isValid: true,
        url: true,
      },
    }),
    db.brandProfile.findUnique({
      where: { projectId },
      select: { brandName: true },
    }),
  ]);

  // If no pages, return early with NOT_CHECKED status
  if (pages.length === 0) {
    const summary = await db.geoReadinessSummary.upsert({
      where: { projectId },
      create: {
        projectId,
        overallScore: 0,
        totalChecks: 0,
        passingChecks: 0,
        failingChecks: 0,
        notCheckedChecks: 15,
      },
      update: {
        overallScore: 0,
        totalChecks: 0,
        passingChecks: 0,
        failingChecks: 0,
        notCheckedChecks: 15,
        calculatedAt: new Date(),
      },
    });
    return summary;
  }

  // Delete previous checks for this project (full re-analysis)
  await db.geoReadinessCheck.deleteMany({
    where: { projectId },
  });

  // Run checks for each category
  const allCategories = Object.keys(GEO_CHECK_CATEGORIES) as GeoCheckCategory[];
  const categoriesToCheck = allCategories.filter(
    (c) => !effectiveConfig.skipCategories.includes(c)
  );

  let totalChecks = 0;
  let passingChecks = 0;
  let failingChecks = 0;
  let notCheckedChecks = 0;
  const categoryScores: Record<string, number[]> = {};
  const checkRecords: Array<{
    category: GeoCheckCategory;
    result: GeoCheckResult;
  }> = [];

  for (const category of categoriesToCheck) {
    const results = checkCategory(
      category,
      pages as PageForGeo[],
      structuredDataRecords as StructuredDataForGeo[],
      brandProfile,
      effectiveConfig
    );

    categoryScores[category] = [];

    for (const result of results) {
      totalChecks++;
      categoryScores[category].push(result.score);

      if (result.status === 'PASSING') passingChecks++;
      else if (result.status === 'FAILING') failingChecks++;
      else if (result.status === 'NOT_CHECKED') notCheckedChecks++;

      checkRecords.push({ category, result });
    }
  }

  // Batch create GeoReadinessCheck records
  for (const { result } of checkRecords) {
    await db.geoReadinessCheck.create({
      data: {
        projectId,
        pageId: result.pageId ?? null,
        url: result.url ?? null,
        category: result.category,
        status: result.status,
        score: result.score,
        title: result.title,
        description: result.description,
        recommendation: result.recommendation,
        evidence: result.evidence ? JSON.stringify(result.evidence) : null,
        checkedAt: new Date(),
      },
    });
  }

  // Calculate average score per category
  const categoryAvgScores: Record<string, number> = {};
  for (const [cat, scores] of Object.entries(categoryScores)) {
    categoryAvgScores[cat] =
      scores.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : 0;
  }

  // Calculate overall score (weighted average)
  const allScores = Object.values(categoryAvgScores);
  const overallScore =
    allScores.length > 0
      ? allScores.reduce((sum, s) => sum + s, 0) / allScores.length
      : 0;

  // Update or create summary
  const summary = await db.geoReadinessSummary.upsert({
    where: { projectId },
    create: {
      projectId,
      overallScore,
      directAnswersScore: categoryAvgScores['DIRECT_ANSWERS'] ?? 0,
      definitionsScore: categoryAvgScores['DEFINITIONS'] ?? 0,
      answerBlocksScore: categoryAvgScores['ANSWER_BLOCKS'] ?? 0,
      entityClarityScore: categoryAvgScores['ENTITY_CLARITY'] ?? 0,
      organisationClarityScore: categoryAvgScores['ORGANISATION_CLARITY'] ?? 0,
      authorInfoScore: categoryAvgScores['AUTHOR_INFORMATION'] ?? 0,
      sourceTransparencyScore: categoryAvgScores['SOURCE_TRANSPARENCY'] ?? 0,
      datesScore: categoryAvgScores['DATES'] ?? 0,
      structuredDataScore: categoryAvgScores['STRUCTURED_DATA'] ?? 0,
      faqsScore: categoryAvgScores['FAQS'] ?? 0,
      uniqueInfoScore: categoryAvgScores['UNIQUE_INFORMATION'] ?? 0,
      citableFactsScore: categoryAvgScores['CITABLE_FACTS'] ?? 0,
      crawlabilityScore: categoryAvgScores['CRAWLABILITY'] ?? 0,
      indexabilityScore: categoryAvgScores['INDEXABILITY'] ?? 0,
      brandConsistencyScore: categoryAvgScores['BRAND_CONSISTENCY'] ?? 0,
      totalChecks,
      passingChecks,
      failingChecks,
      notCheckedChecks,
      calculatedAt: new Date(),
    },
    update: {
      overallScore,
      directAnswersScore: categoryAvgScores['DIRECT_ANSWERS'] ?? 0,
      definitionsScore: categoryAvgScores['DEFINITIONS'] ?? 0,
      answerBlocksScore: categoryAvgScores['ANSWER_BLOCKS'] ?? 0,
      entityClarityScore: categoryAvgScores['ENTITY_CLARITY'] ?? 0,
      organisationClarityScore: categoryAvgScores['ORGANISATION_CLARITY'] ?? 0,
      authorInfoScore: categoryAvgScores['AUTHOR_INFORMATION'] ?? 0,
      sourceTransparencyScore: categoryAvgScores['SOURCE_TRANSPARENCY'] ?? 0,
      datesScore: categoryAvgScores['DATES'] ?? 0,
      structuredDataScore: categoryAvgScores['STRUCTURED_DATA'] ?? 0,
      faqsScore: categoryAvgScores['FAQS'] ?? 0,
      uniqueInfoScore: categoryAvgScores['UNIQUE_INFORMATION'] ?? 0,
      citableFactsScore: categoryAvgScores['CITABLE_FACTS'] ?? 0,
      crawlabilityScore: categoryAvgScores['CRAWLABILITY'] ?? 0,
      indexabilityScore: categoryAvgScores['INDEXABILITY'] ?? 0,
      brandConsistencyScore: categoryAvgScores['BRAND_CONSISTENCY'] ?? 0,
      totalChecks,
      passingChecks,
      failingChecks,
      notCheckedChecks,
      calculatedAt: new Date(),
    },
  });

  return summary;
}

/**
 * Get the current GEO readiness summary for a project.
 *
 * @param projectId - The project ID
 * @returns The current summary or null if never calculated
 */
export async function getGeoReadinessSummary(projectId: string) {
  return db.geoReadinessSummary.findUnique({
    where: { projectId },
  });
}

/**
 * Get GEO readiness checks for a project with optional filters.
 */
export async function getGeoReadinessChecks(
  projectId: string,
  filters?: {
    category?: GeoCheckCategory;
    status?: GeoCheckStatus;
    pageId?: string;
    limit?: number;
    offset?: number;
  }
) {
  const where: Record<string, unknown> = { projectId };
  if (filters?.category) where.category = filters.category;
  if (filters?.status) where.status = filters.status;
  if (filters?.pageId) where.pageId = filters.pageId;

  return db.geoReadinessCheck.findMany({
    where,
    orderBy: { checkedAt: 'desc' },
    take: filters?.limit ?? 50,
    skip: filters?.offset ?? 0,
  });
}
