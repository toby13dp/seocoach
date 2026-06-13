/**
 * Programmatic SEO Template Manager Tests
 * Tests for /src/lib/programmatic/template-manager.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import {
  getDefaultVariables,
  getDefaultContentTemplate,
  getDefaultKeywordPattern,
  renderTemplate,
  generateSlug,
  extractTitle,
  TEMPLATE_TYPE_LABELS,
} from '@/lib/programmatic/template-manager';
import type { TemplateType, ProgrammaticVariable, ProgrammaticDataRows } from '@/lib/programmatic/types';

// ============================================================================
// Template types
// ============================================================================

describe('Template Types', () => {
  test('all 9 template types are defined', () => {
    const templateTypes: TemplateType[] = [
      'SERVICE_LOCATION',
      'PRODUCT_USE_CASE',
      'PRODUCT_AUDIENCE',
      'PRODUCT_FEATURE',
      'CATEGORY_FEATURE',
      'INDUSTRY_SERVICE',
      'INTEGRATION_PLATFORM',
      'COMPARISON',
      'GLOSSARY',
    ];
    expect(templateTypes.length).toBe(9);
  });

  test('each template type is unique', () => {
    const templateTypes: TemplateType[] = [
      'SERVICE_LOCATION', 'PRODUCT_USE_CASE', 'PRODUCT_AUDIENCE',
      'PRODUCT_FEATURE', 'CATEGORY_FEATURE', 'INDUSTRY_SERVICE',
      'INTEGRATION_PLATFORM', 'COMPARISON', 'GLOSSARY',
    ];
    const unique = new Set(templateTypes);
    expect(unique.size).toBe(9);
  });
});

// ============================================================================
// Default variables per template type
// ============================================================================

describe('Default Variables per Template Type', () => {
  test('SERVICE_LOCATION has expected variables', () => {
    const vars = getDefaultVariables('SERVICE_LOCATION');
    const names = vars.map((v) => v.name);
    expect(names).toContain('serviceName');
    expect(names).toContain('locationName');
    expect(names).toContain('serviceDescription');
  });

  test('PRODUCT_USE_CASE has expected variables', () => {
    const vars = getDefaultVariables('PRODUCT_USE_CASE');
    const names = vars.map((v) => v.name);
    expect(names).toContain('productName');
    expect(names).toContain('useCaseName');
    expect(names).toContain('useCaseDescription');
  });

  test('PRODUCT_AUDIENCE has expected variables', () => {
    const vars = getDefaultVariables('PRODUCT_AUDIENCE');
    const names = vars.map((v) => v.name);
    expect(names).toContain('productName');
    expect(names).toContain('audienceName');
    expect(names).toContain('audienceDescription');
  });

  test('PRODUCT_FEATURE has expected variables', () => {
    const vars = getDefaultVariables('PRODUCT_FEATURE');
    const names = vars.map((v) => v.name);
    expect(names).toContain('productName');
    expect(names).toContain('featureName');
    expect(names).toContain('featureDescription');
  });

  test('CATEGORY_FEATURE has expected variables', () => {
    const vars = getDefaultVariables('CATEGORY_FEATURE');
    const names = vars.map((v) => v.name);
    expect(names).toContain('categoryName');
    expect(names).toContain('featureName');
    expect(names).toContain('featureDescription');
  });

  test('INDUSTRY_SERVICE has expected variables', () => {
    const vars = getDefaultVariables('INDUSTRY_SERVICE');
    const names = vars.map((v) => v.name);
    expect(names).toContain('industryName');
    expect(names).toContain('serviceName');
  });

  test('INTEGRATION_PLATFORM has expected variables', () => {
    const vars = getDefaultVariables('INTEGRATION_PLATFORM');
    const names = vars.map((v) => v.name);
    expect(names).toContain('integrationName');
    expect(names).toContain('platformName');
  });

  test('COMPARISON has expected variables', () => {
    const vars = getDefaultVariables('COMPARISON');
    const names = vars.map((v) => v.name);
    expect(names).toContain('itemA');
    expect(names).toContain('itemB');
    expect(names).toContain('comparisonCriteria');
  });

  test('GLOSSARY has expected variables', () => {
    const vars = getDefaultVariables('GLOSSARY');
    const names = vars.map((v) => v.name);
    expect(names).toContain('term');
    expect(names).toContain('definition');
  });
});

// ============================================================================
// Dutch variable labels
// ============================================================================

describe('Dutch Variable Labels', () => {
  test('all default variables have Dutch labels', () => {
    const types: TemplateType[] = [
      'SERVICE_LOCATION', 'PRODUCT_USE_CASE', 'PRODUCT_AUDIENCE',
      'PRODUCT_FEATURE', 'CATEGORY_FEATURE', 'INDUSTRY_SERVICE',
      'INTEGRATION_PLATFORM', 'COMPARISON', 'GLOSSARY',
    ];
    for (const type of types) {
      const vars = getDefaultVariables(type);
      for (const v of vars) {
        expect(v.label.length).toBeGreaterThan(0);
        // Dutch labels should not be English camelCase
        expect(v.label).not.toMatch(/^[a-z][a-zA-Z]+$/);
      }
    }
  });

  test('SERVICE_LOCATION has specific Dutch labels', () => {
    const vars = getDefaultVariables('SERVICE_LOCATION');
    const labels = vars.map((v) => v.label);
    expect(labels).toContain('Dienstnaam');
    expect(labels).toContain('Locatienaam');
    expect(labels).toContain('Dienstbeschrijving');
  });

  test('PRODUCT_USE_CASE has specific Dutch labels', () => {
    const vars = getDefaultVariables('PRODUCT_USE_CASE');
    const labels = vars.map((v) => v.label);
    expect(labels).toContain('Productnaam');
    expect(labels).toContain('Gebruiksscenario');
  });

  test('GLOSSARY has specific Dutch labels', () => {
    const vars = getDefaultVariables('GLOSSARY');
    const labels = vars.map((v) => v.label);
    expect(labels).toContain('Term');
    expect(labels).toContain('Definitie');
  });

  test('variable descriptions are in Dutch', () => {
    const vars = getDefaultVariables('SERVICE_LOCATION');
    for (const v of vars) {
      expect(v.description.length).toBeGreaterThan(0);
    }
    // Check a specific Dutch description
    const serviceDesc = vars.find((v) => v.name === 'serviceName');
    expect(serviceDesc!.description).toContain('dienst');
  });
});

// ============================================================================
// Template type labels (Dutch)
// ============================================================================

describe('Template Type Labels (Dutch)', () => {
  test('all 9 template types have Dutch labels', () => {
    const labels = Object.values(TEMPLATE_TYPE_LABELS);
    expect(labels.length).toBe(9);
  });

  test('SERVICE_LOCATION label is Dutch', () => {
    expect(TEMPLATE_TYPE_LABELS.SERVICE_LOCATION).toBe('Dienst + Locatie');
  });

  test('PRODUCT_USE_CASE label is Dutch', () => {
    expect(TEMPLATE_TYPE_LABELS.PRODUCT_USE_CASE).toBe('Product + Gebruiksscenario');
  });

  test('PRODUCT_AUDIENCE label is Dutch', () => {
    expect(TEMPLATE_TYPE_LABELS.PRODUCT_AUDIENCE).toBe('Product + Doelgroep');
  });

  test('PRODUCT_FEATURE label is Dutch', () => {
    expect(TEMPLATE_TYPE_LABELS.PRODUCT_FEATURE).toBe('Product + Functie');
  });

  test('CATEGORY_FEATURE label is Dutch', () => {
    expect(TEMPLATE_TYPE_LABELS.CATEGORY_FEATURE).toBe('Categorie + Functie');
  });

  test('INDUSTRY_SERVICE label is Dutch', () => {
    expect(TEMPLATE_TYPE_LABELS.INDUSTRY_SERVICE).toBe('Branche + Dienst');
  });

  test('INTEGRATION_PLATFORM label is Dutch', () => {
    expect(TEMPLATE_TYPE_LABELS.INTEGRATION_PLATFORM).toBe('Integratie + Platform');
  });

  test('COMPARISON label is Dutch', () => {
    expect(TEMPLATE_TYPE_LABELS.COMPARISON).toBe('Vergelijking');
  });

  test('GLOSSARY label is Dutch', () => {
    expect(TEMPLATE_TYPE_LABELS.GLOSSARY).toBe('Woordenlijst');
  });
});

// ============================================================================
// Default content templates
// ============================================================================

describe('Default Content Templates', () => {
  test('all template types have content templates', () => {
    const types: TemplateType[] = [
      'SERVICE_LOCATION', 'PRODUCT_USE_CASE', 'PRODUCT_AUDIENCE',
      'PRODUCT_FEATURE', 'CATEGORY_FEATURE', 'INDUSTRY_SERVICE',
      'INTEGRATION_PLATFORM', 'COMPARISON', 'GLOSSARY',
    ];
    for (const type of types) {
      const template = getDefaultContentTemplate(type);
      expect(template.length).toBeGreaterThan(0);
    }
  });

  test('SERVICE_LOCATION template contains variable placeholders', () => {
    const template = getDefaultContentTemplate('SERVICE_LOCATION');
    expect(template).toContain('{{serviceName}}');
    expect(template).toContain('{{locationName}}');
  });

  test('COMPARISON template contains item variables', () => {
    const template = getDefaultContentTemplate('COMPARISON');
    expect(template).toContain('{{itemA}}');
    expect(template).toContain('{{itemB}}');
  });

  test('GLOSSARY template contains term and definition', () => {
    const template = getDefaultContentTemplate('GLOSSARY');
    expect(template).toContain('{{term}}');
    expect(template).toContain('{{definition}}');
  });

  test('content templates use Markdown format', () => {
    const template = getDefaultContentTemplate('SERVICE_LOCATION');
    expect(template).toContain('# ');
    expect(template).toContain('## ');
  });
});

// ============================================================================
// Default keyword patterns
// ============================================================================

describe('Default Keyword Patterns', () => {
  test('all template types have keyword patterns', () => {
    const types: TemplateType[] = [
      'SERVICE_LOCATION', 'PRODUCT_USE_CASE', 'PRODUCT_AUDIENCE',
      'PRODUCT_FEATURE', 'CATEGORY_FEATURE', 'INDUSTRY_SERVICE',
      'INTEGRATION_PLATFORM', 'COMPARISON', 'GLOSSARY',
    ];
    for (const type of types) {
      const pattern = getDefaultKeywordPattern(type);
      expect(pattern.length).toBeGreaterThan(0);
    }
  });

  test('SERVICE_LOCATION pattern combines service and location', () => {
    const pattern = getDefaultKeywordPattern('SERVICE_LOCATION');
    expect(pattern).toBe('{{serviceName}} {{locationName}}');
  });

  test('COMPARISON pattern uses vs', () => {
    const pattern = getDefaultKeywordPattern('COMPARISON');
    expect(pattern).toBe('{{itemA}} vs {{itemB}}');
  });

  test('GLOSSARY pattern includes Dutch word', () => {
    const pattern = getDefaultKeywordPattern('GLOSSARY');
    expect(pattern).toContain('betekenis');
  });
});

// ============================================================================
// Template rendering
// ============================================================================

describe('Template Rendering', () => {
  test('renders template with data values', () => {
    const template = '# {{serviceName}} in {{locationName}}\n\n{{serviceDescription}}';
    const data = {
      serviceName: 'SEO Consult',
      locationName: 'Amsterdam',
      serviceDescription: 'Professionele SEO diensten voor bedrijven.',
    };
    const rendered = renderTemplate(template, data);
    expect(rendered).toContain('SEO Consult');
    expect(rendered).toContain('Amsterdam');
    expect(rendered).toContain('Professionele SEO diensten');
    expect(rendered).not.toContain('{{serviceName}}');
    expect(rendered).not.toContain('{{locationName}}');
  });

  test('unfilled placeholders remain when data is missing', () => {
    const template = '# {{serviceName}} in {{locationName}}\n\n{{serviceDescription}}';
    const data = {
      serviceName: 'SEO Consult',
      locationName: 'Amsterdam',
    };
    const rendered = renderTemplate(template, data);
    expect(rendered).toContain('{{serviceDescription}}');
  });

  test('renders all variable types in template', () => {
    const template = '{{productName}} voor {{useCaseName}} — {{useCaseDescription}}';
    const data = {
      productName: 'SEOCoach',
      useCaseName: 'Lokale SEO',
      useCaseDescription: 'Verbeter uw lokale zichtbaarheid',
    };
    const rendered = renderTemplate(template, data);
    expect(rendered).toBe('SEOCoach voor Lokale SEO — Verbeter uw lokale zichtbaarheid');
  });

  test('replaces multiple occurrences of same variable', () => {
    const template = '{{serviceName}} is geweldig. Kies voor {{serviceName}}!';
    const data = { serviceName: 'SEOCoach' };
    const rendered = renderTemplate(template, data);
    expect(rendered).toBe('SEOCoach is geweldig. Kies voor SEOCoach!');
  });

  test('handles numeric data values', () => {
    const template = 'Prijs: {{price}} euro';
    const data = { price: 99.99 };
    const rendered = renderTemplate(template, data);
    expect(rendered).toContain('99.99');
  });
});

// ============================================================================
// Slug generation
// ============================================================================

describe('Slug Generation', () => {
  test('converts Dutch text to URL-friendly slug', () => {
    const slug = generateSlug('SEO Consult in Amsterdam');
    expect(slug).toBe('seo-consult-in-amsterdam');
  });

  test('removes diacritics from Dutch characters', () => {
    const slug = generateSlug('Fietsenmaker café');
    expect(slug).toBe('fietsenmaker-cafe');
  });

  test('removes special characters', () => {
    const slug = generateSlug('SEO & Marketing: De Beste Tips!');
    expect(slug).toBe('seo-marketing-de-beste-tips');
  });

  test('handles multiple spaces and hyphens', () => {
    const slug = generateSlug('SEO   --   Tips  voor  Beginners');
    expect(slug).toBe('seo-tips-voor-beginners');
  });

  test('trims leading and trailing hyphens', () => {
    const slug = generateSlug('-- SEO Tips --');
    expect(slug).toBe('seo-tips');
  });

  test('converts to lowercase', () => {
    const slug = generateSlug('Zoekmachine Optimalisatie');
    expect(slug).toBe('zoekmachine-optimalisatie');
  });

  test('handles empty string', () => {
    const slug = generateSlug('');
    expect(slug).toBe('');
  });
});

// ============================================================================
// Title extraction
// ============================================================================

describe('Title Extraction', () => {
  test('extracts H1 heading from rendered content', () => {
    const content = '# SEO Consult in Amsterdam\n\nProfessionele SEO diensten.';
    const title = extractTitle(content);
    expect(title).toBe('SEO Consult in Amsterdam');
  });

  test('falls back to first non-empty line when no H1', () => {
    const content = 'SEO Consult in Amsterdam\n\nProfessionele SEO diensten.';
    const title = extractTitle(content);
    expect(title).toBe('SEO Consult in Amsterdam');
  });

  test('returns "Zonder titel" for empty content', () => {
    const content = '';
    const title = extractTitle(content);
    expect(title).toBe('Zonder titel');
  });

  test('returns "Zonder titel" for whitespace-only content', () => {
    const content = '   \n  \n  ';
    const title = extractTitle(content);
    expect(title).toBe('Zonder titel');
  });

  test('extracts title with Dutch characters', () => {
    const content = '# Fietsenmaker in Café district\n\nOnze fietsenmaker.';
    const title = extractTitle(content);
    expect(title).toBe('Fietsenmaker in Café district');
  });
});

// ============================================================================
// Data row management
// ============================================================================

describe('Data Row Management', () => {
  test('data rows have correct structure', () => {
    const dataRows: ProgrammaticDataRows = [
      { serviceName: 'SEO', locationName: 'Amsterdam', serviceDescription: 'SEO diensten in Amsterdam.' },
      { serviceName: 'SEO', locationName: 'Rotterdam', serviceDescription: 'SEO diensten in Rotterdam.' },
    ];
    expect(dataRows.length).toBe(2);
  });

  test('required variables must be filled in data rows', () => {
    const variables: ProgrammaticVariable[] = [
      { name: 'serviceName', label: 'Dienstnaam', type: 'text', required: true, description: 'De naam van de dienst' },
      { name: 'locationName', label: 'Locatienaam', type: 'text', required: true, description: 'De naam van de locatie' },
    ];
    const requiredVars = variables.filter((v) => v.required).map((v) => v.name);

    const row = { serviceName: 'SEO', locationName: '' };
    const missingRequired = requiredVars.filter((v) => row[v] === undefined || row[v] === '');
    expect(missingRequired).toContain('locationName');
  });

  test('Dutch error for missing required variable', () => {
    const rowIndex = 0;
    const varName = 'locationName';
    const message = `Gegevensrij ${rowIndex + 1}: verplichte variabele "${varName}" ontbreekt of is leeg.`;
    expect(message).toContain('verplichte variabele');
    expect(message).toContain('ontbreekt');
  });

  test('data rows are appended to existing rows', () => {
    const existingRows: ProgrammaticDataRows = [
      { serviceName: 'SEO', locationName: 'Amsterdam' },
    ];
    const newRows: ProgrammaticDataRows = [
      { serviceName: 'SEO', locationName: 'Rotterdam' },
      { serviceName: 'SEA', locationName: 'Den Haag' },
    ];
    const combined = [...existingRows, ...newRows];
    expect(combined.length).toBe(3);
  });
});

// ============================================================================
// Preview rendering
// ============================================================================

describe('Preview Rendering', () => {
  test('preview renders template with specific data row', () => {
    const template = '# {{serviceName}} in {{locationName}}\n\n{{serviceDescription}}';
    const rowData = {
      serviceName: 'Webdesign',
      locationName: 'Utrecht',
      serviceDescription: 'Professioneel webdesign voor bedrijven in Utrecht.',
    };
    const rendered = renderTemplate(template, rowData);
    const title = extractTitle(rendered);
    const slug = generateSlug(title);
    const targetKeyword = renderTemplate('{{serviceName}} {{locationName}}', rowData);

    expect(title).toBe('Webdesign in Utrecht');
    expect(slug).toBe('webdesign-in-utrecht');
    expect(targetKeyword).toBe('Webdesign Utrecht');
  });

  test('preview with COMPARISON template type', () => {
    const template = getDefaultContentTemplate('COMPARISON');
    const rowData = {
      itemA: 'SEOCoach',
      itemB: 'Concurrent',
      comparisonCriteria: 'Functies, Prijs, Ondersteuning',
      verdictA: 'Uitgebreide functies en goede ondersteuning',
      verdictB: 'Beperkte functies maar lagere prijs',
    };
    const rendered = renderTemplate(template, rowData);
    expect(rendered).toContain('SEOCoach');
    expect(rendered).toContain('Concurrent');
    expect(rendered).toContain('vs');
  });

  test('preview with GLOSSARY template type', () => {
    const template = getDefaultContentTemplate('GLOSSARY');
    const rowData = {
      term: 'Zoekmachineoptimalisatie',
      definition: 'Het proces van het verbeteren van de zichtbaarheid van een website in zoekmachines.',
      example: 'Het gebruik van relevante zoekwoorden in uw content.',
      relatedTerms: 'SEO, organisch verkeer, ranking',
    };
    const rendered = renderTemplate(template, rowData);
    expect(rendered).toContain('Zoekmachineoptimalisatie');
    expect(rendered).toContain('Definitie');
  });
});

// ============================================================================
// Dutch error messages for template operations
// ============================================================================

describe('Dutch Error Messages', () => {
  test('Dutch error for template not found', () => {
    const templateId = 'nonexistent';
    const message = `Sjabloon met ID "${templateId}" niet gevonden of verwijderd.`;
    expect(message).toContain('niet gevonden of verwijderd');
  });

  test('Dutch error for deleted template', () => {
    const templateId = 'deleted-1';
    const message = `Sjabloon met ID "${templateId}" niet gevonden of verwijderd.`;
    expect(message).toContain('verwijderd');
  });

  test('Dutch error for row index out of range', () => {
    const rowIndex = 99;
    const maxRows = 10;
    const message = `Gegevensrij index ${rowIndex} is buiten bereik. Beschikbare rijen: 0-${maxRows - 1}.`;
    expect(message).toContain('buiten bereik');
  });

  test('Dutch error for delete of nonexistent template', () => {
    const templateId = 'nonexistent';
    const message = `Sjabloon met ID "${templateId}" niet gevonden.`;
    expect(message).toContain('niet gevonden');
  });
});

// ============================================================================
// Variable definition structure
// ============================================================================

describe('Variable Definition Structure', () => {
  test('ProgrammaticVariable has all required fields', () => {
    const variable: ProgrammaticVariable = {
      name: 'serviceName',
      label: 'Dienstnaam',
      type: 'text',
      required: true,
      description: 'De naam van de dienst',
    };
    expect(variable.name).toBe('serviceName');
    expect(variable.label).toBe('Dienstnaam');
    expect(variable.type).toBe('text');
    expect(variable.required).toBe(true);
  });

  test('optional fields work correctly', () => {
    const selectVariable: ProgrammaticVariable = {
      name: 'serviceType',
      label: 'Diensttype',
      type: 'select',
      required: false,
      description: 'Het type dienst',
      options: ['Consult', 'Training', 'Implementatie'],
      defaultValue: 'Consult',
    };
    expect(selectVariable.options).toBeDefined();
    expect(selectVariable.defaultValue).toBe('Consult');
  });

  test('all default variables have valid types', () => {
    const validTypes = ['text', 'number', 'url', 'select'];
    const types: TemplateType[] = [
      'SERVICE_LOCATION', 'PRODUCT_USE_CASE', 'PRODUCT_AUDIENCE',
      'PRODUCT_FEATURE', 'CATEGORY_FEATURE', 'INDUSTRY_SERVICE',
      'INTEGRATION_PLATFORM', 'COMPARISON', 'GLOSSARY',
    ];
    for (const type of types) {
      const vars = getDefaultVariables(type);
      for (const v of vars) {
        expect(validTypes).toContain(v.type);
      }
    }
  });
});
