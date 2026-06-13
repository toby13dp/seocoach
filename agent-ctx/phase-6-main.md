# Phase 6 — GEO & Competitive Intelligence

## Task ID: phase-6-geo-competitive-intelligence
## Agent: main

## Summary
Created the complete Phase 6 (GEO & Competitive Intelligence) for the SEOCoach platform, including:
- 5 backend library modules
- 15 API route files
- 3 frontend pages + 1 page update
- 5 test files

## Files Created

### Backend Libraries (5 files)
1. `/src/lib/geo/index.ts` — GEO readiness analysis with 15 categories, summary calculation, dismiss/undismiss
2. `/src/lib/ai-visibility/index.ts` — AI visibility prompt library, test management, simulation, CSV import, summary
3. `/src/lib/competitor/index.ts` — Competitor CRUD, crawl/snapshot, change detection
4. `/src/lib/trends/index.ts` — Trend tracking, internal search import
5. `/src/lib/authority/index.ts` — Authority/backlink records, CSV import, outreach campaigns

### API Routes (15 files)
1. `/src/app/api/projects/[id]/geo/route.ts` — GET summary/checks, POST run analysis
2. `/src/app/api/projects/[id]/geo/[checkId]/route.ts` — GET check details, PATCH dismiss/undismiss
3. `/src/app/api/projects/[id]/ai-visibility/prompts/route.ts` — GET prompts/clusters, POST create prompt
4. `/src/app/api/projects/[id]/ai-visibility/prompts/[promptId]/route.ts` — GET/PATCH/DELETE prompt
5. `/src/app/api/projects/[id]/ai-visibility/results/route.ts` — GET filtered results, POST manual test
6. `/src/app/api/projects/[id]/ai-visibility/simulate/route.ts` — POST run simulation
7. `/src/app/api/projects/[id]/ai-visibility/import/route.ts` — POST CSV import
8. `/src/app/api/projects/[id]/competitors/route.ts` — GET list, POST add
9. `/src/app/api/projects/[id]/competitors/[competitorId]/route.ts` — GET/PATCH/DELETE
10. `/src/app/api/projects/[id]/competitors/[competitorId]/crawl/route.ts` — POST trigger crawl
11. `/src/app/api/projects/[id]/competitors/[competitorId]/changes/route.ts` — GET changes
12. `/src/app/api/projects/[id]/trends/route.ts` — GET list, POST record/import
13. `/src/app/api/projects/[id]/authority/route.ts` — GET records+summary, POST add/import
14. `/src/app/api/projects/[id]/authority/[recordId]/route.ts` — GET/PATCH (mark as lost, notes)
15. `/src/app/api/projects/[id]/outreach/route.ts` — GET campaigns, POST create

### Frontend Pages (3 new + 1 updated)
1. `/src/app/[locale]/projects/[id]/geo/page.tsx` — GEO-gereedheid page with circular gauge, 15 category cards
2. `/src/app/[locale]/projects/[id]/ai-visibility/page.tsx` — AI-zichtbaarheid page with prompts, results, simulation
3. `/src/app/[locale]/projects/[id]/competitors/page.tsx` — Concurrentieanalyse page with cards, change feed
4. Updated `/src/app/[locale]/projects/[id]/page.tsx` — Added 3 Phase 6 navigation cards

### Tests (5 files)
1. `/src/__tests__/geo/analyzer.test.ts` — 15 categories, real page data, summary, not AI visibility
2. `/src/__tests__/ai-visibility/prompt-library.test.ts` — CRUD, clusters, filters
3. `/src/__tests__/ai-visibility/test-manager.test.ts` — Manual test, simulation disclaimer, summary, CSV
4. `/src/__tests__/competitor/manager.test.ts` — CRUD, crawl/snapshot, change detection, no traffic/revenue
5. `/src/__tests__/authority/manager.test.ts` — CRUD, CSV import, mark as lost, summary

## Key Patterns Followed
- Auth: `getAuthenticatedUser()` + `validateProjectAccess()`
- JSON response format: `{ data, meta? }`
- Dutch error messages: 'Niet geauthenticeerd', 'Geen toegang', 'Interne serverfout'
- Frontend: shadcn/ui components, `'use client'`, framer-motion, Dutch UI text
- Tests: `bun:test`, mock Prisma client, Dutch assertions

## Lint Status
✅ ESLint passes cleanly
✅ Prisma schema in sync
