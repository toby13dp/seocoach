// ============================================================================
// Reviews & Reputation — Sentiment Analyzer
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Rule-based sentiment analysis for review text.
// Uses Dutch keyword patterns to classify sentiment, detect themes,
// identify complaints/compliments, and generate content opportunities.
// All outputs are in Dutch.
// ============================================================================

import { ReviewSentiment } from '@prisma/client';
import {
  NEGATIVE_KEYWORDS,
  POSITIVE_KEYWORDS,
  PRODUCT_THEME_KEYWORDS,
  SERVICE_THEME_KEYWORDS,
} from './types';
import type { SentimentAnalysisResult } from './types';

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Normalize text for keyword matching: lowercase, collapse whitespace.
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Count how many keywords from the given list appear in the text.
 * Returns the count and the matched keywords.
 */
function countKeywordMatches(
  text: string,
  keywords: readonly string[]
): { count: number; matched: string[] } {
  const normalized = normalizeText(text);
  const matched: string[] = [];

  for (const keyword of keywords) {
    const kw = keyword.trim().toLowerCase();
    if (kw && normalized.includes(kw)) {
      matched.push(kw);
    }
  }

  return { count: matched.length, matched };
}

// ============================================================================
// Sentiment Classification
// ============================================================================

/**
 * Classify the overall sentiment based on rating and text content.
 *
 * Scoring logic:
 * - Rating 1: base -0.8
 * - Rating 2: base -0.6
 * - Rating 3: base 0.0
 * - Rating 4: base 0.5
 * - Rating 5: base 0.8
 * - Text keywords adjust the score by ±0.1 each, capped at -1 to 1
 *
 * @param rating - Star rating (1-5)
 * @param text - Review text (may be empty)
 * @returns Sentiment classification and numeric score
 */
export function classifySentiment(
  rating: number,
  text: string
): { sentiment: ReviewSentiment; score: number } {
  const result = classifySentimentInternal(rating, text);
  return { sentiment: result.sentiment, score: result.score };
}

/**
 * Internal version of classifySentiment that also returns keyword match counts
 * for override logic.
 */
function classifySentimentInternal(
  rating: number,
  text: string
): { sentiment: ReviewSentiment; score: number; posCount: number; negCount: number } {
  // Base score from rating
  let score: number;

  if (rating <= 1) {
    score = -0.8;
  } else if (rating === 2) {
    score = -0.6;
  } else if (rating === 3) {
    score = 0.0;
  } else if (rating === 4) {
    score = 0.5;
  } else {
    // rating >= 5
    score = 0.8;
  }

  let posCount = 0;
  let negCount = 0;

  // Adjust based on text keywords
  if (text && text.trim().length > 0) {
    const negMatches = countKeywordMatches(text, NEGATIVE_KEYWORDS);
    const posMatches = countKeywordMatches(text, POSITIVE_KEYWORDS);

    negCount = negMatches.count;
    posCount = posMatches.count;

    score -= negCount * 0.1;
    score += posCount * 0.1;

    // Cap at [-1, 1]
    score = Math.max(-1, Math.min(1, score));
  }

  // Determine sentiment label from score
  let sentiment: ReviewSentiment;

  if (score <= -0.3) {
    sentiment = 'NEGATIVE' as ReviewSentiment;
  } else if (score >= 0.3) {
    sentiment = 'POSITIVE' as ReviewSentiment;
  } else if (score >= -0.1 && score <= 0.1) {
    sentiment = 'NEUTRAL' as ReviewSentiment;
  } else {
    sentiment = 'MIXED' as ReviewSentiment;
  }

  // Override: negative rating but positive text → MIXED
  if (rating <= 2 && posCount > negCount && negCount > 0) {
    sentiment = 'MIXED' as ReviewSentiment;
  }

  // Override: positive rating but negative text → MIXED
  if (rating >= 4 && negCount > posCount && posCount > 0) {
    sentiment = 'MIXED' as ReviewSentiment;
  }

  return { sentiment, score, posCount, negCount };
}

// ============================================================================
// Theme Detection
// ============================================================================

/**
 * Detect themes from review text using Dutch keyword patterns.
 * Returns a list of Dutch theme labels.
 *
 * @param text - Review text to analyze
 * @returns Array of detected Dutch theme labels
 */
export function detectThemes(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  const themes: string[] = [];
  const normalized = normalizeText(text);

  // Product themes
  const productMatches = countKeywordMatches(text, PRODUCT_THEME_KEYWORDS);
  if (productMatches.count >= 2) {
    themes.push('Productkwaliteit');
  } else if (productMatches.count >= 1) {
    // Check which specific product theme
    if (normalized.includes('levering') || normalized.includes('bezorging')) {
      themes.push('Levering');
    } else if (normalized.includes('verpakking')) {
      themes.push('Verpakking');
    } else if (normalized.includes('prijs') || normalized.includes('kosten')) {
      themes.push('Prijs-kwaliteit');
    } else if (normalized.includes('maat') || normalized.includes('grootte') || normalized.includes('afmeting')) {
      themes.push('Pasvorm/Maten');
    } else if (normalized.includes('kleur')) {
      themes.push('Kleur/Uiterlijk');
    } else if (normalized.includes('materiaal') || normalized.includes('duurzaam')) {
      themes.push('Materiaal/Duurzaamheid');
    } else if (normalized.includes('kapot') || normalized.includes('defect') || normalized.includes('beschadigd')) {
      themes.push('Productdefect');
    } else if (normalized.includes('installatie') || normalized.includes('handleiding')) {
      themes.push('Installatie/Handleiding');
    } else if (normalized.includes('gebruik') || normalized.includes('bediening')) {
      themes.push('Gebruiksgemak');
    } else {
      themes.push('Product');
    }
  }

  // Service themes
  const serviceMatches = countKeywordMatches(text, SERVICE_THEME_KEYWORDS);
  if (serviceMatches.count >= 2) {
    themes.push('Klantenservice');
  } else if (serviceMatches.count >= 1) {
    if (normalized.includes('wachttijd') || normalized.includes('trage') || normalized.includes('langzaam')) {
      themes.push('Wachttijd');
    } else if (normalized.includes('communicatie') || normalized.includes('reactie') || normalized.includes('antwoord')) {
      themes.push('Communicatie');
    } else if (normalized.includes('retour') || normalized.includes('ruilen') || normalized.includes('terugbetaling')) {
      themes.push('Retourneren');
    } else if (normalized.includes('garantie')) {
      themes.push('Garantie');
    } else if (normalized.includes('medewerker') || normalized.includes('helpdesk')) {
      themes.push('Medewerkers');
    } else if (normalized.includes('bestelling')) {
      themes.push('Bestelproces');
    } else {
      themes.push('Service');
    }
  }

  // General themes based on keyword presence
  if (normalized.includes('aanbevelen') || normalized.includes('aanbevolen') || normalized.includes('aanrader')) {
    if (!themes.includes('Aanbeveling')) themes.push('Aanbeveling');
  }
  if (normalized.includes('ervaring') || normalized.includes('ervaringen')) {
    if (!themes.includes('Ervaring')) themes.push('Ervaring');
  }
  if (normalized.includes('herhalingsaankoop') || normalized.includes('opnieuw') || normalized.includes('terugkomen')) {
    if (!themes.includes('Terugkerende klant')) themes.push('Terugkerende klant');
  }

  // Limit to top 5 themes
  return themes.slice(0, 5);
}

// ============================================================================
// Complaint Detection
// ============================================================================

/**
 * Detect complaints from negative reviews.
 * Only extracts complaints from reviews with low ratings (1-3) or negative sentiment indicators.
 *
 * @param text - Review text
 * @param rating - Star rating (1-5)
 * @returns Array of Dutch complaint descriptions
 */
export function detectComplaints(text: string, rating: number): string[] {
  if (!text || text.trim().length === 0) return [];
  if (rating >= 5) return []; // No complaints from 5-star reviews

  const complaints: string[] = [];
  const normalized = normalizeText(text);

  // Only look for complaints in lower-rated reviews
  const negMatches = countKeywordMatches(text, NEGATIVE_KEYWORDS);
  if (negMatches.count === 0 && rating >= 4) return [];

  // Product complaints
  if (normalized.includes('kapot') || normalized.includes('defect')) {
    complaints.push('Product is kapot/defect aangekomen');
  }
  if (normalized.includes('beschadigd')) {
    complaints.push('Product was beschadigd bij levering');
  }
  if (normalized.includes('verkeerd') && (normalized.includes('product') || normalized.includes('artikel') || normalized.includes('geleverd'))) {
    complaints.push('Verkeerd product geleverd');
  }
  if (normalized.includes('langzaam') || normalized.includes('trage')) {
    if (normalized.includes('levering') || normalized.includes('bezorging')) {
      complaints.push('Trage levering');
    } else if (normalized.includes('service') || normalized.includes('reactie')) {
      complaints.push('Trage reactie van klantenservice');
    } else {
      complaints.push('Algemene traagheid');
    }
  }
  if (normalized.includes('onvriendelijk')) {
    complaints.push('Onvriendelijke medewerker(s)');
  }
  if (normalized.includes('onbetrouwbaar')) {
    complaints.push('Onbetrouwbare service of product');
  }
  if (normalized.includes('teleurgesteld') || normalized.includes('ontgoocheld')) {
    complaints.push('Klant is teleurgesteld');
  }
  if (normalized.includes('prijs') && (normalized.includes('hoog') || normalized.includes('duur') || normalized.includes('veel'))) {
    complaints.push('Prijs is te hoog');
  }
  if (normalized.includes('maat') && (normalized.includes('niet') || normalized.includes('verkeerd') || normalized.includes('klein') || normalized.includes('groot'))) {
    complaints.push('Verkeerde maat/voering');
  }
  if (normalized.includes('kwaliteit') && (normalized.includes('slecht') || normalized.includes('matig') || normalized.includes('slechte'))) {
    complaints.push('Onvoldoende productkwaliteit');
  }
  if (normalized.includes('retour') || normalized.includes('ruilen')) {
    complaints.push('Problemen met retourneren/ruilen');
  }
  if (normalized.includes('wachttijd') || normalized.includes('wachten')) {
    complaints.push('Lange wachttijd');
  }
  if (normalized.includes('communicatie') && (normalized.includes('slecht') || normalized.includes('ontbrekend') || normalized.includes('geen'))) {
    complaints.push('Slechte communicatie');
  }
  if (normalized.includes('niet') && normalized.includes('geleverd')) {
    complaints.push('Product niet geleverd');
  }
  if (normalized.includes('verpakking') && (normalized.includes('slecht') || normalized.includes('beschadigd'))) {
    complaints.push('Slechte verpakking');
  }
  if (normalized.includes('geen') && normalized.includes('reactie')) {
    complaints.push('Geen reactie ontvangen');
  }
  if (normalized.includes('mislukt') || normalized.includes('fout')) {
    complaints.push('Bestelling of proces mislukt');
  }

  // Generic fallback if negative keywords found but no specific complaint
  if (complaints.length === 0 && negMatches.count > 0 && rating <= 3) {
    complaints.push('Algemene ontevredenheid');
  }

  return [...new Set(complaints)].slice(0, 5);
}

// ============================================================================
// Compliment Detection
// ============================================================================

/**
 * Detect compliments from positive reviews.
 * Only extracts compliments from reviews with high ratings (3-5) or positive sentiment indicators.
 *
 * @param text - Review text
 * @param rating - Star rating (1-5)
 * @returns Array of Dutch compliment descriptions
 */
export function detectCompliments(text: string, rating: number): string[] {
  if (!text || text.trim().length === 0) return [];
  if (rating <= 1) return []; // No compliments from 1-star reviews

  const compliments: string[] = [];
  const normalized = normalizeText(text);

  // Only look for compliments in higher-rated reviews
  const posMatches = countKeywordMatches(text, POSITIVE_KEYWORDS);
  if (posMatches.count === 0 && rating <= 2) return [];

  if (normalized.includes('snel') || normalized.includes('snelle')) {
    if (normalized.includes('levering') || normalized.includes('bezorging')) {
      compliments.push('Snelle levering');
    } else if (normalized.includes('reactie') || normalized.includes('service')) {
      compliments.push('Snelle reactie/service');
    } else {
      compliments.push('Algemene snelheid');
    }
  }
  if (normalized.includes('vriendelijk')) {
    compliments.push('Vriendelijke medewerker(s)');
  }
  if (normalized.includes('kwaliteit') && (normalized.includes('goed') || normalized.includes('uitstekend') || normalized.includes('top') || normalized.includes('prima'))) {
    compliments.push('Hoge productkwaliteit');
  }
  if (normalized.includes('aanbevelen') || normalized.includes('aanbevolen') || normalized.includes('aanrader')) {
    compliments.push('Klant beveelt aan');
  }
  if (normalized.includes('tevreden')) {
    compliments.push('Klant is tevreden');
  }
  if (normalized.includes('professioneel')) {
    compliments.push('Professionele service');
  }
  if (normalized.includes('betrouwbaar')) {
    compliments.push('Betrouwbare leverancier');
  }
  if (normalized.includes('prijs') && (normalized.includes('goed') || normalized.includes('eerlijk') || normalized.includes('concurrerend'))) {
    compliments.push('Goede prijs-kwaliteitverhouding');
  }
  if (normalized.includes('verpakking') && (normalized.includes('goed') || normalized.includes('netjes') || normalized.includes('zorgvuldig'))) {
    compliments.push('Zorgvuldige verpakking');
  }
  if (normalized.includes('communicatie') && (normalized.includes('goed') || normalized.includes('duidelijk') || normalized.includes('helder'))) {
    compliments.push('Goede communicatie');
  }
  if (normalized.includes('behulpzaam') || normalized.includes('help')) {
    compliments.push('Behulpzame medewerkers');
  }
  if (normalized.includes('soepel') || normalized.includes('vlot')) {
    compliments.push('Vlot verloop van bestelling');
  }
  if (normalized.includes('super') || normalized.includes('geweldig') || normalized.includes('fantastisch')) {
    compliments.push('Buitengewoon positieve ervaring');
  }

  // Generic fallback
  if (compliments.length === 0 && posMatches.count > 0 && rating >= 4) {
    compliments.push('Algemene tevredenheid');
  }

  return [...new Set(compliments)].slice(0, 5);
}

// ============================================================================
// Product Issues Detection
// ============================================================================

/**
 * Detect product-specific issues from review text.
 *
 * @param text - Review text
 * @returns Array of Dutch product issue descriptions
 */
export function detectProductIssues(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  const issues: string[] = [];
  const normalized = normalizeText(text);
  const productMatches = countKeywordMatches(text, PRODUCT_THEME_KEYWORDS);

  // Only detect issues if product-related keywords are present
  if (productMatches.count === 0) return [];

  if (normalized.includes('kapot') || normalized.includes('defect')) {
    issues.push('Product defect bij aankomst');
  }
  if (normalized.includes('beschadigd')) {
    issues.push('Productschade tijdens transport');
  }
  if (normalized.includes('verkeerd') && (normalized.includes('product') || normalized.includes('artikel') || normalized.includes('kleur') || normalized.includes('maat'))) {
    issues.push('Verkeerd product of variant ontvangen');
  }
  if (normalized.includes('kwaliteit') && (normalized.includes('slecht') || normalized.includes('matig') || normalized.includes('teleurgesteld'))) {
    issues.push('Kwaliteit voldoet niet aan verwachting');
  }
  if (normalized.includes('maat') && (normalized.includes('klein') || normalized.includes('groot') || normalized.includes('valt') || normalized.includes('pasvorm'))) {
    issues.push('Maatvoering klopt niet');
  }
  if (normalized.includes('kleur') && (normalized.includes('afwijkt') || normalized.includes('anders') || normalized.includes('niet'))) {
    issues.push('Kleur wijkt af van afbeelding');
  }
  if (normalized.includes('materiaal') && (normalized.includes('goedkoop') || normalized.includes('slecht') || normalized.includes('dun'))) {
    issues.push('Materiaal van lage kwaliteit');
  }
  if (normalized.includes('handleiding') && (normalized.includes('ontbreekt') || normalized.includes('onduidelijk') || normalized.includes('niet'))) {
    issues.push('Handleiding ontbreekt of is onduidelijk');
  }
  if (normalized.includes('installatie') && (normalized.includes('moeilijk') || normalized.includes('probleem') || normalized.includes('lukt niet'))) {
    issues.push('Installatieproblemen');
  }
  if (normalized.includes('gebruik') && (normalized.includes('moeilijk') || normalized.includes('onhandig') || normalized.includes('onintuitief'))) {
    issues.push('Product is moeilijk in gebruik');
  }
  if (normalized.includes('duurzaam') && (normalized.includes('niet') || normalized.includes('slecht'))) {
    issues.push('Product is niet duurzaam');
  }
  if (normalized.includes('onderdelen') && (normalized.includes('ontbreken') || normalized.includes('missen'))) {
    issues.push('Onderdelen ontbreken');
  }

  return [...new Set(issues)].slice(0, 5);
}

// ============================================================================
// Service Issues Detection
// ============================================================================

/**
 * Detect service-specific issues from review text.
 *
 * @param text - Review text
 * @returns Array of Dutch service issue descriptions
 */
export function detectServiceIssues(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  const issues: string[] = [];
  const normalized = normalizeText(text);
  const serviceMatches = countKeywordMatches(text, SERVICE_THEME_KEYWORDS);

  // Only detect issues if service-related keywords are present
  if (serviceMatches.count === 0) return [];

  if (normalized.includes('langzaam') || normalized.includes('trage')) {
    if (normalized.includes('levering') || normalized.includes('bezorging')) {
      issues.push('Levering duurt te lang');
    } else {
      issues.push('Trage afhandeling');
    }
  }
  if (normalized.includes('onvriendelijk')) {
    issues.push('Onvriendelijke behandeling');
  }
  if (normalized.includes('wachttijd') || normalized.includes('wachten') || (normalized.includes('lang') && normalized.includes('telefoon'))) {
    issues.push('Lange wachttijd bij klantenservice');
  }
  if (normalized.includes('geen') && (normalized.includes('reactie') || normalized.includes('antwoord') || normalized.includes('terugbellen'))) {
    issues.push('Geen reactie op vragen of klachten');
  }
  if (normalized.includes('communicatie') && (normalized.includes('slecht') || normalized.includes('onduidelijk') || normalized.includes('ontbreekt'))) {
    issues.push('Slechte of ontbrekende communicatie');
  }
  if (normalized.includes('retour') && (normalized.includes('moeilijk') || normalized.includes('probleem') || normalized.includes('niet'))) {
    issues.push('Retourneren is moeilijk of onmogelijk');
  }
  if (normalized.includes('terugbetaling') && (normalized.includes('niet') || normalized.includes('lang') || normalized.includes('uitblijft'))) {
    issues.push('Terugbetaling ontbreekt of duurt lang');
  }
  if (normalized.includes('garantie') && (normalized.includes('niet') || normalized.includes('weigert') || normalized.includes('probleem'))) {
    issues.push('Garantie wordt niet nagekomen');
  }
  if (normalized.includes('bestelling') && (normalized.includes('fout') || normalized.includes('verkeerd') || normalized.includes('mislukt'))) {
    issues.push('Fouten in bestelling');
  }
  if (normalized.includes('onbereikbaar') || (normalized.includes('bereikbaarheid') && normalized.includes('slecht'))) {
    issues.push('Klantenservice onbereikbaar');
  }
  if (normalized.includes('oplossing') && (normalized.includes('niet') || normalized.includes('geen'))) {
    issues.push('Probleem wordt niet opgelost');
  }

  return [...new Set(issues)].slice(0, 5);
}

// ============================================================================
// FAQ Opportunities
// ============================================================================

/**
 * Generate FAQ content opportunities from detected themes and complaints.
 * These suggest FAQ entries that could address common customer questions.
 *
 * @param themes - Detected Dutch theme labels
 * @param complaints - Detected Dutch complaints
 * @returns Array of Dutch FAQ opportunity descriptions
 */
export function generateFAQOpportunities(
  themes: string[],
  complaints: string[]
): string[] {
  const opportunities: string[] = [];

  // Map themes to FAQ opportunities
  for (const theme of themes) {
    switch (theme) {
      case 'Levering':
        opportunities.push('FAQ: Hoe lang duurt de levering?');
        break;
      case 'Retourneren':
        opportunities.push('FAQ: Hoe kan ik een product retourneren?');
        break;
      case 'Prijs-kwaliteit':
        opportunities.push('FAQ: Waarom zijn jullie prijzen zo? / Wat krijg ik voor mijn geld?');
        break;
      case 'Pasvorm/Maten':
        opportunities.push('FAQ: Hoe kies ik de juiste maat?');
        break;
      case 'Kleur/Uiterlijk':
        opportunities.push('FAQ: Komt de kleur overeen met de foto?');
        break;
      case 'Materiaal/Duurzaamheid':
        opportunities.push('FAQ: Van welk materiaal is dit product gemaakt?');
        break;
      case 'Productdefect':
        opportunities.push('FAQ: Wat moet ik doen als mijn product defect is?');
        break;
      case 'Installatie/Handleiding':
        opportunities.push('FAQ: Hoe installeer ik het product?');
        break;
      case 'Gebruiksgemak':
        opportunities.push('FAQ: Hoe gebruik ik het product?');
        break;
      case 'Wachttijd':
        opportunities.push('FAQ: Hoe lang duurt het voordat ik reactie krijg?');
        break;
      case 'Communicatie':
        opportunities.push('FAQ: Hoe kan ik jullie bereiken?');
        break;
      case 'Garantie':
        opportunities.push('FAQ: Wat is het garantiebeleid?');
        break;
      case 'Medewerkers':
        opportunities.push('FAQ: Hoe kan ik een klacht indienen over een medewerker?');
        break;
      case 'Bestelproces':
        opportunities.push('FAQ: Hoe plaats ik een bestelling?');
        break;
    }
  }

  // Map specific complaints to FAQ opportunities
  for (const complaint of complaints) {
    if (complaint.includes('retourneren') && !opportunities.some(o => o.includes('retourneren'))) {
      opportunities.push('FAQ: Wat is het retourbeleid?');
    }
    if (complaint.includes('levering') && !opportunities.some(o => o.includes('levering'))) {
      opportunities.push('FAQ: Wat zijn de levertijden?');
    }
    if (complaint.includes('reactie') && !opportunities.some(o => o.includes('reactie') || o.includes('bereiken'))) {
      opportunities.push('FAQ: Hoe snel reageren jullie op vragen?');
    }
    if (complaint.includes('kapot') && !opportunities.some(o => o.includes('defect'))) {
      opportunities.push('FAQ: Wat als mijn product kapot is?');
    }
    if (complaint.includes('maat') && !opportunities.some(o => o.includes('maat'))) {
      opportunities.push('FAQ: Hoe kies ik de juiste maat?');
    }
    if (complaint.includes('prijs') && !opportunities.some(o => o.includes('prijs'))) {
      opportunities.push('FAQ: Waarom zijn de prijzen zo?');
    }
  }

  return [...new Set(opportunities)].slice(0, 8);
}

// ============================================================================
// Content Opportunities
// ============================================================================

/**
 * Generate content marketing opportunities from detected themes and complaints.
 * These suggest blog posts, guides, or landing pages that could address
 * common customer concerns and improve SEO.
 *
 * @param themes - Detected Dutch theme labels
 * @param complaints - Detected Dutch complaints
 * @returns Array of Dutch content opportunity descriptions
 */
export function generateContentOpportunities(
  themes: string[],
  complaints: string[]
): string[] {
  const opportunities: string[] = [];

  // Map themes to content opportunities
  for (const theme of themes) {
    switch (theme) {
      case 'Productkwaliteit':
        opportunities.push('Blog: Hoe wij productkwaliteit waarborgen');
        break;
      case 'Levering':
        opportunities.push('Landingspagina: Leveringsinformatie en verzendopties');
        break;
      case 'Verpakking':
        opportunities.push('Blog: Duurzame verpakking – onze aanpak');
        break;
      case 'Prijs-kwaliteit':
        opportunities.push('Blog: Waarom kwaliteit zijn prijs waard is');
        break;
      case 'Pasvorm/Maten':
        opportunities.push('Gids: Maattabel en advies voor de juiste keuze');
        break;
      case 'Materiaal/Duurzaamheid':
        opportunities.push('Blog: Duurzaamheid van onze materialen');
        break;
      case 'Klantenservice':
        opportunities.push('Landingspagina: Onze klantenservice – altijd bereikbaar');
        break;
      case 'Wachttijd':
        opportunities.push('Blog: Hoe wij snelle reactietijden garanderen');
        break;
      case 'Communicatie':
        opportunities.push('Blog: Transparante communicatie als prioriteit');
        break;
      case 'Retourneren':
        opportunities.push('Gids: Probleemloos retourneren in 3 stappen');
        break;
      case 'Garantie':
        opportunities.push('Landingspagina: Onze garantievoorwaarden');
        break;
      case 'Aanbeveling':
        opportunities.push('Testimonials pagina: Wat klanten zeggen');
        break;
    }
  }

  // Map specific complaints to content opportunities
  for (const complaint of complaints) {
    if (complaint.includes('trage levering') && !opportunities.some(o => o.includes('Leveringsinformatie'))) {
      opportunities.push('Landingspagina: Actuele levertijden en verzendopties');
    }
    if (complaint.includes('onvriendelijk') && !opportunities.some(o => o.includes('klantenservice'))) {
      opportunities.push('Blog: Onze klantenservice-training en waarden');
    }
    if (complaint.includes('teleurgesteld') && !opportunities.some(o => o.includes('kwaliteit'))) {
      opportunities.push('Blog: Hoe wij klanttevredenheid verbeteren');
    }
    if (complaint.includes('retourneren') && !opportunities.some(o => o.includes('retourneren'))) {
      opportunities.push('Gids: Retourneren en ruilen – alles wat u moet weten');
    }
    if (complaint.includes('wachttijd') && !opportunities.some(o => o.includes('reactietijd'))) {
      opportunities.push('Blog: Hoe wij onze reactietijden verkorten');
    }
  }

  return [...new Set(opportunities)].slice(0, 8);
}

// ============================================================================
// Trust Signals
// ============================================================================

/**
 * Identify trust signals from a review that can be used in marketing.
 * These are indicators that the business is reliable and trustworthy.
 *
 * @param review - Review data with rating, optional content, and verification status
 * @returns Array of Dutch trust signal descriptions
 */
export function identifyTrustSignals(review: {
  rating: number;
  content?: string;
  isVerified?: boolean;
}): string[] {
  const signals: string[] = [];

  // Verified purchase is a strong trust signal
  if (review.isVerified) {
    signals.push('Geverifieerde aankoop');
  }

  if (!review.content || review.content.trim().length === 0) {
    // Rating-only: limited trust signals
    if (review.rating >= 4) {
      signals.push('Hoge beoordeling zonder opmerkingen');
    }
    return signals;
  }

  const normalized = normalizeText(review.content);

  // Specific trust signals from text
  if (normalized.includes('aanbevelen') || normalized.includes('aanbevolen') || normalized.includes('aanrader')) {
    signals.push('Klant beveelt expliciet aan');
  }
  if (normalized.includes('tweede') || normalized.includes('opnieuw') || normalized.includes('weer') || normalized.includes('terugkomen') || normalized.includes('vaste klant')) {
    signals.push('Terugkerende klant');
  }
  if ((normalized.includes('snelle') || normalized.includes('snel')) && (normalized.includes('levering') || normalized.includes('bezorging'))) {
    signals.push('Snelle levering bevestigd door klant');
  }
  if (normalized.includes('kwaliteit') && (normalized.includes('goed') || normalized.includes('uitstekend') || normalized.includes('top'))) {
    signals.push('Kwaliteit bevestigd door klant');
  }
  if (normalized.includes('professioneel')) {
    signals.push('Professionele service bevestigd');
  }
  if (normalized.includes('betrouwbaar')) {
    signals.push('Betrouwbaarheid bevestigd door klant');
  }
  if (normalized.includes('tevreden')) {
    signals.push('Uitgesproken tevredenheid');
  }
  if (normalized.includes('precies') || normalized.includes('exact') || normalized.includes('zoals beschreven') || normalized.includes('volgens verwachting')) {
    signals.push('Product komt overeen met beschrijving');
  }
  if (normalized.includes('voordelig') || normalized.includes('goedkoper') || (normalized.includes('prijs') && normalized.includes('kwaliteit'))) {
    signals.push('Goede prijs-kwaliteit bevestigd');
  }
  if (normalized.includes('vriendelijk')) {
    signals.push('Vriendelijke service bevestigd');
  }

  // General high-rating trust signal
  if (review.rating >= 5 && signals.length === 0) {
    signals.push('Maximumscore ontvangen');
  }

  return [...new Set(signals)].slice(0, 6);
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Perform complete sentiment analysis on a review.
 * Combines all sub-analyses into a single result.
 *
 * @param review - Review data with rating, optional content and title
 * @returns Complete sentiment analysis result
 *
 * @example
 * ```typescript
 * const result = analyzeSentiment({
 *   rating: 2,
 *   content: 'Levering was erg langzaam, product is kapot aangekomen. Teleurgesteld.',
 *   title: 'Niet tevreden',
 * });
 * // result.sentiment === 'NEGATIVE'
 * // result.complaints includes 'Trage levering', 'Product is kapot/defect aangekomen'
 * // result.themes includes 'Levering', 'Productdefect'
 * ```
 */
export function analyzeSentiment(review: {
  rating: number;
  content?: string;
  title?: string;
}): SentimentAnalysisResult {
  // Combine title and content for text analysis
  const fullText = [review.title, review.content].filter(Boolean).join(' ');

  // Classify overall sentiment
  const { sentiment, score } = classifySentimentInternal(review.rating, fullText);

  // Detect themes
  const themes = detectThemes(fullText);

  // Detect complaints and compliments
  const complaints = detectComplaints(fullText, review.rating);
  const compliments = detectCompliments(fullText, review.rating);

  // Detect product and service issues
  const productIssues = detectProductIssues(fullText);
  const serviceIssues = detectServiceIssues(fullText);

  // Generate opportunities
  const faqOpportunities = generateFAQOpportunities(themes, complaints);
  const contentOpportunities = generateContentOpportunities(themes, complaints);

  // Identify trust signals
  const trustSignals = identifyTrustSignals({
    rating: review.rating,
    content: review.content,
  });

  return {
    sentiment,
    score: Math.round(score * 100) / 100, // Round to 2 decimals
    themes,
    complaints,
    compliments,
    productIssues,
    serviceIssues,
    faqOpportunities,
    contentOpportunities,
    trustSignals,
  };
}
