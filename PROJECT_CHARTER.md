# SEOCoach — Project Charter

**Document version:** 1.0  
**Date:** 2026-03-04  
**Status:** Active  

---

## 1. Project Vision

SEOCoach is an AI-driven SEO automation platform purpose-built for the Dutch market. It empowers entrepreneurs, marketers, e-commerce businesses, and SEO agencies to plan, execute, and measure their entire organic search strategy from a single, unified platform — without requiring technical expertise.

The platform combines deep SEO intelligence — keyword discovery, search intent analysis, technical auditing, content strategy, and competitor monitoring — with practical automation: AI content generation, programmatic SEO, CMS publishing, internal linking, white-label reporting, and agency operations. Every feature is designed around a single principle: **what you see must be understandable, and every action must be safe and reversible.**

SEOCoach speaks Dutch by default. Every label, score, explanation, and recommendation is written in plain Dutch (nl-NL, nl-BE) without unexplained English acronyms. The platform never fabricates metrics before real data exists, never publishes without explicit approval, and never hides how a score was calculated.

The long-term vision is to become the definitive SEO operating system for the Dutch-language market — the tool that a bakery owner in Utrecht, a marketing manager in Antwerp, and an agency team in Amsterdam all reach for when they need to understand and improve their organic visibility.

---

## 2. Strategic Goals

### 2.1 Primary Goals

| # | Goal | Measurable Outcome |
|---|------|-------------------|
| G1 | **Democratise SEO for non-technical Dutch users** | A first-time user can complete onboarding, run their first crawl, and understand their top-priority actions within 15 minutes, entirely in Dutch. |
| G2 | **Automate the full SEO workflow end to end** | From keyword research through content creation, quality assurance, internal linking, CMS publishing, and performance monitoring — every step can be completed or automated from within the platform. |
| G3 | **Deliver explainable, evidence-based insights** | Every score, recommendation, and alert includes a plain-Dutch explanation, the evidence behind it, and the calculation method. No black-box metrics. |
| G4 | **Ensure absolute tenant data isolation** | Zero cross-tenant data leakage. Automated isolation tests run on every deployment. |
| G5 | **Enable agency-scale operations** | Agencies manage unlimited clients, projects, and team members with white-label reporting, client portals, approval workflows, and profitability tracking. |
| G6 | **Provide safe, approval-first automation** | No destructive or publishing action is ever executed without explicit human approval. Every automated action is auditable and reversible. |
| G7 | **Support AI transparency and GEO readiness** | AI-generated content is clearly labelled, sources are tracked, claims are verified against evidence, and GEO/AI search visibility is measured and reported transparently. |

### 2.2 Secondary Goals

- **Self-hostable by default**: The platform runs entirely on-premises or in a private cloud. No mandatory external SaaS dependencies for core functionality.
- **Local AI first**: Ollama and local models are the default AI provider. External providers are optional and cost-tracked.
- **Privacy by design**: Personal data is minimised, consent is tracked, and data deletion is supported at the project and account level.
- **Accessible**: WCAG 2.1 AA compliance for all user-facing interfaces, including drag-and-drop alternatives.
- **Dutch language excellence**: Not just translated — designed in Dutch, for Dutch speakers, with locale-aware formatting for dates, numbers, and currency.

---

## 3. Stakeholders

### 3.1 Primary Users

| User Persona | Description | Key Needs |
|-------------|-------------|-----------|
| **Ondernemer** (Entrepreneur) | Small business owner managing their own web presence | Simple dashboard, clear priorities, guided actions, no jargon |
| **Marketeer** (Marketing employee) | In-house marketing professional responsible for organic search | Content workflow, keyword insights, performance tracking, reporting |
| **SEO-specialist** | Professional SEO consultant or in-house specialist | Technical audits, competitor analysis, advanced controls, data exports |
| **Contentredacteur** (Content editor) | Writer creating and optimising SEO content | Content briefs, quality feedback, brand consistency, CMS publishing |
| **E-commerce manager** | Online store operator managing product SEO | Product feeds, WooCommerce integration, revenue prioritisation, category optimisation |
| **Bureau-eigenaar** (Agency owner) | SEO agency owner managing multiple clients | Client portal, white-label reports, team management, profitability, SLAs |
| **Klant** (Client) | Agency client with limited access | Read-only dashboards, approval workflows, shared reports |
| **Ontwikkelaar** (Developer) | Technical team member managing integrations and migrations | API access, webhook configuration, deployment monitoring, technical views |

### 3.2 Other Stakeholders

| Stakeholder | Interest |
|------------|---------|
| **Platform administrators** | System health, tenant management, security monitoring |
| **Compliance officers** | GDPR compliance, data retention, audit trails |
| **AI providers** (Ollama, OpenAI-compatible) | Provider interfaces, cost tracking, rate limits |
| **CMS platforms** (WordPress, WooCommerce) | Integration stability, API compatibility |
| **Third-party data providers** (Search Console, Analytics, backlink data) | Data accuracy, sync reliability |

---

## 4. Project Scope

### 4.1 In Scope

The platform covers the following functional domains, each implemented across multiple phases:

1. **Foundation**: Authentication, multi-tenancy, RBAC, projects, brand profiles, onboarding, jobs, audit logging, Dutch i18n
2. **Crawling & Technical SEO**: Safe crawler, content inventory, page snapshots, technical SEO rule engine, source-vs-rendered analysis
3. **Keywords & Content Intelligence**: Keyword management, search intent classification, opportunity scoring, topic clusters, AI content studio, content quality analysis, content decay detection, content pruning
4. **Content Automation & CMS**: Full AI content studio, internal linking, structured data generation, WordPress integration, WooCommerce integration, programmatic SEO, publishing and rollback
5. **Analytics & Monitoring**: Search Console integration, Google Analytics integration, monitoring and alerts, roadmap, white-label reporting
6. **GEO & Competitive Intelligence**: GEO readiness analysis, measured AI visibility, competitor intelligence, trends, authority analysis, digital PR
7. **Local SEO & Reputation**: Local SEO management, Google Business Profile, review management, reputation monitoring
8. **E-commerce SEO**: Product inventory, category optimisation, product feeds, revenue prioritisation
9. **CRO & Business Intelligence**: Conversion optimisation, experiments, first-party analytics, behaviour analysis, SEO forecasting, budget planning
10. **Agency & Client Operations**: Client portal, agency management, benchmarking, project management integrations
11. **AI Copilots & Agents**: Dutch project-aware copilot, specialised AI agents, automation rules
12. **Migrations & Deployments**: Website migration module, deployment regression monitoring
13. **Production Hardening**: Security audit, privacy audit, accessibility audit, performance optimisation, reliability, observability, backup and restore, documentation

### 4.2 Out of Scope

- Mobile native applications (responsive web only)
- Support for languages other than Dutch and English technical fallback
- Real-time collaborative editing (multi-cursor)
- Built-in email sending infrastructure (local preview in development)
- Kubernetes orchestration (Docker Compose deployment model)
- Automated paid advertising (SEA/PPC) management
- Social media management or scheduling
- CRM functionality beyond client project tracking

---

## 5. Success Criteria

The project is considered successful when all of the following are true:

### 5.1 Functional Completeness

- [ ] A new user can register, create an organisation, invite members, and complete the Dutch onboarding wizard
- [ ] A crawl can be started, monitored, and its results browsed with technical issues explained in plain Dutch
- [ ] Keywords can be imported, classified by intent, and scored with transparent, explainable calculations
- [ ] A topic cluster can be built visually and as an accessible list
- [ ] A Dutch content brief can be generated, a draft written using Ollama, and quality feedback reviewed
- [ ] Content can be published to WordPress/WooCommerce with an approval workflow and rollback support
- [ ] Programmatic SEO pages can be generated with quality gates preventing thin or doorway content
- [ ] Search performance data can be imported, trended, and compared across periods
- [ ] White-label reports can be built, exported as PDF, and shared through secure client portals
- [ ] GEO readiness is assessed and AI visibility is measured with honest methodology labels
- [ ] Competitor changes are tracked and summarised with evidence, without inventing traffic data
- [ ] Local SEO locations and reviews are managed with response drafts requiring approval
- [ ] E-commerce products are prioritised by revenue, and product feeds are validated
- [ ] CRO findings are generated, experiments are tracked, and forecasts show assumptions and uncertainty
- [ ] The copilot answers grounded questions in Dutch, citing project evidence and stating uncertainty
- [ ] Specialised agents propose actions that require human approval before execution
- [ ] Website migrations are planned with redirect validation and post-launch monitoring
- [ ] Deployment regressions are detected and reported

### 5.2 Quality Criteria

- [ ] **Tenant isolation**: Zero cross-tenant data leakage, verified by automated tests on every deployment
- [ ] **Security**: No critical or high-severity vulnerabilities in the final audit
- [ ] **Accessibility**: WCAG 2.1 AA compliance with accessible alternatives for all drag-and-drop interactions
- [ ] **Performance**: Dashboard loads in under 2 seconds with 10,000 pages; crawl processes 100 pages per minute
- [ ] **Dutch language**: Every user-facing string is in Dutch by default; no unexplained English acronyms
- [ ] **No fabricated metrics**: The dashboard never displays SEO scores or trends before actual data has been collected
- [ ] **Approval workflows**: Every publishing and destructive action requires explicit human approval

### 5.3 Operational Criteria

- [ ] The platform starts locally with documented Docker Compose commands
- [ ] Backup and restore procedures are documented and tested
- [ ] All documentation is available in Dutch for users and English for administrators

---

## 6. Constraints

### 6.1 Technical Constraints

| Constraint | Description |
|-----------|-------------|
| **Technology stack** | Next.js 16, TypeScript (strict), Prisma/SQLite (development), PostgreSQL (production), NextAuth.js, shadcn/ui, Tailwind CSS |
| **Self-hosted** | Must run entirely on-premises; no mandatory external SaaS for core features |
| **Local AI first** | Ollama is the default AI provider; external providers are optional |
| **No paid email dependency** | Development mode uses local email preview; production must work with any SMTP server |
| **Docker Compose deployment** | Docker Compose is the deployment model; Kubernetes is out of scope |
| **Database** | PostgreSQL for production with Prisma ORM; SQLite for local development |
| **Browser support** | Last two versions of Chrome, Firefox, Safari, and Edge |

### 6.2 Design Constraints

| Constraint | Description |
|-----------|-------------|
| **Dutch-first** | nl-NL is the default locale; nl-BE is supported; English is a technical fallback only |
| **Non-technical users** | The default experience must not require SEO or technical knowledge |
| **One primary action per screen** | Every screen has exactly one primary call to action; secondary actions are de-emphasised |
| **Plain Dutch** | No unexplained acronyms; scores are explainable; recommendations are in plain language |
| **Safe defaults** | All settings ship with safe default values; advanced options are behind explicit controls |
| **No fabricated data** | Scores, trends, and metrics are only shown when real underlying data exists |
| **Approval-first** | Publishing, deletion, redirect changes, and all destructive actions require explicit approval |
| **Explainable AI** | AI-generated content is labelled, sources are tracked, and claims are verified against evidence |

### 6.3 Organisational Constraints

| Constraint | Description |
|-----------|-------------|
| **Phased delivery** | The project is delivered in 13 phases; each phase must be complete before the next begins |
| **Documentation-first** | Requirements must be documented before implementation begins |
| **Traceability** | Every requirement maps to implementation, tests, and documentation in the traceability matrix |
| **No requirement weakening** | Requirements may be deferred but never silently removed or simplified |

---

## 7. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Scope creep from 13-phase plan | High | High | Strict phase gates; each phase must meet its definition of done before the next begins |
| Dutch language quality inconsistency | Medium | High | Translation keys with centralised Dutch strings; native Dutch review for all user-facing content |
| AI provider reliability | Medium | Medium | Local Ollama as default; provider fallback chain; graceful degradation when AI is unavailable |
| Tenant data leakage | Low | Critical | Automated tenant isolation tests on every deployment; row-level security; audit logging |
| CMS integration breaking changes | Medium | Medium | Adapter pattern with capability detection; versioned API interactions; error recovery |
| Non-technical user abandonment | Medium | High | Guided onboarding; contextual help; safe defaults; one primary action per screen |
| Crawler SSRF or abuse | Medium | Critical | Domain allowlists; private IP blocking; rate limiting; crawl depth and page limits |
| Prompt injection through crawled content | Medium | High | Input sanitisation; output filtering; copilot permission boundaries; no credential exposure |

---

## 8. Assumptions

1. Users have a website they can verify ownership of or crawl
2. WordPress sites use the official REST API with application passwords
3. WooCommerce stores use the official WooCommerce REST API
4. Ollama is available for local AI inference in development and optional in production
5. Google Search Console and Analytics data access is configured by the user
6. The platform is hosted in an environment the user controls (on-premises or private cloud)
7. Users have basic computer literacy but no SEO or technical knowledge
8. Dutch (nl-NL, nl-BE) is the primary language for all user-facing content

---

## 9. Key Definitions

| Term | Definition |
|------|-----------|
| **Tenant** | An organisation with fully isolated data; no tenant can access another tenant's data |
| **Project** | A website project within a tenant, representing a single domain or subdomain |
| **Brand Profile** | A comprehensive profile defining brand voice, terminology, claims, audiences, and editorial rules for a project |
| **GEO** | Generative Engine Optimisation — the practice of optimising content for visibility in AI-generated search responses |
| **Goedkeuring** | Approval — explicit user consent required before any publishing or destructive action |
| **Regel** | Rule — a technical SEO rule in the extensible rule engine |
| **Actie** | Action — a recommended or required task visible on the "Mijn belangrijkste acties" page |
| **Copiloot** | Copilot — an AI assistant that answers questions grounded in project data, in Dutch |
| **Agent** | A specialised AI agent that proposes actions within a bounded domain, requiring human approval |

---

*This charter is a living document. Changes require stakeholder review and must be recorded in the project audit log.*
