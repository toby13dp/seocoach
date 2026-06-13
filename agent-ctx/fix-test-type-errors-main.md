# Task: Fix TypeScript Type Errors in SEOCoach Phase 6 Test Files

## Summary

Fixed all TypeScript type errors across 3 test files by aligning function call signatures with the actual source implementations, constructing proper CSV strings for import tests, and correcting result type property access.

## Files Modified

### 1. `/home/z/my-project/src/__tests__/ai-visibility/prompt-library.test.ts`

**Fixes:**
- `createPrompt('proj-1', { name: '...', prompt: '...' })` → `createPrompt('proj-1', 'name', 'prompt')` — positional args matching signature `(projectId, name, prompt, clusterId?, funnelStage?, searchIntent?)`
- `createPrompt('proj-1', { name, prompt, clusterId, funnelStage, searchIntent })` → `createPrompt('proj-1', 'name', 'prompt', 'cluster-1', 'CONSIDERATION', 'COMMERCIAL_INVESTIGATION')`
- `createCluster('proj-1', { name: '...' })` → `createCluster('proj-1', 'name')` — positional args matching signature `(projectId, name, description?)`
- `createCluster('proj-1', { name, description })` → `createCluster('proj-1', 'name', 'description')`

### 2. `/home/z/my-project/src/__tests__/ai-visibility/test-manager.test.ts`

**Fixes:**
- `runLocalSimulation('proj-1', { promptText: '...' })` → `runLocalSimulation('proj-1', '...')` — positional args matching `createLocalSimulation(projectId, prompt, aiProvider?)`
- `runLocalSimulation('proj-1', { promptText, platform, model })` → `runLocalSimulation('proj-1', 'prompt', { model: '...' })` — aiProvider is 3rd arg with `{ providerId?, model? }`
- `importCsvResults('proj-1', [{...}, {...}])` → `importCsvResults('proj-1', 'prompt,platform,mentioned\n...')` — CSV string instead of object array
- `result.count` → `result.imported` — `AIVisibilityImportResult` has `imported`, not `count`
- `result.batchId).toContain('csv-')` → `toContain('csv_')` — actual format uses underscore
- `{ startDate, endDate }` → `{ dateFrom: new Date(...), dateTo: new Date(...) }` — `AIVisibilityFilters` uses `dateFrom`/`dateTo` as `Date` type
- Added missing mocks: `db.aIPromptLibrary.count`, `db.project.findUnique`, `@/lib/ai/provider-manager`

### 3. `/home/z/my-project/src/__tests__/authority/manager.test.ts`

**Fixes:**
- `importCsvBacklinks('proj-1', { records: [...] })` → `importCsvBacklinks('proj-1', 'source url,domain\n...')` — CSV string instead of object
- `result.count` → `result.imported` — `AuthorityImportResult` has `imported`, not `count`
- `result.batchId).toContain('csv-')` → `toContain('auth_')` — actual format is `auth_`
- `getAuthorityRecords` returns array, not `{ records, total }` — fixed assertions
- `summary.totalRecords` → `summary.total` — `AuthoritySummary` uses `total`
- `summary.activeLinks`/`summary.lostLinks` → `summary.byStatus['active']`/`summary.byStatus['lost']`
- Removed `summary.nofollowCount` and `summary.avgDomainAuthority` — don't exist in `AuthoritySummary`
- Added `summary.topDomains`, `summary.newLinks30Days`, `summary.lostLinks30Days` assertions
- Changed "avgDomainAuthority" test to "topDomains" test
- Changed "allows custom providerSource" test to "always sets providerSource to csv_import" — function hardcodes this
- `createOutreachCampaign('proj-1', { name, description, targetCount })` → `createOutreachCampaign('proj-1', 'name', 'description')` — positional args matching `createCampaign(projectId, name, description?)`
- Removed `targetCount` from assertion — not part of create data

## Verification

- `bun run lint` passes with no errors
- Dev server log shows no compilation issues
