# SEOCoach — Product Requirements

**Document version:** 1.0  
**Date:** 2026-03-04  
**Status:** Active  

---

## Overview

This document defines the complete functional requirements for SEOCoach, an AI-driven SEO automation platform for Dutch entrepreneurs, marketers, e-commerce businesses, and SEO agencies. Requirements are organised by module and mapped to implementation phases. Every requirement must be traceable in `REQUIREMENTS_TRACEABILITY.md`.

---

## Module 1: Foundation & Multi-Tenant Platform

### 1.1 Authentication

| ID | Requirement |
|----|------------|
| AUTH-001 | Users can register with email and password. Registration requires email verification. |
| AUTH-002 | Users can log in and log out. Sessions are managed securely with configurable expiry. |
| AUTH-003 | Password reset architecture is implemented. Passwords are hashed using a modern, adaptive algorithm (bcrypt or Argon2). |
| AUTH-004 | Rate limiting is enforced on authentication endpoints to prevent brute-force attacks. |
| AUTH-005 | Authentication audit events are recorded: registration, login, logout, failed login, password reset, email verification. |
| AUTH-006 | Development mode uses a local email preview mechanism. No paid email provider is required. |
| AUTH-007 | Session management supports concurrent session control and remote session termination. |

### 1.2 Multi-Tenancy

| ID | Requirement |
|----|------------|
| TEN-001 | Organisations are the primary tenant boundary. Every tenant-owned database record includes an explicit `organisationId`. |
| TEN-002 | Organisation memberships link users to organisations with defined roles. |
| TEN-003 | Clients represent agency clients within an organisation. |
| TEN-004 | Website projects belong to a client and contain domains, locations, and all project data. |
| TEN-005 | Domains are registered within a project and validated before crawling. |
| TEN-006 | Locations represent physical or service-area locations for local SEO within a project. |
| TEN-007 | User invitations are sent by organisation owners or managers. Invitation links expire. |
| TEN-008 | Every tenant-owned query is tenant-aware: database queries include the tenant context and cannot accidentally return cross-tenant data. |
| TEN-009 | Every background job carries tenant context and operates only within that tenant's scope. |
| TEN-010 | Automated tests prove that one organisation cannot read or modify another organisation's data. |

### 1.3 Role-Based Access Control (RBAC)

| ID | Requirement |
|----|------------|
| RBAC-001 | The following roles are supported: Platform Administrator, Organisation Owner, Agency Owner, SEO Manager, Content Manager, Editor, Developer, Client, Read-Only User. |
| RBAC-002 | Permissions are defined centrally. Permission rules are not spread unpredictably throughout components. |
| RBAC-003 | Each role has a defined set of allowed actions. Roles can be viewed but not modified by non-administrators. |
| RBAC-004 | Object-level permissions restrict access to specific projects, clients, and resources. |
| RBAC-005 | Role changes are audit-logged. |
| RBAC-006 | Client-role users can only access data explicitly shared with them through the client portal. |

### 1.4 Brand Profile

| ID | Requirement |
|----|------------|
| BRAND-001 | Each project has a BrandProfile containing: brand name, description, products, services, audiences, regions, tone of voice, address preference, preferred terminology, prohibited terminology, allowed claims, prohibited claims, proof points, certifications, contact information, conversion goals, editorial rules, and disclaimers. |
| BRAND-002 | The BrandProfile defaults to Dutch locale settings. |
| BRAND-003 | BrandProfile data is injected into AI content generation to maintain brand consistency. |
| BRAND-004 | Prohibited terminology and prohibited claims are checked against during content quality analysis. |
| BRAND-005 | BrandProfile changes are audit-logged. |

### 1.5 Onboarding

| ID | Requirement |
|----|------------|
| ONB-001 | A Dutch onboarding wizard guides new users through setup with the following steps: Organisatie, Bedrijf, Website, Doelen, Doelgroepen, Producten en diensten, Regio's, Koppelingen, Eerste scan voorbereiden, Overzicht. |
| ONB-002 | Each step provides clear Dutch explanations of what is being asked and why. |
| ONB-003 | Integration steps are optional and can be skipped. |
| ONB-004 | The onboarding wizard populates the BrandProfile automatically from user responses. |
| ONB-005 | Onboarding is accessible (keyboard-navigable, screen-reader friendly, WCAG 2.1 AA). |

### 1.6 Dashboard

| ID | Requirement |
|----|------------|
| DASH-001 | The dashboard is role-aware: different roles see different widgets, actions, and priorities. |
| DASH-002 | Project health indicators are based only on real available data. No fabricated SEO metrics are displayed before crawling and integrations are implemented. |
| DASH-003 | The dashboard shows: important actions, recent activity, integration status, scheduled work, and approval requests. |
| DASH-004 | Empty states are designed for every dashboard widget: clear messages explain what data is needed and how to provide it. |
| DASH-005 | The central action list ("Mijn belangrijkste acties") displays prioritised actions with: title, plain-language description, business impact, SEO impact, priority, effort, owner, deadline, status, automation availability, and approval requirement. |

### 1.7 Job System

| ID | Requirement |
|----|------------|
| JOB-001 | Jobs can be created, queued, and monitored with visible status and progress. |
| JOB-002 | Jobs support retries with configurable backoff, cancellation, and error storage. |
| JOB-003 | Every job carries tenant context and operates only within that tenant's scope. |
| JOB-004 | Users can view their job history with status, duration, and error details. |
| JOB-005 | Jobs are idempotent: re-running a job with the same inputs produces the same result without duplication. |
| JOB-006 | Dead-letter handling exists for jobs that exhaust retries. |

### 1.8 Audit Logging

| ID | Requirement |
|----|------------|
| AUDIT-001 | The following events are audit-logged: authentication events, membership changes, role changes, project changes, brand profile changes, integration configuration changes, and all sensitive actions. |
| AUDIT-002 | Audit logs include: timestamp, user, action, affected entity, before and after values, and source (UI, API, or system). |
| AUDIT-003 | Audit logs are immutable and cannot be deleted by non-platform-administrators. |
| AUDIT-004 | Audit logs are tenant-scoped: each tenant can see only their own audit events. |

### 1.9 Internationalisation

| ID | Requirement |
|----|------------|
| I18N-001 | The default user-facing locale is Dutch (nl-NL). Dutch (nl-BE) is also supported. |
| I18N-002 | English is used as a technical fallback for developer-facing strings only. |
| I18N-003 | All user-facing strings use translation keys. No hardcoded Dutch or English text in components. |
| I18N-004 | Locale switching is supported at the user level. |
| I18N-005 | Dates, numbers, and currency values are formatted according to the user's locale. |

### 1.10 Settings

| ID | Requirement |
|----|------------|
| SET-001 | Organisation settings include: name, address, logo, default locale, time zone, and notification preferences. |
| SET-002 | Project settings include: domain, crawl configuration, automation level, and privacy preferences. |
| SET-003 | User settings include: locale, time zone, notification preferences, and privacy preferences. |
| SET-004 | Automation level is configurable per project: from fully manual to supervised automation. |

---

## Module 2: Crawling & Technical SEO

### 2.1 Safe Crawler

| ID | Requirement |
|----|------------|
| CRAWL-001 | The crawler respects domain allowlists: only explicitly approved domains are crawled. |
| CRAWL-002 | The crawler honours robots.txt directives including crawl-delay. |
| CRAWL-003 | Crawl rate limiting is configurable per project. Maximum page limits and depth limits prevent runaway crawls. |
| CRAWL-004 | URL normalisation prevents duplicate crawling of equivalent URLs. |
| CRAWL-005 | Sitemap discovery and XML sitemap parsing are supported. |
| CRAWL-006 | Redirect handling follows redirects within limits; redirect chains and loops are detected. |
| CRAWL-007 | HTML parsing extracts: title, description, headings, canonical, meta robots, language, internal links, external links, images, structured data, and main content. |
| CRAWL-008 | Crawl progress is visible to the user. Crawls can be cancelled. |
| CRAWL-009 | SSRF protection blocks: internal IP addresses, localhost, cloud metadata endpoints, non-HTTP protocols, and redirects to private networks. |
| CRAWL-010 | Protection against: excessively large responses, decompression bombs, and malicious HTML sanitisation. |
| CRAWL-011 | A Playwright rendering mode is available for selected pages. Not every page is rendered by default. |
| CRAWL-012 | Page snapshots are stored for each crawl, enabling historical comparison. |
| CRAWL-013 | Crawl history is maintained with full metadata: start time, end time, pages found, pages crawled, errors, and configuration. |

### 2.2 Content Inventory

| ID | Requirement |
|----|------------|
| INV-001 | A searchable page inventory displays all crawled pages with filters, sorting, and pagination. |
| INV-002 | Bulk selection enables actions across multiple pages. Saved views persist filter combinations. |
| INV-003 | Each page record stores: URL, status, title, description, H1, word count, canonical, indexability, content type, language, publication date, modification date, internal links, external links, images, alt text, structured data, duplicate similarity, crawl depth, and conversion elements. |
| INV-004 | Export to CSV and other formats is supported. |
| INV-005 | Simple and technical page detail views are available. The simple view hides technical details by default. |

### 2.3 Technical SEO Rule Engine

| ID | Requirement |
|----|------------|
| RULE-001 | An extensible rule engine evaluates crawled pages against a comprehensive set of SEO rules. |
| RULE-002 | Rules cover: 4xx/5xx pages, redirect chains, redirect loops, missing canonical, conflicting canonical, canonical to error, noindex conflicts, robots.txt blocking, sitemap conflicts, missing title, duplicate title, weak/unclear title, missing description, duplicate description, missing H1, multiple H1, heading structure, broken internal links, broken external links, orphan pages, deep pages, missing image alt text, oversized images, mixed content, HTTPS problems, structured data errors, hreflang errors, pagination issues, thin content, duplicate content, near-duplicate content, shadow content, staging URLs, parameter explosion, faceted navigation risks, and JavaScript rendering differences. |
| RULE-003 | Every issue includes: Dutch plain-language explanation, technical details, evidence, severity, priority, impact, effort, affected URLs, recommended action, possible automatic fix, and confidence level. |
| RULE-004 | New rules can be added without modifying core engine code (plugin architecture). |

### 2.4 Source vs. Rendered Analysis

| ID | Requirement |
|----|------------|
| RENDER-001 | Comparisons between source HTML and rendered HTML are provided for: text content, internal links, canonical, robots directives, structured data, headings, and navigation. |
| RENDER-002 | Meaningful differences are highlighted with Dutch explanations of their SEO impact. |

---

## Module 3: Keywords & Content Intelligence

### 3.1 Keyword Management

| ID | Requirement |
|----|------------|
| KW-001 | Keywords can be entered manually or imported from CSV files. |
| KW-002 | Search query storage preserves the original query text, source, and import date. |
| KW-003 | Keywords can be grouped into thematic clusters. |
| KW-004 | Search intent classification is performed using AI (provider-neutral structured output) with non-AI fallback rules. |
| KW-005 | Funnel classification maps keywords to awareness, consideration, and decision stages. |
| KW-006 | Keywords can be mapped to personas, products/services, and locations. |
| KW-007 | Seasonality fields allow marking keywords with expected traffic patterns. |

### 3.2 Opportunity Scoring

| ID | Requirement |
|----|------------|
| OPP-001 | An explainable opportunity score is calculated for each keyword. |
| OPP-002 | Each score component is stored separately and visible to the user. |
| OPP-003 | Score weights are configurable by administrators. |
| OPP-004 | The score calculation is shown in Dutch. The formula is never hidden in a black box. |

### 3.3 Topic Clusters

| ID | Requirement |
|----|------------|
| TOPIC-001 | Topics, clusters, and pillar pages can be created and managed. |
| TOPIC-002 | Supporting pages are linked to pillar pages with defined relations. |
| TOPIC-003 | Each cluster entry includes: suggested URL, search intent, funnel stage, conversion goal, priority, impact, and effort. |
| TOPIC-004 | A visual graph view displays topic cluster relationships. |
| TOPIC-005 | An accessible list view is provided as an alternative to the graph. |
| TOPIC-006 | Drag-and-drop editing is supported with accessible alternatives. |
| TOPIC-007 | Relationship editing allows changing pillar-supporting connections. |

### 3.4 AI Provider Layer

| ID | Requirement |
|----|------------|
| AI-001 | An Ollama adapter connects to local Ollama instances for AI inference. |
| AI-002 | A generic OpenAI-compatible adapter connects to OpenAI-compatible endpoints. |
| AI-003 | Provider interface abstracts provider-specific details. Model discovery is supported where possible. |
| AI-004 | Connection testing validates provider availability before use. |
| AI-005 | Structured output is supported for consistent AI responses. |
| AI-006 | Retry, timeout, and fallback logic handles provider failures gracefully. |
| AI-007 | Token usage and cost tracking are recorded per request, per project, per tenant. |
| AI-008 | Local-provider (Ollama) usage is marked as zero-cost. |
| AI-009 | Privacy settings control which data is sent to external AI providers. |
| AI-010 | Prompt template versioning tracks changes to AI prompts over time. |
| AI-011 | An external paid AI provider is not required for any core functionality. |

### 3.5 Content Briefs & Studio Foundation

| ID | Requirement |
|----|------------|
| BRIEF-001 | Content opportunities are surfaced from keyword research, gap analysis, and topic clusters. |
| BRIEF-002 | Content briefs include: target keyword, search intent, outline, source selection, and brand profile injection. |
| BRIEF-003 | An outline editor allows structured content planning. |
| BRIEF-004 | Source selection enables users to choose existing pages, brand data, and uploaded documents as grounding material. |
| BRIEF-005 | Draft generation uses AI with brand profile injection and source grounding. |
| BRIEF-006 | Content versions are stored with full diff view between versions. |
| BRIEF-007 | Approval states track content through: draft, review, approved, published. |
| BRIEF-008 | Claim markers identify statements that need verification against sources. |

### 3.6 Content Quality, Decay & Pruning

| ID | Requirement |
|----|------------|
| QUAL-001 | Quality analysis covers: intent alignment, topic coverage, readability, originality, brand consistency, E-E-A-T signals, internal links, entities, conversion strength, GEO readiness, and publication readiness. |
| QUAL-002 | Decay detection uses available historical data. When historical data is unavailable, the platform clearly states that no trend can yet be calculated. |
| QUAL-003 | Pruning recommendations classify pages as: keep, improve, merge, redirect, noindex, or remove. |
| QUAL-004 | Risk analysis is required before destructive pruning recommendations. |
| QUAL-005 | Every quality score is explainable: the user can see which factors contributed and how. |

---

## Module 4: Content Automation & CMS

### 4.1 Full AI Content Studio

| ID | Requirement |
|----|------------|
| STUDIO-001 | The content workflow follows: select opportunity → select content type → generate brief → edit outline → select sources → generate draft → run quality checks → review claims → add internal links → preview → approve → save as CMS draft → schedule or publish → monitor publication status. |
| STUDIO-002 | Supported content types: articles, service pages, location pages, category pages, product descriptions, comparison pages, FAQs, glossary pages, how-to content, pillar pages, landing pages, AI answer posts, meta titles, meta descriptions, CTAs, introductions, and content updates. |
| STUDIO-003 | Source grounding records which sources were used. Claims not supported by selected sources are flagged. The platform never claims generated text is factually verified when it is not. |

### 4.2 Content Quality Controls

| ID | Requirement |
|----|------------|
| QC-001 | Pre-publication quality checks run: duplicate comparison, near-duplicate comparison, brand consistency, prohibited claim detection, prohibited terminology detection, search intent check, readability check, internal link check, conversion check, GEO readiness check, unsupported claim check, location page uniqueness check, and product data consistency check. |
| QC-002 | Findings are classified as blocking (must be resolved before publishing) or non-blocking (warnings). |

### 4.3 Internal Linking

| ID | Requirement |
|----|------------|
| LINK-001 | Internal link suggestions are generated from: semantic analysis, topic cluster relationships, orphan page detection, strong-page authority, and anchor variation. |
| LINK-002 | Existing links are detected to avoid duplicate suggestions. Broken link replacement suggestions are provided. |
| LINK-003 | Cannibalisation safeguards prevent linking to pages that compete for the same keyword. |
| LINK-004 | Each suggestion includes: context snippet, confidence score, and recommended anchor text. |
| LINK-005 | Approval workflows support: single approval, bulk approval, diff preview, CMS publishing, and rollback metadata. |

### 4.4 Structured Data Generator

| ID | Requirement |
|----|------------|
| SCHEMA-001 | Visual editors and JSON-LD generation are provided for: Organization, LocalBusiness, Product, Offer, Review, BreadcrumbList, Article, FAQPage, HowTo, Person, Event, JobPosting, Service, WebSite, and WebPage. |
| SCHEMA-002 | Validation checks: required fields, consistency with visible page content, product data, review data, price data, and availability data. |
| SCHEMA-003 | Missing values are never fabricated. The user is informed when required data is unavailable. |

### 4.5 WordPress Integration

| ID | Requirement |
|----|------------|
| WP-001 | Connection wizard with secure credential storage (application passwords). Connection test validates access and capabilities. |
| WP-002 | Import: pages, posts, categories, tags, authors (where available), and media. |
| WP-003 | Publishing: draft creation, draft update, preview, scheduling, publishing, slug, excerpt, featured image, and category/tag assignment. |
| WP-004 | SEO metadata adapter architecture supports popular SEO plugins. |
| WP-005 | Error handling with retry, audit logging, and rollback metadata. Publication status is tracked. |

### 4.6 WooCommerce Integration

| ID | Requirement |
|----|------------|
| WOO-001 | Connection wizard with secure credential storage. Connection test validates access. |
| WOO-002 | Import: products, categories, variations, product descriptions, short descriptions, category content, inventory status, prices, public product metadata, and reviews (where available). |
| WOO-003 | Sales and revenue signals are imported where authorised. |
| WOO-004 | Draft updates where supported, with publication audit trail. |

### 4.7 Programmatic SEO

| ID | Requirement |
|----|------------|
| PSEO-001 | Template-based page generation for: service+location, product+use case, product+audience, product+feature, category+feature, industry+service, integration+platform, comparison pages, and glossary pages. |
| PSEO-002 | Quality gates prevent publication of pages that fail: unique data requirement, minimum value threshold, duplicate check, cannibalisation check, template completeness, brand check, claim check, and internal link check. |
| PSEO-003 | The system never publishes thin or doorway pages. |
| PSEO-004 | Variable editor, data preview, sample page generation, and bulk preview are provided. |
| PSEO-005 | Exclusion reasons are shown for rejected pages. An approval queue controls publication. |
| PSEO-006 | Publication limits and scheduling control the pace of programmatic content. |
| PSEO-007 | Rollback is supported for programmatic content published to CMS. |

### 4.8 Content Decay & Pruning Workflows

| ID | Requirement |
|----|------------|
| DECAY-001 | Users can view declining pages, generate update briefs, compare old and proposed content, approve revisions, publish updates, and monitor post-update metrics. |
| DECAY-002 | The platform does not claim decline when insufficient historical data exists. |
| PRUNE-001 | Pruning recommendations include: evidence, risk assessment, affected internal links, search performance impact, conversion performance impact, and proposed redirects. |
| PRUNE-002 | Removal actions require explicit approval. Rollback guidance is provided for every pruning action. |

### 4.9 Change History

| ID | Requirement |
|----|------------|
| CHG-001 | All content changes are tracked: previous content, new content, user, AI agent, timestamp, CMS result, rollback data, and approval. |

---

## Module 5: Analytics & Monitoring

### 5.1 Search Performance & Analytics

| ID | Requirement |
|----|------------|
| PERF-001 | Adapter architecture and working imports for: Google Search Console, Google Analytics 4, CSV search performance, CSV analytics, CSV conversions, and CSV revenue. |
| PERF-002 | Time-series metrics are stored for: clicks, impressions, CTR, average position, sessions, landing pages, conversions, revenue, product revenue, and query performance. |
| PERF-003 | Date comparison supports: previous period, year-over-year (where data exists), filters, segments, export, data freshness indicator, sync status, and missing-data explanations. |

### 5.2 Monitoring & Alerts

| ID | Requirement |
|----|------------|
| ALERT-001 | Alerts are generated for: ranking drops, click drops, impression drops, CTR drops, conversion drops, revenue drops, indexing issues, new 404 pages, unexpected noindex, broken integrations, publishing failures, content decay, competitor changes, lost AI mentions, negative review trends, and deployment regressions. |
| ALERT-002 | Alert management supports: severity, thresholds, minimum data volume, anomaly detection architecture, grouping, snooze, acknowledge, resolve, assign, and notification preferences. |
| ALERT-003 | Daily and weekly digest architecture is implemented. |

### 5.3 Roadmap

| ID | Requirement |
|----|------------|
| ROAD-001 | Roadmap recommendations are generated from: technical issues, content gaps, keyword opportunities, decay, internal links, competitors, GEO, local SEO, e-commerce, CRO, and revenue. |
| ROAD-002 | Views: today, this week, this month, 90 days, later, Kanban, calendar, table, and timeline. |

### 5.4 White-Label Reporting

| ID | Requirement |
|----|------------|
| REPORT-001 | WhiteLabelProfile includes: logo, colours, fonts, organisation details, footer, introduction, closing text, sender identity, branding removal, and custom-domain-ready architecture. |
| REPORT-002 | Report types: monthly, quarterly, technical audit, content, keywords, competitors, local SEO, GEO, WooCommerce, CRO, revenue, executive, holistic, and custom. |
| REPORT-003 | Report builder supports: drag-and-drop sections, KPI cards, charts, tables, text, recommendations, roadmap, page breaks, preview, versions, and approval status. |
| REPORT-004 | Output formats: HTML, PDF, CSV, secure share link, password protection, expiry date, client comments, archive, and scheduling. |
| REPORT-005 | Report snapshots ensure historical reports do not unexpectedly change when source data changes. |

---

## Module 6: GEO & Competitive Intelligence

### 6.1 GEO Readiness

| ID | Requirement |
|----|------------|
| GEO-001 | GEO readiness analysis covers: direct answers, definitions, answer blocks, entity clarity, organisation clarity, author information, source transparency, dates, structured data, FAQs, unique information, citable facts, crawlability, indexability, and brand consistency. |
| GEO-002 | The result is presented as a readiness assessment, not as measured external AI visibility. |

### 6.2 Measured AI Visibility

| ID | Requirement |
|----|------------|
| AIVIS-001 | A prompt library and prompt clusters support systematic AI visibility testing. |
| AIVIS-002 | Manual test entry, CSV import, response upload, and screenshot evidence are supported. |
| AIVIS-003 | Permitted provider adapter interface and local simulation are available. |
| AIVIS-004 | Every result stores: method, platform, model, prompt, response, date, country, language, mentions, URLs, sources, competitors, sentiment, accuracy, confidence, and evidence. |
| AIVIS-005 | Local simulations display: "Simulatie — geen bewijs van werkelijke externe AI-zichtbaarheid." |
| AIVIS-006 | Calculated metrics include: Share of AI Voice, brand mentions, source mentions, competitor mentions, accuracy, sentiment, prompt coverage, and funnel coverage. |

### 6.3 Competitor Intelligence

| ID | Requirement |
|----|------------|
| COMP-001 | Respectful public crawling and change detection for: pages, titles, headings, topics, services, categories, locations, structured data, internal links, public prices, publishing frequency, and positioning. |
| COMP-002 | Competitor feed with evidence snapshots, change summaries, impact suggestions, and recommended responses. |
| COMP-003 | The platform never invents traffic or revenue data for competitors. |

### 6.4 Trends & Authority

| ID | Requirement |
|----|------------|
| TREND-001 | Trend records from: search queries, internal search imports, competitor changes, review themes, user-provided news sources, regulation records, seasonality, and AI prompts. |
| AUTH-001 | Provider-neutral authority data for: backlinks, lost links, new links, brand mentions, link gaps, outreach opportunities, and campaigns. |
| AUTH-002 | Outreach is never sent automatically. |

---

## Module 7: Local SEO & Reputation

### 7.1 Local SEO

| ID | Requirement |
|----|------------|
| LOCAL-001 | Location management with NAP records, opening hours, local landing pages, local keywords, and local competitors. |
| LOCAL-002 | Local structured data generation and validation. |
| LOCAL-003 | Location health scores, comparisons, and local content plans. |
| LOCAL-004 | Rank CSV imports and Google Business Profile adapter. |

### 7.2 Review & Reputation Management

| ID | Requirement |
|----|------------|
| REV-001 | Imports and adapters for: Google reviews, WooCommerce reviews, Trustpilot imports, CSV reviews, surveys, and support feedback. |
| REV-002 | Analysis covers: sentiment, themes, complaints, compliments, product issues, service issues, FAQ opportunities, content opportunities, and trust signals. |
| REV-003 | Review response drafts are generated and require approval before public posting. |

---

## Module 8: E-commerce SEO

### 8.1 E-commerce SEO

| ID | Requirement |
|----|------------|
| ECOM-001 | Product inventory, category inventory, variation analysis, out-of-stock handling, seasonal product analysis, and faceted navigation analysis. |
| ECOM-002 | Product structured data analysis, product internal links, product image analysis, and category quality. |
| ECOM-003 | Revenue prioritisation and margin prioritisation (when data exists). |

### 8.2 Product Feeds

| ID | Requirement |
|----|------------|
| FEED-001 | Import and validation for: Merchant feeds, Meta catalogue feeds, comparison feeds, marketplace feeds, and affiliate feeds. |
| FEED-002 | Validation checks: titles, descriptions, GTIN, category, product type, inventory, price, images, missing attributes, website mismatches, and rejection reasons. |

---

## Module 9: CRO & Business Intelligence

### 9.1 First-Party Analytics

| ID | Requirement |
|----|------------|
| FPA-001 | Optional privacy-friendly event collector supporting: page views, sessions, sources, campaigns, events, conversions, funnels, revenue, consent state, cookieless basic mode, and server-side events. |
| FPA-002 | Privacy responsibilities are documented. |

### 9.2 Behaviour & CRO

| ID | Requirement |
|----|------------|
| CRO-001 | Behaviour imports and adapters for: scroll depth, clicks, rage clicks, dead clicks, form abandonment, device type, and engagement. |
| CRO-002 | CRO findings for: CTAs, forms, trust, value proposition, pricing communication, mobile UX, funnels, landing pages, and product pages. |

### 9.3 Experiments

| ID | Requirement |
|----|------------|
| EXP-001 | Experiment tracking with: hypothesis, test group, control group, KPI, dates, expected result, observed result, confidence, conclusion, and follow-up. |
| EXP-002 | The platform does not overstate statistical certainty. |

### 9.4 Forecasting & Budget Planning

| ID | Requirement |
|----|------------|
| FORE-001 | Scenario-based forecasting (conservative, realistic, ambitious) for: traffic, clicks, leads, conversions, revenue, CTR improvement, ranking improvement, content output, and required effort. |
| FORE-002 | Forecasts show: assumptions, inputs, uncertainty, confidence, and ranges. |
| FORE-003 | Budget allocation for: technical SEO, content, updates, authority, digital PR, CRO, local SEO, GEO, monitoring, and reporting. |

---

## Module 10: Agency & Client Operations

### 10.1 Client Portal

| ID | Requirement |
|----|------------|
| PORTAL-001 | White-label client portal with access to explicitly shared: reports, KPI summaries, roadmap, tasks, content drafts, content approval, technical action approval, comments, documents, meeting notes, approval requests, and notification preferences. |
| PORTAL-002 | The portal must never expose: internal margins, private agency notes, other clients, provider credentials, internal AI prompts, or unshared operational data. |

### 10.2 Agency Operations

| ID | Requirement |
|----|------------|
| AGENCY-001 | Client overview, contract limits, deliverables, time tracking, monthly work, client health, team capacity, assignments, recurring tasks, approval queues, and SLAs. |
| AGENCY-002 | Subscription-ready architecture and billing adapter architecture. |
| AGENCY-003 | Profitability fields with restricted permissions. Internal notes hidden from clients. |
| AGENCY-004 | Agency dashboard showing: clients needing attention, reports due, pending approvals, capacity risks, missing deliverables, critical SEO alerts, integration failures, and growth opportunities. |

### 10.3 Benchmarking

| ID | Requirement |
|----|------------|
| BENCH-001 | Within-organisation benchmarking for: CTR, technical health, publishing frequency, content growth, conversion rate, issue resolution speed, GEO readiness, AI visibility, organic growth, and publication speed. |
| BENCH-002 | Cross-client aggregated benchmarking requires explicit permission and anonymisation. |

### 10.4 Project Management Integrations

| ID | Requirement |
|----|------------|
| PM-001 | Adapters for: Jira, Trello, Asana, ClickUp, Monday, Linear, GitHub Issues, and generic webhooks. |
| PM-002 | Each adapter supports: connection test, project mapping, task export, status sync architecture, owner mapping, error handling, and audit logs. |
| PM-003 | Exported SEO tasks include: plain-language summary, technical detail, priority, evidence, URLs, deadline, owner, and source link back to the platform. |

---

## Module 11: AI Copilots & Agents

### 11.1 Dutch Project-Aware Copilot

| ID | Requirement |
|----|------------|
| COPILOT-001 | The copilot answers questions grounded in authorised project data, in Dutch by default. |
| COPILOT-002 | The copilot can address: page improvement priorities, traffic change explanations, missing topics, cannibalisation, competitor changes, technical problem priorities, revenue-affecting opportunities, monthly client summary content, location attention needs, and AI response brand absence. |
| COPILOT-003 | The copilot: cites project evidence, links to internal records, states missing data, states uncertainty, avoids inventing figures, respects permissions, resists prompt injection from crawled pages, and never reveals credentials or system prompts. |
| COPILOT-004 | Copilot tools: create draft task, create draft content brief, create draft report summary, prepare recommendation, open relevant pages, and prepare approval request. |
| COPILOT-005 | The copilot must not directly perform risky actions without an approval workflow. |

### 11.2 Specialised Agents

| ID | Requirement |
|----|------------|
| AGENT-001 | Controlled agents: Strategy, Technical SEO, Content Research, Content Writer, Content Quality, Internal Linking, Local SEO, E-commerce, GEO, Competitor, CRO, Reporting, Publishing, Migration, and Quality Assurance. |
| AGENT-002 | Agent framework includes: tool allowlists, permission checks, tenant context, maximum steps, timeouts, cost limits, provider limits, approval gates, audit logs, input/output schemas, retry policies, cancellation, and human-readable execution summaries. |
| AGENT-003 | Every agent run stores: objective, agent, model, inputs, retrieved sources, proposed actions, completed actions, approvals, errors, cost, duration, result, and confidence. |

### 11.3 Automation Rules

| ID | Requirement |
|----|------------|
| AUTO-001 | Visual automation rule builder with triggers (new technical issue, metric drop, new content opportunity, content decay, new competitor page, new negative review, scheduled date, new AI visibility result, new WordPress draft, product feed error, deployment event) and actions (create task, create alert, generate brief, generate content draft, generate report, notify user, prepare CMS update, run crawl, run quality check, create approval request, call webhook). |
| AUTO-002 | High-risk actions require explicit configuration and approval rules. No automation publishes or deletes without human approval. |

---

## Module 12: Migrations & Deployments

### 12.1 Website Migration Module

| ID | Requirement |
|----|------------|
| MIG-001 | Migration projects with: old URL crawl, new URL or staging crawl, URL mapping, mapping suggestions, and redirect validation. |
| MIG-002 | Comparisons: metadata, headings, content, canonical, robots, structured data, and internal links. |
| MIG-003 | Pre-launch checklist with launch blockers. Statuses: Nog te controleren, Klaar, Probleem gevonden, Blokkeert lancering, Goedgekeurd. |
| MIG-004 | Post-launch: go-live monitoring, 404 tracking, ranking comparison, traffic comparison, and migration report. |
| MIG-005 | All redirect changes require approval. |

### 12.2 Deployment Monitoring

| ID | Requirement |
|----|------------|
| DEP-001 | Integrations or webhooks for: GitHub, GitLab, and generic CI/CD. |
| DEP-002 | Post-deployment checks for: robots.txt, canonicals, titles, meta robots, sitemaps, status codes, structured data, internal links, rendering, performance, and critical URLs. |
| DEP-003 | Deployment records with before-and-after comparison, regression findings, severity, suggested rollback, notification, and optional blocking status. Blocking must be explicitly enabled. |

---

## Module 13: Production Hardening

### 13.1 Security

| ID | Requirement |
|----|------------|
| SEC-001 | Security audit covering: authentication, sessions, password handling, tenant isolation, RBAC, object-level permissions, API permissions, background jobs, report links, file uploads, CMS credentials, AI credentials, integration secrets, webhooks, SSRF, private IP protection, crawler redirects, HTML sanitisation, XSS, CSRF, SQL injection, command injection, path traversal, rate limiting, brute-force protection, audit logging, secret masking, error information leakage, dependency vulnerabilities, container security, backup security, prompt injection, AI tool misuse, and agent privilege escalation. |
| SEC-002 | Critical and high-severity issues are resolved before launch. |

### 13.2 Privacy

| ID | Requirement |
|----|------------|
| PRIV-001 | Privacy audit covering: personal data collection, consent, analytics, behaviour tracking, review data, client portal data, AI provider data transfer, data retention, data deletion, data export, backups, logs, screenshots, and uploaded files. |
| PRIV-002 | Data export, project deletion, account deletion, retention controls, external AI consent, analytics consent, and behaviour tracking consent are implemented. |

### 13.3 Accessibility

| ID | Requirement |
|----|------------|
| A11Y-001 | WCAG 2.1 AA compliance: keyboard access, focus order, focus visibility, screen reader labels, form errors, colour contrast, charts, tables, dialogs, drag-and-drop alternatives, reduced motion, responsive layout, zoom, and Dutch language metadata. |
| A11Y-002 | Accessible alternatives for: topic cluster editing, report builder, Kanban, and automation builder. |

### 13.4 Performance & Reliability

| ID | Requirement |
|----|------------|
| PERF-R-001 | Database indexes, N+1 query resolution, large table optimisation, time-series query optimisation, crawl storage, page snapshot storage, report generation, PDF rendering, background job optimisation, frontend bundle optimisation, API pagination, and caching. |
| PERF-R-002 | Health checks, readiness checks, graceful shutdown, job retries, dead-letter handling, idempotency, transaction boundaries, migration safety, backup verification, restore procedure, failed integration recovery, partial sync recovery, report generation recovery, and CMS publishing recovery. |

### 13.5 Observability

| ID | Requirement |
|----|------------|
| OBS-001 | Structured logs, request IDs, job IDs, tenant-safe logging, error tracking interface, metrics, queue metrics, crawl metrics, integration metrics, AI usage metrics, report generation metrics, and health dashboard. |
| OBS-002 | Credentials, full access tokens, and unnecessary sensitive content are never logged. |

### 13.6 Backup & Restore

| ID | Requirement |
|----|------------|
| BACKUP-001 | PostgreSQL backup procedure, object storage backup procedure, encryption guidance, retention guidance, restore procedure, restore verification, and disaster recovery checklist. |
| BACKUP-002 | Restore is tested in an automated or documented reproducible environment. |

---

## Cross-Cutting Requirements

| ID | Requirement |
|----|------------|
| CC-001 | **Tenant isolation**: Every data access path enforces tenant boundaries. Automated tests verify isolation on every deployment. |
| CC-002 | **Dutch-first**: All user-facing text defaults to Dutch (nl-NL, nl-BE). English is a technical fallback only. No unexplained acronyms. |
| CC-003 | **No fabricated metrics**: Scores, trends, and indicators are shown only when real underlying data exists. |
| CC-004 | **Approval-first**: Every publishing, deletion, redirect, and destructive action requires explicit human approval. |
| CC-005 | **Explainable scores**: Every score is decomposable into its factors, shown in plain Dutch. |
| CC-006 | **Safe defaults**: All settings ship with safe default values. Advanced options are behind explicit controls. |
| CC-007 | **Contextual help**: Every complex concept has a contextual help icon or tooltip in Dutch. |
| CC-008 | **Consistent labels**: Priority, status, and severity labels are consistent across the entire platform. |
| CC-009 | **Audit logging**: All significant actions are audit-logged with tenant context. |
| CC-010 | **Technology stack**: Next.js 16, TypeScript (strict), Prisma/SQLite (dev), PostgreSQL (prod), NextAuth.js, shadcn/ui, Tailwind CSS. |

---

*Requirements may be deferred across phases but must never be silently removed or simplified. All changes are tracked in REQUIREMENTS_TRACEABILITY.md.*
