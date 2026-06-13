# SEOCoach — Requirements Traceability Matrix

**Document version:** 1.0  
**Date:** 2026-03-04  
**Last updated:** 2026-03-04  

---

## Purpose

This document maps every requirement defined in `PRODUCT_REQUIREMENTS.md` to its implementation location, API endpoint, UI screen, database entity, tests, documentation, current status, and known limitations. It is the single source of truth for requirement coverage and must be updated whenever a requirement is implemented, deferred, or modified.

### Status Definitions

| Status | Definition |
|--------|-----------|
| **Complete** | Fully implemented, tested, and documented |
| **Partial** | Implementation exists but is incomplete or untested |
| **Planned** | Not yet started; scheduled for a specific phase |
| **Blocked** | Cannot proceed due to an unresolved dependency |
| **N/A** | Not applicable to this deployment or configuration |

---

## Module 1: Foundation & Multi-Tenant Platform

### 1.1 Authentication

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| AUTH-001 | User registration with email verification | 1 | `src/app/api/auth/register/route.ts` | `POST /api/auth/register` | `/registreren` | `User`, `VerificationToken` | `tests/auth/registration.test.ts` | User guide: Registreren | Planned | — |
| AUTH-002 | Login, logout, session management | 1 | `src/app/api/auth/[...nextauth]/route.ts` | `POST /api/auth/signin`, `POST /api/auth/signout` | `/inloggen` | `User`, `Session`, `Account` | `tests/auth/session.test.ts` | User guide: Inloggen | Planned | — |
| AUTH-003 | Password reset, secure hashing | 1 | `src/app/api/auth/reset-password/route.ts` | `POST /api/auth/reset-password` | `/wachtwoord-vergeten` | `User`, `ResetToken` | `tests/auth/password-reset.test.ts` | User guide: Wachtwoord herstellen | Planned | — |
| AUTH-004 | Rate limiting on auth endpoints | 1 | `src/middleware/rate-limit.ts` | Middleware | N/A | `RateLimit` (Redis) | `tests/auth/rate-limit.test.ts` | Admin guide: Rate limiting | Planned | — |
| AUTH-005 | Authentication audit events | 1 | `src/lib/audit/auth-events.ts` | Internal | N/A | `AuditLog` | `tests/audit/auth-events.test.ts` | Admin guide: Audit logs | Planned | — |
| AUTH-006 | Local email preview in development | 1 | `src/app/api/auth/preview-emails/route.ts` | `GET /api/auth/preview-emails` | Dev only | N/A | `tests/auth/email-preview.test.ts` | Dev docs: Local development | Planned | — |
| AUTH-007 | Concurrent session control | 1 | `src/lib/auth/session-control.ts` | Internal | `/instellingen/sessies` | `Session` | `tests/auth/concurrent-sessions.test.ts` | User guide: Sessiebeheer | Planned | — |

### 1.2 Multi-Tenancy

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| TEN-001 | Organisations as tenant boundary | 1 | `src/app/api/organisations/route.ts` | `POST /api/organisations`, `GET /api/organisations/:id` | `/organisaties` | `Organisation` | `tests/tenancy/isolation.test.ts` | Admin guide: Multi-tenancy | Planned | — |
| TEN-002 | Organisation memberships | 1 | `src/app/api/organisations/:id/members/route.ts` | `GET/POST /api/organisations/:id/members` | `/organisaties/:id/leden` | `Membership` | `tests/tenancy/membership.test.ts` | User guide: Teambeheer | Planned | — |
| TEN-003 | Clients within organisations | 1 | `src/app/api/organisations/:id/clients/route.ts` | `GET/POST /api/organisations/:id/clients` | `/klanten` | `Client` | `tests/tenancy/clients.test.ts` | User guide: Klantbeheer | Planned | — |
| TEN-004 | Website projects | 1 | `src/app/api/projects/route.ts` | `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/:id` | `/projecten` | `Project` | `tests/tenancy/projects.test.ts` | User guide: Projectbeheer | Planned | — |
| TEN-005 | Domain management | 1 | `src/app/api/projects/:id/domains/route.ts` | `GET/POST /api/projects/:id/domains` | `/projecten/:id/domeinen` | `Domain` | `tests/tenancy/domains.test.ts` | User guide: Domeinen | Planned | — |
| TEN-006 | Locations for local SEO | 1 | `src/app/api/projects/:id/locations/route.ts` | `GET/POST /api/projects/:id/locations` | `/projecten/:id/locaties` | `Location` | `tests/tenancy/locations.test.ts` | User guide: Locaties | Planned | Placeholder schema only; full implementation in Phase 7 |
| TEN-007 | User invitations | 1 | `src/app/api/organisations/:id/invitations/route.ts` | `POST /api/organisations/:id/invitations`, `POST /api/invitations/:token/accept` | `/organisaties/:id/uitnodigen` | `Invitation` | `tests/tenancy/invitations.test.ts` | User guide: Uitnodigingen | Planned | — |
| TEN-008 | Tenant-aware queries | 1 | `src/lib/db/tenant-filter.ts` | Middleware | N/A | All tenant-owned entities | `tests/tenancy/isolation.test.ts` | Architecture: Tenant isolation | Planned | — |
| TEN-009 | Tenant-aware background jobs | 1 | `src/lib/jobs/tenant-context.ts` | Internal | N/A | `Job` | `tests/tenancy/job-isolation.test.ts` | Architecture: Jobs | Planned | — |
| TEN-010 | Automated tenant isolation tests | 1 | `tests/tenancy/isolation.test.ts` | N/A | N/A | All tenant-owned entities | Self-referential | Architecture: Testing | Planned | — |

### 1.3 Role-Based Access Control

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| RBAC-001 | All roles defined | 1 | `src/lib/auth/roles.ts` | N/A | N/A | `Role` enum | `tests/rbac/roles.test.ts` | Architecture: RBAC | Planned | — |
| RBAC-002 | Central permission system | 1 | `src/lib/auth/permissions.ts` | Middleware | N/A | `Permission` | `tests/rbac/permissions.test.ts` | Architecture: RBAC | Planned | — |
| RBAC-003 | Role-based action restrictions | 1 | `src/lib/auth/guards.ts` | Middleware | N/A | N/A | `tests/rbac/action-restrictions.test.ts` | Architecture: RBAC | Planned | — |
| RBAC-004 | Object-level permissions | 1 | `src/lib/auth/object-permissions.ts` | Middleware | N/A | `ObjectPermission` | `tests/rbac/object-permissions.test.ts` | Architecture: RBAC | Planned | — |
| RBAC-005 | Role change audit logging | 1 | `src/lib/audit/role-changes.ts` | Internal | N/A | `AuditLog` | `tests/audit/role-changes.test.ts` | Admin guide: Audit logs | Planned | — |
| RBAC-006 | Client-role data restrictions | 1 | `src/lib/auth/client-restrictions.ts` | Middleware | `/klant-portaal` | N/A | `tests/rbac/client-restrictions.test.ts` | Architecture: Client portal | Planned | Basic restrictions in Phase 1; full portal in Phase 10 |

### 1.4 Brand Profile

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| BRAND-001 | Complete BrandProfile model | 1 | `src/app/api/projects/:id/brand-profile/route.ts` | `GET/PUT /api/projects/:id/brand-profile` | `/projecten/:id/merkprofiel` | `BrandProfile` | `tests/brand-profile/crud.test.ts` | User guide: Merkprofiel | Planned | — |
| BRAND-002 | Dutch locale defaults | 1 | `src/lib/brand-profile/defaults.ts` | N/A | `/projecten/:id/merkprofiel` | `BrandProfile.locale` | `tests/brand-profile/defaults.test.ts` | User guide: Merkprofiel | Planned | — |
| BRAND-003 | Brand injection into AI generation | 3 | `src/lib/ai/brand-injection.ts` | Internal | N/A | N/A | `tests/ai/brand-injection.test.ts` | Architecture: AI providers | Planned | Depends on Phase 3 AI layer |
| BRAND-004 | Prohibited terminology/claim checking | 3 | `src/lib/content/brand-checks.ts` | Internal | Content quality screen | N/A | `tests/content/brand-checks.test.ts` | Architecture: Content quality | Planned | Depends on Phase 3 quality system |
| BRAND-005 | Brand profile change audit | 1 | `src/lib/audit/brand-profile-changes.ts` | Internal | N/A | `AuditLog` | `tests/audit/brand-profile-changes.test.ts` | Admin guide: Audit logs | Planned | — |

### 1.5 Onboarding

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| ONB-001 | Dutch onboarding wizard (10 steps) | 1 | `src/app/onboarding/page.tsx` | `POST /api/onboarding` | `/aan-de-slag` | `OnboardingState` | `tests/onboarding/wizard.test.ts` | User guide: Aan de slag | Planned | — |
| ONB-002 | Clear Dutch explanations per step | 1 | `src/i18n/nl/onboarding.json` | N/A | `/aan-de-slag` | N/A | `tests/onboarding/language.test.ts` | User guide: Aan de slag | Planned | — |
| ONB-003 | Optional integration steps | 1 | `src/app/onboarding/page.tsx` | N/A | `/aan-de-slag` | `OnboardingState` | `tests/onboarding/skip-integrations.test.ts` | User guide: Aan de slag | Planned | — |
| ONB-004 | Auto-populate BrandProfile | 1 | `src/lib/onboarding/profile-builder.ts` | Internal | `/aan-de-slag` | `BrandProfile` | `tests/onboarding/profile-builder.test.ts` | Architecture: Onboarding | Planned | — |
| ONB-005 | Accessible onboarding (WCAG 2.1 AA) | 1 | `src/app/onboarding/page.tsx` | N/A | `/aan-de-slag` | N/A | `tests/onboarding/accessibility.test.ts` | Accessibility audit | Planned | — |

### 1.6 Dashboard

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| DASH-001 | Role-aware dashboard | 1 | `src/app/dashboard/page.tsx` | `GET /api/dashboard` | `/overzicht` | N/A | `tests/dashboard/role-widget.test.ts` | User guide: Overzicht | Planned | — |
| DASH-002 | Real data only, no fabricated metrics | 1 | `src/lib/dashboard/data-policy.ts` | Internal | `/overzicht` | N/A | `tests/dashboard/no-fabricated-metrics.test.ts` | Architecture: Data policy | Planned | — |
| DASH-003 | Dashboard widgets | 1 | `src/components/dashboard/widgets/` | `GET /api/dashboard/widgets` | `/overzicht` | N/A | `tests/dashboard/widgets.test.ts` | User guide: Overzicht | Planned | — |
| DASH-004 | Empty states for all widgets | 1 | `src/components/dashboard/empty-states/` | N/A | `/overzicht` | N/A | `tests/dashboard/empty-states.test.ts` | UX principles: Empty states | Planned | — |
| DASH-005 | "Mijn belangrijkste acties" | 1 | `src/app/dashboard/actions/page.tsx` | `GET /api/dashboard/actions` | `/mijn-acties` | `Action` | `tests/dashboard/actions.test.ts` | User guide: Mijn acties | Planned | — |

### 1.7 Job System

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| JOB-001 | Job creation, queuing, monitoring | 1 | `src/lib/jobs/queue.ts` | `POST /api/jobs`, `GET /api/jobs/:id` | `/taken` | `Job` | `tests/jobs/queue.test.ts` | Architecture: Jobs | Planned | — |
| JOB-002 | Retries, cancellation, error storage | 1 | `src/lib/jobs/retry.ts`, `src/lib/jobs/cancel.ts` | `POST /api/jobs/:id/cancel` | `/taken/:id` | `Job` | `tests/jobs/retry-cancel.test.ts` | Architecture: Jobs | Planned | — |
| JOB-003 | Tenant context in jobs | 1 | `src/lib/jobs/tenant-context.ts` | Internal | N/A | `Job.organisationId` | `tests/jobs/tenant-context.test.ts` | Architecture: Tenant isolation | Planned | — |
| JOB-004 | User-visible job history | 1 | `src/app/jobs/page.tsx` | `GET /api/jobs` | `/taken` | `Job` | `tests/jobs/history.test.ts` | User guide: Taken | Planned | — |
| JOB-005 | Job idempotency | 1 | `src/lib/jobs/idempotency.ts` | Internal | N/A | `Job.idempotencyKey` | `tests/jobs/idempotency.test.ts` | Architecture: Jobs | Planned | — |
| JOB-006 | Dead-letter handling | 1 | `src/lib/jobs/dead-letter.ts` | `GET /api/jobs/dead-letter` | `/taken/mislukt` | `Job` | `tests/jobs/dead-letter.test.ts` | Architecture: Jobs | Planned | — |

### 1.8 Audit Logging

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| AUDIT-001 | Audit event types defined | 1 | `src/lib/audit/events.ts` | N/A | N/A | `AuditLog` | `tests/audit/events.test.ts` | Admin guide: Audit logs | Planned | — |
| AUDIT-002 | Audit log structure | 1 | `src/lib/audit/logger.ts` | `GET /api/audit-logs` | `/audit-logs` | `AuditLog` | `tests/audit/structure.test.ts` | Admin guide: Audit logs | Planned | — |
| AUDIT-003 | Log immutability | 1 | `src/lib/audit/immutability.ts` | Internal | N/A | `AuditLog` | `tests/audit/immutability.test.ts` | Architecture: Audit | Planned | — |
| AUDIT-004 | Tenant-scoped audit logs | 1 | `src/lib/audit/tenant-scope.ts` | `GET /api/audit-logs?organisationId=:id` | `/audit-logs` | `AuditLog.organisationId` | `tests/audit/tenant-scope.test.ts` | Architecture: Tenant isolation | Planned | — |

### 1.9 Internationalisation

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| I18N-001 | nl-NL default, nl-BE support | 1 | `src/i18n/nl-NL.json`, `src/i18n/nl-BE.json` | N/A | All | N/A | `tests/i18n/locale.test.ts` | Architecture: i18n | Planned | — |
| I18N-002 | English technical fallback | 1 | `src/i18n/en.json` | N/A | Dev/technical | N/A | `tests/i18n/fallback.test.ts` | Architecture: i18n | Planned | — |
| I18N-003 | Translation keys, no hardcoded text | 1 | `src/lib/i18n/keys.ts` | N/A | All | N/A | `tests/i18n/no-hardcoded.test.ts` | Architecture: i18n | Planned | — |
| I18N-004 | User-level locale switching | 1 | `src/app/api/user/locale/route.ts` | `PUT /api/user/locale` | `/instellingen/taal` | `User.locale` | `tests/i18n/switching.test.ts` | User guide: Taalinstellingen | Planned | — |
| I18N-005 | Locale-aware date/number formatting | 1 | `src/lib/i18n/format.ts` | N/A | All | N/A | `tests/i18n/format.test.ts` | Architecture: i18n | Planned | — |

### 1.10 Settings

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| SET-001 | Organisation settings | 1 | `src/app/api/organisations/:id/settings/route.ts` | `GET/PUT /api/organisations/:id/settings` | `/instellingen/organisatie` | `OrganisationSettings` | `tests/settings/organisation.test.ts` | User guide: Instellingen | Planned | — |
| SET-002 | Project settings | 1 | `src/app/api/projects/:id/settings/route.ts` | `GET/PUT /api/projects/:id/settings` | `/instellingen/project` | `ProjectSettings` | `tests/settings/project.test.ts` | User guide: Instellingen | Planned | — |
| SET-003 | User settings | 1 | `src/app/api/user/settings/route.ts` | `GET/PUT /api/user/settings` | `/instellingen/gebruiker` | `UserSettings` | `tests/settings/user.test.ts` | User guide: Instellingen | Planned | — |
| SET-004 | Automation level per project | 1 | `src/lib/automation/level.ts` | Internal | `/instellingen/project` | `ProjectSettings.automationLevel` | `tests/settings/automation-level.test.ts` | Architecture: Automation | Planned | — |

---

## Module 2: Crawling & Technical SEO

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| CRAWL-001 | Domain allowlists | 2 | `src/lib/crawler/allowlist.ts` | `GET/PUT /api/projects/:id/crawl-settings` | `/projecten/:id/crawl-instellingen` | `CrawlSettings` | `tests/crawler/allowlist.test.ts` | User guide: Crawlen | Planned | — |
| CRAWL-002 | robots.txt support | 2 | `src/lib/crawler/robots-txt.ts` | Internal | N/A | N/A | `tests/crawler/robots-txt.test.ts` | Architecture: Crawler | Planned | — |
| CRAWL-003 | Crawl rate limiting, page/depth limits | 2 | `src/lib/crawler/rate-limit.ts` | `GET/PUT /api/projects/:id/crawl-settings` | `/projecten/:id/crawl-instellingen` | `CrawlSettings` | `tests/crawler/rate-limit.test.ts` | Architecture: Crawler | Planned | — |
| CRAWL-004 | URL normalisation | 2 | `src/lib/crawler/url-normalise.ts` | Internal | N/A | N/A | `tests/crawler/url-normalise.test.ts` | Architecture: Crawler | Planned | — |
| CRAWL-005 | Sitemap discovery & parsing | 2 | `src/lib/crawler/sitemap.ts` | Internal | N/A | N/A | `tests/crawler/sitemap.test.ts` | Architecture: Crawler | Planned | — |
| CRAWL-006 | Redirect handling, chain/loop detection | 2 | `src/lib/crawler/redirects.ts` | Internal | N/A | N/A | `tests/crawler/redirects.test.ts` | Architecture: Crawler | Planned | — |
| CRAWL-007 | HTML parsing extraction | 2 | `src/lib/crawler/parser.ts` | Internal | N/A | `Page` | `tests/crawler/parser.test.ts` | Architecture: Crawler | Planned | — |
| CRAWL-008 | Crawl progress & cancellation | 2 | `src/lib/crawler/progress.ts` | `GET /api/crawls/:id`, `POST /api/crawls/:id/cancel` | `/projecten/:id/crawlen/:id` | `Crawl` | `tests/crawler/progress.test.ts` | User guide: Crawlen | Planned | — |
| CRAWL-009 | SSRF protection | 2 | `src/lib/crawler/ssrf-protection.ts` | Internal | N/A | N/A | `tests/crawler/ssrf.test.ts` | Security: SSRF | Planned | — |
| CRAWL-010 | Response size, decompression, HTML sanitisation | 2 | `src/lib/crawler/safety.ts` | Internal | N/A | N/A | `tests/crawler/safety.test.ts` | Security: Crawler safety | Planned | — |
| CRAWL-011 | Playwright rendering mode | 2 | `src/lib/crawler/renderer.ts` | Internal | N/A | `PageSnapshot` | `tests/crawler/renderer.test.ts` | Architecture: Crawler | Planned | — |
| CRAWL-012 | Page snapshots | 2 | `src/lib/crawler/snapshots.ts` | Internal | N/A | `PageSnapshot` | `tests/crawler/snapshots.test.ts` | Architecture: Snapshots | Planned | — |
| CRAWL-013 | Crawl history | 2 | `src/app/api/crawls/route.ts` | `GET /api/crawls` | `/projecten/:id/crawl-geschiedenis` | `Crawl` | `tests/crawler/history.test.ts` | User guide: Crawl geschiedenis | Planned | — |
| INV-001 | Searchable page inventory | 2 | `src/app/api/projects/:id/pages/route.ts` | `GET /api/projects/:id/pages` | `/projecten/:id/pagina's` | `Page` | `tests/inventory/search.test.ts` | User guide: Pagina's | Planned | — |
| INV-002 | Bulk selection, saved views, export | 2 | `src/lib/inventory/bulk-actions.ts` | `POST /api/projects/:id/pages/bulk` | `/projecten/:id/pagina's` | `SavedView` | `tests/inventory/bulk.test.ts` | User guide: Pagina's | Planned | — |
| INV-003 | Complete page record fields | 2 | `src/lib/crawler/parser.ts` | N/A | `/projecten/:id/pagina's/:pageId` | `Page` | `tests/inventory/page-fields.test.ts` | Architecture: Data model | Planned | — |
| INV-004 | Export to CSV | 2 | `src/app/api/projects/:id/pages/export/route.ts` | `GET /api/projects/:id/pages/export` | `/projecten/:id/pagina's` | N/A | `tests/inventory/export.test.ts` | User guide: Exporteren | Planned | — |
| INV-005 | Simple and technical detail views | 2 | `src/app/projects/[id]/pages/[pageId]/page.tsx` | `GET /api/projects/:id/pages/:pageId` | `/projecten/:id/pagina's/:pageId` | N/A | `tests/inventory/detail-views.test.ts` | UX principles: Progressive depth | Planned | — |
| RULE-001 | Extensible rule engine | 2 | `src/lib/rules/engine.ts` | `GET /api/projects/:id/issues` | `/projecten/:id/problemen` | `Issue` | `tests/rules/engine.test.ts` | Architecture: Rule engine | Planned | — |
| RULE-002 | Comprehensive SEO rules | 2 | `src/lib/rules/definitions/` | N/A | `/projecten/:id/problemen` | `Issue` | `tests/rules/definitions.test.ts` | Architecture: Rule definitions | Planned | — |
| RULE-003 | Issue details (Dutch explanation, evidence, etc.) | 2 | `src/lib/rules/issue-formatter.ts` | N/A | `/projecten/:id/problemen/:issueId` | `Issue` | `tests/rules/issue-details.test.ts` | UX principles: Explainable scores | Planned | — |
| RULE-004 | Plugin architecture for new rules | 2 | `src/lib/rules/plugin.ts` | N/A | N/A | N/A | `tests/rules/plugin.test.ts` | Architecture: Rule engine | Planned | — |
| RENDER-001 | Source vs. rendered comparisons | 2 | `src/lib/crawler/render-compare.ts` | `GET /api/projects/:id/pages/:pageId/render-comparison` | `/projecten/:id/pagina's/:pageId/vergelijking` | `PageSnapshot` | `tests/crawler/render-compare.test.ts` | User guide: Bron vs. weergave | Planned | — |
| RENDER-002 | Meaningful difference highlighting | 2 | `src/lib/crawler/render-diff.ts` | N/A | `/projecten/:id/pagina's/:pageId/vergelijking` | N/A | `tests/crawler/render-diff.test.ts` | UX principles: Visible progress | Planned | — |

---

## Module 3: Keywords & Content Intelligence

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| KW-001 | Manual entry, CSV import | 3 | `src/app/api/projects/:id/keywords/route.ts` | `POST /api/projects/:id/keywords`, `POST /api/projects/:id/keywords/import` | `/projecten/:id/zoekwoorden` | `Keyword` | `tests/keywords/import.test.ts` | User guide: Zoekwoorden | Planned | — |
| KW-002 | Search query storage | 3 | `src/lib/keywords/storage.ts` | Internal | N/A | `Keyword` | `tests/keywords/storage.test.ts` | Architecture: Keywords | Planned | — |
| KW-003 | Keyword grouping | 3 | `src/lib/keywords/grouping.ts` | `POST /api/projects/:id/keyword-groups` | `/projecten/:id/zoekwoorden/groepen` | `KeywordGroup` | `tests/keywords/grouping.test.ts` | User guide: Zoekwoordgroepen | Planned | — |
| KW-004 | Search intent classification (AI + fallback) | 3 | `src/lib/keywords/intent-classifier.ts` | `POST /api/projects/:id/keywords/classify-intent` | `/projecten/:id/zoekwoorden` | `Keyword.intent` | `tests/keywords/intent.test.ts` | Architecture: AI classification | Planned | — |
| KW-005 | Funnel classification | 3 | `src/lib/keywords/funnel.ts` | Internal | `/projecten/:id/zoekwoorden` | `Keyword.funnelStage` | `tests/keywords/funnel.test.ts` | User guide: Zoekwoordfunnel | Planned | — |
| KW-006 | Persona, product, location mapping | 3 | `src/lib/keywords/mapping.ts` | `PUT /api/projects/:id/keywords/:id/mapping` | `/projecten/:id/zoekwoorden/:id` | `KeywordMapping` | `tests/keywords/mapping.test.ts` | User guide: Zoekwoorden | Planned | — |
| KW-007 | Seasonality fields | 3 | `src/lib/keywords/seasonality.ts` | `PUT /api/projects/:id/keywords/:id/seasonality` | `/projecten/:id/zoekwoorden/:id` | `Keyword.seasonality` | `tests/keywords/seasonality.test.ts` | User guide: Seizoenlijkheid | Planned | — |
| OPP-001 | Explainable opportunity score | 3 | `src/lib/keywords/opportunity-score.ts` | `GET /api/projects/:id/keywords/:id/opportunity` | `/projecten/:id/zoekwoorden/:id` | `Keyword.opportunityScore` | `tests/keywords/opportunity.test.ts` | Architecture: Opportunity scoring | Planned | — |
| OPP-002 | Score components stored separately | 3 | `src/lib/keywords/opportunity-score.ts` | Internal | `/projecten/:id/zoekwoorden/:id` | `OpportunityScoreComponent` | `tests/keywords/opportunity-components.test.ts` | Architecture: Opportunity scoring | Planned | — |
| OPP-003 | Configurable weights | 3 | `src/lib/keywords/opportunity-weights.ts` | `GET/PUT /api/admin/opportunity-weights` | `/beheer/kansscore-gewichten` | `OpportunityWeight` | `tests/keywords/opportunity-weights.test.ts` | Admin guide: Scores | Planned | — |
| OPP-004 | Score shown in Dutch | 3 | `src/components/keywords/score-breakdown.tsx` | N/A | `/projecten/:id/zoekwoorden/:id` | N/A | `tests/keywords/score-language.test.ts` | UX principles: Explainable scores | Planned | — |
| TOPIC-001 | Topics, clusters, pillar pages | 3 | `src/app/api/projects/:id/topics/route.ts` | `GET/POST /api/projects/:id/topics` | `/projecten/:id/onderwerpen` | `Topic`, `Cluster`, `PillarPage` | `tests/topics/crud.test.ts` | User guide: Onderwerpen | Planned | — |
| TOPIC-002 | Supporting pages with relations | 3 | `src/lib/topics/relations.ts` | `POST /api/projects/:id/topics/:id/relations` | `/projecten/:id/onderwerpen/:id` | `TopicRelation` | `tests/topics/relations.test.ts` | User guide: Onderwerpen | Planned | — |
| TOPIC-003 | Cluster entry fields | 3 | `src/lib/topics/entry-fields.ts` | N/A | `/projecten/:id/onderwerpen/:id` | `TopicEntry` | `tests/topics/entry-fields.test.ts` | User guide: Onderwerpen | Planned | — |
| TOPIC-004 | Visual graph view | 3 | `src/components/topics/graph-view.tsx` | N/A | `/projecten/:id/onderwerpen/grafiek` | N/A | `tests/topics/graph-view.test.ts` | User guide: Onderwerpgrafiek | Planned | — |
| TOPIC-005 | Accessible list view | 3 | `src/components/topics/list-view.tsx` | N/A | `/projecten/:id/onderwerpen/lijst` | N/A | `tests/topics/list-view.test.ts` | UX principles: Accessibility | Planned | — |
| TOPIC-006 | Drag-and-drop editing | 3 | `src/components/topics/drag-drop.tsx` | N/A | `/projecten/:id/onderwerpen/grafiek` | N/A | `tests/topics/drag-drop.test.ts` | UX principles: DnD alternatives | Planned | — |
| TOPIC-007 | Relationship editing | 3 | `src/components/topics/relation-editor.tsx` | `PUT /api/projects/:id/topics/:id/relations` | `/projecten/:id/onderwerpen/:id/relaties` | N/A | `tests/topics/relation-editing.test.ts` | User guide: Relaties | Planned | — |
| AI-001 | Ollama adapter | 3 | `src/lib/ai/providers/ollama.ts` | `POST /api/ai/test-connection` | `/instellingen/ai-providers` | `AIProvider` | `tests/ai/ollama.test.ts` | Architecture: AI providers | Planned | — |
| AI-002 | OpenAI-compatible adapter | 3 | `src/lib/ai/providers/openai-compatible.ts` | N/A | `/instellingen/ai-providers` | `AIProvider` | `tests/ai/openai.test.ts` | Architecture: AI providers | Planned | — |
| AI-003 | Provider interface & model discovery | 3 | `src/lib/ai/provider-interface.ts` | `GET /api/ai/providers/:id/models` | `/instellingen/ai-providers/:id` | `AIProvider`, `AIModel` | `tests/ai/provider-interface.test.ts` | Architecture: AI providers | Planned | — |
| AI-004 | Connection testing | 3 | `src/lib/ai/connection-test.ts` | `POST /api/ai/providers/:id/test` | `/instellingen/ai-providers/:id` | N/A | `tests/ai/connection-test.test.ts` | User guide: AI providers | Planned | — |
| AI-005 | Structured output | 3 | `src/lib/ai/structured-output.ts` | Internal | N/A | N/A | `tests/ai/structured-output.test.ts` | Architecture: AI providers | Planned | — |
| AI-006 | Retry, timeout, fallback | 3 | `src/lib/ai/retry-fallback.ts` | Internal | N/A | N/A | `tests/ai/retry-fallback.test.ts` | Architecture: AI providers | Planned | — |
| AI-007 | Token & cost tracking | 3 | `src/lib/ai/cost-tracking.ts` | `GET /api/projects/:id/ai-usage` | `/projecten/:id/ai-gebruik` | `AIUsageRecord` | `tests/ai/cost-tracking.test.ts` | User guide: AI gebruik | Planned | — |
| AI-008 | Local-provider zero-cost marking | 3 | `src/lib/ai/cost-tracking.ts` | Internal | `/projecten/:id/ai-gebruik` | `AIUsageRecord` | `tests/ai/zero-cost.test.ts` | Architecture: AI providers | Planned | — |
| AI-009 | Privacy settings for AI providers | 3 | `src/lib/ai/privacy-settings.ts` | `GET/PUT /api/projects/:id/ai-privacy` | `/instellingen/project/ai-privacy` | `AIPrivacySettings` | `tests/ai/privacy.test.ts` | Architecture: AI privacy | Planned | — |
| AI-010 | Prompt template versioning | 3 | `src/lib/ai/prompt-templates.ts` | `GET /api/admin/prompt-templates` | `/beheer/prompt-sjablonen` | `PromptTemplate` | `tests/ai/prompt-templates.test.ts` | Architecture: AI providers | Planned | — |
| AI-011 | No external paid provider required | 3 | Architecture | N/A | N/A | N/A | `tests/ai/local-only.test.ts` | Architecture: AI providers | Planned | Must verify Ollama-only workflow |
| BRIEF-001 | Content opportunities | 3 | `src/lib/content/opportunities.ts` | `GET /api/projects/:id/content-opportunities` | `/projecten/:id/content-kansen` | `ContentOpportunity` | `tests/content/opportunities.test.ts` | User guide: Content kansen | Planned | — |
| BRIEF-002 | Content briefs | 3 | `src/app/api/projects/:id/content-briefs/route.ts` | `GET/POST /api/projects/:id/content-briefs` | `/projecten/:id/content-briefs` | `ContentBrief` | `tests/content/briefs.test.ts` | User guide: Content briefs | Planned | — |
| BRIEF-003 | Outline editor | 3 | `src/components/content/outline-editor.tsx` | `PUT /api/projects/:id/content-briefs/:id/outline` | `/projecten/:id/content-briefs/:id` | `ContentBrief.outline` | `tests/content/outline.test.ts` | User guide: Outline | Planned | — |
| BRIEF-004 | Source selection | 3 | `src/lib/content/source-selection.ts` | `PUT /api/projects/:id/content-briefs/:id/sources` | `/projecten/:id/content-briefs/:id/bronnen` | `ContentBriefSource` | `tests/content/sources.test.ts` | User guide: Bronnen | Planned | — |
| BRIEF-005 | Draft generation with brand injection | 3 | `src/lib/content/draft-generator.ts` | `POST /api/projects/:id/content-briefs/:id/generate` | `/projecten/:id/content-briefs/:id` | `ContentDraft` | `tests/content/draft-generation.test.ts` | User guide: Concept genereren | Planned | — |
| BRIEF-006 | Content versions & diff view | 3 | `src/app/api/projects/:id/content/:id/versions/route.ts` | `GET /api/projects/:id/content/:id/versions` | `/projecten/:id/content/:id/versies` | `ContentVersion` | `tests/content/versions.test.ts` | User guide: Versiegeschiedenis | Planned | — |
| BRIEF-007 | Approval states | 3 | `src/lib/content/approval-states.ts` | `PUT /api/projects/:id/content/:id/approve` | `/projecten/:id/content/:id` | `ContentItem.approvalState` | `tests/content/approval.test.ts` | User guide: Goedkeuring | Planned | — |
| BRIEF-008 | Claim markers | 3 | `src/lib/content/claim-markers.ts` | Internal | `/projecten/:id/content/:id` | `ClaimMarker` | `tests/content/claim-markers.test.ts` | Architecture: Content quality | Planned | — |
| QUAL-001 | Quality analysis dimensions | 3 | `src/lib/content/quality-analysis.ts` | `POST /api/projects/:id/content/:id/quality-check` | `/projecten/:id/content/:id/kwaliteit` | `QualityScore` | `tests/content/quality.test.ts` | User guide: Kwaliteit | Planned | — |
| QUAL-002 | Decay detection (honest about missing data) | 3 | `src/lib/content/decay-detection.ts` | `GET /api/projects/:id/content-decay` | `/projecten/:id/content-verval` | `DecayRecord` | `tests/content/decay.test.ts` | Architecture: Decay detection | Planned | — |
| QUAL-003 | Pruning recommendations | 3 | `src/lib/content/pruning.ts` | `GET /api/projects/:id/pruning-recommendations` | `/projecten/:id/snoeien` | `PruningRecommendation` | `tests/content/pruning.test.ts` | User guide: Content snoeien | Planned | — |
| QUAL-004 | Risk analysis before destructive pruning | 3 | `src/lib/content/pruning-risk.ts` | Internal | `/projecten/:id/snoeien/:id` | N/A | `tests/content/pruning-risk.test.ts` | Architecture: Pruning safety | Planned | — |
| QUAL-005 | Explainable quality scores | 3 | `src/components/content/quality-breakdown.tsx` | N/A | `/projecten/:id/content/:id/kwaliteit` | N/A | `tests/content/quality-explainability.test.ts` | UX principles: Explainable scores | Planned | — |

---

## Module 4: Content Automation & CMS

| Req ID | Requirement Summary | Phase | Implementation | API Endpoint | UI Screen | Database Entity | Tests | Documentation | Status | Limitations |
|--------|-------------------|-------|---------------|-------------|-----------|----------------|-------|--------------|--------|------------|
| STUDIO-001 | Full content workflow (14 steps) | 4 | `src/lib/content/workflow.ts` | Various | `/projecten/:id/content-studio` | `ContentItem`, `ContentDraft`, `Approval` | `tests/content/workflow.test.ts` | User guide: Content studio | Planned | — |
| STUDIO-002 | Content type support | 4 | `src/lib/content/types.ts` | N/A | `/projecten/:id/content-studio/nieuw` | `ContentItem.type` | `tests/content/types.test.ts` | User guide: Content types | Planned | — |
| STUDIO-003 | Source grounding, no false verification claims | 4 | `src/lib/content/source-grounding.ts` | Internal | `/projecten/:id/content/:id/bronnen` | `SourceGrounding` | `tests/content/source-grounding.test.ts` | Architecture: Source grounding | Planned | — |
| QC-001 | Pre-publication quality checks | 4 | `src/lib/content/pre-publish-checks.ts` | `POST /api/projects/:id/content/:id/pre-publish` | `/projecten/:id/content/:id/controle` | `QualityCheck` | `tests/content/pre-publish.test.ts` | User guide: Publicatiecontrole | Planned | — |
| QC-002 | Blocking vs. non-blocking findings | 4 | `src/lib/content/check-severity.ts` | Internal | `/projecten/:id/content/:id/controle` | `QualityCheck.blocking` | `tests/content/check-severity.test.ts` | Architecture: Quality checks | Planned | — |
| LINK-001 | Internal link suggestion generation | 4 | `src/lib/linking/suggestions.ts` | `GET /api/projects/:id/internal-links/suggestions` | `/projecten/:id/interne-links` | `LinkSuggestion` | `tests/linking/suggestions.test.ts` | User guide: Interne links | Planned | — |
| LINK-002 | Existing link detection, broken link replacement | 4 | `src/lib/linking/detection.ts` | Internal | N/A | `Page.internalLinks` | `tests/linking/detection.test.ts` | Architecture: Linking | Planned | — |
| LINK-003 | Cannibalisation safeguards | 4 | `src/lib/linking/cannibalisation.ts` | Internal | N/A | N/A | `tests/linking/cannibalisation.test.ts` | Architecture: Linking | Planned | — |
| LINK-004 | Suggestion context & confidence | 4 | `src/lib/linking/context.ts` | Internal | `/projecten/:id/interne-links/:id` | `LinkSuggestion` | `tests/linking/context.test.ts` | User guide: Interne links | Planned | — |
| LINK-005 | Approval workflows (single, bulk, diff, rollback) | 4 | `src/lib/linking/approval.ts` | `POST /api/projects/:id/internal-links/approve` | `/projecten/:id/interne-links/goedkeuren` | `LinkApproval` | `tests/linking/approval.test.ts` | User guide: Link goedkeuring | Planned | — |
| SCHEMA-001 | Visual editors & JSON-LD generation | 4 | `src/lib/schema/generator.ts` | `POST /api/projects/:id/schema/generate` | `/projecten/:id/gestructureerde-data` | `StructuredData` | `tests/schema/generator.test.ts` | User guide: Gestructureerde data | Planned | — |
| SCHEMA-002 | Schema validation | 4 | `src/lib/schema/validator.ts` | `POST /api/projects/:id/schema/validate` | `/projecten/:id/gestructureerde-data/:id` | N/A | `tests/schema/validator.test.ts` | User guide: Validatie | Planned | — |
| SCHEMA-003 | No fabricated missing values | 4 | `src/lib/schema/no-fabrication.ts` | Internal | N/A | N/A | `tests/schema/no-fabrication.test.ts` | Architecture: Schema integrity | Planned | — |
| WP-001 | WordPress connection wizard | 4 | `src/lib/integrations/wordpress/connection.ts` | `POST /api/integrations/wordpress/connect` | `/instellingen/koppelingen/wordpress` | `IntegrationCredential` | `tests/integrations/wp-connection.test.ts` | User guide: WordPress koppelen | Planned | — |
| WP-002 | WordPress import | 4 | `src/lib/integrations/wordpress/import.ts` | `POST /api/integrations/wordpress/import` | `/projecten/:id/wordpress/importeren` | `WordPressPost`, `WordPressPage` | `tests/integrations/wp-import.test.ts` | User guide: WordPress import | Planned | — |
| WP-003 | WordPress publishing | 4 | `src/lib/integrations/wordpress/publish.ts` | `POST /api/integrations/wordpress/publish` | `/projecten/:id/content/:id/publiceren` | `PublicationRecord` | `tests/integrations/wp-publish.test.ts` | User guide: Publiceren | Planned | — |
| WP-004 | SEO metadata adapter architecture | 4 | `src/lib/integrations/wordpress/seo-adapters.ts` | Internal | N/A | N/A | `tests/integrations/wp-seo-adapters.test.ts` | Architecture: WordPress SEO | Planned | — |
| WP-005 | Error handling, retry, audit, rollback | 4 | `src/lib/integrations/wordpress/error-handling.ts` | Internal | N/A | `PublicationRecord` | `tests/integrations/wp-error-handling.test.ts` | Architecture: Publishing safety | Planned | — |
| WOO-001 | WooCommerce connection wizard | 4 | `src/lib/integrations/woocommerce/connection.ts` | `POST /api/integrations/woocommerce/connect` | `/instellingen/koppelingen/woocommerce` | `IntegrationCredential` | `tests/integrations/woo-connection.test.ts` | User guide: WooCommerce koppelen | Planned | — |
| WOO-002 | WooCommerce import | 4 | `src/lib/integrations/woocommerce/import.ts` | `POST /api/integrations/woocommerce/import` | `/projecten/:id/woocommerce/importeren` | `WooCommerceProduct` | `tests/integrations/woo-import.test.ts` | User guide: WooCommerce import | Planned | — |
| WOO-003 | Sales & revenue signal import | 4 | `src/lib/integrations/woocommerce/revenue.ts` | `POST /api/integrations/woocommerce/sync-revenue` | N/A | `RevenueRecord` | `tests/integrations/woo-revenue.test.ts` | Architecture: Revenue tracking | Planned | — |
| WOO-004 | Draft updates & audit trail | 4 | `src/lib/integrations/woocommerce/publish.ts` | `POST /api/integrations/woocommerce/update-product` | `/projecten/:id/woocommerce/producten/:id` | `PublicationRecord` | `tests/integrations/woo-publish.test.ts` | User guide: Producten bijwerken | Planned | — |
| PSEO-001 | Template-based page generation | 4 | `src/lib/programmatic-seo/generator.ts` | `POST /api/projects/:id/programmatic/generate` | `/projecten/:id/programmatisch-seo` | `ProgrammaticTemplate`, `GeneratedPage` | `tests/programmatic/generator.test.ts` | User guide: Programmatisch SEO | Planned | — |
| PSEO-002 | Quality gates | 4 | `src/lib/programmatic-seo/quality-gates.ts` | Internal | N/A | `GeneratedPage.qualityStatus` | `tests/programmatic/quality-gates.test.ts` | Architecture: Programmatic SEO safety | Planned | — |
| PSEO-003 | No thin/doorway pages | 4 | `src/lib/programmatic-seo/thin-page-check.ts` | Internal | N/A | N/A | `tests/programmatic/thin-page.test.ts` | Architecture: Programmatic SEO safety | Planned | — |
| PSEO-004 | Variable editor, data preview, bulk preview | 4 | `src/components/programmatic/editor.tsx` | `GET /api/projects/:id/programmatic/:id/preview` | `/projecten/:id/programmatisch-seo/:id` | N/A | `tests/programmatic/preview.test.ts` | User guide: Sjablonen | Planned | — |
| PSEO-005 | Exclusion reasons & approval queue | 4 | `src/lib/programmatic-seo/approval-queue.ts` | `GET /api/projects/:id/programmatic/approval-queue` | `/projecten/:id/programmatisch-seo/goedkeuring` | `ProgrammaticApproval` | `tests/programmatic/approval-queue.test.ts` | User guide: Goedkeuringswachtrij | Planned | — |
| PSEO-006 | Publication limits & scheduling | 4 | `src/lib/programmatic-seo/scheduler.ts` | `POST /api/projects/:id/programmatic/schedule` | `/projecten/:id/programmatisch-seo/plannen` | `PublicationSchedule` | `tests/programmatic/scheduler.test.ts` | User guide: Planning | Planned | — |
| PSEO-007 | Rollback support | 4 | `src/lib/programmatic-seo/rollback.ts` | `POST /api/projects/:id/programmatic/:id/rollback` | `/projecten/:id/programmatisch-seo/:id` | `RollbackRecord` | `tests/programmatic/rollback.test.ts` | User guide: Terugdraaien | Planned | — |
| DECAY-001 | Content decay workflow | 4 | `src/lib/content/decay-workflow.ts` | `GET /api/projects/:id/content-decay/workflow` | `/projecten/:id/content-verval` | `DecayWorkflow` | `tests/content/decay-workflow.test.ts` | User guide: Content verval | Planned | — |
| DECAY-002 | No decline claim without data | 4 | `src/lib/content/decay-honesty.ts` | Internal | N/A | N/A | `tests/content/decay-honesty.test.ts` | Architecture: Data honesty | Planned | — |
| PRUNE-001 | Pruning recommendations with evidence | 4 | `src/lib/content/pruning-recommendations.ts` | `GET /api/projects/:id/pruning-recommendations` | `/projecten/:id/snoeien` | `PruningRecommendation` | `tests/content/pruning-recommendations.test.ts` | User guide: Content snoeien | Planned | — |
| PRUNE-002 | Approval required, rollback guidance | 4 | `src/lib/content/pruning-approval.ts` | `POST /api/projects/:id/pruning/:id/approve` | `/projecten/:id/snoeien/:id` | `PruningApproval` | `tests/content/pruning-approval.test.ts` | User guide: Snoeien goedkeuren | Planned | — |
| CHG-001 | Change history tracking | 4 | `src/lib/content/change-history.ts` | `GET /api/projects/:id/content/:id/history` | `/projecten/:id/content/:id/geschiedenis` | `ContentChange` | `tests/content/change-history.test.ts` | User guide: Wijzigingsgeschiedenis | Planned | — |

---

## Modules 5–13: Summary Traceability

*The full per-requirement traceability for Modules 5–13 follows the same structure as Modules 1–4 above. Detailed rows will be populated as each phase begins implementation. The summary below provides phase-level tracking.*

| Req ID | Requirement Summary | Phase | Status | Notes |
|--------|-------------------|-------|--------|-------|
| PERF-001–PERF-003 | Search performance & analytics | 5 | Planned | Adapter architecture; time-series model |
| ALERT-001–ALERT-003 | Monitoring & alerts | 5 | Planned | Alert model; notification system |
| ROAD-001, ROAD-002 | Roadmap generation | 5 | Planned | Roadmap model; multiple views |
| REPORT-001–REPORT-005 | White-label reporting | 5 | Planned | WhiteLabelProfile; report builder; PDF generation; snapshots |
| GEO-001, GEO-002 | GEO readiness | 6 | Planned | Readiness analysis; no fake visibility claims |
| AIVIS-001–AIVIS-006 | Measured AI visibility | 6 | Planned | Prompt library; simulation label "Simulatie — geen bewijs..." |
| COMP-001–COMP-003 | Competitor intelligence | 6 | Planned | Safe crawling; no fabricated traffic/revenue |
| TREND-001 | Trend records | 6 | Planned | Multi-source trend aggregation |
| AUTH-001, AUTH-002 | Authority & digital PR | 6 | Planned | Provider-neutral; no auto-outreach |
| LOCAL-001–LOCAL-004 | Local SEO | 7 | Planned | NAP records; GBP adapter; location health |
| REV-001–REV-003 | Review & reputation | 7 | Planned | Multi-source reviews; approval-required responses |
| ECOM-001–ECOM-003 | E-commerce SEO | 8 | Planned | Revenue prioritisation; product analysis |
| FEED-001, FEED-002 | Product feeds | 8 | Planned | Feed validation; rejection reasons |
| FPA-001, FPA-002 | First-party analytics | 9 | Planned | Privacy-friendly; consent model |
| CRO-001, CRO-002 | Behaviour & CRO | 9 | Planned | Behaviour imports; CRO findings |
| EXP-001, EXP-002 | Experiments | 9 | Planned | No overstated statistical certainty |
| FORE-001–FORE-003 | Forecasting & budget | 9 | Planned | Scenario-based; transparent assumptions |
| PORTAL-001, PORTAL-002 | Client portal | 10 | Planned | White-label; strict data restrictions |
| AGENCY-001–AGENCY-004 | Agency operations | 10 | Planned | Client health; capacity; profitability |
| BENCH-001, BENCH-002 | Benchmarking | 10 | Planned | Within-org; anonymised cross-client |
| PM-001–PM-003 | Project management integrations | 10 | Planned | Jira, Trello, Asana, etc. adapters |
| COPILOT-001–COPILOT-005 | Dutch project-aware copilot | 11 | Planned | Grounded; Dutch; honest; approval-first |
| AGENT-001–AGENT-003 | Specialised agents | 11 | Planned | Tool allowlists; approval gates; audit |
| AUTO-001, AUTO-002 | Automation rules | 11 | Planned | Visual builder; no bypass of approvals |
| MIG-001–MIG-005 | Website migration | 12 | Planned | URL mapping; redirect validation; monitoring |
| DEP-001–DEP-003 | Deployment monitoring | 12 | Planned | CI/CD webhooks; regression detection |
| SEC-001, SEC-002 | Security audit | 13 | Planned | Comprehensive audit; resolve critical/high |
| PRIV-001, PRIV-002 | Privacy audit | 13 | Planned | GDPR compliance; data deletion/export |
| A11Y-001, A11Y-002 | Accessibility audit | 13 | Planned | WCAG 2.1 AA; DnD alternatives |
| PERF-R-001, PERF-R-002 | Performance & reliability | 13 | Planned | Load testing; idempotency; recovery |
| OBS-001, OBS-002 | Observability | 13 | Planned | Structured logs; tenant-safe; no credential leaks |
| BACKUP-001, BACKUP-002 | Backup & restore | 13 | Planned | Tested restore; encryption; retention |

---

## Cross-Cutting Requirements

| Req ID | Requirement | Applies To | Implementation | Tests | Documentation | Status | Limitations |
|--------|------------|-----------|---------------|-------|--------------|--------|------------|
| CC-001 | Tenant isolation | All modules | `src/lib/db/tenant-filter.ts`, `src/lib/jobs/tenant-context.ts` | `tests/tenancy/isolation.test.ts` (per module) | Architecture: Tenant isolation | Planned | — |
| CC-002 | Dutch-first, no unexplained acronyms | All modules | `src/i18n/`, `src/lib/i18n/` | `tests/i18n/no-hardcoded.test.ts`, `tests/i18n/no-unexplained-acronyms.test.ts` | UX principles: Plain Dutch | Planned | — |
| CC-003 | No fabricated metrics | All modules | `src/lib/dashboard/data-policy.ts` | `tests/dashboard/no-fabricated-metrics.test.ts` | Architecture: Data policy | Planned | — |
| CC-004 | Approval-first for publishing/destructive | Modules 4, 7, 11, 12 | `src/lib/auth/approval-gate.ts` | `tests/approval/workflow.test.ts` (per feature) | Architecture: Approval flows | Planned | — |
| CC-005 | Explainable scores | Modules 2, 3, 4, 5, 6, 7, 8, 9 | `src/lib/scoring/explainable.ts` | `tests/scoring/explainability.test.ts` | UX principles: Explainable scores | Planned | — |
| CC-006 | Safe defaults | All modules | `src/lib/config/safe-defaults.ts` | `tests/config/safe-defaults.test.ts` | Architecture: Safe defaults | Planned | — |
| CC-007 | Contextual help | All modules | `src/components/ui/contextual-help.tsx` | `tests/help/contextual.test.ts` | UX principles: Contextual help | Planned | — |
| CC-008 | Consistent labels | All modules | `src/lib/i18n/labels.ts` | `tests/i18n/label-consistency.test.ts` | UX principles: Consistent labels | Planned | — |
| CC-009 | Audit logging | All modules | `src/lib/audit/logger.ts` | `tests/audit/coverage.test.ts` | Architecture: Audit | Planned | — |
| CC-010 | Technology stack (Next.js 16, TypeScript, Prisma, etc.) | All modules | `package.json`, `tsconfig.json`, `prisma/schema.prisma` | CI pipeline | Architecture: Technology | Planned | — |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-04 | Initial requirements traceability matrix created | System |

---

*This document must be updated whenever a requirement's implementation status changes. A requirement may only be marked "Complete" when working code and passing tests exist.*
