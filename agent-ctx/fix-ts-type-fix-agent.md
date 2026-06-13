# Task ID: fix-ts
# Agent: Type Fix Agent

## Work Log

Fixed TypeScript errors in 8 project source files:

### 1. `src/app/[locale]/projects/[id]/issues/page.tsx`
- **Line 617**: Replaced undefined `{apos}` with `{"'"}` to render an apostrophe character
- **Line 580/261**: Changed `parseEvidence` return type from `unknown` to `Record<string, unknown>[] | Record<string, unknown> | string | null` to fix `unknown` not assignable to `ReactNode` error

### 2. `src/app/api/projects/[id]/keywords/[keywordId]/score/route.ts`
- **Line 33**: Added `projectId` as second argument to `calculateAndSaveOpportunityScore()` (was missing required parameter)
- **Line 36**: Replaced `calculateScoreDetails(keywordId)` with `getScoreTrace(keywordId)` since `calculateScoreDetails` requires a `KeywordWithMetrics` object, not a string ID. Updated import accordingly.

### 3. `src/app/api/projects/[id]/keywords/import/route.ts`
- **Line 68**: Changed `importKeywords(projectId, parsed, { onDuplicate: 'update' })` to `importKeywords(projectId, parsed, 'csv')` to match the function signature which expects `source: 'manual' | 'csv' | 'ai'` as the third argument

### 4. `src/lib/content/quality-analyzer.ts`
- **Lines 526, 577**: Wrapped `keywordPresent` assignment with `!!()` to convert `boolean | "" | undefined` to `boolean`. The expression `targetKeyword && content.toLowerCase().includes(...)` can evaluate to `""` or `undefined`, but the consuming functions expect `boolean | undefined`.

### 5. `src/lib/crawler/crawler.ts`
- **Lines 586, 593, 642**: Changed `determinePageStatus()` return type from `string` to `'OK' | 'REDIRECT' | 'CLIENT_ERROR' | 'SERVER_ERROR' | 'BLOCKED' | 'TIMEOUT'` and `determineIndexability()` return type from `string` to `'INDEXABLE' | 'NOINDEX' | 'BLOCKED_ROBOTS' | 'CANONICALIZED' | 'BLOCKED_META' | 'UNKNOWN'` to match Prisma enum types.

### 6. `src/lib/crawler/renderer.ts`
- **Lines 156-191**: Added `?? null` to all `textDiff()` calls where `sourceData`/`renderedData` properties are `string | null | undefined` but `textDiff` expects `string | null`. Applied to `title`, `description`, `h1`, `canonicalUrl`, and `metaRobots` comparisons.

### 7. `src/lib/rules/rules/sitemap-issues.ts`
- **Line 96**: Changed `expected: true` to `expected: 'true'` since `IssueEvidence.expected` is `string | number`, not `boolean`.

### 8. `src/lib/rules/session-analyzer.ts`
- **Lines 82-89**: Changed `safeParseJson<T>` type parameters to include `| null` (e.g., `safeParseJson<string[] | null>` instead of `safeParseJson<string[]>`) and replaced `null as T | null` fallback values with simple `null`. This fixes `null` not being assignable to array types.

## Verification
All 8 target files now compile without TypeScript errors. Remaining errors in the project are in files outside the task scope (organizations/route.ts, i18n/routing.ts, auth.ts).
