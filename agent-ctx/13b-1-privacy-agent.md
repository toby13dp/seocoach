# Task 13b-1 — Privacy & Data Management Agent

## Summary
Implemented Phase 13 privacy and data management features (PRIV-001, PRIV-002) for the SEOCoach platform.

## Files Created

### Library Modules (`/src/lib/privacy/`)
1. **data-export.ts** — GDPR right to data portability
   - `exportUserData(userId)`: Collects all user data across profile, settings, orgs, projects
   - `generateExportFile(userId)`: Writes structured JSON to /tmp
   - Excludes sensitive fields (API keys), ISO 8601 dates, format metadata

2. **account-deletion.ts** — GDPR right to erasure (account level)
   - `requestAccountDeletion(userId)`: 30-day grace, UUID confirmation code
   - `confirmAccountDeletion(userId, code)`: Full deletion with org ownership transfer, PII anonymization
   - `cancelAccountDeletion(userId)`: Cancel with audit trail
   - `getDeletionStatus(userId)`: Query current status

3. **project-deletion.ts** — Project data erasure
   - `requestProjectDeletion(projectId, userId)`: 7-day grace, permission check
   - `confirmProjectDeletion(projectId, code)`: Cascade delete via Prisma
   - `cancelProjectDeletion(projectId)`: Cancel with audit trail
   - `getProjectDeletionStatus(projectId)`: Query current status

4. **consent-manager.ts** — Consent management with audit trail
   - `ConsentType` enum: ANALYTICS, BEHAVIOUR_TRACKING, EXTERNAL_AI, EMAIL_MARKETING
   - `recordConsent()`, `checkConsent()`, `withdrawConsent()`, `getConsentHistory()`
   - Proposed Prisma model in comments for future migration

5. **retention-manager.ts** — Data retention lifecycle
   - 7 predefined policies (DailyMetrics 730d, AICallLogs 365d, etc.)
   - `enforceRetentionPolicy()`, `enforceAllRetentionPolicies()`
   - `getRetentionPolicy()`, `listRetentionPolicies()`

6. **index.ts** — Re-exports all modules

### API Routes
1. **`/api/user/data-export/route.ts`** — POST (generate) + GET (download)
2. **`/api/user/account-deletion/route.ts`** — POST (request/confirm/cancel) + GET (status)
3. **`/api/projects/[id]/deletion/route.ts`** — POST (request/confirm/cancel) + GET (status)
4. **`/api/user/consent/route.ts`** — GET (consents + history) + POST (record/withdraw)

## Key Design Decisions
- Used existing JSON fields (privacyPreferences, settings) for scheduling metadata to avoid schema changes
- All dates in ISO 8601 format
- Dutch error messages throughout
- Zod discriminated unions for action-based API endpoints
- Grace periods: 30 days (account), 7 days (project)
- Consent is opt-in (default: false)
- Ownership transfer for orgs when last owner deletes account

## Verification
- `tsc --noEmit`: No errors in new files
- `bun run lint`: No new errors
- Dev server running normally
