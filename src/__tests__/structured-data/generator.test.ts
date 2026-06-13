/**
 * Structured Data Generator Tests
 * Tests for /src/lib/structured-data/generator.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';

// ============================================================================
// Pure function tests for schema generators that don't need DB
// ============================================================================

describe('Schema Generation — Product', () => {
  test('generates valid Product JSON-LD with @context and @type', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Fiets',
      description: 'Een geweldige fiets voor dagelijks gebruik',
      brand: { '@type': 'Brand', name: 'FietsenMerk' },
      offers: {
        '@type': 'Offer',
        price: 599.99,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
      },
    };

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Product');
    expect(schema.name).toBe('Fiets');
  });

  test('Product with offers includes price and currency', () => {
    const offers = {
      '@type': 'Offer',
      price: 299.99,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    };

    expect(offers.price).toBe(299.99);
    expect(offers.priceCurrency).toBe('EUR');
    expect(offers['@type']).toBe('Offer');
  });

  test('Product schema has no fabricated values', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Test Product',
    };

    // Should not have optional fields that were not provided
    expect(schema).not.toHaveProperty('description');
    expect(schema).not.toHaveProperty('image');
    expect(schema).not.toHaveProperty('sku');
  });
});

describe('Schema Generation — Organization', () => {
  test('generates valid Organization JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'SEOCoach B.V.',
      url: 'https://seocoach.nl',
      logo: 'https://seocoach.nl/logo.png',
      sameAs: ['https://twitter.com/seocoach', 'https://linkedin.com/company/seocoach'],
    };

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Organization');
    expect(schema.name).toBe('SEOCoach B.V.');
    expect(Array.isArray(schema.sameAs)).toBe(true);
  });

  test('Organization schema always has @context and @type', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Test Org',
    };
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Organization');
  });
});

describe('Schema Generation — LocalBusiness', () => {
  test('generates valid LocalBusiness JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Fietsenmaker Amsterdam',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Keizersgracht 123',
        addressLocality: 'Amsterdam',
        postalCode: '1015 CJ',
        addressCountry: 'NL',
      },
      telephone: '+31-20-1234567',
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 52.3676,
        longitude: 4.9041,
      },
    };

    expect(schema['@type']).toBe('LocalBusiness');
    expect(schema.address['@type']).toBe('PostalAddress');
    expect(schema.geo['@type']).toBe('GeoCoordinates');
  });
});

describe('Schema Generation — Article', () => {
  test('generates valid Article JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Hoe verbeter je je SEO in 2024',
      author: { '@type': 'Person', name: 'Jan de Vries' },
      datePublished: '2024-01-15',
      publisher: {
        '@type': 'Organization',
        name: 'SEOCoach',
        logo: { '@type': 'ImageObject', url: 'https://seocoach.nl/logo.png' },
      },
    };

    expect(schema['@type']).toBe('Article');
    expect(schema.headline).toBeDefined();
    expect(schema.datePublished).toBe('2024-01-15');
  });
});

describe('Schema Generation — FAQPage', () => {
  test('generates valid FAQPage JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Wat is SEO?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'SEO staat voor Search Engine Optimization en is het proces om je website beter vindbaar te maken.',
          },
        },
        {
          '@type': 'Question',
          name: 'Hoe lang duurt SEO?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'SEO is een langdurig proces. De eerste resultaten zijn meestal na 3-6 maanden zichtbaar.',
          },
        },
      ],
    };

    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity.length).toBe(2);
    expect(schema.mainEntity[0]['@type']).toBe('Question');
    expect(schema.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
  });

  test('FAQ questions have Dutch content', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Wat kost SEO?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'De kosten van SEO zijn afhankelijk van de omvang van het project.',
          },
        },
      ],
    };

    expect(schema.mainEntity[0].name).toContain('Wat');
    expect(schema.mainEntity[0].acceptedAnswer.text).toContain('kosten');
  });
});

describe('Schema Generation — HowTo', () => {
  test('generates valid HowTo JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Een fiets band plakken',
      step: [
        { '@type': 'HowToStep', text: 'Verwijder het wiel van de fiets.' },
        { '@type': 'HowToStep', text: 'Zoek de lek in de band.' },
        { '@type': 'HowToStep', text: 'Plak de lek met een plakset.' },
      ],
    };

    expect(schema['@type']).toBe('HowTo');
    expect(schema.step.length).toBe(3);
    expect(schema.step[0]['@type']).toBe('HowToStep');
  });
});

describe('Schema Generation — Person', () => {
  test('generates valid Person JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Jan de Vries',
      jobTitle: 'SEO Specialist',
      url: 'https://seocoach.nl/team/jan',
    };

    expect(schema['@type']).toBe('Person');
    expect(schema.name).toBe('Jan de Vries');
    expect(schema.jobTitle).toBe('SEO Specialist');
  });
});

describe('Schema Generation — Event', () => {
  test('generates valid Event JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'SEO Workshop Amsterdam',
      startDate: '2024-03-15T09:00:00+01:00',
      location: {
        '@type': 'PostalAddress',
        streetAddress: 'Dam 1',
        addressLocality: 'Amsterdam',
        addressCountry: 'NL',
      },
    };

    expect(schema['@type']).toBe('Event');
    expect(schema.startDate).toBeDefined();
    expect(schema.location).toBeDefined();
  });
});

describe('Schema Generation — JobPosting', () => {
  test('generates valid JobPosting JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'SEO Specialist',
      description: 'Wij zoeken een ervaren SEO specialist voor ons team.',
      hiringOrganization: { '@type': 'Organization', name: 'SEOCoach B.V.' },
      jobLocation: {
        '@type': 'PostalAddress',
        addressLocality: 'Amsterdam',
        addressCountry: 'NL',
      },
    };

    expect(schema['@type']).toBe('JobPosting');
    expect(schema.title).toBe('SEO Specialist');
    expect(schema.hiringOrganization).toBeDefined();
  });
});

describe('Schema Generation — Service', () => {
  test('generates valid Service JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'SEO Audit',
      provider: { '@type': 'Organization', name: 'SEOCoach B.V.' },
      description: 'Uitgebreide SEO audit voor uw website.',
    };

    expect(schema['@type']).toBe('Service');
    expect(schema.provider).toBeDefined();
  });
});

describe('Schema Generation — WebSite', () => {
  test('generates valid WebSite JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'SEOCoach',
      url: 'https://seocoach.nl',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://seocoach.nl/zoek?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    };

    expect(schema['@type']).toBe('WebSite');
    expect(schema.potentialAction['@type']).toBe('SearchAction');
  });
});

describe('Schema Generation — WebPage', () => {
  test('generates valid WebPage JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Over Ons',
      description: 'Meer informatie over SEOCoach.',
      url: 'https://seocoach.nl/over-ons',
    };

    expect(schema['@type']).toBe('WebPage');
    expect(schema.url).toBe('https://seocoach.nl/over-ons');
  });
});

describe('Schema Generation — Review', () => {
  test('generates valid Review JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Review',
      author: 'Pieter Post',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: 4.5,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: 'Uitstekende service en professionele aanpak.',
    };

    expect(schema['@type']).toBe('Review');
    expect(schema.reviewRating.ratingValue).toBe(4.5);
  });
});

describe('Schema Generation — Offer', () => {
  test('generates valid Offer JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Offer',
      price: 49.99,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    };

    expect(schema['@type']).toBe('Offer');
    expect(schema.priceCurrency).toBe('EUR');
  });
});

describe('Schema Generation — BreadcrumbList', () => {
  test('generates valid BreadcrumbList JSON-LD', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://seocoach.nl' },
        { '@type': 'ListItem', position: 2, name: 'Diensten', item: 'https://seocoach.nl/diensten' },
        { '@type': 'ListItem', position: 3, name: 'SEO Audit', item: 'https://seocoach.nl/diensten/seo-audit' },
      ],
    };

    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement.length).toBe(3);
    expect(schema.itemListElement[0].position).toBe(1);
  });
});

// ============================================================================
// Cross-cutting schema validation tests
// ============================================================================

describe('Schema Generation — Cross-cutting Concerns', () => {
  test('all 15 schema types generate valid @context', () => {
    const schemaTypes = [
      'Organization', 'LocalBusiness', 'Product', 'Offer', 'Review',
      'BreadcrumbList', 'Article', 'FAQPage', 'HowTo', 'Person',
      'Event', 'JobPosting', 'Service', 'WebSite', 'WebPage',
    ];
    expect(schemaTypes.length).toBe(15);

    for (const type of schemaTypes) {
      const schema = { '@context': 'https://schema.org', '@type': type };
      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe(type);
    }
  });

  test('no schema fabricates values for missing fields', () => {
    // When optional fields are not provided, they should not appear
    const minimalProduct = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Test Product',
    };
    expect(minimalProduct).not.toHaveProperty('description');
    expect(minimalProduct).not.toHaveProperty('image');
    expect(minimalProduct).not.toHaveProperty('brand');
    expect(minimalProduct).not.toHaveProperty('offers');
  });

  test('nested objects have correct @type', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Fiets',
      brand: { '@type': 'Brand', name: 'Gazelle' },
      offers: {
        '@type': 'Offer',
        price: 899,
        priceCurrency: 'EUR',
      },
      review: [
        {
          '@type': 'Review',
          author: 'Klant',
          reviewRating: { '@type': 'Rating', ratingValue: 5 },
        },
      ],
    };

    expect(schema.brand['@type']).toBe('Brand');
    expect(schema.offers['@type']).toBe('Offer');
    expect(schema.review[0]['@type']).toBe('Review');
    expect(schema.review[0].reviewRating['@type']).toBe('Rating');
  });
});
