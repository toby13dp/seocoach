# Task 4H: Programmatic SEO Module — Work Record

## Summary
Created the complete Programmatic SEO module at `/home/z/my-project/src/lib/programmatic/` with 5 files implementing template management, quality gates, page generation, and publishing workflows.

## Files Created

### 1. `types.ts`
- `ProgrammaticVariable` — name, label (Dutch), type (text|number|url|select), required, options?, defaultValue?, description (Dutch)
- `ProgrammaticDataRows` — Array of Record<string, string|number>
- `TemplateType` — Union of all 9 template type enum values
- `QualityGatesConfig` — Configurable quality gate thresholds
- `ProgrammaticTemplateConfig` — templateType, variables, contentTemplate, targetKeyword, qualityGates
- `QualityGateResult` — gateName (Dutch), passed, score (0-100), message (Dutch), details?
- `ProgrammaticGenerationResult` — totalGenerated, approved, rejected, rejectionReasons map
- `TemplatePreview` — rendered content, rowData, targetKeyword, title, slug
- `TemplateSummary` — List view summary of a template
- `TemplateWithPages` — Detailed template view with pages
- `ProgrammaticPageSummary` — Page summary for detail views

### 2. `template-manager.ts`
- Default variable sets for all 9 template types (SERVICE_LOCATION, PRODUCT_USE_CASE, PRODUCT_AUDIENCE, PRODUCT_FEATURE, CATEGORY_FEATURE, INDUSTRY_SERVICE, INTEGRATION_PLATFORM, COMPARISON, GLOSSARY)
- Default content templates and keyword patterns for each type
- `createTemplate()` — Save template to DB with defaults
- `updateTemplate()` — Update template with partial config
- `getTemplate()` — Get template with pages (returns TemplateWithPages)
- `listTemplates()` — List all templates for a project
- `deleteTemplate()` — Soft delete
- `addDataRows()` — Add data rows with required variable validation
- `renderTemplate()` — Replace {{variable}} placeholders with data
- `generateSlug()` — Dutch-friendly slug generation
- `extractTitle()` — Extract H1 title from rendered content
- `previewTemplate()` — Preview single row
- `previewBulk()` — Preview first N rows

### 3. `quality-gates.ts`
Implements `runQualityGates()` with 8 checks:

1. **Unieke gegevens vereist** (non-blocking) — Checks key variables differ between pages
2. **Minimale waardedrempel** (non-blocking) — 300+ words, title, 3+ data points
3. **Duplicaatcontrole** (BLOCKING) — Trigram similarity against existing pages, reject >80%
4. **Kannibalisatiecontrole** (non-blocking) — Keyword overlap with existing pages
5. **Sjabloonvolledigheid** (BLOCKING) — All {{variable}} placeholders filled, no empty sections
6. **Merkcontrole** (BLOCKING) — Prohibited terms/claims from brand profile
7. **Claimcontrole** (non-blocking) — Unsubstantiated claims detection (superlatives, absolutes)
8. **Interne linkcontrole** (non-blocking) — At least one internal link suggestion

Returns `QualityGateRunResult` with overall score (average), approval status, rejection reasons, and warnings.

### 4. `generator.ts`
- `generatePages()` — Generate pages for all data rows up to limit:
  1. Fill template with row data
  2. Use AI (`providerManager.fallbackGenerate()`) to expand with brand context
  3. Run quality gates
  4. Save as APPROVED or REJECTED with reasons
- `regeneratePage()` — Regenerate a single rejected page
- `publishApprovedPages()` — Publish approved pages respecting maxPages limit
- `setPublicationLimit()` — Set max publishable pages

### 5. `index.ts`
Barrel export of all public functions and types.

## Key Design Decisions
- All user-facing strings in Dutch (gate names, rejection reasons, descriptions, error messages)
- Quality gates are mandatory — no bypass mechanism
- Blocking gates (duplicate, template completeness, brand check) cause rejection
- Non-blocking gates generate warnings but don't block approval
- AI expansion includes brand context from BrandProfile
- Publication respects template-level maxPages limit
- Skips already-generated data rows on re-run
- Falls back to basic template rendering if AI generation fails

## Verification
- ESLint: Passed with zero errors
- All files properly import from `@/lib/db` and `@/lib/ai/provider-manager`
