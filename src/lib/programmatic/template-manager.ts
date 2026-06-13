// ============================================================================
// Programmatic SEO Template Manager — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages the lifecycle of programmatic SEO templates: creation, updating,
// listing, deletion, data row management, and preview rendering.
// All user-facing strings are in Dutch.
// ============================================================================

import { db } from '@/lib/db';
import type {
  ProgrammaticVariable,
  ProgrammaticDataRows,
  ProgrammaticTemplateConfig,
  TemplateType,
  TemplatePreview,
  TemplateSummary,
  TemplateWithPages,
  ProgrammaticPageSummary,
} from './types';

// ============================================================================
// Default Variable Sets per Template Type
// ============================================================================

/**
 * Default variable definitions for each template type.
 * These are used when creating a new template without custom variables.
 * All labels and descriptions are in Dutch.
 */
const DEFAULT_VARIABLES: Record<TemplateType, ProgrammaticVariable[]> = {
  SERVICE_LOCATION: [
    { name: 'serviceName', label: 'Dienstnaam', type: 'text', required: true, description: 'De naam van de dienst' },
    { name: 'locationName', label: 'Locatienaam', type: 'text', required: true, description: 'De naam van de locatie of stad' },
    { name: 'locationRegion', label: 'Regio', type: 'text', required: false, description: 'De regio of provincie' },
    { name: 'serviceDescription', label: 'Dienstbeschrijving', type: 'text', required: true, description: 'Beschrijving van de dienst' },
    { name: 'serviceBenefits', label: 'Voordelen', type: 'text', required: false, description: 'Voordelen van de dienst op deze locatie' },
  ],
  PRODUCT_USE_CASE: [
    { name: 'productName', label: 'Productnaam', type: 'text', required: true, description: 'De naam van het product' },
    { name: 'useCaseName', label: 'Gebruiksscenario', type: 'text', required: true, description: 'Naam van het gebruiksscenario' },
    { name: 'useCaseDescription', label: 'Scenario-beschrijving', type: 'text', required: true, description: 'Beschrijving van het gebruiksscenario' },
    { name: 'productFeatures', label: 'Productfuncties', type: 'text', required: false, description: 'Relevante productfuncties voor dit scenario' },
  ],
  PRODUCT_AUDIENCE: [
    { name: 'productName', label: 'Productnaam', type: 'text', required: true, description: 'De naam van het product' },
    { name: 'audienceName', label: 'Doelgroepnaam', type: 'text', required: true, description: 'De naam van de doelgroep' },
    { name: 'audienceDescription', label: 'Doelgroepbeschrijving', type: 'text', required: true, description: 'Beschrijving van de doelgroep' },
    { name: 'tailoredBenefits', label: 'Afgestemde voordelen', type: 'text', required: false, description: 'Voordelen specifiek voor deze doelgroep' },
  ],
  PRODUCT_FEATURE: [
    { name: 'productName', label: 'Productnaam', type: 'text', required: true, description: 'De naam van het product' },
    { name: 'featureName', label: 'Functienaam', type: 'text', required: true, description: 'De naam van de functie' },
    { name: 'featureDescription', label: 'Functiebeschrijving', type: 'text', required: true, description: 'Beschrijving van de functie' },
    { name: 'featureBenefits', label: 'Functievoordelen', type: 'text', required: false, description: 'Voordelen van deze functie' },
  ],
  CATEGORY_FEATURE: [
    { name: 'categoryName', label: 'Categorienaam', type: 'text', required: true, description: 'De naam van de categorie' },
    { name: 'featureName', label: 'Functienaam', type: 'text', required: true, description: 'De naam van de functie' },
    { name: 'featureDescription', label: 'Functiebeschrijving', type: 'text', required: true, description: 'Beschrijving van de functie' },
    { name: 'benefits', label: 'Voordelen', type: 'text', required: false, description: 'Voordelen van deze combinatie' },
  ],
  INDUSTRY_SERVICE: [
    { name: 'industryName', label: 'Branchnaam', type: 'text', required: true, description: 'De naam van de branche' },
    { name: 'serviceName', label: 'Dienstnaam', type: 'text', required: true, description: 'De naam van de dienst' },
    { name: 'industryChallenges', label: 'Branchuitdagingen', type: 'text', required: false, description: 'Specifieke uitdagingen in deze branche' },
    { name: 'serviceSolution', label: 'Oplossing', type: 'text', required: false, description: 'Hoe de dienst deze uitdagingen oplost' },
  ],
  INTEGRATION_PLATFORM: [
    { name: 'integrationName', label: 'Integratienaam', type: 'text', required: true, description: 'De naam van de integratie' },
    { name: 'platformName', label: 'Platformnaam', type: 'text', required: true, description: 'De naam van het platform' },
    { name: 'setupSteps', label: 'Installatiestappen', type: 'text', required: false, description: 'Stappen om de integratie in te stellen' },
    { name: 'benefits', label: 'Voordelen', type: 'text', required: false, description: 'Voordelen van deze integratie' },
  ],
  COMPARISON: [
    { name: 'itemA', label: 'Item A', type: 'text', required: true, description: 'De naam van het eerste item' },
    { name: 'itemB', label: 'Item B', type: 'text', required: true, description: 'De naam van het tweede item' },
    { name: 'comparisonCriteria', label: 'Vergelijkingscriteria', type: 'text', required: true, description: 'Criteria voor vergelijking' },
    { name: 'verdictA', label: 'Oordeel A', type: 'text', required: false, description: 'Oordeel over item A' },
    { name: 'verdictB', label: 'Oordeel B', type: 'text', required: false, description: 'Oordeel over item B' },
  ],
  GLOSSARY: [
    { name: 'term', label: 'Term', type: 'text', required: true, description: 'De woordenschat-term' },
    { name: 'definition', label: 'Definitie', type: 'text', required: true, description: 'De definitie van de term' },
    { name: 'example', label: 'Voorbeeld', type: 'text', required: false, description: 'Een voorbeeld van het gebruik' },
    { name: 'relatedTerms', label: 'Gerelateerde termen', type: 'text', required: false, description: 'Gerelateerde termen in de woordenschat' },
  ],
};

/**
 * Dutch names for each template type, used in UI displays.
 */
export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  SERVICE_LOCATION: 'Dienst + Locatie',
  PRODUCT_USE_CASE: 'Product + Gebruiksscenario',
  PRODUCT_AUDIENCE: 'Product + Doelgroep',
  PRODUCT_FEATURE: 'Product + Functie',
  CATEGORY_FEATURE: 'Categorie + Functie',
  INDUSTRY_SERVICE: 'Branche + Dienst',
  INTEGRATION_PLATFORM: 'Integratie + Platform',
  COMPARISON: 'Vergelijking',
  GLOSSARY: 'Woordenlijst',
};

/**
 * Default content templates for each template type.
 * Uses {{variable}} placeholders that will be filled with data row values.
 */
const DEFAULT_CONTENT_TEMPLATES: Record<TemplateType, string> = {
  SERVICE_LOCATION: `# {{serviceName}} in {{locationName}}

{{serviceDescription}}

## Waarom {{serviceName}} in {{locationName}}?

{{serviceBenefits}}

## {{serviceName}} in de regio {{locationRegion}}

Ontdek onze professionele {{serviceName}} diensten in {{locationName}} en omgeving. Wij bieden betrouwbare en kwalitatieve oplossingen voor al uw behoeften.`,
  PRODUCT_USE_CASE: `# {{productName}} voor {{useCaseName}}

{{useCaseDescription}}

## Hoe {{productName}} helpt bij {{useCaseName}}

{{productFeatures}}

## Aan de slag

Ontdek hoe {{productName}} uw workflow voor {{useCaseName}} kan verbeteren.`,
  PRODUCT_AUDIENCE: `# {{productName}} voor {{audienceName}}

{{audienceDescription}}

## Voordelen voor {{audienceName}}

{{tailoredBenefits}}

## Waarom {{audienceName}} kiezen voor {{productName}}

Ontdek de voordelen die specifiek afstemmen op de behoeften van {{audienceName}}.`,
  PRODUCT_FEATURE: `# {{featureName}} van {{productName}}

{{featureDescription}}

## Voordelen van {{featureName}}

{{featureBenefits}}

## {{featureName}} optimaal benutten in {{productName}}

Leer hoe u het meeste uit {{featureName}} haalt binnen {{productName}}.`,
  CATEGORY_FEATURE: `# {{featureName}} in {{categoryName}}

{{featureDescription}}

## Voordelen

{{benefits}}

## Meer over {{categoryName}}

Ontdek alle functies binnen de {{categoryName}} categorie.`,
  INDUSTRY_SERVICE: `# {{serviceName}} voor de {{industryName}} branche

## Uitdagingen in de {{industryName}}

{{industryChallenges}}

## Onze {{serviceName}} oplossing

{{serviceSolution}}

## Resultaten in de {{industryName}}

Ontdek hoe onze {{serviceName}} de {{industryName}} branche transformeert.`,
  INTEGRATION_PLATFORM: `# {{integrationName}} integratie met {{platformName}}

## Installatie

{{setupSteps}}

## Voordelen

{{benefits}}

## Aan de slag met {{integrationName}} en {{platformName}}

Verbind {{integrationName}} met {{platformName}} voor een naadloze workflow.`,
  COMPARISON: `# {{itemA}} vs {{itemB}}: Een volledige vergelijking

## Vergelijkingscriteria

{{comparisonCriteria}}

## {{itemA}}

{{verdictA}}

## {{itemB}}

{{verdictB}}

## Conclusie

Een gedetailleerde vergelijking tussen {{itemA}} en {{itemB}} op basis van {{comparisonCriteria}}.`,
  GLOSSARY: `# {{term}} — Definitie

{{definition}}

## Voorbeeld

{{example}}

## Gerelateerde termen

{{relatedTerms}}

## Meer weten over {{term}}?

Leer meer over {{term}} en gerelateerde concepten in onze uitgebreide woordenlijst.`,
};

/**
 * Default target keyword patterns for each template type.
 */
const DEFAULT_KEYWORD_PATTERNS: Record<TemplateType, string> = {
  SERVICE_LOCATION: '{{serviceName}} {{locationName}}',
  PRODUCT_USE_CASE: '{{productName}} {{useCaseName}}',
  PRODUCT_AUDIENCE: '{{productName}} {{audienceName}}',
  PRODUCT_FEATURE: '{{productName}} {{featureName}}',
  CATEGORY_FEATURE: '{{categoryName}} {{featureName}}',
  INDUSTRY_SERVICE: '{{serviceName}} {{industryName}}',
  INTEGRATION_PLATFORM: '{{integrationName}} {{platformName}}',
  COMPARISON: '{{itemA}} vs {{itemB}}',
  GLOSSARY: '{{term}} betekenis',
};

// ============================================================================
// Template Manager Functions
// ============================================================================

/**
 * Get the default variable set for a template type.
 * @param templateType - The template type to get defaults for
 * @returns Array of default variable definitions
 */
export function getDefaultVariables(templateType: TemplateType): ProgrammaticVariable[] {
  return [...DEFAULT_VARIABLES[templateType]];
}

/**
 * Get the default content template for a template type.
 * @param templateType - The template type to get defaults for
 * @returns Default content template string with {{variable}} placeholders
 */
export function getDefaultContentTemplate(templateType: TemplateType): string {
  return DEFAULT_CONTENT_TEMPLATES[templateType];
}

/**
 * Get the default target keyword pattern for a template type.
 * @param templateType - The template type to get defaults for
 * @returns Default keyword pattern with {{variable}} placeholders
 */
export function getDefaultKeywordPattern(templateType: TemplateType): string {
  return DEFAULT_KEYWORD_PATTERNS[templateType];
}

/**
 * Create a new programmatic SEO template for a project.
 *
 * If the config doesn't specify variables or contentTemplate, defaults for
 * the given template type are used.
 *
 * @param projectId - The project to create the template for
 * @param config - Template configuration
 * @param name - Human-readable template name
 * @param description - Optional template description
 * @returns The created template database record
 */
export async function createTemplate(
  projectId: string,
  config: ProgrammaticTemplateConfig,
  name?: string,
  description?: string
) {
  const variables = config.variables.length > 0
    ? config.variables
    : getDefaultVariables(config.templateType);

  const contentTemplate = config.contentTemplate || getDefaultContentTemplate(config.templateType);
  const targetKeyword = config.targetKeyword || getDefaultKeywordPattern(config.templateType);

  const templateName = name || TEMPLATE_TYPE_LABELS[config.templateType];

  const template = await db.programmaticTemplate.create({
    data: {
      projectId,
      name: templateName,
      description: description || null,
      templateType: config.templateType,
      contentTemplate,
      variables: JSON.stringify(variables),
      targetKeyword,
      dataRows: JSON.stringify([]),
      qualityGates: JSON.stringify(config.qualityGates),
      maxPages: 100,
      publishedCount: 0,
      isActive: true,
    },
  });

  return template;
}

/**
 * Update an existing programmatic template.
 *
 * @param templateId - The template to update
 * @param config - Partial configuration to merge with existing
 * @returns The updated template database record
 * @throws Error if the template is not found or has been deleted
 */
export async function updateTemplate(
  templateId: string,
  config: Partial<
    ProgrammaticTemplateConfig & {
      name?: string;
      description?: string;
      maxPages?: number;
      isActive?: boolean;
    }
  >
) {
  const existing = await db.programmaticTemplate.findFirst({
    where: { id: templateId },
  });

  if (!existing || existing.deletedAt) {
    throw new Error(`Sjabloon met ID "${templateId}" niet gevonden of verwijderd.`);
  }

  const updateData: Record<string, unknown> = {};

  if (config.name !== undefined) updateData.name = config.name;
  if (config.description !== undefined) updateData.description = config.description;
  if (config.isActive !== undefined) updateData.isActive = config.isActive;
  if (config.maxPages !== undefined) updateData.maxPages = config.maxPages;

  if (config.templateType !== undefined) updateData.templateType = config.templateType;

  if (config.variables !== undefined) {
    updateData.variables = JSON.stringify(config.variables);
  }

  if (config.contentTemplate !== undefined) {
    updateData.contentTemplate = config.contentTemplate;
  }

  if (config.targetKeyword !== undefined) {
    updateData.targetKeyword = config.targetKeyword;
  }

  if (config.qualityGates !== undefined) {
    updateData.qualityGates = JSON.stringify(config.qualityGates);
  }

  const updated = await db.programmaticTemplate.update({
    where: { id: templateId },
    data: updateData,
  });

  return updated;
}

/**
 * Get a template with its associated pages.
 *
 * @param templateId - The template to retrieve
 * @returns Template with pages, or null if not found
 */
export async function getTemplate(templateId: string): Promise<TemplateWithPages | null> {
  const template = await db.programmaticTemplate.findFirst({
    where: { id: templateId },
    include: {
      pages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!template || template.deletedAt) return null;

  const variables: ProgrammaticVariable[] = template.variables
    ? JSON.parse(template.variables)
    : [];

  const dataRows: ProgrammaticDataRows = template.dataRows
    ? JSON.parse(template.dataRows)
    : [];

  const qualityGates = template.qualityGates
    ? JSON.parse(template.qualityGates)
    : {};

  const pages: ProgrammaticPageSummary[] = template.pages.map((p) => ({
    id: p.id,
    title: p.title ?? undefined,
    slug: p.slug ?? undefined,
    status: p.status,
    qualityScore: p.qualityScore,
    rejectionReasons: p.rejectionReasons ? JSON.parse(p.rejectionReasons) : undefined,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  return {
    id: template.id,
    projectId: template.projectId,
    name: template.name,
    description: template.description ?? undefined,
    templateType: template.templateType as TemplateType,
    dataRowCount: dataRows.length,
    pageCount: template.pages.length,
    approvedCount: template.pages.filter((p) => p.status === 'APPROVED').length,
    publishedCount: template.publishedCount,
    maxPages: template.maxPages,
    isActive: template.isActive,
    variables,
    contentTemplate: template.contentTemplate,
    targetKeyword: template.targetKeyword ?? '',
    qualityGates,
    dataRows,
    pages,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

/**
 * List all active templates for a project.
 *
 * @param projectId - The project to list templates for
 * @returns Array of template summaries
 */
export async function listTemplates(projectId: string): Promise<TemplateSummary[]> {
  const templates = await db.programmaticTemplate.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    include: {
      pages: {
        where: { deletedAt: null },
        select: {
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return templates.map((t) => {
    const dataRows: ProgrammaticDataRows = t.dataRows ? JSON.parse(t.dataRows) : [];
    return {
      id: t.id,
      projectId: t.projectId,
      name: t.name,
      description: t.description ?? undefined,
      templateType: t.templateType as TemplateType,
      dataRowCount: dataRows.length,
      pageCount: t.pages.length,
      approvedCount: t.pages.filter((p) => p.status === 'APPROVED').length,
      publishedCount: t.publishedCount,
      maxPages: t.maxPages,
      isActive: t.isActive,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  });
}

/**
 * Soft-delete a template by setting deletedAt.
 *
 * @param templateId - The template to delete
 * @throws Error if the template is not found
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  const existing = await db.programmaticTemplate.findFirst({
    where: { id: templateId },
  });

  if (!existing) {
    throw new Error(`Sjabloon met ID "${templateId}" niet gevonden.`);
  }

  await db.programmaticTemplate.update({
    where: { id: templateId },
    data: { deletedAt: new Date(), isActive: false },
  });
}

/**
 * Add data rows to a template.
 *
 * Rows are appended to the existing data rows. Each row must contain
 * values for the required variables defined in the template.
 *
 * @param templateId - The template to add data rows to
 * @param rows - Array of data rows to add
 * @throws Error if the template is not found or required variables are missing
 */
export async function addDataRows(
  templateId: string,
  rows: ProgrammaticDataRows
): Promise<void> {
  const template = await db.programmaticTemplate.findFirst({
    where: { id: templateId },
  });

  if (!template || template.deletedAt) {
    throw new Error(`Sjabloon met ID "${templateId}" niet gevonden of verwijderd.`);
  }

  // Validate required variables
  const variables: ProgrammaticVariable[] = template.variables
    ? JSON.parse(template.variables)
    : [];
  const requiredVars = variables.filter((v) => v.required).map((v) => v.name);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    for (const varName of requiredVars) {
      if (row[varName] === undefined || row[varName] === '') {
        throw new Error(
          `Gegevensrij ${i + 1}: verplichte variabele "${varName}" ontbreekt of is leeg.`
        );
      }
    }
  }

  const existingRows: ProgrammaticDataRows = template.dataRows
    ? JSON.parse(template.dataRows)
    : [];

  const updatedRows = [...existingRows, ...rows];

  await db.programmaticTemplate.update({
    where: { id: templateId },
    data: { dataRows: JSON.stringify(updatedRows) },
  });
}

// ============================================================================
// Template Rendering Helpers
// ============================================================================

/**
 * Render a template string by replacing {{variable}} placeholders with data.
 *
 * @param template - The template string with {{variable}} placeholders
 * @param data - The data row to fill in
 * @returns The rendered string with placeholders replaced
 */
export function renderTemplate(
  template: string,
  data: Record<string, string | number>
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(placeholder, String(value));
  }
  return rendered;
}

/**
 * Generate a slug from a string (Dutch-friendly).
 *
 * Converts to lowercase, replaces special characters, and removes non-alphanumeric chars.
 *
 * @param text - The text to slugify
 * @returns A URL-friendly slug
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract a title from rendered content.
 * Looks for the first H1 heading (# ) in Markdown.
 *
 * @param renderedContent - The rendered content
 * @returns The extracted title or a fallback
 */
export function extractTitle(renderedContent: string): string {
  const h1Match = renderedContent.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  // Fallback: first non-empty line
  const firstLine = renderedContent.split('\n').find((l) => l.trim().length > 0);
  return firstLine?.trim() || 'Zonder titel';
}

/**
 * Preview a single page by rendering the template with a specific data row.
 *
 * @param templateId - The template to preview
 * @param rowIndex - The index of the data row to use
 * @returns A template preview with rendered content
 * @throws Error if the template or row is not found
 */
export async function previewTemplate(
  templateId: string,
  rowIndex: number
): Promise<TemplatePreview> {
  const template = await db.programmaticTemplate.findFirst({
    where: { id: templateId },
  });

  if (!template || template.deletedAt) {
    throw new Error(`Sjabloon met ID "${templateId}" niet gevonden of verwijderd.`);
  }

  const dataRows: ProgrammaticDataRows = template.dataRows
    ? JSON.parse(template.dataRows)
    : [];

  if (rowIndex < 0 || rowIndex >= dataRows.length) {
    throw new Error(
      `Gegevensrij index ${rowIndex} is buiten bereik. Beschikbare rijen: 0-${dataRows.length - 1}.`
    );
  }

  const rowData = dataRows[rowIndex];
  const rendered = renderTemplate(template.contentTemplate, rowData);
  const targetKeyword = renderTemplate(template.targetKeyword || '', rowData);
  const title = extractTitle(rendered);
  const slug = generateSlug(title);

  return {
    rendered,
    rowData,
    targetKeyword,
    title,
    slug,
  };
}

/**
 * Preview multiple pages by rendering the template with the first N data rows.
 *
 * @param templateId - The template to preview
 * @param count - Number of previews to generate
 * @returns Array of template previews
 * @throws Error if the template is not found
 */
export async function previewBulk(
  templateId: string,
  count: number
): Promise<TemplatePreview[]> {
  const template = await db.programmaticTemplate.findFirst({
    where: { id: templateId },
  });

  if (!template || template.deletedAt) {
    throw new Error(`Sjabloon met ID "${templateId}" niet gevonden of verwijderd.`);
  }

  const dataRows: ProgrammaticDataRows = template.dataRows
    ? JSON.parse(template.dataRows)
    : [];

  const previewCount = Math.min(count, dataRows.length);
  const previews: TemplatePreview[] = [];

  for (let i = 0; i < previewCount; i++) {
    const rowData = dataRows[i];
    const rendered = renderTemplate(template.contentTemplate, rowData);
    const targetKeyword = renderTemplate(template.targetKeyword || '', rowData);
    const title = extractTitle(rendered);
    const slug = generateSlug(title);

    previews.push({ rendered, rowData, targetKeyword, title, slug });
  }

  return previews;
}
