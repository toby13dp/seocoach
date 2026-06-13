# Task 4B+4I: Source Grounding + Workflow + Decay & Pruning Workflows

## Agent: main

## Summary
Implemented three new modules for the SEOCoach platform's content management system:

### Module 1: Source Grounding (`/home/z/my-project/src/lib/content/source-grounding.ts`)
- **addContentSource** — Create ContentSource records with validation
- **listContentSources** — List/filter sources by project and brief
- **removeContentSource** — Soft delete with audit trail
- **selectSourcesForBrief** — Associate sources with briefs (project validation)
- **getSourcesForBrief** — Retrieve sources linked to a brief
- **checkClaimSupport** — Parse `[VERIFICATIE_NODIG]` markers, verify claims against sources using keyword matching + AI semantic analysis, mark as SUPPORTED/UNSUPPORTED/PARTIALLY_SUPPORTED with Dutch explanations. Returns clear warning when no sources selected.
- **importPageAsSource** — Import crawled Page as PAGE-type source (deduplicates by URL)
- **importBrandProfileAsSource** — Import BrandProfile as BRAND_PROFILE-type source

### Module 2: Content Workflow (`/home/z/my-project/src/lib/content/workflow.ts`)
14-step content creation workflow:
1. **startWorkflow** — Creates ContentBrief in DRAFT status
2. **selectOpportunity** — Associates keyword with brief
3. **selectContentType** — Stores content type in brief metadata (17 types with Dutch labels)
4. **generateBriefFromWorkflow** — AI-generated brief with title, audience, outline, etc.
5. **editOutline** — Update outline structure
6. **selectSourcesForWorkflow** — Delegate to source-grounding
7. **generateDraftFromWorkflow** — Delegate to draft-generator
8. **runQualityChecksFromWorkflow** — Delegate to quality-controls
9. **reviewClaimsFromWorkflow** — Delegate to source-grounding checkClaimSupport
10. **addInternalLinksFromWorkflow** — AI-powered internal link suggestions
11. **previewContent** — Clean content preview with stripped claim markers
12. **approveContent** — Approval with blocking findings + unsupported claims check
13. **saveAsCMSDraft** — Save to CMS (connection validation)
14. **scheduleOrPublish** — Schedule or immediate publish

Plus: **getWorkflowStatus**, **listWorkflows**, **contentTypeOptions** (17 types with Dutch labels/descriptions)

### Module 3: Decay & Pruning Workflows (`/home/z/my-project/src/lib/content/decay-workflow.ts`)
- **viewDecliningPages** — List pages sorted by decay percentage
- **generateUpdateBrief** — AI-generated update brief from decay record (CONTENT_UPDATE type)
- **compareContent** — Diff comparison with AI-powered analysis (improvements/risks in Dutch)
- **approveRevision** — Approval with blocking findings check, ContentChange record
- **publishUpdate** — Publish update, reset decay record to KEEP
- **monitorPostUpdateMetrics** — Placeholder with monitoring note and next check date
- **recommendPruningAction** — Enhanced recommendation with: traffic evidence, internal links affected, backlink risk, authority risk, search/conversion performance, redirect target, overall risk level — all in Dutch
- **approvePruning** — Explicit approval required for REMOVE/REDIRECT/NOINDEX, ContentChange record, rollback guidance in Dutch

### Barrel Export Update (`/home/z/my-project/src/lib/content/index.ts`)
- Added all new exports from source-grounding, workflow, and decay-workflow
- `recommendPruningAction` from decay-workflow aliased as `recommendPruningActionWorkflow` to avoid conflict with decay-detector export
- All existing exports preserved

## Key Design Decisions
- **Approval-first**: No content published without approval; no destructive pruning without explicit approval
- **Conservative claim checking**: NEVER marks content as verified when sources don't support it
- **Dutch-first**: All user-facing strings in Dutch
- **Existing module reuse**: Delegates to draft-generator, quality-controls, source-grounding, change-history
- **Content type storage**: Uses brief's `sources` JSON field for metadata (contentType, decayId, etc.) since no dedicated metadata column exists
- **AI fallback**: All AI-dependent functions have graceful fallbacks when AI is unavailable
