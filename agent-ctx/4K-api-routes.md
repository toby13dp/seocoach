# Task 4K — Phase 4 API Routes for SEOCoach

## Agent: API Route Creator
## Date: 2026-03-04

## Summary
Created all 32 Phase 4 API route files for the SEOCoach SEO automation platform. All routes follow the existing project pattern with Dutch error messages, proper auth/tenant validation, and consistent JSON response format.

## Files Created

### 1. CMS Connections (3 files)
- `src/app/api/projects/[id]/cms-connections/route.ts` — GET (list), POST (create)
- `src/app/api/projects/[id]/cms-connections/[connectionId]/route.ts` — GET (details), PATCH (update), DELETE (soft delete)
- `src/app/api/projects/[id]/cms-connections/[connectionId]/test/route.ts` — POST (test connection, dispatches to WP or WC)

### 2. Internal Links (4 files)
- `src/app/api/projects/[id]/internal-links/route.ts` — GET (list with filters), POST (generate candidates)
- `src/app/api/projects/[id]/internal-links/[linkId]/route.ts` — GET (with diff), PATCH (approve/reject), DELETE (405 not allowed)
- `src/app/api/projects/[id]/internal-links/bulk-approve/route.ts` — POST (bulk approve)
- `src/app/api/projects/[id]/internal-links/[linkId]/rollback/route.ts` — POST (rollback published link)

### 3. Structured Data (2 files)
- `src/app/api/projects/[id]/structured-data/route.ts` — GET (list), POST (generate)
- `src/app/api/projects/[id]/structured-data/[dataId]/route.ts` — GET (with validation), PATCH (update/approve), DELETE

### 4. Programmatic SEO (5 files)
- `src/app/api/projects/[id]/programmatic/route.ts` — GET (list templates), POST (create template)
- `src/app/api/projects/[id]/programmatic/[templateId]/route.ts` — GET (with pages), PATCH (update), DELETE (soft)
- `src/app/api/projects/[id]/programmatic/[templateId]/generate/route.ts` — POST (generate pages)
- `src/app/api/projects/[id]/programmatic/[templateId]/pages/[pageId]/route.ts` — GET (page detail), PATCH (approve/reject)
- `src/app/api/projects/[id]/programmatic/[templateId]/publish/route.ts` — POST (publish approved pages)

### 5. Content Sources (2 files)
- `src/app/api/projects/[id]/content-sources/route.ts` — GET (list), POST (add)
- `src/app/api/projects/[id]/content-sources/[sourceId]/route.ts` — DELETE (soft remove)

### 6. Quality Findings (2 files)
- `src/app/api/projects/[id]/quality-findings/route.ts` — GET (list with filters)
- `src/app/api/projects/[id]/quality-findings/[findingId]/route.ts` — PATCH (dismiss)

### 7. Content Changes (3 files)
- `src/app/api/projects/[id]/content-changes/route.ts` — GET (list with filters)
- `src/app/api/projects/[id]/content-changes/[changeId]/route.ts` — GET (detail with diff)
- `src/app/api/projects/[id]/content-changes/[changeId]/rollback/route.ts` — POST (rollback)

### 8. Workflow (2 files)
- `src/app/api/projects/[id]/workflow/route.ts` — GET (list workflows), POST (start new)
- `src/app/api/projects/[id]/workflow/[briefId]/route.ts` — GET (status), PATCH (update step)

### 9. Content Workflow Extended (2 files)
- `src/app/api/projects/[id]/briefs/[briefId]/claim-check/route.ts` — POST (check claim support)
- `src/app/api/projects/[id]/briefs/[briefId]/pre-publish/route.ts` — POST (run pre-pub checks)

### 10. CMS Content Operations (5 files)
- `src/app/api/projects/[id]/cms-connections/[connectionId]/posts/route.ts` — GET (list), POST (create draft)
- `src/app/api/projects/[id]/cms-connections/[connectionId]/posts/[postId]/route.ts` — GET, PATCH
- `src/app/api/projects/[id]/cms-connections/[connectionId]/products/route.ts` — GET (WooCommerce)
- `src/app/api/projects/[id]/cms-connections/[connectionId]/categories/route.ts` — GET (WP/WC)

### 11. Decay Workflow (2 files)
- `src/app/api/projects/[id]/decay-workflow/route.ts` — GET (declining pages)
- `src/app/api/projects/[id]/decay-workflow/[decayId]/route.ts` — POST (actions: generateUpdateBrief, approvePruning, compareContent)

## Key Design Decisions
1. All error messages in Dutch as required
2. All routes use `getAuthenticatedUser()` + `validateProjectAccess()` pattern
3. Async params pattern (`params: Promise<...>`) for Next.js 16 compatibility
4. Consistent `{ data, meta? }` JSON response format
5. Proper HTTP status codes (401, 403, 404, 400, 405, 201, 500)
6. Internal link deletion returns 405 (immutable after creation)
7. CMS connection test dispatches based on `providerType` (WP vs WC)
8. Categories endpoint handles both WP and WC dispatching
9. Workflow routes map between `ContentApprovalStatus` and `ContentWorkflowStep`
10. Claim check uses keyword overlap against approved sources
11. Decay workflow actions include risk assessment for destructive pruning

## Lint Status
✅ `bun run lint` passes with zero errors
