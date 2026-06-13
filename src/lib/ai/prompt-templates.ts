// ============================================================================
// AI Provider Layer — Prompt Template System
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Built-in prompt templates for SEO-specific AI generation tasks.
// Templates are in Dutch by default, targeting the Dutch SEO market.
// Supports variable interpolation with {{variable}} syntax and version tracking.
// ============================================================================

import { db } from '@/lib/db';
import type { BuiltinPromptTemplate, AIMessage } from './types';

// ============================================================================
// Built-in Prompt Templates
// ============================================================================

/**
 * Registry of all built-in prompt templates for SEOCoach.
 * Each template is designed for a specific SEO content generation task
 * and is written in Dutch for the Dutch market.
 *
 * Template variables use the {{variableName}} syntax for interpolation.
 */
export const BUILTIN_TEMPLATES: BuiltinPromptTemplate[] = [
  // --------------------------------------------------------------------------
  // Content Brief Generation
  // --------------------------------------------------------------------------
  {
    id: 'content-brief',
    name: 'Content Brief Generator',
    description:
      'Genereer een uitgebreide content brief in het Nederlands met SEO-richtlijnen, structuur en doelgroepanalyse.',
    template: `Je bent een ervaren SEO-strateg voor de Nederlandse markt.

Genereer een uitgebreide content brief voor het volgende onderwerp:

**Hoofdzoekwoord:** {{keyword}}
**Secundaire zoekwoorden:** {{secondaryKeywords}}
**Doelgroep:** {{targetAudience}}
**Doel:** {{contentGoal}}
**Gewenste woordlengte:** {{wordCount}}

De content brief moet bevatten:
1. **Titelsuggestie** — Een pakkende, SEO-geoptimaliseerde titel (max 60 tekens)
2. **Meta-beschrijving** — Een overtuigende meta-beschrijving (max 155 tekens)
3. **Zoekintentie** — Classificatie (informatief, transactioneel, navigatie, commercieel onderzoek)
4. **Doelgroepanalyse** — Wie zoekt hiernaar en waarom
5. **Contentstructuur** — H2/H3koppen met korte beschrijvingen
6. **Belangrijkste aandachtspunten** — Wat moet de content absoluut bevatten
7. **Interne linkkansen** — Welke gerelateerde pagina's moeten worden gelinkt
8. **Call-to-action** — Gewenste actie na het lezen

Geef de brief in gestructureerd Nederlands.`,
    category: 'brief',
    version: '1.0',
    variables: [
      'keyword',
      'secondaryKeywords',
      'targetAudience',
      'contentGoal',
      'wordCount',
    ],
    systemMessage:
      'Je bent een professionele SEO-contentstrateg gespecialiseerd in de Nederlandse markt. Je output is altijd in het Nederlands, gestructureerd en actiegericht.',
  },

  // --------------------------------------------------------------------------
  // Content Draft Generation
  // --------------------------------------------------------------------------
  {
    id: 'content-draft',
    name: 'Content Draft Generator',
    description:
      'Genereer een SEO-geoptimaliseerde content draft in het Nederlands op basis van een content brief.',
    template: `Je bent een ervaren SEO-contentwriter voor de Nederlandse markt.

Schrijf een volledige, SEO-geoptimaliseerde content draft op basis van de volgende brief:

**Onderwerp:** {{topic}}
**Hoofdzoekwoord:** {{keyword}}
**Secundaire zoekwoorden:** {{secondaryKeywords}}
**Tone of voice:** {{toneOfVoice}}
**Doelgroep:** {{targetAudience}}
**Gewenste woordlengte:** {{wordCount}}
**Structuur:** {{outline}}

Vereisten:
- Gebruik het hoofdzoekwoord natuurlijk in de eerste alinea
- Verwerk secundaire zoekwoorden organisch door de tekst
- Gebruik heldere H2/H3-structuur
- Schrijf actieve, toegankelijke zinnen (B1-niveau)
- Voeg een interne linksuggestie toe waar relevant
- Sluit af met een duidelijke call-to-action
- Gebruik Nederlandse spelling en grammatica

Schrijf de volledige content draft in het Nederlands.`,
    category: 'draft',
    version: '1.0',
    variables: [
      'topic',
      'keyword',
      'secondaryKeywords',
      'toneOfVoice',
      'targetAudience',
      'wordCount',
      'outline',
    ],
    systemMessage:
      'Je bent een professionele SEO-contentwriter die vloeiend en overtuigend in het Nederlands schrijft. Je content is altijd geoptimaliseerd voor zowel zoekmachines als lezers.',
  },

  // --------------------------------------------------------------------------
  // Search Intent Classification
  // --------------------------------------------------------------------------
  {
    id: 'intent-classification',
    name: 'Search Intent Classifier',
    description:
      'Classificeer de zoekintentie van zoekwoorden in informatief, navigatie, transactioneel of commercieel onderzoek.',
    template: `Classificeer de zoekintentie voor de volgende zoekwoorden:

{{keywords}}

Geef voor elk zoekwoord:
1. **Zoekwoord**
2. **Intentie** — Een van: informatief, navigatie, transactioneel, commercieel onderzoek
3. **Uitleg** — Waarom deze classificatie
4. **Funnel-fase** — Top, Midden of Bodem
5. **Contentadvies** — Welk type content past het beste

Geef het resultaat als gestructureerde JSON met deze velden:
{
  "classifications": [
    {
      "keyword": "...",
      "intent": "informatief|navigatie|transactioneel|commercieel_onderzoek",
      "explanation": "...",
      "funnelStage": "top|middle|bottom",
      "contentAdvice": "..."
    }
  ]
}`,
    category: 'intent',
    version: '1.0',
    variables: ['keywords'],
    systemMessage:
      'Je bent een SEO-analist gespecialiseerd in zoekintentie-classificatie. Analyseer zoekwoorden nauwkeurig en geef gestructureerde output in JSON-formaat.',
  },

  // --------------------------------------------------------------------------
  // Content Quality Analysis
  // --------------------------------------------------------------------------
  {
    id: 'quality-analysis',
    name: 'Content Quality Analyzer',
    description:
      'Analyseer de kwaliteit van content op SEO-relevantie, leesbaarheid, en E-E-A-T signalen.',
    template: `Analyseer de volgende content op kwaliteit en SEO-effectiviteit:

**URL/Pagina:** {{url}}
**Doelzoekwoord:** {{keyword}}
**Content:**
{{content}}

Beoordeel de content op de volgende criteria (schaal 1-10):

1. **Zoekwoordoptimalisatie** — Is het doelzoekwoord goed geplaatst?
2. **Leesbaarheid** — Is de tekst toegankelijk voor de doelgroep?
3. **Contentdiepte** — Is het onderwerp voldoende uitgediept?
4. **E-E-A-T signalen** — Ervaring, Expertise, Autoriteit, Betrouwbaarheid
5. **Structuur** — Zijn koppen en alinea's logisch opgebouwd?
6. **Unieke waarde** — Biedt de content iets dat concurrenten niet hebben?
7. **Call-to-action** — Is er een duidelijke vervolgstap?
8. **Mobiel-vriendelijk** — Is de content geschikt voor mobiel?

Geef ook:
- **Totale scorescore** (1-100)
- **Top 3 verbeterpunten** met prioriteit
- **Concreet actieplan** per verbeterpunt

Geef de analyse in het Nederlands.`,
    category: 'quality',
    version: '1.0',
    variables: ['url', 'keyword', 'content'],
    systemMessage:
      'Je bent een kritische SEO-contentanalist met diepe kennis van Google E-E-A-T richtlijnen en de Nederlandse contentmarkt. Wees constructief maar eerlijk in je beoordeling.',
  },

  // --------------------------------------------------------------------------
  // Meta Description Generation
  // --------------------------------------------------------------------------
  {
    id: 'meta-description',
    name: 'Meta Description Generator',
    description:
      'Genereer SEO-geoptimaliseerde meta descriptions in het Nederlands.',
    template: `Genereer 5 alternatieve meta descriptions voor de volgende pagina:

**Titel:** {{title}}
**Hoofdzoekwoord:** {{keyword}}
**Pagina-content samenvatting:** {{contentSummary}}
**Doelgroep:** {{targetAudience}}

Vereisten voor elke meta description:
- Maximaal 155 tekens
- Bevat het hoofdzoekwoord natuurlijk
- Heeft een duidelijke call-to-action
- Is uniek en onderscheidend
- Spreekt de doelgroep aan

Geef elke meta description met:
- De tekst
- Tekenaantal
- Gebruikte CTA-type

Geef de resultaten in het Nederlands.`,
    category: 'meta',
    version: '1.0',
    variables: ['title', 'keyword', 'contentSummary', 'targetAudience'],
    systemMessage:
      'Je bent een SEO-copywriter die beknopte, overtuigende meta descriptions schrijft voor de Nederlandse markt. Elke meta description is een mini-advertentie in de zoekresultaten.',
  },

  // --------------------------------------------------------------------------
  // SEO Title Suggestions
  // --------------------------------------------------------------------------
  {
    id: 'title-suggestions',
    name: 'SEO Title Suggester',
    description:
      'Genereer SEO-geoptimaliseerde titelsuggesties in het Nederlands.',
    template: `Genereer 8 SEO-titelsuggesties voor de volgende pagina:

**Onderwerp:** {{topic}}
**Hoofdzoekwoord:** {{keyword}}
**Content-type:** {{contentType}}
**Doelgroep:** {{targetAudience}}
**Concurrerende titels:** {{competitorTitles}}

Vereisten voor elke titel:
- Maximaal 60 tekens
- Bevat het hoofdzoekwoord
- Is klikverlockend (geen clickbait)
- Is uniek ten opzichte van concurrenten
- Past bij het content-type

Categoriseer elke suggestie:
- **Informatief** — Feitelijke, educatieve titels
- **Lijstjes** — "7 manieren om..." of "Top 10..."
- **Hoe-tot** — "Zo doe je..."
- **Vraag** — "Wat is..." of "Hoe werkt..."
- **Vergelijking** — "X vs Y"

Geef voor elke titel:
- De titeltekst
- Tekenaantal
- Categorie
- Verwacht CTR-voordeel (hoog/midden/laag)

Geef de resultaten in het Nederlands.`,
    category: 'title',
    version: '1.0',
    variables: [
      'topic',
      'keyword',
      'contentType',
      'targetAudience',
      'competitorTitles',
    ],
    systemMessage:
      'Je bent een SEO-titelspecialist die de perfecte balans vindt tussen zoekmachineoptimalisatie en klikverleiding voor de Nederlandse markt.',
  },
];

// ============================================================================
// Template Rendering
// ============================================================================

/**
 * Render a prompt template by replacing {{variable}} placeholders with values.
 *
 * Supports the Mustache-style double-brace syntax. Variables that are not
 * provided are replaced with an empty string (not an error).
 *
 * @param templateId - The built-in template ID to render
 * @param variables - Key-value pairs to substitute into the template
 * @returns The rendered template string, or the raw template if no variables provided
 * @throws Error if the template ID is not found
 *
 * @example
 * ```typescript
 * const rendered = renderTemplate('content-brief', {
 *   keyword: 'SEO tools Nederland',
 *   secondaryKeywords: 'SEO software, zoekwoord onderzoek',
 *   targetAudience: 'Nederlandse marketeers',
 *   contentGoal: 'Informeren en converteren',
 *   wordCount: '2000',
 * });
 * ```
 */
export function renderTemplate(
  templateId: string,
  variables: Record<string, string>
): string {
  const template = BUILTIN_TEMPLATES.find((t) => t.id === templateId);

  if (!template) {
    throw new Error(`Built-in template "${templateId}" not found`);
  }

  let rendered = template.template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    rendered = rendered.replaceAll(placeholder, value);
  }

  // Replace any remaining unreplaced variables with empty strings
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, '');

  return rendered;
}

/**
 * Render a template and return it as an array of AIMessage objects,
 * splitting the system message from the user prompt if the template
 * defines a systemMessage.
 *
 * @param templateId - The built-in template ID to render
 * @param variables - Key-value pairs to substitute into the template
 * @returns Array of AIMessage objects ready for AI generation
 *
 * @example
 * ```typescript
 * const messages = renderTemplateAsMessages('content-brief', {
 *   keyword: 'SEO tools',
 *   secondaryKeywords: 'SEO software',
 *   targetAudience: 'Marketeers',
 *   contentGoal: 'Informeren',
 *   wordCount: '2000',
 * });
 * // messages[0] = { role: 'system', content: '...' }
 * // messages[1] = { role: 'user', content: '...' }
 * ```
 */
export function renderTemplateAsMessages(
  templateId: string,
  variables: Record<string, string>
): AIMessage[] {
  const template = BUILTIN_TEMPLATES.find((t) => t.id === templateId);

  if (!template) {
    throw new Error(`Built-in template "${templateId}" not found`);
  }

  const messages: AIMessage[] = [];

  // Add system message if defined
  if (template.systemMessage) {
    messages.push({
      role: 'system',
      content: template.systemMessage,
    });
  }

  // Add the rendered template as user message
  const renderedContent = renderTemplate(templateId, variables);
  messages.push({
    role: 'user',
    content: renderedContent,
  });

  return messages;
}

/**
 * Get a built-in template by ID.
 *
 * @param templateId - The template ID to look up
 * @returns The template definition, or undefined if not found
 */
export function getBuiltinTemplate(
  templateId: string
): BuiltinPromptTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === templateId);
}

/**
 * List all built-in template IDs and their metadata.
 *
 * @returns Array of template summaries
 */
export function listBuiltinTemplates(): Array<{
  id: string;
  name: string;
  category: string;
  variables: string[];
}> {
  return BUILTIN_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    variables: t.variables,
  }));
}

// ============================================================================
// Database-backed Template Management
// ============================================================================

/**
 * Get the active prompt template from the database for a specific category and provider.
 *
 * Looks for a template matching the given category that is active and
 * associated with the specified provider. Returns null if no template is found.
 *
 * @param category - The template category (e.g. "brief", "draft", "quality")
 * @param providerId - The AI provider to look up templates for
 * @returns The PromptTemplate record, or null if not found
 */
export async function getTemplate(
  category: string,
  providerId: string
): Promise<{
  id: string;
  name: string;
  description: string | null;
  template: string;
  version: string;
  variables: string | null;
  category: string | null;
  isActive: boolean;
} | null> {
  const template = await db.promptTemplate.findFirst({
    where: {
      category,
      providerId,
      isActive: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  return template ?? null;
}

/**
 * Seed built-in templates into the database for a specific provider.
 *
 * Creates database records for all built-in templates that don't already
 * exist for the given provider. Existing templates are not overwritten
 * (uses upsert by providerId + name + version unique constraint).
 *
 * @param providerId - The AI provider ID to associate templates with
 * @returns Number of templates created
 */
export async function seedBuiltinTemplates(providerId: string): Promise<number> {
  let created = 0;

  for (const builtin of BUILTIN_TEMPLATES) {
    try {
      await db.promptTemplate.upsert({
        where: {
          providerId_name_version: {
            providerId,
            name: builtin.name,
            version: builtin.version,
          },
        },
        create: {
          providerId,
          name: builtin.name,
          description: builtin.description,
          template: builtin.template,
          version: builtin.version,
          variables: JSON.stringify(builtin.variables),
          category: builtin.category,
          isActive: true,
        },
        update: {
          // Only update if the existing template is still at the same version
          // but the content has changed (template updates)
          description: builtin.description,
          variables: JSON.stringify(builtin.variables),
          category: builtin.category,
        },
      });
      created++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[PromptTemplates] Failed to seed template "${builtin.name}": ${msg}`
      );
    }
  }

  return created;
}

/**
 * Get all templates for a provider, grouped by category.
 *
 * @param providerId - The AI provider ID
 * @returns Record mapping category names to arrays of template summaries
 */
export async function getTemplatesByCategory(
  providerId: string
): Promise<Record<string, Array<{ id: string; name: string; version: string }>>> {
  const templates = await db.promptTemplate.findMany({
    where: {
      providerId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      version: true,
      category: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  const grouped: Record<string, Array<{ id: string; name: string; version: string }>> = {};

  for (const template of templates) {
    const cat = template.category ?? 'uncategorized';
    if (!grouped[cat]) {
      grouped[cat] = [];
    }
    grouped[cat].push({
      id: template.id,
      name: template.name,
      version: template.version,
    });
  }

  return grouped;
}
