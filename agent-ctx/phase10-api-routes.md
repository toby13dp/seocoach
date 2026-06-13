# Phase 10 Client Portal API Routes

## Task ID: phase10-api-routes

## Summary
Created 4 API route files for the SEOCoach Phase 10 Client Portal features. All routes follow existing project patterns: `getAuthenticatedUser()` for auth, `validateTenantAccess`/membership checks for tenant isolation, `params: Promise<{...}>` for Next.js 16, Dutch error messages, `db` from `@/lib/db`, and audit logging.

## Files Created

### 1. `/src/app/api/clients/[clientId]/portal-access/route.ts`
- **GET**: Lists all portal access records for a client, parses JSON restrictions, org membership check
- **PUT**: Bulk update portal access with `{ updates: [{ accessType, granted, restrictions? }] }`, validates against `PORTAL_ACCESS_TYPES`, upserts each record, audit logs

### 2. `/src/app/api/clients/[clientId]/notification-preferences/route.ts`
- **GET**: Gets client notification preferences (upserts defaults if none exist), org membership check
- **PUT**: Updates notification preferences, validates `digestFrequency` against valid values, upserts, audit logs

### 3. `/src/app/api/clients/[clientId]/extension/route.ts`
- **GET**: Gets client extension (contract, health, SLA), filters restricted fields (billingNotes, costRate, profitability) for CLIENT role users via `isClientRole()`
- **PUT**: Updates extension fields, auto-calculates profitability when fee/cost changes, blocks restricted field updates from CLIENT role, audit logs
- **POST**: Creates extension if not exists (409 if already exists), auto-calculates profitability, filters response for CLIENT role

### 4. `/src/app/api/organizations/[id]/agency-dashboard/route.ts`
- **GET**: Gets agency dashboard data via `buildAgencyDashboard()`, requires AGENCY_OWNER, ORG_OWNER, or PLATFORM_ADMIN role

## Patterns Used
- Auth: `getAuthenticatedUser()` → 401 if null
- Tenant: Organization membership check via `db.organizationMembership.findUnique`
- Params: `const { clientId/id } = await params;` (Next.js 16 Promise pattern)
- Dutch-first: All user-facing error messages in Dutch
- Soft deletes: All queries filter `deletedAt: null`
- Audit logging via `logAuditEvent()`
- Import types from `@prisma/client`
