/**
 * Sentiment Analyzer Tests
 * Tests for /src/lib/reviews/sentiment-analyzer.ts
 */

import { describe, test, expect } from 'bun:test';
import {
  analyzeSentiment,
  classifySentiment,
  detectThemes,
  detectComplaints,
  detectCompliments,
  detectProductIssues,
  detectServiceIssues,
  generateFAQOpportunities,
  generateContentOpportunities,
  identifyTrustSignals,
} from '@/lib/reviews/sentiment-analyzer';

// ============================================================================
// classifySentiment — Rating-based sentiment base
// ============================================================================

describe('classifySentiment — rating-based sentiment base', () => {
  test('rating 1 yields NEGATIVE sentiment', () => {
    const { sentiment, score } = classifySentiment(1, '');
    expect(sentiment).toBe('NEGATIVE');
    expect(score).toBe(-0.8);
  });

  test('rating 2 yields NEGATIVE sentiment', () => {
    const { sentiment, score } = classifySentiment(2, '');
    expect(sentiment).toBe('NEGATIVE');
    expect(score).toBe(-0.6);
  });

  test('rating 3 yields NEUTRAL sentiment', () => {
    const { sentiment, score } = classifySentiment(3, '');
    expect(sentiment).toBe('NEUTRAL');
    expect(score).toBe(0.0);
  });

  test('rating 4 yields POSITIVE sentiment', () => {
    const { sentiment, score } = classifySentiment(4, '');
    expect(sentiment).toBe('POSITIVE');
    expect(score).toBe(0.5);
  });

  test('rating 5 yields POSITIVE sentiment', () => {
    const { sentiment, score } = classifySentiment(5, '');
    expect(sentiment).toBe('POSITIVE');
    expect(score).toBe(0.8);
  });
});

// ============================================================================
// classifySentiment — Dutch negative keyword adjustment
// ============================================================================

describe('classifySentiment — Dutch negative keyword adjustment', () => {
  test('"slecht" pushes sentiment downward', () => {
    const neutral = classifySentiment(3, '');
    const withNeg = classifySentiment(3, 'slecht');
    expect(withNeg.score).toBeLessThan(neutral.score);
  });

  test('"terug" pushes sentiment downward', () => {
    const neutral = classifySentiment(3, '');
    const withNeg = classifySentiment(3, 'ik wil mijn geld terug');
    expect(withNeg.score).toBeLessThan(neutral.score);
  });

  test('"teleurgesteld" pushes sentiment downward', () => {
    const neutral = classifySentiment(3, '');
    const withNeg = classifySentiment(3, 'ik ben teleurgesteld');
    expect(withNeg.score).toBeLessThan(neutral.score);
  });

  test('multiple negative keywords compound the adjustment', () => {
    const one = classifySentiment(3, 'slecht');
    const two = classifySentiment(3, 'slecht teleurgesteld waardeloos');
    expect(two.score).toBeLessThan(one.score);
  });
});

// ============================================================================
// classifySentiment — Dutch positive keyword adjustment
// ============================================================================

describe('classifySentiment — Dutch positive keyword adjustment', () => {
  test('"goed" pushes sentiment upward', () => {
    const neutral = classifySentiment(3, '');
    const withPos = classifySentiment(3, 'goed');
    expect(withPos.score).toBeGreaterThan(neutral.score);
  });

  test('"uitstekend" pushes sentiment upward', () => {
    const neutral = classifySentiment(3, '');
    const withPos = classifySentiment(3, 'uitstekend');
    expect(withPos.score).toBeGreaterThan(neutral.score);
  });

  test('"geweldig" pushes sentiment upward', () => {
    const neutral = classifySentiment(3, '');
    const withPos = classifySentiment(3, 'geweldig');
    expect(withPos.score).toBeGreaterThan(neutral.score);
  });

  test('multiple positive keywords compound the adjustment', () => {
    const one = classifySentiment(3, 'goed');
    const two = classifySentiment(3, 'goed uitstekend geweldig fantastisch');
    expect(two.score).toBeGreaterThan(one.score);
  });
});

// ============================================================================
// classifySentiment — Score bounds and MIXED overrides
// ============================================================================

describe('classifySentiment — score bounds and MIXED overrides', () => {
  test('sentiment score stays within -1 to 1 range', () => {
    // Even with extreme keywords the score must be clamped
    const veryNeg = classifySentiment(1, 'slecht teleurgesteld waardeloos afschuwelijk vreselijk onbetrouwbaar kapot defect verkeerd klacht probleem mislukt beschadigd ramp chaos');
    expect(veryNeg.score).toBeGreaterThanOrEqual(-1);
    expect(veryNeg.score).toBeLessThanOrEqual(1);

    const veryPos = classifySentiment(5, 'goed uitstekend geweldig prima top snel vriendelijk aanbevelen tevreden perfect fijn super heerlijk professioneel betrouwbaar fantastisch voortreffelijk behulpzaam prettig soepel verrast beste aanrader topkwaliteit');
    expect(veryPos.score).toBeGreaterThanOrEqual(-1);
    expect(veryPos.score).toBeLessThanOrEqual(1);
  });

  test('positive rating with negative text produces MIXED', () => {
    // rating 4-5 but more negative keywords than positive, with some positive present
    const result = classifySentiment(4, 'slecht waardeloos teleurgesteld maar wel goed');
    expect(result.sentiment).toBe('MIXED');
  });

  test('negative rating with positive text produces MIXED', () => {
    // rating 1-2 but more positive keywords than negative, with some negative present
    const result = classifySentiment(2, 'goed uitstekend geweldig fantastisch slecht');
    expect(result.sentiment).toBe('MIXED');
  });
});

// ============================================================================
// detectThemes — Dutch theme detection
// ============================================================================

describe('detectThemes — Dutch theme detection', () => {
  test('detects "kwaliteit" as Productkwaliteit theme', () => {
    // Need 2+ product keywords to get the broad "Productkwaliteit" theme
    const themes = detectThemes('De kwaliteit van dit product is goed en de levering was snel');
    expect(themes).toContain('Productkwaliteit');
  });

  test('detects "levering" as Levering theme', () => {
    const themes = detectThemes('De levering was erg traag');
    expect(themes).toContain('Levering');
  });

  test('detects "prijs" as Prijs-kwaliteit theme', () => {
    const themes = detectThemes('De prijs was redelijk');
    expect(themes).toContain('Prijs-kwaliteit');
  });

  test('detects "klantenservice" as Service theme', () => {
    // Single service keyword → specific theme
    const themes = detectThemes('De klantenservice was traag');
    expect(themes.length).toBeGreaterThan(0);
    expect(themes.some(t => ['Klantenservice', 'Wachttijd', 'Service'].includes(t))).toBe(true);
  });

  test('detects "medewerker" as Medewerkers theme', () => {
    const themes = detectThemes('De medewerker was niet behulpzaam');
    expect(themes).toContain('Medewerkers');
  });

  test('detects "wachttijd" as Wachttijd theme', () => {
    const themes = detectThemes('De wachttijd was erg lang');
    expect(themes).toContain('Wachttijd');
  });

  test('detects "retour" as Retourneren theme', () => {
    const themes = detectThemes('Het retour proces was ingewikkeld');
    expect(themes).toContain('Retourneren');
  });

  test('detects "aanbevelen" as Aanbeveling theme', () => {
    const themes = detectThemes('Ik zou dit aanbevelen aan iedereen');
    expect(themes).toContain('Aanbeveling');
  });

  test('returns empty array for empty text', () => {
    const themes = detectThemes('');
    expect(themes).toEqual([]);
  });

  test('limits to at most 5 themes', () => {
    // Create text with many theme keywords
    const themes = detectThemes('kwaliteit levering verpakking prijs maat kleur materiaal klantenservice wachttijd communicatie retour garantie aanbevelen');
    expect(themes.length).toBeLessThanOrEqual(5);
  });
});

// ============================================================================
// detectComplaints — Dutch complaint detection
// ============================================================================

describe('detectComplaints — Dutch complaint detection', () => {
  test('detects "kapot" complaint', () => {
    const complaints = detectComplaints('Het product is kapot aangekomen', 2);
    expect(complaints).toContain('Product is kapot/defect aangekomen');
  });

  test('detects "teleurgesteld" complaint', () => {
    const complaints = detectComplaints('Ik ben teleurgesteld in de service', 2);
    expect(complaints).toContain('Klant is teleurgesteld');
  });

  test('detects "langzaam" + "levering" as Trage levering', () => {
    const complaints = detectComplaints('De levering was erg langzaam', 1);
    expect(complaints).toContain('Trage levering');
  });

  test('detects "onvriendelijk" complaint', () => {
    const complaints = detectComplaints('De medewerker was onvriendelijk', 2);
    expect(complaints).toContain('Onvriendelijke medewerker(s)');
  });

  test('detects "wachttijd" complaint', () => {
    const complaints = detectComplaints('De wachttijd was te lang', 2);
    expect(complaints).toContain('Lange wachttijd');
  });

  test('returns empty for 5-star reviews', () => {
    const complaints = detectComplaints('slecht waardeloos', 5);
    expect(complaints).toEqual([]);
  });

  test('returns empty for empty text', () => {
    const complaints = detectComplaints('', 1);
    expect(complaints).toEqual([]);
  });

  test('generic fallback for negative text with no specific complaint', () => {
    const complaints = detectComplaints('slecht waardeloos', 1);
    expect(complaints.length).toBeGreaterThan(0);
    expect(complaints).toContain('Algemene ontevredenheid');
  });
});

// ============================================================================
// detectCompliments — Dutch compliment detection
// ============================================================================

describe('detectCompliments — Dutch compliment detection', () => {
  test('detects "snel" + "levering" as Snelle levering', () => {
    const compliments = detectCompliments('Snelle levering, heel blij', 5);
    expect(compliments).toContain('Snelle levering');
  });

  test('detects "vriendelijk" compliment', () => {
    const compliments = detectCompliments('De medewerker was erg vriendelijk', 4);
    expect(compliments).toContain('Vriendelijke medewerker(s)');
  });

  test('detects "aanbevelen" compliment', () => {
    const compliments = detectCompliments('Ik zou dit zeker aanbevelen', 5);
    expect(compliments).toContain('Klant beveelt aan');
  });

  test('detects "professioneel" compliment', () => {
    const compliments = detectCompliments('Zeer professioneel en behulpzaam', 4);
    expect(compliments).toContain('Professionele service');
  });

  test('detects "betrouwbaar" compliment', () => {
    const compliments = detectCompliments('Betrouwbaar en goed bedrijf', 4);
    expect(compliments).toContain('Betrouwbare leverancier');
  });

  test('returns empty for 1-star reviews', () => {
    const compliments = detectCompliments('geweldig uitstekend', 1);
    expect(compliments).toEqual([]);
  });

  test('returns empty for empty text', () => {
    const compliments = detectCompliments('', 5);
    expect(compliments).toEqual([]);
  });

  test('generic fallback for positive text with no specific compliment', () => {
    const compliments = detectCompliments('goed super fantastisch', 5);
    expect(compliments.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// detectProductIssues — Product issue patterns
// ============================================================================

describe('detectProductIssues — product issue patterns', () => {
  test('detects "kapot" product issue', () => {
    const issues = detectProductIssues('Het product is kapot aangekomen');
    expect(issues).toContain('Product defect bij aankomst');
  });

  test('detects "beschadigd" product issue', () => {
    const issues = detectProductIssues('Het product was beschadigd');
    expect(issues).toContain('Productschade tijdens transport');
  });

  test('detects wrong product issue', () => {
    const issues = detectProductIssues('Ik heb het verkeerd product ontvangen');
    expect(issues).toContain('Verkeerd product of variant ontvangen');
  });

  test('detects quality expectation issue', () => {
    const issues = detectProductIssues('De kwaliteit is slecht en teleurgesteld');
    expect(issues).toContain('Kwaliteit voldoet niet aan verwachting');
  });

  test('detects sizing issue', () => {
    const issues = detectProductIssues('De maat valt klein uit de pasvorm is verkeerd');
    expect(issues).toContain('Maatvoering klopt niet');
  });

  test('returns empty for text without product keywords', () => {
    const issues = detectProductIssues('geweldig uitstekend ervaring');
    expect(issues).toEqual([]);
  });

  test('returns empty for empty text', () => {
    const issues = detectProductIssues('');
    expect(issues).toEqual([]);
  });
});

// ============================================================================
// detectServiceIssues — Service issue patterns
// ============================================================================

describe('detectServiceIssues — service issue patterns', () => {
  test('detects slow delivery issue', () => {
    const issues = detectServiceIssues('De bezorging was erg langzaam');
    expect(issues).toContain('Levering duurt te lang');
  });

  test('detects "onvriendelijk" service issue', () => {
    const issues = detectServiceIssues('De medewerker was onvriendelijk');
    expect(issues).toContain('Onvriendelijke behandeling');
  });

  test('detects long wait time issue', () => {
    const issues = detectServiceIssues('De wachttijd bij de klantenservice was te lang');
    expect(issues).toContain('Lange wachttijd bij klantenservice');
  });

  test('detects no response issue', () => {
    const issues = detectServiceIssues('Geen reactie ontvangen op mijn vraag');
    expect(issues).toContain('Geen reactie op vragen of klachten');
  });

  test('detects return difficulty issue', () => {
    const issues = detectServiceIssues('Het retour is moeilijk en een probleem');
    expect(issues).toContain('Retourneren is moeilijk of onmogelijk');
  });

  test('returns empty for text without service keywords', () => {
    const issues = detectServiceIssues('De kleur is mooi en de maat klopt');
    expect(issues).toEqual([]);
  });

  test('returns empty for empty text', () => {
    const issues = detectServiceIssues('');
    expect(issues).toEqual([]);
  });
});

// ============================================================================
// generateFAQOpportunities — FAQ generation from themes
// ============================================================================

describe('generateFAQOpportunities — FAQ generation in Dutch', () => {
  test('generates FAQ for Levering theme', () => {
    const faqs = generateFAQOpportunities(['Levering'], []);
    expect(faqs).toContain('FAQ: Hoe lang duurt de levering?');
  });

  test('generates FAQ for Retourneren theme', () => {
    const faqs = generateFAQOpportunities(['Retourneren'], []);
    expect(faqs).toContain('FAQ: Hoe kan ik een product retourneren?');
  });

  test('generates FAQ for Wachttijd theme', () => {
    const faqs = generateFAQOpportunities(['Wachttijd'], []);
    expect(faqs).toContain('FAQ: Hoe lang duurt het voordat ik reactie krijg?');
  });

  test('generates FAQ from complaints', () => {
    const faqs = generateFAQOpportunities([], ['Problemen met retourneren/ruilen']);
    expect(faqs.length).toBeGreaterThan(0);
    expect(faqs.some(f => f.toLowerCase().includes('retour'))).toBe(true);
  });

  test('does not duplicate FAQ opportunities', () => {
    const faqs = generateFAQOpportunities(['Levering'], ['Trage levering']);
    // Levering theme generates "FAQ: Hoe lang duurt de levering?"
    // "Trage levering" complaint generates "FAQ: Wat zijn de levertijden?"
    // These are different, so both should appear, but no duplicates
    const unique = new Set(faqs);
    expect(faqs.length).toBe(unique.size);
  });

  test('returns empty for no themes or complaints', () => {
    const faqs = generateFAQOpportunities([], []);
    expect(faqs).toEqual([]);
  });

  test('FAQ text is in Dutch', () => {
    const faqs = generateFAQOpportunities(['Levering', 'Garantie'], []);
    for (const faq of faqs) {
      expect(faq).toContain('FAQ:');
    }
  });

  test('limits to at most 8 FAQ opportunities', () => {
    const themes = ['Levering', 'Retourneren', 'Prijs-kwaliteit', 'Pasvorm/Maten',
      'Kleur/Uiterlijk', 'Materiaal/Duurzaamheid', 'Productdefect',
      'Installatie/Handleiding', 'Wachttijd', 'Communicatie'];
    const faqs = generateFAQOpportunities(themes, []);
    expect(faqs.length).toBeLessThanOrEqual(8);
  });
});

// ============================================================================
// generateContentOpportunities — Content opportunity generation
// ============================================================================

describe('generateContentOpportunities — content opportunities in Dutch', () => {
  test('generates Blog for Productkwaliteit theme', () => {
    const ops = generateContentOpportunities(['Productkwaliteit'], []);
    expect(ops).toContain('Blog: Hoe wij productkwaliteit waarborgen');
  });

  test('generates Landingspagina for Levering theme', () => {
    const ops = generateContentOpportunities(['Levering'], []);
    expect(ops).toContain('Landingspagina: Leveringsinformatie en verzendopties');
  });

  test('generates Gids for Retourneren theme', () => {
    const ops = generateContentOpportunities(['Retourneren'], []);
    expect(ops).toContain('Gids: Probleemloos retourneren in 3 stappen');
  });

  test('generates content from complaints', () => {
    const ops = generateContentOpportunities([], ['Klant is teleurgesteld']);
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.some(o => o.includes('klanttevredenheid') || o.includes('kwaliteit'))).toBe(true);
  });

  test('returns empty for no themes or complaints', () => {
    const ops = generateContentOpportunities([], []);
    expect(ops).toEqual([]);
  });

  test('content types include Blog, Landingspagina, Gids, Testimonials', () => {
    const ops = generateContentOpportunities(['Productkwaliteit', 'Levering', 'Retourneren', 'Aanbeveling'], []);
    const hasBlog = ops.some(o => o.startsWith('Blog:'));
    const hasLP = ops.some(o => o.startsWith('Landingspagina:'));
    const hasGids = ops.some(o => o.startsWith('Gids:'));
    const hasTestimonial = ops.some(o => o.startsWith('Testimonials'));
    expect(hasBlog).toBe(true);
    expect(hasLP).toBe(true);
    expect(hasGids).toBe(true);
    expect(hasTestimonial).toBe(true);
  });

  test('limits to at most 8 content opportunities', () => {
    const themes = ['Productkwaliteit', 'Levering', 'Verpakking', 'Prijs-kwaliteit',
      'Pasvorm/Maten', 'Klantenservice', 'Wachttijd', 'Communicatie',
      'Retourneren', 'Garantie', 'Aanbeveling'];
    const ops = generateContentOpportunities(themes, []);
    expect(ops.length).toBeLessThanOrEqual(8);
  });
});

// ============================================================================
// identifyTrustSignals — Trust signal detection
// ============================================================================

describe('identifyTrustSignals — trust signal detection', () => {
  test('verified purchase is a strong trust signal', () => {
    const signals = identifyTrustSignals({ rating: 4, content: 'Goed product', isVerified: true });
    expect(signals).toContain('Geverifieerde aankoop');
  });

  test('"aanbevelen" produces recommendation trust signal', () => {
    const signals = identifyTrustSignals({ rating: 5, content: 'Ik beveel dit aanbevelen aan' });
    expect(signals).toContain('Klant beveelt expliciet aan');
  });

  test('returning customer trust signal', () => {
    const signals = identifyTrustSignals({ rating: 5, content: 'Ik kom hier opnieuw terug' });
    expect(signals).toContain('Terugkerende klant');
  });

  test('fast delivery trust signal', () => {
    const signals = identifyTrustSignals({ rating: 5, content: 'Snelle levering ontvangen' });
    expect(signals).toContain('Snelle levering bevestigd door klant');
  });

  test('quality confirmed trust signal', () => {
    const signals = identifyTrustSignals({ rating: 5, content: 'De kwaliteit is goed' });
    expect(signals).toContain('Kwaliteit bevestigd door klant');
  });

  test('5-star rating with positive content and no specific signals produces "Maximumscore ontvangen"', () => {
    // When rating is 5 and no other trust signals were detected, fallback signal is added
    const signals = identifyTrustSignals({ rating: 5, content: 'al ok' });
    expect(signals).toContain('Maximumscore ontvangen');
  });

  test('4+ rating without content produces "Hoge beoordeling zonder opmerkingen"', () => {
    const signals = identifyTrustSignals({ rating: 4 });
    expect(signals).toContain('Hoge beoordeling zonder opmerkingen');
  });

  test('returns empty for low rating with no content', () => {
    const signals = identifyTrustSignals({ rating: 1 });
    expect(signals).toEqual([]);
  });

  test('limits to at most 6 trust signals', () => {
    const signals = identifyTrustSignals({
      rating: 5,
      content: 'aanbevelen opnieuw snelle levering kwaliteit goed professioneel betrouwbaar tevreden precies voordelig vriendelijk',
      isVerified: true,
    });
    expect(signals.length).toBeLessThanOrEqual(6);
  });
});

// ============================================================================
// analyzeSentiment — Full pipeline
// ============================================================================

describe('analyzeSentiment — full analysis pipeline', () => {
  test('negative review produces correct full analysis', () => {
    const result = analyzeSentiment({
      rating: 1,
      content: 'Het product is kapot en de levering was langzaam. Ik ben teleurgesteld.',
      title: 'Slechte ervaring',
    });

    expect(result.sentiment).toBe('NEGATIVE');
    expect(result.score).toBeLessThan(0);
    expect(result.score).toBeGreaterThanOrEqual(-1);
    expect(result.complaints.length).toBeGreaterThan(0);
    expect(result.themes.length).toBeGreaterThan(0);
  });

  test('positive review produces correct full analysis', () => {
    const result = analyzeSentiment({
      rating: 5,
      content: 'Geweldige kwaliteit en snelle levering. Ik beveel het aan!',
      title: 'Uitstekend',
    });

    expect(result.sentiment).toBe('POSITIVE');
    expect(result.score).toBeGreaterThan(0);
    expect(result.compliments.length).toBeGreaterThan(0);
    expect(result.themes.length).toBeGreaterThan(0);
  });

  test('neutral review produces NEUTRAL sentiment', () => {
    const result = analyzeSentiment({
      rating: 3,
      content: 'Het product is voldoende.',
    });

    expect(result.sentiment).toBe('NEUTRAL');
    expect(result.score).toBeGreaterThanOrEqual(-0.1);
    expect(result.score).toBeLessThanOrEqual(0.1);
  });

  test('empty content returns neutral sentiment with empty arrays', () => {
    const result = analyzeSentiment({ rating: 3 });

    expect(result.sentiment).toBe('NEUTRAL');
    expect(result.score).toBe(0);
    expect(result.themes).toEqual([]);
    expect(result.complaints).toEqual([]);
    expect(result.compliments).toEqual([]);
    expect(result.productIssues).toEqual([]);
    expect(result.serviceIssues).toEqual([]);
    expect(result.faqOpportunities).toEqual([]);
    expect(result.contentOpportunities).toEqual([]);
  });

  test('combines title and content for analysis', () => {
    // Title has "kapot", content has "levering"
    const result = analyzeSentiment({
      rating: 1,
      title: 'Product is kapot',
      content: 'En de levering was traag',
    });

    expect(result.themes.length).toBeGreaterThan(0);
    expect(result.complaints.length).toBeGreaterThan(0);
  });

  test('result structure matches SentimentAnalysisResult interface', () => {
    const result = analyzeSentiment({ rating: 4, content: 'Goed product' });

    expect(result).toHaveProperty('sentiment');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('themes');
    expect(result).toHaveProperty('complaints');
    expect(result).toHaveProperty('compliments');
    expect(result).toHaveProperty('productIssues');
    expect(result).toHaveProperty('serviceIssues');
    expect(result).toHaveProperty('faqOpportunities');
    expect(result).toHaveProperty('contentOpportunities');
    expect(result).toHaveProperty('trustSignals');
  });

  test('score is rounded to 2 decimal places', () => {
    const result = analyzeSentiment({ rating: 3, content: 'goed' });
    // Check that the score has at most 2 decimal places
    const decimals = result.score.toString().split('.')[1];
    if (decimals) {
      expect(decimals.length).toBeLessThanOrEqual(2);
    }
  });
});
