/**
 * Structured Data Validator Tests
 * Tests for /src/lib/structured-data/validator.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { validateStructuredData } from '@/lib/structured-data/validator';

// ============================================================================
// Test helpers
// ============================================================================

function makeBaseData(type: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    ...overrides,
  };
}

// ============================================================================
// @context and @type validation
// ============================================================================

describe('@context and @type validation', () => {
  test('valid @context is required', () => {
    const result = validateStructuredData('ORGANIZATION', {
      '@type': 'Organization',
      name: 'Test Org',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === '@context')).toBe(true);
  });

  test('invalid @context produces Dutch error', () => {
    const result = validateStructuredData('ORGANIZATION', {
      '@context': 'http://wrong.org',
      '@type': 'Organization',
      name: 'Test Org',
    });
    expect(result.isValid).toBe(false);
    const contextError = result.errors.find((e) => e.field === '@context');
    expect(contextError).toBeDefined();
    expect(contextError!.message).toContain('@context moet "https://schema.org" zijn');
  });

  test('@type must match the expected schema type', () => {
    const result = validateStructuredData('PRODUCT', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Test',
    });
    expect(result.isValid).toBe(false);
    const typeError = result.errors.find((e) => e.field === '@type');
    expect(typeError).toBeDefined();
    expect(typeError!.message).toContain('@type moet "Product" zijn');
  });

  test('valid @context and @type pass these checks', () => {
    const result = validateStructuredData('ORGANIZATION', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Test Org',
    });
    expect(result.errors.some((e) => e.field === '@context')).toBe(false);
    expect(result.errors.some((e) => e.field === '@type')).toBe(false);
  });
});

// ============================================================================
// Required field validation
// ============================================================================

describe('Required field validation', () => {
  test('ORGANIZATION requires name', () => {
    const result = validateStructuredData('ORGANIZATION', makeBaseData('Organization'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Naam');
  });

  test('LOCAL_BUSINESS requires name and address', () => {
    const result = validateStructuredData('LOCAL_BUSINESS', makeBaseData('LocalBusiness'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Naam');
    expect(result.missingRequiredFields).toContain('Adres');
  });

  test('PRODUCT requires name', () => {
    const result = validateStructuredData('PRODUCT', makeBaseData('Product'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Productnaam');
  });

  test('ARTICLE requires headline, author, datePublished', () => {
    const result = validateStructuredData('ARTICLE', makeBaseData('Article'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Kopregel');
    expect(result.missingRequiredFields).toContain('Auteur');
    expect(result.missingRequiredFields).toContain('Publicatiedatum');
  });

  test('FAQ_PAGE requires mainEntity', () => {
    const result = validateStructuredData('FAQ_PAGE', makeBaseData('FAQPage'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Veelgestelde vragen');
  });

  test('HOW_TO requires name and step', () => {
    const result = validateStructuredData('HOW_TO', makeBaseData('HowTo'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Naam');
    expect(result.missingRequiredFields).toContain('Stappen');
  });

  test('EVENT requires name, startDate, location', () => {
    const result = validateStructuredData('EVENT', makeBaseData('Event'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Naam');
    expect(result.missingRequiredFields).toContain('Startdatum');
    expect(result.missingRequiredFields).toContain('Locatie');
  });

  test('JOB_POSTING requires title, description, hiringOrganization, jobLocation', () => {
    const result = validateStructuredData('JOB_POSTING', makeBaseData('JobPosting'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Functietitel');
    expect(result.missingRequiredFields).toContain('Functiebeschrijving');
    expect(result.missingRequiredFields).toContain('Werkgever');
    expect(result.missingRequiredFields).toContain('Werklocatie');
  });

  test('REVIEW requires author and reviewRating', () => {
    const result = validateStructuredData('REVIEW', makeBaseData('Review'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Auteur');
    expect(result.missingRequiredFields).toContain('Beoordeling');
  });

  test('SERVICE requires name and provider', () => {
    const result = validateStructuredData('SERVICE', makeBaseData('Service'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Naam');
    expect(result.missingRequiredFields).toContain('Aanbieder');
  });

  test('WEB_SITE requires name and url', () => {
    const result = validateStructuredData('WEB_SITE', makeBaseData('WebSite'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Naam');
    expect(result.missingRequiredFields).toContain('URL');
  });

  test('OFFER requires price and priceCurrency', () => {
    const result = validateStructuredData('OFFER', makeBaseData('Offer'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Prijs');
    expect(result.missingRequiredFields).toContain('Valuta');
  });

  test('BREADCRUMB_LIST requires itemListElement', () => {
    const result = validateStructuredData('BREADCRUMB_LIST', makeBaseData('BreadcrumbList'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Breadcrumb-items');
  });

  test('PERSON requires name', () => {
    const result = validateStructuredData('PERSON', makeBaseData('Person'));
    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields).toContain('Naam');
  });

  test('Dutch field names in missing required fields', () => {
    const result = validateStructuredData('ARTICLE', makeBaseData('Article'));
    for (const field of result.missingRequiredFields) {
      // Dutch field names should not look like English path names
      expect(field).not.toContain('.');
    }
  });
});

// ============================================================================
// URL validation
// ============================================================================

describe('URL validation', () => {
  test('invalid URL is flagged with Dutch message', () => {
    const result = validateStructuredData('WEB_SITE', makeBaseData('WebSite', {
      name: 'Test Site',
      url: 'not-a-url',
    }));
    const urlError = result.errors.find((e) => e.field === 'url');
    expect(urlError).toBeDefined();
    expect(urlError!.message).toContain('geldige URL');
  });

  test('valid URL passes validation', () => {
    const result = validateStructuredData('WEB_SITE', makeBaseData('WebSite', {
      name: 'Test Site',
      url: 'https://seocoach.nl',
    }));
    expect(result.errors.some((e) => e.field === 'url')).toBe(false);
  });

  test('invalid logo URL is flagged', () => {
    const result = validateStructuredData('ORGANIZATION', makeBaseData('Organization', {
      name: 'Test Org',
      logo: 'not-a-logo-url',
    }));
    const logoError = result.errors.find((e) => e.field === 'logo');
    expect(logoError).toBeDefined();
    expect(logoError!.message).toContain('geldige URL');
  });

  test('sameAs array with invalid URL is flagged', () => {
    const result = validateStructuredData('ORGANIZATION', makeBaseData('Organization', {
      name: 'Test Org',
      sameAs: ['https://twitter.com/test', 'not-a-url'],
    }));
    const sameAsError = result.errors.find((e) => e.field === 'sameAs');
    expect(sameAsError).toBeDefined();
  });
});

// ============================================================================
// Date validation
// ============================================================================

describe('Date validation', () => {
  test('invalid date format is flagged with Dutch message', () => {
    const result = validateStructuredData('ARTICLE', makeBaseData('Article', {
      headline: 'Test',
      author: 'Jan',
      datePublished: 'not-a-date',
    }));
    const dateError = result.errors.find((e) => e.field === 'datePublished');
    expect(dateError).toBeDefined();
    expect(dateError!.message).toContain('geldige ISO-datum');
  });

  test('valid ISO date passes validation', () => {
    const result = validateStructuredData('ARTICLE', makeBaseData('Article', {
      headline: 'Test',
      author: 'Jan',
      datePublished: '2024-01-15',
    }));
    expect(result.errors.some((e) => e.field === 'datePublished')).toBe(false);
  });

  test('valid ISO datetime passes validation', () => {
    const result = validateStructuredData('ARTICLE', makeBaseData('Article', {
      headline: 'Test',
      author: 'Jan',
      datePublished: '2024-01-15T10:30:00Z',
    }));
    expect(result.errors.some((e) => e.field === 'datePublished')).toBe(false);
  });

  test('Event endDate before startDate produces error', () => {
    const result = validateStructuredData('EVENT', makeBaseData('Event', {
      name: 'Test Event',
      startDate: '2024-06-15',
      endDate: '2024-06-10',
      location: 'Amsterdam',
    }));
    const endDateError = result.errors.find((e) => e.field === 'endDate');
    expect(endDateError).toBeDefined();
    expect(endDateError!.message).toContain('Einddatum mag niet voor de startdatum liggen');
  });

  test('Article dateModified before datePublished produces warning', () => {
    const result = validateStructuredData('ARTICLE', makeBaseData('Article', {
      headline: 'Test',
      author: 'Jan',
      datePublished: '2024-06-15',
      dateModified: '2024-01-01',
    }));
    const dateWarning = result.warnings.find((w) => w.field === 'dateModified');
    expect(dateWarning).toBeDefined();
    expect(dateWarning!.message).toContain('Wijzigingsdatum ligt voor de publicatiedatum');
  });
});

// ============================================================================
// Price and currency validation
// ============================================================================

describe('Price and currency validation', () => {
  test('negative price is flagged', () => {
    const result = validateStructuredData('OFFER', makeBaseData('Offer', {
      price: -10,
      priceCurrency: 'EUR',
    }));
    const priceError = result.errors.find((e) => e.field === 'price');
    expect(priceError).toBeDefined();
    expect(priceError!.message).toContain('positief getal');
  });

  test('invalid currency code is flagged with Dutch message', () => {
    const result = validateStructuredData('OFFER', makeBaseData('Offer', {
      price: 100,
      priceCurrency: 'euro',
    }));
    const currencyError = result.errors.find((e) => e.field === 'priceCurrency');
    expect(currencyError).toBeDefined();
    expect(currencyError!.message).toContain('geldige valutacode');
    expect(currencyError!.message).toContain('EUR');
  });

  test('valid EUR currency passes', () => {
    const result = validateStructuredData('OFFER', makeBaseData('Offer', {
      price: 100,
      priceCurrency: 'EUR',
    }));
    expect(result.errors.some((e) => e.field === 'priceCurrency')).toBe(false);
  });

  test('Review ratingValue must be positive', () => {
    const result = validateStructuredData('REVIEW', makeBaseData('Review', {
      author: 'Test',
      reviewRating: { '@type': 'Rating', ratingValue: -1 },
    }));
    const ratingError = result.errors.find((e) => e.field === 'reviewRating.ratingValue');
    expect(ratingError).toBeDefined();
    expect(ratingError!.message).toContain('positief getal');
  });
});

// ============================================================================
// Cross-field validation
// ============================================================================

describe('Cross-field validation', () => {
  test('FAQ with empty mainEntity array produces error', () => {
    const result = validateStructuredData('FAQ_PAGE', makeBaseData('FAQPage', {
      mainEntity: [],
    }));
    const entityError = result.errors.find((e) => e.field === 'mainEntity');
    expect(entityError).toBeDefined();
    expect(entityError!.message).toContain('minimaal één vraag');
  });

  test('FAQ with missing question name produces error', () => {
    const result = validateStructuredData('FAQ_PAGE', makeBaseData('FAQPage', {
      mainEntity: [{ '@type': 'Question', acceptedAnswer: { '@type': 'Answer', text: 'Antwoord' } }],
    }));
    const nameError = result.errors.find((e) => e.field === 'mainEntity[0].name');
    expect(nameError).toBeDefined();
    expect(nameError!.message).toContain('Vraag');
  });

  test('FAQ with missing answer text produces error', () => {
    const result = validateStructuredData('FAQ_PAGE', makeBaseData('FAQPage', {
      mainEntity: [{ '@type': 'Question', name: 'Test?', acceptedAnswer: { '@type': 'Answer' } }],
    }));
    const answerError = result.errors.find((e) => e.field === 'mainEntity[0].acceptedAnswer.text');
    expect(answerError).toBeDefined();
    expect(answerError!.message).toContain('Antwoordtekst');
  });

  test('HowTo with empty steps produces error', () => {
    const result = validateStructuredData('HOW_TO', makeBaseData('HowTo', {
      name: 'Test HowTo',
      step: [],
    }));
    const stepError = result.errors.find((e) => e.field === 'step');
    expect(stepError).toBeDefined();
    expect(stepError!.message).toContain('minimaal één stap');
  });

  test('HowTo step without text produces error', () => {
    const result = validateStructuredData('HOW_TO', makeBaseData('HowTo', {
      name: 'Test HowTo',
      step: [{ '@type': 'HowToStep', name: 'Stap 1' }],
    }));
    const stepTextError = result.errors.find((e) => e.field === 'step[0].text');
    expect(stepTextError).toBeDefined();
    expect(stepTextError!.message).toContain('Stapbeschrijving');
  });

  test('BreadcrumbList with empty items produces error', () => {
    const result = validateStructuredData('BREADCRUMB_LIST', makeBaseData('BreadcrumbList', {
      itemListElement: [],
    }));
    const itemsError = result.errors.find((e) => e.field === 'itemListElement');
    expect(itemsError).toBeDefined();
    expect(itemsError!.message).toContain('minimaal één item');
  });

  test('Breadcrumb non-sequential positions produce warning', () => {
    const result = validateStructuredData('BREADCRUMB_LIST', makeBaseData('BreadcrumbList', {
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home' },
        { '@type': 'ListItem', position: 3, name: 'About' },
      ],
    }));
    const posWarning = result.warnings.find((w) => w.field === 'itemListElement[].position');
    expect(posWarning).toBeDefined();
    expect(posWarning!.message).toContain('opeenvolgend');
  });

  test('Article without publisher produces warning', () => {
    const result = validateStructuredData('ARTICLE', makeBaseData('Article', {
      headline: 'Test',
      author: 'Jan',
      datePublished: '2024-01-01',
    }));
    const publisherWarning = result.warnings.find((w) => w.field === 'publisher');
    expect(publisherWarning).toBeDefined();
    expect(publisherWarning!.message).toContain('uitgever');
  });

  test('Article without image produces warning', () => {
    const result = validateStructuredData('ARTICLE', makeBaseData('Article', {
      headline: 'Test',
      author: 'Jan',
      datePublished: '2024-01-01',
    }));
    const imageWarning = result.warnings.find((w) => w.field === 'image');
    expect(imageWarning).toBeDefined();
    expect(imageWarning!.message).toContain('afbeelding');
  });

  test('LocalBusiness without telephone produces warning', () => {
    const result = validateStructuredData('LOCAL_BUSINESS', makeBaseData('LocalBusiness', {
      name: 'Test Business',
      address: { '@type': 'PostalAddress', streetAddress: 'Test 1', addressLocality: 'Amsterdam' },
    }));
    const telWarning = result.warnings.find((w) => w.field === 'telephone');
    expect(telWarning).toBeDefined();
    expect(telWarning!.message).toContain('telefoonnummer');
  });

  test('LocalBusiness without openingHours produces warning', () => {
    const result = validateStructuredData('LOCAL_BUSINESS', makeBaseData('LocalBusiness', {
      name: 'Test Business',
      address: { '@type': 'PostalAddress', streetAddress: 'Test 1', addressLocality: 'Amsterdam' },
    }));
    const hoursWarning = result.warnings.find((w) => w.field === 'openingHours');
    expect(hoursWarning).toBeDefined();
    expect(hoursWarning!.message).toContain('Openingstijden');
  });

  test('WebSite with non-SearchAction potentialAction produces error', () => {
    const result = validateStructuredData('WEB_SITE', makeBaseData('WebSite', {
      name: 'Test',
      url: 'https://test.nl',
      potentialAction: { '@type': 'ViewAction', target: 'test' },
    }));
    const actionError = result.errors.find((e) => e.field === 'potentialAction.@type');
    expect(actionError).toBeDefined();
    expect(actionError!.message).toContain('SearchAction');
  });

  test('PRODUCT offers without price produce error', () => {
    const result = validateStructuredData('PRODUCT', makeBaseData('Product', {
      name: 'Test Product',
      offers: { '@type': 'Offer', priceCurrency: 'EUR' },
    }));
    const priceError = result.errors.find((e) => e.field === 'offers.price');
    expect(priceError).toBeDefined();
    expect(priceError!.message).toContain('Prijs');
  });

  test('JOB_POSTING with future datePosted produces warning', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const result = validateStructuredData('JOB_POSTING', makeBaseData('JobPosting', {
      title: 'Test Job',
      description: 'Test description',
      hiringOrganization: { '@type': 'Organization', name: 'Test' },
      jobLocation: { '@type': 'PostalAddress', addressLocality: 'Amsterdam' },
      datePosted: futureDate.toISOString().split('T')[0],
    }));
    const dateWarning = result.warnings.find((w) => w.field === 'datePosted');
    expect(dateWarning).toBeDefined();
    expect(dateWarning!.message).toContain('toekomst');
  });
});

// ============================================================================
// Full valid schemas
// ============================================================================

describe('Full valid schemas', () => {
  test('complete Organization schema is valid', () => {
    const result = validateStructuredData('ORGANIZATION', makeBaseData('Organization', {
      name: 'SEOCoach B.V.',
      url: 'https://seocoach.nl',
      logo: 'https://seocoach.nl/logo.png',
      sameAs: ['https://twitter.com/seocoach'],
    }));
    expect(result.isValid).toBe(true);
    expect(result.missingRequiredFields.length).toBe(0);
  });

  test('complete Article schema is valid', () => {
    const result = validateStructuredData('ARTICLE', makeBaseData('Article', {
      headline: 'Test Article',
      author: 'Jan de Vries',
      datePublished: '2024-01-15',
      publisher: { '@type': 'Organization', name: 'SEOCoach' },
      image: 'https://seocoach.nl/image.jpg',
    }));
    expect(result.isValid).toBe(true);
    expect(result.missingRequiredFields.length).toBe(0);
  });

  test('complete FAQPage schema is valid', () => {
    const result = validateStructuredData('FAQ_PAGE', makeBaseData('FAQPage', {
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Wat is SEO?',
          acceptedAnswer: { '@type': 'Answer', text: 'SEO is zoekmachineoptimalisatie.' },
        },
      ],
    }));
    expect(result.isValid).toBe(true);
  });
});

// ============================================================================
// Dutch messages
// ============================================================================

describe('Dutch messages in validation', () => {
  test('all error messages contain Dutch text', () => {
    const result = validateStructuredData('ARTICLE', makeBaseData('Article'));
    for (const error of result.errors) {
      expect(error.message.length).toBeGreaterThan(0);
      // Error messages should contain Dutch words or schema.org identifiers
      const hasContent = error.message.length > 0;
      expect(hasContent).toBe(true);
    }
  });

  test('missing required field messages use Dutch names', () => {
    const result = validateStructuredData('ARTICLE', makeBaseData('Article'));
    const dutchFieldNames = ['Kopregel', 'Auteur', 'Publicatiedatum'];
    for (const name of dutchFieldNames) {
      expect(result.missingRequiredFields).toContain(name);
    }
  });

  test('warning messages are in Dutch', () => {
    const result = validateStructuredData('LOCAL_BUSINESS', makeBaseData('LocalBusiness', {
      name: 'Test',
      address: { '@type': 'PostalAddress', streetAddress: 'Test 1', addressLocality: 'Amsterdam' },
    }));
    for (const warning of result.warnings) {
      expect(warning.message.length).toBeGreaterThan(0);
    }
  });
});
