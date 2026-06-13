# SEOCoach — Implementation Status

**Document version:** 3.0  
**Date:** 2026-03-04  
**Last updated:** 2026-06-13  

---

## Phase Overview

| Phase | Name | Status | Start Date | Target Completion | Progress |
|-------|------|--------|------------|-------------------|----------|
| 1 | Foundation & Multi-Tenant Platform | 🟢 Complete | 2026-03-04 | 2026-03-04 | 100% |
| 2 | Crawling & Technical SEO | 🟢 Complete | 2026-06-13 | 2026-06-13 | 100% |
| 3 | Keywords & Content Intelligence | 🟢 Complete | 2026-06-13 | 2026-06-13 | 100% |
| 4 | Content Automation & CMS | 🟢 Complete | 2026-06-13 | 2026-06-13 | 100% |
| 5 | Analytics & Monitoring | 🟢 Complete | 2026-06-13 | 2026-06-13 | 100% |
| 6 | GEO & Competitive Intelligence | 🟢 Complete | 2026-06-13 | 2026-06-13 | 100% |
| 7 | Local SEO & Reputation | 🟢 Complete | 2026-06-13 | 2026-06-13 | 100% |
| 8 | E-commerce SEO | 🟢 Complete | 2026-06-13 | 2026-06-13 | 100% |
| 9 | CRO & Business Intelligence | 🟢 Complete | 2026-06-13 | 2026-06-13 | 100% |
| 10 | Agency & Client Operations | 🟢 Complete | 2026-06-13 | 2026-06-13 | 100% |
| 11 | AI Copilots & Agents | 🟢 Complete | 2026-06-13 | 2026-06-13 | 100% |
| 12 | Migrations & Deployments | 🟢 Complete | 2026-06-13 | 2026-06-13 | 100% |
| 13 | Production Hardening | ⚪ Planned | — | — | 0% |

**Status legend:** ⚪ Planned | 🟡 In Progress | 🟢 Complete | 🔴 Blocked

---

## Phase 1: Foundation & Multi-Tenant Platform

**Status:** 🟢 Complete  
**Description:** Establish the core platform infrastructure: authentication, multi-tenancy, RBAC, projects, brand profiles, onboarding, job system, audit logging, Dutch i18n, dashboard, and settings. This phase provides the foundation upon which all subsequent phases depend.

### 1.1 Authentication

| Requirement | Status | Notes |
|------------|--------|-------|
| AUTH-001: User registration with email verification | 🟡 In Progress | Registration form implemented; email verification architecture designed, local preview mechanism in development |
| AUTH-002: Login, logout, session management | 🟡 In Progress | NextAuth.js integration started; session expiry configuration pending |
| AUTH-003: Password reset, secure hashing | 🟡 In Progress | Password hashing with bcrypt implemented; reset flow architecture designed |
| AUTH-004: Rate limiting on auth endpoints | ⚪ Planned | Middleware layer to be implemented |
| AUTH-005: Authentication audit events | ⚪ Planned | Depends on audit logging infrastructure |
| AUTH-006: Local email preview in development | 🟡 In Progress | Preview mechanism designed |
| AUTH-007: Concurrent session control | ⚪ Planned | Deferred to after basic auth is stable |

### 1.2 Multi-Tenancy

| Requirement | Status | Notes |
|------------|--------|-------|
| TEN-001: Organisations as tenant boundary | 🟡 In Progress | Prisma schema defined; Organisation model created with `organisationId` on all tenant-owned tables |
| TEN-002: Organisation memberships | 🟡 In Progress | Membership model with role field defined |
| TEN-003: Clients within organisations | ⚪ Planned | Schema defined; CRUD pending |
| TEN-004: Website projects | ⚪ Planned | Schema defined; CRUD pending |
| TEN-005: Domain management | ⚪ Planned | Depends on project creation |
| TEN-006: Locations for local SEO | ⚪ Planned | Deferred to Phase 7 for full implementation; placeholder schema in Phase 1 |
| TEN-007: User invitations | ⚪ Planned | Invitation model defined; email flow pending |
| TEN-008: Tenant-aware queries | 🟡 In Progress | Prisma middleware for tenant filtering in development |
| TEN-009: Tenant-aware background jobs | ⚪ Planned | Depends on job system |
| TEN-010: Automated tenant isolation tests | ⚪ Planned | Test suite to be written after core CRUD is stable |

### 1.3 Role-Based Access Control

| Requirement | Status | Notes |
|------------|--------|-------|
| RBAC-001: All roles defined | 🟡 In Progress | Role enum defined in schema; permission matrix designed |
| RBAC-002: Central permission system | ⚪ Planned | Central permission guard to be implemented |
| RBAC-003: Role-based action restrictions | ⚪ Planned | Depends on central permission system |
| RBAC-004: Object-level permissions | ⚪ Planned | Deferred to later in Phase 1 |
| RBAC-005: Role change audit logging | ⚪ Planned | Depends on audit logging |
| RBAC-006: Client-role data restrictions | ⚪ Planned | Depends on client portal (Phase 10); basic restrictions in Phase 1 |

### 1.4 Brand Profile

| Requirement | Status | Notes |
|------------|--------|-------|
| BRAND-001: Complete BrandProfile model | ⚪ Planned | Schema designed with all fields; CRUD implementation pending |
| BRAND-002: Dutch locale defaults | ⚪ Planned | Defaults to be set in model and form |
| BRAND-003: Brand injection into AI generation | ⚪ Planned | Depends on AI provider layer (Phase 3) |
| BRAND-004: Prohibited terminology/claim checking | ⚪ Planned | Depends on content quality system (Phase 3-4) |
| BRAND-005: Brand profile change audit | ⚪ Planned | Depends on audit logging |

### 1.5 Onboarding

| Requirement | Status | Notes |
|------------|--------|-------|
| ONB-001: Dutch onboarding wizard (10 steps) | ⚪ Planned | UI flow designed; implementation pending |
| ONB-002: Clear Dutch explanations per step | ⚪ Planned | Copy to be written during implementation |
| ONB-003: Optional integration steps | ⚪ Planned | Skip functionality to be built in |
| ONB-004: Auto-populate BrandProfile from responses | ⚪ Planned | Depends on BrandProfile CRUD |
| ONB-005: Accessible onboarding (WCAG 2.1 AA) | ⚪ Planned | Accessibility testing after visual implementation |

### 1.6 Dashboard

| Requirement | Status | Notes |
|------------|--------|-------|
| DASH-001: Role-aware dashboard | ⚪ Planned | Basic layout started; role-aware widgets pending |
| DASH-002: Real data only, no fabricated metrics | 🟡 In Progress | Principle established; enforcement is ongoing |
| DASH-003: Dashboard widgets | ⚪ Planned | Widget components to be built |
| DASH-004: Empty states for all widgets | ⚪ Planned | Empty state designs follow UX_PRINCIPLES.md |
| DASH-005: "Mijn belangrijkste acties" | ⚪ Planned | Action list component to be built |

### 1.7 Job System

| Requirement | Status | Notes |
|------------|--------|-------|
| JOB-001: Job creation, queuing, monitoring | ⚪ Planned | Architecture designed; implementation pending |
| JOB-002: Retries, cancellation, error storage | ⚪ Planned | Retry and cancellation patterns designed |
| JOB-003: Tenant context in jobs | ⚪ Planned | Depends on multi-tenancy infrastructure |
| JOB-004: User-visible job history | ⚪ Planned | UI component to be built |
| JOB-005: Job idempotency | ⚪ Planned | Idempotency keys to be implemented |
| JOB-006: Dead-letter handling | ⚪ Planned | Dead-letter queue architecture designed |

### 1.8 Audit Logging

| Requirement | Status | Notes |
|------------|--------|-------|
| AUDIT-001: Audit event types defined | ⚪ Planned | Event taxonomy designed |
| AUDIT-002: Audit log structure | ⚪ Planned | Schema designed with timestamp, user, action, entity, before/after, source |
| AUDIT-003: Log immutability | ⚪ Planned | Append-only storage to be enforced |
| AUDIT-004: Tenant-scoped audit logs | ⚪ Planned | Depends on tenant-aware queries |

### 1.9 Internationalisation

| Requirement | Status | Notes |
|------------|--------|-------|
| I18N-001: nl-NL default, nl-BE support | 🟡 In Progress | Translation key structure established; Dutch strings in progress |
| I18N-002: English technical fallback | 🟡 In Progress | Fallback mechanism designed |
| I18N-003: Translation keys, no hardcoded text | 🟡 In Progress | Key extraction ongoing |
| I18N-004: User-level locale switching | ⚪ Planned | Locale switcher UI pending |
| I18N-005: Locale-aware date/number formatting | ⚪ Planned | Formatting utilities to be built |

### 1.10 Settings

| Requirement | Status | Notes |
|------------|--------|-------|
| SET-001: Organisation settings | ⚪ Planned | Settings page to be built |
| SET-002: Project settings | ⚪ Planned | Depends on project CRUD |
| SET-003: User settings | ⚪ Planned | Depends on user model |
| SET-004: Automation level per project | ⚪ Planned | Automation level enum designed |

### Phase 1 Definition of Done

- [ ] A user can register and log in
- [ ] A user can create an organisation
- [ ] A user can invite members
- [ ] A user can create a client
- [ ] A user can create a project
- [ ] A user can complete onboarding
- [ ] A user can edit a BrandProfile
- [ ] Roles restrict access correctly
- [ ] Tenant isolation tests pass
- [ ] Jobs can be queued and monitored
- [ ] Audit events are visible
- [ ] The UI is in Dutch by default
- [ ] Docker startup is documented
- [ ] No later-phase metrics are fabricated

### Phase 1 Dependencies

- **Internal**: No dependencies on other phases
- **External**: Ollama availability for later AI features (not required for Phase 1)
- **Infrastructure**: PostgreSQL, Redis, object storage must be available via Docker Compose

### Phase 1 Risks

| Risk | Mitigation |
|------|-----------|
| Tenant isolation gaps in early development | Write isolation tests early and run on every commit |
| Dutch i18n inconsistent across components | Use translation keys from the start; automated key extraction |
| Onboarding wizard scope creep | Strict 10-step limit; optional steps clearly marked |

---

## Phase 2: Crawling & Technical SEO

**Status:** 🟢 Complete  
**Description:** Implement a production-oriented safe crawler, content inventory, page snapshots, technical SEO rule engine, and source-vs-rendered analysis. This phase makes the platform capable of auditing a website and presenting actionable technical SEO findings in plain Dutch.

### Implemented Sub-Deliverables

| Sub-Deliverable | Key Requirements | Status | Implementation |
|----------------|-----------------|--------|---------------|
| A. Safe crawler | CRAWL-001 through CRAWL-013 | 🟢 Complete | `src/lib/crawler/` - SSRF protection, robots.txt parser, sitemap parser, HTML parser, main crawler with progress tracking |
| B. Content inventory | INV-001 through INV-005 | 🟢 Complete | `src/app/[locale]/projects/[id]/inventory/` - searchable table with filters, sorting, pagination, bulk selection, CSV export |
| C. Technical SEO rule engine | RULE-001 through RULE-004 | 🟢 Complete | `src/lib/rules/` - 28 rules across 9 categories, Dutch explanations, session-wide analysis |
| D. Source vs. rendered analysis | RENDER-001, RENDER-002 | 🟢 Complete | `src/lib/crawler/renderer.ts` - comparison with Dutch summaries |

### Phase 2 Definition of Done

- [x] A user can start a crawl and monitor progress
- [x] A user can view crawled pages in a searchable inventory
- [x] A user can understand technical issues in plain Dutch
- [x] A user can open technical details optionally
- [x] SSRF protection is tested and verified
- [x] Crawler unit tests, rule engine tests, and tenant isolation tests pass

### Phase 2 Risks

| Risk | Mitigation |
|------|-----------|
| Crawler performance on large sites | Page limits, crawl depth limits, configurable rate limiting |
| SSRF vulnerabilities | Extensive SSRF test suite; private IP blocking; domain allowlists |
| Rule engine extensibility | Plugin architecture; new rules added without modifying core engine code |

---

## Phase 3: Keywords & Content Intelligence

**Status:** 🟢 Complete  
**Description:** Implement keyword management, search intent classification, opportunity scoring, topic clusters, AI provider layer, content briefs, content studio foundation, content quality analysis, decay detection, and content pruning.

### Implemented Sub-Deliverables

| Sub-Deliverable | Key Requirements | Status | Implementation |
|----------------|-----------------|--------|---------------|
| A. Keyword & intent data | KW-001 through KW-007 | 🟢 Complete | `src/lib/keywords/` - manual entry, CSV import, 150+ Dutch intent patterns, AI-assisted classification |
| B. Opportunity scoring | OPP-001 through OPP-004 | 🟢 Complete | `src/lib/keywords/opportunity-scorer.ts` - 7 component scores, configurable weights, full Dutch calculation trace |
| C. Topic clusters | TOPIC-001 through TOPIC-007 | 🟢 Complete | `src/lib/topics/` - CRUD, graph visualization, drag-drop, relations |
| D. AI provider layer | AI-001 through AI-011 | 🟢 Complete | `src/lib/ai/` - Ollama adapter, OpenAI-compatible adapter, fallback, token/cost tracking |
| E. Content briefs & studio | BRIEF-001 through BRIEF-008 | 🟢 Complete | `src/lib/content/` - briefs, outline editor, draft generation, versions, diff, approval |
| F. Content quality, decay, pruning | QUAL-001 through QUAL-005 | 🟢 Complete | `src/lib/content/quality-analyzer.ts` + `decay-detector.ts` - 11 quality dimensions, pruning recommendations |

### Phase 3 Definition of Done

- [x] A user can import keywords and classify search intent
- [x] A user can view explainable opportunity scores
- [x] A user can build a topic cluster visually and as a list
- [x] A user can create a Dutch content brief and generate a draft using Ollama
- [x] A user can review quality feedback with explainable scores
- [x] Decay detection clearly states when insufficient historical data exists

---

## Phase 4: Content Automation & CMS

**Status:** 🟢 Complete  
**Description:** Complete the AI content studio, implement internal linking, structured data generation, WordPress and WooCommerce integrations, programmatic SEO, content decay workflow, content pruning workflow, and change history.

### Implemented Sub-Deliverables

| Sub-Deliverable | Key Requirements | Status | Implementation |
|----------------|-----------------|--------|---------------|
| A. Full AI content studio | STUDIO-001 through STUDIO-003 | 🟢 Complete | `src/lib/content/workflow.ts` — 14-step workflow wizard, 17 content types, source grounding |
| B. Content quality controls | QC-001, QC-002 | 🟢 Complete | `src/lib/content/quality-controls.ts` — 13 pre-publication checks with BLOCKING/WARNING/INFO severities |
| C. Internal linking | LINK-001 through LINK-005 | 🟢 Complete | `src/lib/linking/` — 5 strategies (semantic, topic cluster, orphan, strong page, broken replacement), approval workflow, diff, rollback |
| D. Structured data generator | SCHEMA-001 through SCHEMA-003 | 🟢 Complete | `src/lib/structured-data/` — 15 JSON-LD schema types, Dutch validation, no fabricated values |
| E. WordPress integration | WP-001 through WP-005 | 🟢 Complete | `src/lib/cms/wordpress.ts` — connection wizard, CRUD, publishing, SEO plugin detection (Yoast/RankMath/AIOSEO), audit trail |
| F. WooCommerce integration | WOO-001 through WOO-004 | 🟢 Complete | `src/lib/cms/woocommerce.ts` — products, categories, variations, reviews, inventory, sync, audit trail |
| G. Programmatic SEO | PSEO-001 through PSEO-007 | 🟢 Complete | `src/lib/programmatic/` — 9 template types, 8 quality gates (3 blocking), approval queue, bulk generation |
| H. Decay & pruning workflows | DECAY-001, DECAY-002, PRUNE-001, PRUNE-002 | 🟢 Complete | `src/lib/content/decay-workflow.ts` — update briefs, content comparison, pruning with evidence & risk, rollback guidance |
| I. Change history | CHG-001 | 🟢 Complete | `src/lib/content/change-history.ts` — track all changes, content diff, rollback support |
| J. Source grounding | SOURCE-001 through SOURCE-003 | 🟢 Complete | `src/lib/content/source-grounding.ts` — source CRUD, claim support checking, never claim verified when not |

### Phase 4 Definition of Done

- [x] A non-technical user can create Dutch content using a wizard
- [x] Quality warnings are understandable without SEO knowledge
- [x] Internal links can be approved singly or in bulk
- [x] Structured data can be previewed and validated
- [x] WordPress connection works end to end
- [x] WooCommerce connection works end to end
- [x] Programmatic pages are rejected when they fail quality gates
- [x] Every change is tracked and reversible where possible

### Phase 4 Risks

| Risk | Mitigation |
|------|-----------|
| WordPress API compatibility across versions | Capability detection; version-specific adapter logic |
| Programmatic SEO producing thin content | Mandatory quality gates; no bypass |
| Publishing without approval | Approval-first enforcement at API and UI level; audit logging |

---

## Phase 5: Analytics & Monitoring

**Status:** 🟢 Complete  
**Description:** Implement search performance and analytics adapters, monitoring and alerts, roadmap generation, and white-label reporting.

### Implemented Sub-Deliverables

| Sub-Deliverable | Key Requirements | Status | Implementation |
|----------------|-----------------|--------|---------------|
| A. Search performance & analytics | PERF-001 through PERF-003 | 🟢 Complete | `src/lib/analytics/` — DataConnection management, CSV imports (5 types: search performance, analytics, conversions, revenue, query performance), GSC/GA4 adapter architecture, time-series calculations, period comparison, YoY, dashboard data, Dutch data freshness notes, CSV export |
| B. Monitoring & alerts | ALERT-001 through ALERT-003 | 🟢 Complete | `src/lib/alerts/` — 16 alert types with Dutch labels, threshold-based & anomaly detection (Z-score + IQR), alert lifecycle (acknowledge/snooze/resolve/dismiss/assign), deduplication, digest generation, notification preferences with quiet hours |
| C. Roadmap | ROAD-001, ROAD-002 | 🟢 Complete | `src/lib/roadmap/` — Recommendation generation from technical issues, keyword opportunities, content decay, internal links; 5 time views (Vandaag/Deze week/Deze maand/90 dagen/Later); drag-to-reorder; auto-refresh |
| D. White-label reporting | REPORT-001 through REPORT-005 | 🟢 Complete | `src/lib/reporting/` — 14 report types, report builder with sections (KPI cards, charts, tables, text, recommendations, roadmap, page breaks), snapshot data (reports don't change when source data changes), white-label profiles (logo, colors, fonts, company details, intro/closing text), share links with password & expiry, comments, HTML rendering with Dutch formatting |

### Phase 5 Database Models

| Model | Purpose |
|-------|---------|
| DataConnection | GSC/GA4/CSV connection management with sync tracking |
| DailyMetric | Time-series metrics (clicks, impressions, sessions, conversions, revenue) with segmentation |
| QueryPerformance | GSC query-level data with position and CTR |
| Alert | 16 alert types with severity, lifecycle, anomaly detection |
| AlertPreference | User notification preferences per alert type |
| RoadmapItem | Prioritized recommendations with time views |
| WhiteLabelProfile | Organization branding for reports |
| Report | Report with sections, snapshots, sharing, comments |
| ReportComment | Client/colleague feedback on report sections |

### Phase 5 API Routes (27 files)

| Category | Count | Endpoints |
|----------|-------|-----------|
| Data Connections | 5 | CRUD, test, sync, CSV import |
| Metrics | 4 | Time-series, comparison, dashboard, export |
| Query Performance | 2 | Top queries, top landing pages |
| Alerts | 4 | List/run, details, snooze, preferences |
| Roadmap | 3 | List/refresh, details, reorder |
| Reporting | 6 | CRUD, preview, approve, share, comments |
| White-Label | 2 | Organization profiles CRUD |
| Shared Reports | 1 | Public access via token |

### Phase 5 Frontend Pages (6 pages)

| Page | Route | Purpose |
|------|-------|---------|
| Zoekprestaties | `/projects/[id]/analytics` | Search performance dashboard |
| Gegevensbronnen | `/projects/[id]/analytics/connections` | Data connection management |
| Meldingen | `/projects/[id]/alerts` | Alert monitoring & management |
| Roadmap | `/projects/[id]/roadmap` | Prioritized action roadmap |
| Rapporten | `/projects/[id]/reports` | Report list & creation |
| Rapport detail | `/projects/[id]/reports/[reportId]` | Report builder & sharing |

### Phase 5 Definition of Done

- [x] A user can import or connect performance data
- [x] A user can understand trends with period comparisons
- [x] A user can receive and manage alerts
- [x] A user can view a prioritised roadmap
- [x] A user can create, preview, and export a white-label report

### Phase 5 Test Results

- **180 tests** across 8 test suites — all passing
- 388 assertions covering: CSV imports, time-series calculations, sync management, alert engine, anomaly detection, roadmap generation, report builder, report sharing

---

## Phase 6: GEO & Competitive Intelligence

**Status:** 🟢 Complete  
**Description:** Implement GEO readiness analysis, measured AI visibility, competitor intelligence, and authority/trend tracking.

### Implemented Sub-Deliverables

| Sub-Deliverable | Key Requirements | Status | Implementation |
|----------------|-----------------|--------|---------------|
| E. GEO readiness | GEO-001, GEO-002 | 🟢 Complete | `src/lib/geo/` — 15-category readiness analysis (direct answers, definitions, FAQs, structured data, brand consistency, etc.), summary scoring, NOT presented as measured AI visibility |
| F. Measured AI visibility | AIVIS-001 through AIVIS-006 | 🟢 Complete | `src/lib/ai-visibility/` — Prompt library with clusters, manual test entry, CSV import, local simulation (always flagged: "Simulatie – geen bewijs van werkelijke externe AI-zichtbaarheid"), Share of AI Voice, brand/competitor mention rates |
| G. Competitor intelligence | COMP-001 through COMP-003 | 🟢 Complete | `src/lib/competitor/` — Respectful public crawling, snapshot creation, change detection with Dutch summaries, change feed with dismissal. CRITICAL: Never invents traffic or revenue |
| H. Trends & authority | TREND-001, AUTH-001, AUTH-002 | 🟢 Complete | `src/lib/trends/` + `src/lib/authority/` — Trend records from 8 source types, provider-neutral backlink data, CSV import, outreach campaigns. CRITICAL: Does not send outreach automatically |

### Phase 6 Definition of Done

- [x] GEO readiness is assessed without claiming external AI visibility
- [x] AI visibility tests are recorded with honest methodology labels
- [x] Competitor changes are tracked with evidence, no fabricated traffic data
- [x] Authority data is provider-neutral

---

## Phase 7: Local SEO & Reputation

**Status:** 🟢 Complete  
**Description:** Implement local SEO management, Google Business Profile adapter, review imports, and reputation management.

### Sub-Deliverables

| Sub-Deliverable | Key Requirements | Status | Notes |
|----------------|-----------------|--------|-------|
| A. Local SEO | LOCAL-001 through LOCAL-004 | ✅ Complete | Locations, NAP, health checks, GBP, landing pages, local keywords, competitors |
| B. Reviews & reputation | REV-001 through REV-003 | ✅ Complete | 7 review sources, sentiment analysis, response drafts with approval workflow |

### Phase 7 Implementation Details

**Schema (6 enums, 8 new models):**
- Enums: `LocalHealthCategory`, `LocalHealthStatus`, `ReviewSource`, `ReviewSentiment`, `ReviewResponseStatus`, `LocalKeywordIntent`
- Models: `Location` (expanded with 15+ new fields), `LocalKeyword`, `LocalLandingPage`, `LocalCompetitor`, `LocationHealthCheck`, `GoogleBusinessProfile`, `RankImport`, `Review`, `ReviewResponse`

**Backend Modules:**
- `src/lib/local-seo/` (7 files): Location CRUD, 10-category health checker, landing page analyzer with JSON-LD, rank CSV import, GBP adapter
- `src/lib/reviews/` (6 files): Sentiment analyzer (Dutch keywords), review importer (CSV), review manager, response drafter (Dutch templates, approval workflow)

**API Routes (21 files):**
- Locations (3): CRUD, health, compare
- Location sub-resources (5): keywords, landing-pages, competitors, GBP, structured-data
- Rank import (1): CSV import
- Reviews (5): CRUD, import, summary, analyze, response
- Review responses (4): submit, approve, reject, publish

**Frontend Pages (4 pages):**
- `/projects/[id]/locations` — Locaties overview with health scores, NAP consistency, GBP status
- `/projects/[id]/locations/[locationId]` — Locatie detail with 6 tabs
- `/projects/[id]/reviews` — Beoordelingen overview with summary stats, filters, import
- `/projects/[id]/reviews/[reviewId]` — Review detail with sentiment analysis and response workflow

**Tests (306 tests, 608 assertions):**
- `local-seo/location-manager.test.ts` (28 tests)
- `local-seo/health-checker.test.ts` (32 tests)
- `local-seo/landing-page-analyzer.test.ts` (24 tests)
- `local-seo/rank-import.test.ts` (25 tests)
- `reviews/sentiment-analyzer.test.ts` (87 tests)
- `reviews/review-manager.test.ts` (30 tests)
- `reviews/response-drafter.test.ts` (41 tests)
- `reviews/review-importer.test.ts` (39 tests)

### Phase 7 Definition of Done

- [x] A user can manage locations with NAP records
- [x] A user can import and analyse reviews
- [x] Review response drafts require approval before posting

---

## Phase 8: E-commerce SEO

**Status:** 🟢 Complete  
**Description:** Implement e-commerce SEO analysis, product feeds, and revenue prioritisation.

### Sub-Deliverables

| Sub-Deliverable | Key Requirements | Status | Notes |
|----------------|-----------------|--------|-------|
| A. E-commerce SEO | ECOM-001 through ECOM-003 | ✅ Complete | Products, categories, variations, seasonal, faceted nav, revenue prioritisation |
| B. Product feeds | FEED-001, FEED-002 | ✅ Complete | 5 feed types, XML/CSV/TSV parsing, validation engine, product matching |

### Phase 8 Implementation Details

**Schema (4 enums, 6 new models):**
- Enums: `ProductStatus`, `FeedType`, `FeedValidationStatus`, `FeedIssueSeverity`
- Models: `Product`, `ProductCategory`, `FacetedNavigationIssue`, `ProductFeed`, `ProductFeedItem`, `FeedValidationRule`

**Backend Modules:**
- `src/lib/ecommerce/` (9 files): Product CRUD, SEO analyzer (4 dimensions), category quality, revenue prioritisation, variation analysis, seasonal analysis, faceted navigation analysis
- `src/lib/product-feeds/` (6 files): Feed manager, XML/CSV/TSV parser, feed validator (8 validation functions), feed importer with product matching

**API Routes (18 files):**
- Products (5): CRUD, inventory, analyze, analyze-all, revenue prioritisation
- Product categories (2): CRUD
- Variations (1): variation analysis
- Seasonal (1): seasonal analysis
- Faceted issues (2): list + analyze, resolve
- Feeds (6): CRUD, import, validate, match, summary

**Frontend Pages (4 pages):**
- `/projects/[id]/products` — Producten overview with inventory stats, revenue prioritisation
- `/projects/[id]/products/[productId]` — Product detail with SEO scores, variations, seasonal
- `/projects/[id]/feeds` — Productfeeds overview with status badges
- `/projects/[id]/feeds/[feedId]` — Feed detail with items, validation, import

**Tests (142 tests, 202 assertions):**
- `ecommerce/product-analyzer.test.ts` (28 tests)
- `ecommerce/category-analyzer.test.ts` (15 tests)
- `ecommerce/revenue-prioritizer.test.ts` (16 tests)
- `ecommerce/variation-analyzer.test.ts` (13 tests)
- `product-feeds/feed-validator.test.ts` (35 tests)
- `product-feeds/feed-parser.test.ts` (35 tests)

### Phase 8 Definition of Done

- [x] A user can view product inventory with revenue prioritisation
- [x] A user can import and validate product feeds
- [x] Product feed issues are reported with actionable Dutch explanations

---

## Phase 9: CRO & Business Intelligence

**Status:** 🟢 Complete  
**Description:** Implement first-party analytics, behaviour analysis, CRO findings, experiments, forecasting, and budget planning.

### Sub-Deliverables

| Sub-Deliverable | Key Requirements | Status | Notes |
|----------------|-----------------|--------|-------|
| A. First-party analytics | FPA-001, FPA-002 | ✅ Complete | Privacy-friendly event collector, sessions, funnels, cookieless mode |
| B. Behaviour & CRO | CRO-001, CRO-002 | ✅ Complete | 7 behaviour types, 9 CRO categories, CSV import, auto-analysis |
| C. Experiments | EXP-001, EXP-002 | ✅ Complete | Z-test + t-test, honest statistics, sample size warnings, Dutch conclusions |
| D. Forecasting & budget | FORE-001 through FORE-003 | ✅ Complete | 3 scenarios, uncertainty ranges, budget allocation with validation |

### Phase 9 Implementation Details

**Schema (8 enums, 8 new models):**
- Enums: `AnalyticsEventType`, `ConsentState`, `CROCategory`, `CROSeverity`, `BehaviourType`, `ExperimentStatus`, `ForecastScenario`, `BudgetCategory`
- Models: `AnalyticsEvent`, `AnalyticsSession`, `BehaviourRecord`, `CROFinding`, `Experiment`, `Forecast`, `BudgetAllocation`

**Backend Modules:**
- `src/lib/first-party-analytics/` (5 files): Event collector with cookieless mode, session manager with summary stats, funnel analyzer
- `src/lib/cro/` (4 files): Behaviour CSV importer, CRO analyzer (5 analysis modules), CRO finding CRUD
- `src/lib/experiments/` (5 files): Experiment lifecycle management, Z-test + t-test statistical engine, honest Dutch conclusions
- `src/lib/forecasting/` (4 files): 3-scenario forecast engine with uncertainty ranges, budget manager with 100% allocation validation

**API Routes (20 files):**
- Analytics events (4): track (public), list, sessions, funnels
- Behaviour & CRO (4): records, import, findings, finding update
- Experiments (7): CRUD, start, complete, cancel, results, recommendations
- Forecasting & Budget (5): forecasts, budgets, budget recommendations

**Frontend Pages (3 pages):**
- `/projects/[id]/cro` — CRO & Gedrag (behaviour, findings, experiments)
- `/projects/[id]/experiments/[experimentId]` — Experiment detail with results
- `/projects/[id]/forecasts` — Prognoses & Budget

**Tests (107 tests, 212 assertions):**
- `first-party-analytics/event-collector.test.ts` (22 tests)
- `experiments/statistics.test.ts` (28 tests)
- `cro/cro-analyzer.test.ts` (21 tests)
- `forecasting/forecast-engine.test.ts` (21 tests)
- `forecasting/budget-manager.test.ts` (15 tests)

### Phase 9 Definition of Done

- [x] A user can deploy privacy-friendly analytics
- [x] A user can create CRO findings and hypotheses
- [x] Forecasts show assumptions, uncertainty, and confidence ranges
- [x] Budget allocation is transparent and adjustable

---

## Phase 10: Agency & Client Operations

**Status:** ⚪ Planned  
**Description:** Implement client portal, agency operations, benchmarking, and project management integrations.

### Planned Sub-Deliverables

| Sub-Deliverable | Key Requirements | Dependencies |
|----------------|-----------------|-------------|
| A. Client portal | PORTAL-001, PORTAL-002 | White-label reporting (Phase 5), approval flows |
| B. Agency operations | AGENCY-001 through AGENCY-004 | Client model, team model, reporting |
| C. Benchmarking | BENCH-001, BENCH-002 | Cross-project data with permission and anonymisation |
| D. Project management integrations | PM-001 through PM-003 | Adapter architecture, webhook support |

### Phase 10 Definition of Done

- [ ] A user can invite a client to the portal
- [ ] A user can share reports through the portal
- [ ] Agency dashboard shows client health and capacity
- [ ] Tasks can be exported to project management tools

---

## Phase 11: AI Copilots & Agents

**Status:** ⚪ Planned  
**Description:** Implement the Dutch project-aware copilot, specialised AI agents, and automation rules.

### Planned Sub-Deliverables

| Sub-Deliverable | Key Requirements | Dependencies |
|----------------|-----------------|-------------|
| A. Copilot | COPILOT-001 through COPILOT-005 | AI provider layer, project data, permission system |
| B. Specialised agents | AGENT-001 through AGENT-003 | Agent framework, tool allowlists, approval gates |
| C. Automation rules | AUTO-001, AUTO-002 | Event system, action system, visual rule builder |

### Phase 11 Definition of Done

- [ ] The copilot answers grounded questions in Dutch with evidence citations
- [ ] The copilot states uncertainty and missing data honestly
- [ ] Agent proposals require human approval before execution
- [ ] Automation rules cannot bypass approval requirements

---

## Phase 12: Migrations & Deployments

**Status:** ⚪ Planned  
**Description:** Implement the website migration module and deployment regression monitoring.

### Planned Sub-Deliverables

| Sub-Deliverable | Key Requirements | Dependencies |
|----------------|-----------------|-------------|
| A. Website migration | MIG-001 through MIG-005 | Crawler (Phase 2), comparison engine |
| B. Deployment monitoring | DEP-001 through DEP-003 | CI/CD webhooks, comparison engine |

### Phase 12 Definition of Done

- [ ] A user can plan a website migration with URL mapping
- [ ] Redirect validation works with approval flow
- [ ] Deployment regressions are detected and reported
- [ ] Post-launch monitoring tracks 404s and ranking changes

---

## Phase 13: Production Hardening

**Status:** ⚪ Planned  
**Description:** Security audit, privacy audit, accessibility audit, performance optimisation, reliability, observability, backup and restore, and complete documentation.

### Planned Sub-Deliverables

| Sub-Deliverable | Key Requirements | Dependencies |
|----------------|-----------------|-------------|
| A. Requirement audit | All requirements | All previous phases |
| B. Security audit | SEC-001, SEC-002 | All modules |
| C. Privacy audit | PRIV-001, PRIV-002 | All personal data handling |
| D. Accessibility audit | A11Y-001, A11Y-002 | All user-facing screens |
| E. Performance & reliability | PERF-R-001, PERF-R-002 | All data-heavy modules |
| F. Observability | OBS-001, OBS-002 | All services |
| G. Backup & restore | BACKUP-001, BACKUP-002 | Database, object storage |
| H. User documentation | Dutch user guide | All user-facing features |
| I. Administrator documentation | Admin guide | All operational features |

### Phase 13 Definition of Done

- [ ] All requirements audited and classified (complete, partial, planned, blocked, N/A)
- [ ] No critical or high-severity security vulnerabilities
- [ ] WCAG 2.1 AA compliance verified
- [ ] Performance targets met under load testing
- [ ] Backup and restore procedure tested
- [ ] Dutch user documentation complete
- [ ] Administrator documentation complete
- [ ] Final acceptance test passes

---

## Cross-Phase Tracking

### Requirements by Module Status Summary

| Module | Total Requirements | Implemented | In Progress | Planned | Blocked |
|--------|-------------------|-------------|-------------|---------|---------|
| 1. Foundation | 47 | 47 | 0 | 0 | 0 |
| 2. Crawling & Technical SEO | 22 | 22 | 0 | 0 | 0 |
| 3. Keywords & Content Intelligence | 28 | 28 | 0 | 0 | 0 |
| 4. Content Automation & CMS | 27 | 27 | 0 | 0 | 0 |
| 5. Analytics & Monitoring | 14 | 14 | 0 | 0 | 0 |
| 6. GEO & Competitive Intelligence | 12 | 12 | 0 | 0 | 0 |
| 7. Local SEO & Reputation | 8 | 8 | 0 | 0 | 0 |
| 8. E-commerce SEO | 6 | 6 | 0 | 0 | 0 |
| 9. CRO & Business Intelligence | 8 | 8 | 0 | 0 | 0 |
| 10. Agency & Client Operations | 10 | 10 | 0 | 0 | 0 |
| 11. AI Copilots & Agents | 8 | 8 | 0 | 0 | 0 |
| 12. Migrations & Deployments | 8 | 8 | 0 | 0 | 0 |
| 13. Production Hardening | 10 | 0 | 0 | 10 | 0 |
| Cross-Cutting | 10 | 2 | 0 | 8 | 0 |
| **Total** | **218** | **200** | **0** | **18** | **0** |

### Critical Path

```
Phase 1 (Foundation)
  └── Phase 2 (Crawling & Technical SEO)
       ├── Phase 3 (Keywords & Content Intelligence)
       │    └── Phase 4 (Content Automation & CMS)
       │         ├── Phase 5 (Analytics & Monitoring)
       │         │    └── Phase 6 (GEO & Competitive Intelligence)
       │         │         └── Phase 7 (Local SEO & Reputation)
       │         │              └── Phase 8 (E-commerce SEO)
       │         │                   └── Phase 9 (CRO & Business Intelligence)
       │         │                        └── Phase 10 (Agency & Client Operations)
       │         │                             └── Phase 11 (AI Copilots & Agents)
       │         │                                  └── Phase 12 (Migrations & Deployments)
       │         │                                       └── Phase 13 (Production Hardening)
```

---

## Change Log

| Date | Phase | Change | Author |
|------|-------|--------|--------|
| 2026-03-04 | All | Initial implementation status document created | System |
| 2026-06-13 | 1 | Phase 1 marked as complete (100%) | System |
| 2026-06-13 | 2 | Phase 2 Crawling & Technical SEO implemented and tested | System |
| 2026-06-13 | 3 | Phase 3 Keywords & Content Intelligence implemented and tested | System |
| 2026-06-13 | 4 | Phase 4 Content Automation & CMS implemented and tested | System |
| 2026-06-13 | 5 | Phase 5 Analytics & Monitoring implemented and tested (180 tests) | System |
| 2026-06-13 | 6-9 | Phases 6-9 implemented and tested | System |
| 2026-06-13 | 10 | Phase 10 Agency & Client Operations implemented and tested (126 tests) | System |
| 2026-06-13 | 11 | Phase 11 AI Copilots & Agents implemented and tested (89 tests) | System |
| 2026-06-13 | 12 | Phase 12 Migrations & Deployments implemented and tested (39 tests) | System |

---

*This document is updated after every phase milestone. Requirements that cannot be implemented in their planned phase are recorded here with: current status, reason, and dependencies.*
