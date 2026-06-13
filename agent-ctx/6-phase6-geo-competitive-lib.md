# Phase 6 — GEO & Competitive Intelligence Library Modules

## Task
Create backend library modules under `/home/z/my-project/src/lib/` for Phase 6 (GEO & Competitive Intelligence) of the SEOCoach platform.

## Files Created (20 files across 5 modules)

### Module 1: `/src/lib/geo/` (3 files)
- **types.ts**: `GEO_CHECK_CATEGORIES` with Dutch labels/descriptions for all 15 categories, `GEO_CATEGORY_LABELS` mapping, `GeoCheckResult` and `GeoReadinessConfig` interfaces
- **analyzer.ts**: `analyzeGeoReadiness(projectId)` — analyzes crawled pages across 15 GEO categories using Page, TechnicalIssue, StructuredData, BrandProfile data. Creates GeoReadinessCheck records and updates GeoReadinessSummary. CRITICAL: Does NOT present as measured external AI visibility.
- **index.ts**: Barrel export with aliases for API route compatibility

### Module 2: `/src/lib/ai-visibility/` (5 files)
- **types.ts**: `SIMULATION_DISCLAIMER`, `AIVisibilityTestConfig`, `AIVisibilityMetrics`, `DEFAULT_DUTCH_PROMPTS` (10 Dutch market prompts), `SENTIMENT_NUMERIC_MAP`, `AI_VISIBILITY_CSV_COLUMNS`, `AIVisibilityImportResult`, `AIVisibilityFilters`
- **prompt-library.ts**: CRUD for prompts/clusters (`createPrompt`, `updatePrompt`, `deletePrompt`, `getPrompt`, `getPrompts`, `createCluster`, `getClusters`, `seedDefaultPrompts`)
- **csv-import.ts**: `importAIVisibilityCSV(projectId, csvContent)` — flexible column mapping (Dutch & English), sets method to CSV_IMPORT
- **test-manager.ts**: `createManualTest`, `createLocalSimulation` (always sets `isSimulation=true` and `simulationNote=SIMULATION_DISCLAIMER`), `calculateSummary` (Share of AI Voice, brand mention rate, etc.), `getResults`, `getSummary`
- **index.ts**: Barrel export with API compatibility aliases (`importCsvResults`, `runLocalSimulation`, `softDeletePrompt`)

### Module 3: `/src/lib/competitor/` (5 files)
- **types.ts**: `CHANGE_TYPE_LABELS` and `CHANGE_TYPE_DESCRIPTIONS` with Dutch labels for all 12 change types, `CompetitorFilters`, `CompetitorFeedFilters`
- **manager.ts**: `addCompetitor`, `updateCompetitor`, `removeCompetitor` (soft delete), `getCompetitors`, `getCompetitorDetails`
- **crawler.ts**: `crawlCompetitor(competitorId)` — respectful crawl with robots.txt, SSRF protection, crawl delays. Uses existing crawler/parser. `detectChanges(competitorId)` — compares snapshots, creates CompetitorChange records with Dutch summaries. CRITICAL: Does NOT invent traffic or revenue data.
- **feed.ts**: `getCompetitorFeed`, `dismissChange`, `getChangeDetails` — enriched with Dutch labels
- **index.ts**: Barrel export with aliases (`softDeleteCompetitor`, `getCompetitor`, `getCompetitorChanges`)

### Module 4: `/src/lib/trends/` (3 files)
- **types.ts**: `TREND_SOURCE_LABELS`, `TREND_DIRECTION_LABELS`, `TREND_DIRECTION_DESCRIPTIONS` (all Dutch), `TrendFilters`, `InternalSearchImportResult`, `KeywordTrendResult`, `SeasonalTrendResult`
- **tracker.ts**: `recordTrend`, `getTrends`, `detectKeywordTrends` (analyzes query performance data for rising/declining patterns), `detectSeasonalTrends` (identifies seasonal patterns from 12+ months of data), `importInternalSearch` (CSV import for internal search data)
- **index.ts**: Barrel export

### Module 5: `/src/lib/authority/` (4 files)
- **types.ts**: `AUTHORITY_TYPE_LABELS`, `AUTHORITY_TYPE_DESCRIPTIONS` (Dutch), `AuthorityRecordFilters`, `AuthorityImportResult`, `AUTHORITY_CSV_COLUMNS` (Ahrefs/Moz/Semrush format support), `AuthoritySummary`
- **manager.ts**: `addAuthorityRecord`, `getAuthorityRecords`, `markAsLost`, `getAuthorityRecord`, `updateAuthorityRecord`, `importAuthorityCSV` (flexible column mapping), `getAuthoritySummary`
- **outreach.ts**: `createCampaign`, `updateCampaign`, `addToCampaign`, `removeFromCampaign`, `getCampaigns`, `updateCampaignStats`. CRITICAL: Does NOT send outreach automatically.
- **index.ts**: Barrel export with aliases (`importCsvBacklinks`, `calculateAuthoritySummary`, `getOutreachCampaigns`, `createOutreachCampaign`)

## Key Design Decisions
1. All user-facing text is in Dutch (nl-NL)
2. Never fabricate data — only show metrics when real data exists
3. Simulations always display: "Simulatie – geen bewijs van werkelijke externe AI-zichtbaarheid."
4. Do not invent traffic or revenue for competitors
5. Do not send outreach automatically
6. Followed existing code patterns (keywords/, alerts/ modules)
7. Used strict TypeScript with Prisma client from `@/lib/db`
8. Added API compatibility aliases for routes created by previous agents

## Verification
- `bun run lint` — passes cleanly
- `npx tsc --noEmit` — zero errors in all 5 new modules
- Dev server running without issues
