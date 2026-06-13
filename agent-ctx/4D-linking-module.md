# Task 4D — Internal Linking Module

## Summary
Created the complete Internal Linking module at `/home/z/my-project/src/lib/linking/` with 5 files:

### Files Created

1. **`types.ts`** — TypeScript interfaces for the entire linking module:
   - `LinkCandidate` — source/target page IDs, URLs, anchor text, strategy, confidence, etc.
   - `LinkApproval` — approval/rejection decisions with user and notes
   - `LinkDiff` — before/after content diff for link insertion preview
   - `BulkApprovalResult` / `BulkApprovalDetail` — bulk operation results
   - `InternalLinkFilters` — status, strategy, page, confidence range filters
   - `CannibalizationWarning` — keyword cannibalization detection results
   - `AnchorVariation` — anchor text variation with type and confidence
   - `PageLinkProfile` — internal page profile with normalizedUrl, wordCount, linking data
   - `CandidateGenerationResult` — overall generation summary

2. **`anchor-variation.ts`** — Dutch anchor text generation:
   - `generateAnchorVariations(targetTitle, targetKeyword, context)` — produces 3-5 variations
   - Five variation types: exact match, partial match, descriptive, action-oriented, natural language
   - All Dutch-language output (e.g., "lees meer over [topic]", "ontdek [topic]")
   - Enforces length constraints (3-60 characters)
   - Deduplication and fallback generation to ensure minimum 3 results

3. **`candidate-generator.ts`** — Main candidate generation with 5 strategies:
   - **SEMANTIC** — Uses AI (`providerManager.fallbackGenerate()`) to find semantically related pages
   - **TOPIC_CLUSTER** — Links pages within the same cluster (pillar↔sub-page, sub↔sub)
   - **ORPHAN_PAGE** — Finds pages with `isOrphan=true` and suggests links from strong pages
   - **STRONG_PAGE** — Identifies high-incoming-link pages and suggests links to newer content
   - **BROKEN_REPLACEMENT** — Finds broken links from `TechnicalIssue` data and suggests replacements
   - Cannibalization detection: warns when two pages target the same primary keyword
   - Confidence adjustment for cannibalization-affected candidates
   - Deduplication by source→target URL pair
   - Saves all candidates to the `InternalLink` Prisma table

4. **`approval-workflow.ts`** — Full approval lifecycle:
   - `approveLink(linkId, userId)` — PENDING → APPROVED
   - `rejectLink(linkId, userId, reason?)` — PENDING/APPROVED → REJECTED
   - `bulkApproveLinks(linkIds, userId)` — Bulk approve with detailed results
   - `generateLinkDiff(linkId)` — Before/after diff showing link insertion point
   - `publishApprovedLinks(projectId, cmsConnectionId?)` — APPROVED → PUBLISHED (with CMS integration)
   - `rollbackLink(linkId, userId)` — PUBLISHED → ROLLED_BACK (with CMS undo)

5. **`index.ts`** — Barrel export of all public functions and types

### Key Design Decisions
- All user-facing strings in Dutch
- Approval-first: no link published without explicit approval
- Confidence scores between 0-1 with cannibalization penalties
- `PageLinkProfile` includes `normalizedUrl` and `wordCount` for proper type safety
- CMS connection status check uses `CONNECTED` (matching Prisma `CMSConnectionStatus` enum)
- Map iteration uses `Array.from()` for ES5 compatibility
- Proper null/undefined handling throughout all database operations

### Validation
- ESLint: passes with zero errors
- TypeScript: no errors in the linking module files
