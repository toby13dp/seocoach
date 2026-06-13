---
Task ID: 1
Agent: Main Agent
Task: Build Phase 1 - Foundation and Multi-Tenant Platform

Work Log:
- Created comprehensive project documentation (PROJECT_CHARTER.md, PRODUCT_REQUIREMENTS.md, UX_PRINCIPLES.md, IMPLEMENTATION_STATUS.md, REQUIREMENTS_TRACEABILITY.md)
- Designed and implemented Prisma database schema with 17+ models (User, Organization, OrganizationMembership, Client, Project, Domain, Location, BrandProfile, Permission, RolePermission, Job, AuditLog, ActionItem, UserSettings, etc.)
- Implemented NextAuth.js v4 authentication with Credentials provider, JWT sessions, password hashing
- Implemented RBAC permission system with 9 roles and 8 permission categories
- Implemented audit logging with domain-specific helpers
- Implemented job system with progress tracking, retries, cancellation
- Implemented tenant isolation utilities
- Set up next-intl for Dutch-first i18n (nl-NL default, en fallback)
- Created Dutch translation file with 150+ keys across 15 sections
- Built 20 API route endpoints covering auth, organizations, projects, brand profiles, actions, jobs, audit logs, user settings
- Built complete frontend UI: login/register page, dashboard, projects list, project detail with tabs, onboarding wizard (10 steps), settings, audit log, integrations placeholder
- All pages use Dutch by default with emerald/green color scheme
- Fixed setState-during-render issue in HomePage (redirect)
- Fixed Prisma P2011 error (updatedAt NOT NULL constraint) by adding @default(now())
- Fixed audit log function signature mismatch in projects route
- Verified full registration → login → project creation → onboarding flow in browser

Stage Summary:
- Phase 1 core functionality is working end-to-end
- User can register, login, create organizations and projects
- Dutch onboarding wizard works through all 10 steps
- Audit logging captures project creation events
- RBAC and tenant isolation implemented at the API level
- All lint checks pass

---
Task ID: 4
Agent: Rule Engine Agent
Task: Build Technical SEO Rule Engine for SEOCoach

Work Log:
- Created /src/lib/rules/types.ts — Core type definitions (TechnicalRule, IssueEvidence, TechnicalIssueResult, PageAnalysis, RuleEntry, CrossPageRuleEntry)
- Created 15 rule files under /src/lib/rules/rules/:
  1. status-codes.ts — 4xx/5xx detection (2 rules)
  2. redirect-chains.ts — 3+ hop redirect chains
  3. redirect-loops.ts — Circular redirect detection
  4. canonical-errors.ts — Missing/conflicting canonical (2 rules)
  5. meta-issues.ts — Missing/duplicate title/description, noindex (5 rules: 3 per-page + 2 cross-page)
  6. heading-issues.ts — Missing H1, multiple H1, heading hierarchy (3 rules)
  7. broken-links.ts — Broken internal/external links (cross-page)
  8. orphan-pages.ts — Orphan page detection
  9. deep-pages.ts — Pages too deep in site structure (>3 clicks)
  10. thin-content.ts — Pages with <300 words
  11. duplicate-content.ts — Near-duplicate content (per-page + cross-page)
  12. image-issues.ts — Missing alt text, oversized images (2 rules)
  13. https-issues.ts — Non-HTTPS, mixed content (2 rules)
  14. structured-data-issues.ts — Invalid/missing structured data (2 rules)
  15. hreflang-issues.ts — Missing/invalid/conflicting hreflang (3 rules: 2 per-page + 1 cross-page)
  16. sitemap-issues.ts — Noindex in sitemap, missing from sitemap (2 rules)
- Created /src/lib/rules/engine.ts — RuleEngine class with:
  - Registers all 25+ rules automatically
  - runAllRules() / runRule() for per-page analysis
  - runAllCrossPageRules() for cross-page analysis
  - disableRule() / enableRule() for selective rule execution
  - addRule() / addCrossPageRule() for custom rules
  - getRuleDefinitions() / getRulesByCategory() / getCategories() for querying
  - Singleton instance via getRuleEngine()
- Created /src/lib/rules/session-analyzer.ts — Session-wide analysis:
  - analyzeCrawlSession() — Fetches all pages from a crawl session, converts to PageAnalysis, runs all rules, saves to TechnicalIssue table
  - pageToAnalysis() — Converts Prisma Page model to PageAnalysis
  - getSessionIssues() / getSessionSummary() — Query existing issues
  - Includes broken-links cross-page detection
  - Batch insertion with transaction support
- Created /src/lib/rules/index.ts — Barrel export
- All Dutch explanations in plain, non-technical language
- Fixed escaping issues with apostrophes in Dutch text (pagina's → pagina\'s)
- All lint checks pass

Stage Summary:
- Complete SEO rule engine with 25+ rules across 9 categories
- Per-page and cross-page rule execution
- Session-wide analysis that saves results to the database
- All Dutch explanations are in plain, non-technical language
- Engine supports custom rules, disabling rules, and category filtering

---
Task ID: 6+7
Agent: Keyword & Scoring Agent
Task: Build Keyword Management and Opportunity Scoring Libraries

Work Log:
- Created /src/lib/keywords/types.ts — Core type definitions:
  - SearchIntent, FunnelStage union types matching Prisma enums
  - KeywordImport interface for import operations
  - KeywordCSVRow interface for flexible CSV column mapping
  - IntentClassificationResult with Dutch reasoning
  - OpportunityScoreWeights with default values documented
  - KeywordWithMetrics combining keyword + brand profile data
  - ScoreResult with 7 component scores (0-100 each)
  - ScoreCalculationStep and ScoreCalculationTrace for explainability
  - ImportResult for tracking import outcomes

- Created /src/lib/keywords/import.ts — Keyword CSV Import:
  - parseCSV() — Parses CSV with flexible column name mapping (30+ aliases for Dutch/English/SEO-tool columns)
  - validateKeywordImport() — Validates keyword entries with Dutch error messages
  - normalizeKeyword() — Lowercases, trims, removes diacritical marks for deduplication
  - importKeywords() — Bulk import with duplicate handling (update vs skip)
  - Handles quoted CSV fields, various CSV dialects
  - Returns count of imported, updated, and skipped keywords

- Created /src/lib/keywords/intent-classifier.ts — Search Intent Classification:
  - classifyIntent() — Rule-based classification using Dutch language patterns
    - Transactional: 28 patterns (kopen, bestellen, prijs, etc.)
    - Commercial Investigation: 24 patterns (vergelijk, review, beste, etc.)
    - Navigational: 13 patterns (login, inloggen, website, etc.)
    - Informational: 31 patterns (hoe, wat is, waarom, etc.)
    - Local: 18 patterns (in de buurt, dichtbij, etc.) + 2 geographic patterns with Dutch cities/provinces
    - Branded: 48 well-known Dutch brand names
  - classifyIntentWithAI() — AI-assisted classification using ProviderManager
    - Falls back to rule-based when AI is unavailable
    - Parses JSON from AI response (handles markdown code blocks)
    - Low temperature (0.2) for consistent classification
  - classifyIntentBatch() / classifyIntentBatchWithAI() — Batch processing
  - All reasoning in Dutch

- Created /src/lib/keywords/opportunity-scorer.ts — Opportunity Scoring:
  - 7 component scoring functions (each 0-100):
    - volumeScore: logarithmic scale with diminishing returns
    - difficultyScore: inverse relationship (lower = better)
    - relevanceScore: matches against brand name, products, services
    - currentRankScore: position 11-20 = highest opportunity (quick-win sweet spot)
    - intentScore: transactional (95) > commercial (85) > local (75) > branded (60) > informational (40) > navigational (30)
    - funnelScore: decision (95) > consideration (70) > retention (60) > awareness (35)
    - competitionScore: CPC value scaled by difficulty factor
  - getDefaultWeights() / validateWeights() — Weight management
  - calculateOpportunityScore() — Full weighted score calculation
  - calculateScoreDetails() — Full calculation trace in Dutch with 7 steps + summary
  - calculateAndSaveOpportunityScore() — Calculate and persist to database
  - recalculateProjectScores() — Recalculate all project keyword scores
  - getScoreTrace() — Retrieve stored calculation trace
  - All explanations in plain Dutch with verdicts and actionable insights

- Created /src/lib/keywords/index.ts — Barrel export

Stage Summary:
- Complete keyword management library with import, classification, and scoring
- CSV import supports 30+ column name aliases from SEO tools (Ahrefs, SEMrush, Moz)
- Rule-based intent classifier with 150+ Dutch language patterns across 6 intent categories
- AI-assisted classification with graceful fallback to rule-based
- Opportunity scoring with 7 weighted components and full Dutch calculation traces
- All edge cases handled (null values, zero volume, missing data → neutral defaults)
- All lint checks pass

---
Task ID: 3-api
Agent: API Routes Agent
Task: Build API Routes for Phase 2-3 (Crawl, Keywords, Topics, AI Providers, Content)

Work Log:
- Created /src/lib/topics/index.ts — Barrel export for topics module (was missing)

- Created 24 API route files connecting frontend to backend libraries:

  Crawl & Technical SEO Routes (6 files):
  1. /api/projects/[id]/crawls/route.ts — GET (list with pagination, status filter), POST (start crawl with Job creation, async background execution + rule analysis)
  2. /api/projects/[id]/crawls/[crawlId]/route.ts — GET (session details with progress %), DELETE (cancel running crawl)
  3. /api/projects/[id]/pages/route.ts — GET (list pages from latest crawl, 12+ filters: statusCode, indexability, contentType, search, wordCount range, isOrphan, duplicateGroup, sorting)
  4. /api/projects/[id]/pages/[pageId]/route.ts — GET (page details with snapshots, issues, rendered comparison)
  5. /api/projects/[id]/issues/route.ts — GET (list technical issues with severity/priority/category/ruleId/dismissed/session filters + severity summary)
  6. /api/projects/[id]/issues/[issueId]/route.ts — PATCH (dismiss/undismiss), DELETE (not allowed, immutable)

  Keyword Routes (5 files):
  7. /api/projects/[id]/keywords/route.ts — GET (list with search/intent/funnel/volume/difficulty filters, opportunity score include), POST (add single or bulk keywords up to 1000)
  8. /api/projects/[id]/keywords/import/route.ts — POST (CSV import with file upload, 5MB limit, flexible column mapping)
  9. /api/projects/[id]/keywords/[keywordId]/route.ts — GET (details with opportunity score + related pages/topics), PATCH (update intent/funnel/tags/etc), DELETE (soft delete)
  10. /api/projects/[id]/keywords/[keywordId]/classify/route.ts — POST (rule-based or AI-assisted intent classification)
  11. /api/projects/[id]/keywords/[keywordId]/score/route.ts — POST (calculate/recalculate opportunity score with calculation trace)

  Topic Routes (5 files):
  12. /api/projects/[id]/topics/route.ts — GET (list or graph format via ?graph=true, clusterId filter), POST (create topic with cluster assignment)
  13. /api/projects/[id]/topics/[topicId]/route.ts — GET (details with relations, keywords, briefs), PATCH (update), DELETE (soft delete)
  14. /api/projects/[id]/clusters/route.ts — GET (list with topic counts or ?withTopics=true for full groups), POST (create cluster)
  15. /api/projects/[id]/clusters/[clusterId]/route.ts — GET (cluster with topics and pillar), PATCH (update), DELETE (soft delete, detaches topics)
  16. /api/projects/[id]/topic-relations/route.ts — POST (create relation between topics), DELETE (remove relation by ?relationId)

  AI Provider Routes (3 files):
  17. /api/projects/[id]/ai-providers/route.ts — GET (list with masked API keys), POST (add provider with URL validation, isDefault handling)
  18. /api/projects/[id]/ai-providers/[providerId]/route.ts — GET (details with privacy settings), PATCH (update), DELETE (soft delete + deactivate)
  19. /api/projects/[id]/ai-providers/[providerId]/test/route.ts — POST (test connection with simple generate request, returns success/duration/tokens)

  Content Routes (5 files):
  20. /api/projects/[id]/briefs/route.ts — GET (list with approval/intent/funnel/search filters + pagination), POST (create brief)
  21. /api/projects/[id]/briefs/[briefId]/route.ts — GET (details with versions), PATCH (update fields or approve), DELETE (archive)
  22. /api/projects/[id]/briefs/[briefId]/draft/route.ts — POST (generate AI draft, or regenerate with feedback)
  23. /api/projects/[id]/briefs/[briefId]/quality/route.ts — POST (run quality analysis on latest version, 11 dimensions)
  24. /api/projects/[id]/decay/route.ts — GET (list decay records with pruning action filter + summary), POST (run decay detection)

Implementation details:
- All routes verify auth with getAuthenticatedUser()
- All routes verify project access with validateProjectAccess()
- Consistent JSON response format: { data, meta? }
- Proper HTTP status codes (401, 403, 404, 400, 405, 201, 500)
- Crawl start creates Job + CrawlSession, runs crawl + rule analysis asynchronously
- Issues are immutable (DELETE returns 405, use PATCH to dismiss)
- Content briefs use ARCHIVED status instead of soft delete (no deletedAt field in schema)
- All lint checks pass

Stage Summary:
- 24 API route files created covering all Phase 2-3 functionality
- Complete CRUD for crawls, pages, issues, keywords, topics, clusters, AI providers, content briefs
- Specialized endpoints: crawl start with async execution, keyword CSV import, intent classification (rule-based + AI), opportunity scoring, topic graph visualization, AI provider testing, content draft generation, quality analysis, decay detection
- All routes properly authenticated and tenant-isolated
- Consistent error handling and response format

---
Task ID: 2-3-completion
Agent: Main Agent
Task: Complete Phase 2-3 - Crawling, Technical SEO, Keywords & Content Intelligence

Work Log:
- Updated Prisma schema with 20+ new models: CrawlSession, Page, PageSnapshot, TechnicalIssue, RenderedComparison, Keyword, KeywordPage, OpportunityScore, Topic, TopicCluster, TopicKeyword, TopicRelation, AIProvider, AICallLog, PromptTemplate, ContentBrief, ContentVersion, ContentQuality, ContentDecay
- Added 10 new enums: CrawlStatus, PageStatus, Indexability, ContentType, IssueSeverity, SearchIntent, FunnelStage, PruningAction, ContentApprovalStatus, AIProviderType
- Implemented Safe Crawler engine (src/lib/crawler/): SSRF protection, robots.txt parser, sitemap parser, HTML parser, main crawler with progress tracking
- Implemented Source vs Rendered comparison (src/lib/crawler/renderer.ts)
- Implemented Technical SEO Rule Engine (src/lib/rules/): 28 rules across 9 categories with Dutch explanations, session-wide analysis
- Implemented Keyword Management (src/lib/keywords/): CSV import, 150+ Dutch intent patterns, opportunity scoring with 7 components and Dutch calculation traces
- Implemented Topic Clusters (src/lib/topics/): CRUD, graph visualization, relations, drag-drop
- Implemented AI Provider Layer (src/lib/ai/): Ollama adapter, OpenAI-compatible adapter, fallback, token/cost tracking, prompt templates
- Implemented Content Studio (src/lib/content/): briefs, outline editor, draft generation, versions, quality analysis (11 dimensions), decay detection, pruning recommendations
- Built 24 API route endpoints covering all Phase 2-3 functionality
- Built 12 frontend pages: crawls, inventory, inventory detail, issues, keywords, keyword detail, topics, briefs, content studio, AI providers, content decay
- Updated project detail page with module navigation cards
- Wrote 236 test cases across 9 test suites - all passing
- Updated IMPLEMENTATION_STATUS.md to reflect Phase 1-3 completion
- Fixed all Phase 2-3 TypeScript errors

Stage Summary:
- Phase 2 (Crawling & Technical SEO) is complete with all definition of done items checked
- Phase 3 (Keywords & Content Intelligence) is complete with all definition of done items checked
- 99 requirements implemented out of 218 total (45%)
- All tests pass, lint passes, TypeScript compiles
- All user-facing text is in Dutch

---
Task ID: 4
Agent: Main Agent
Task: Build Phase 4 - Content Automation, CMS, Internal Linking & Programmatic SEO

Work Log:
- Updated Prisma schema with 8 new enums (CMSProviderType, CMSConnectionStatus, ContentWorkflowStep, InternalLinkStatus, InternalLinkStrategy, StructuredDataType, ProgrammaticTemplateType, ProgrammaticPageStatus, ContentChangeType) and 9 new models (CMSConnection, InternalLink, StructuredData, ProgrammaticTemplate, ProgrammaticPage, ContentChange, ContentSource, QualityFinding)
- Implemented Internal Linking module (src/lib/linking/): 5 strategies (semantic AI, topic cluster, orphan page, strong page, broken replacement), anchor variation with Dutch patterns, approval workflow with bulk approve/reject, diff preview, CMS publishing, rollback
- Implemented Structured Data Generator (src/lib/structured-data/): 15 JSON-LD schema types, Dutch validation with required field checks, never fabricates missing values
- Implemented WordPress Integration (src/lib/cms/wordpress.ts): connection wizard with application passwords, CRUD, scheduling, publishing, media upload, SEO plugin detection (Yoast/RankMath/AIOSEO), retry logic, audit trail
- Implemented WooCommerce Integration (src/lib/cms/woocommerce.ts): product operations, category management, variations, reviews, inventory, pricing, product import/sync, audit trail
- Implemented Programmatic SEO module (src/lib/programmatic/): 9 template types with Dutch variable labels, 8 quality gates (3 blocking: duplicate, template completeness, brand check), AI-powered page generation, approval queue, publication limits
- Implemented Content Quality Controls (src/lib/content/quality-controls.ts): 13 pre-publication checks with BLOCKING/WARNING/INFO severities, dismiss functionality
- Implemented Change History (src/lib/content/change-history.ts): record, query with filters, content diff generation, rollback support
- Implemented Source Grounding (src/lib/content/source-grounding.ts): source CRUD, claim support checking (SUPPORTED/UNSUPPORTED/PARTIALLY_SUPPORTED), never claims verified when not
- Implemented Content Workflow (src/lib/content/workflow.ts): 14-step content creation wizard, 17 content types with Dutch labels, approval gates
- Implemented Decay & Pruning Workflows (src/lib/content/decay-workflow.ts): update briefs for decayed pages, content comparison, pruning with evidence/risk/rollback guidance
- Created 32 API route files across 11 feature areas
- Created 7 frontend pages: CMS connections, internal links, structured data, programmatic SEO, content studio (workflow), content history, decay workflow
- Updated project detail page with 8 new module navigation cards
- Created 11 test suites covering all Phase 4 modules
- Fixed all Phase 4 TypeScript errors
- Updated IMPLEMENTATION_STATUS.md

Stage Summary:
- Phase 4 (Content Automation & CMS) is complete with all definition of done items checked
- 126 requirements implemented out of 218 total (58%)
- All lint passes, Phase 4 TypeScript compiles cleanly
- All user-facing text is in Dutch
- 8 new backend library modules, 32 API routes, 7 frontend pages
- Approval-first workflows enforced throughout
- Quality gates prevent thin/doorway page publication

---
Task ID: 5
Agent: Main Agent
Task: Build Phase 5 - Analytics & Monitoring

Work Log:
- Updated Prisma schema with 9 new enums (DataConnectionType, DataConnectionStatus, AlertType, AlertSeverity, AlertStatus, RoadmapView, RoadmapItemType, ReportType, ReportStatus, ReportSectionType) and 9 new models (DataConnection, DailyMetric, QueryPerformance, Alert, AlertPreference, RoadmapItem, WhiteLabelProfile, Report, ReportComment)
- Pushed schema changes to SQLite database
- Implemented Analytics module (src/lib/analytics/): types with Dutch metric display info, CSV imports (5 types with flexible column mapping), time-series calculations with period comparison & YoY, data connection sync manager, CSV export with Dutch formatting
- Implemented Alert Engine (src/lib/alerts/): 16 alert types with Dutch labels, threshold & anomaly detection (Z-score + IQR), alert lifecycle management, notification preferences with quiet hours, digest generation
- Implemented Roadmap module (src/lib/roadmap/): recommendation generation from technical issues, keyword opportunities, content decay, internal links; 5 time views with Dutch labels; CRUD and drag-to-reorder
- Implemented Reporting module (src/lib/reporting/): 14 report types with default Dutch section layouts, report builder with sections, snapshot data for immutable reports, white-label profiles with branding, share links with password & expiry, HTML rendering with Dutch formatting, comments
- Created 27 API route files covering: data connections (5), metrics (4), query performance (2), alerts (4), roadmap (3), reporting (6), white-label (2), shared reports (1)
- Created 6 frontend pages: analytics dashboard, data connections, alerts, roadmap, reports, report detail
- Updated project detail page with 4 new Phase 5 navigation cards
- Added Dutch translations for all Phase 5 modules
- Wrote 180 tests across 8 test suites - all passing (388 assertions)
- Fixed TypeScript error in connections page (unintentional comparison)
- Updated IMPLEMENTATION_STATUS.md

Stage Summary:
- Phase 5 (Analytics & Monitoring) is complete with all definition of done items checked
- 140 requirements implemented out of 218 total (64%)
- All lint passes, Phase 5 TypeScript compiles cleanly
- All user-facing text is in Dutch
- 4 new backend library modules (22 files), 27 API routes, 6 frontend pages
- 180 tests all passing
- Report snapshots ensure historical reports don't change when source data changes
- Alert deduplication prevents notification spam

---
Task ID: 6
Agent: Main Agent
Task: Build Phase 6 - GEO & Competitive Intelligence

Work Log:
- Updated Prisma schema with 6 new enums (GeoCheckCategory, GeoCheckStatus, AIVisibilityMethod, CompetitorChangeType, TrendSourceType, AuthorityRecordType) and 12 new models (GeoReadinessCheck, GeoReadinessSummary, AIPromptLibrary, AIPromptCluster, AIVisibilityResult, AIVisibilitySummary, Competitor, CompetitorSnapshot, CompetitorChange, TrendRecord, AuthorityRecord, OutreachCampaign)
- Fixed prompt/relation naming conflict in AIVisibilityResult (prompt → promptText)
- Pushed schema changes to SQLite database
- Implemented GEO Readiness module (src/lib/geo/): 15-category readiness analysis using existing Page/TechnicalIssue/StructuredData/BrandProfile data, summary scoring, NOT presented as measured external AI visibility
- Implemented AI Visibility module (src/lib/ai-visibility/): prompt library with clusters, manual test entry, CSV import, local simulation (always flagged with Dutch disclaimer "Simulatie – geen bewijs van werkelijke externe AI-zichtbaarheid"), Share of AI Voice calculation, brand/competitor mention rates
- Implemented Competitor Intelligence module (src/lib/competitor/): respectful public crawling with robots.txt/SSRF protection, snapshot creation, change detection with Dutch summaries, change feed with dismissal. CRITICAL: Never invents traffic or revenue data
- Implemented Trends module (src/lib/trends/): trend records from 8 source types, keyword/seasonal trend detection, internal search CSV import
- Implemented Authority module (src/lib/authority/): provider-neutral backlink data, CSV import (Ahrefs/Moz/Semrush formats), mark-as-lost, outreach campaigns. CRITICAL: Does not send outreach automatically
- Created 15 API route files covering GEO, AI visibility, competitors, trends, authority, outreach
- Created 3 frontend pages: GEO-gereedheid, AI-zichtbaarheid, Concurrentieanalyse
- Updated project detail page with 3 Phase 6 navigation cards
- Wrote 78 tests across 5 test suites - all passing (183 assertions)
- Fixed multiple test type mismatches between test expectations and actual function signatures
- Added global fetch mock for competitor crawl tests
- Updated IMPLEMENTATION_STATUS.md

Stage Summary:
- Phase 6 (GEO & Competitive Intelligence) is complete with all definition of done items checked
- 152 requirements implemented out of 218 total (70%)
- All lint passes, Phase 6 TypeScript compiles cleanly
- All user-facing text is in Dutch
- 5 new backend library modules (20 files), 15 API routes, 3 frontend pages
- 78 tests all passing
- GEO readiness is clearly NOT presented as measured external AI visibility
- AI simulations are always flagged with Dutch disclaimer
- Competitor intelligence never invents traffic or revenue
- Authority data is provider-neutral; outreach is never sent automatically

---
Task ID: 7-2b
Agent: Reviews & Reputation Agent
Task: Build Reviews & Reputation Module (Subphase J, Phase 7)

Work Log:
- Created /src/lib/reviews/types.ts — Core type definitions:
  - ReviewImportData interface for review import operations
  - SentimentAnalysisResult with Dutch themes, complaints, compliments, product/service issues, FAQ/content opportunities, trust signals
  - ReviewSummary with rating distribution, sentiment distribution, top themes, response rate, avg response time
  - ReviewResponseDraft interface
  - Dutch label maps: REVIEW_SOURCE_LABELS (7 sources), REVIEW_SENTIMENT_LABELS (4 sentiments), REVIEW_RESPONSE_STATUS_LABELS (5 statuses)
  - DEFAULT_REVIEW_COLUMN_MAPPINGS with Dutch/English column aliases for CSV import
  - NEGATIVE_KEYWORDS (32 Dutch negative keywords), POSITIVE_KEYWORDS (32 Dutch positive keywords)
  - PRODUCT_THEME_KEYWORDS (24 Dutch product keywords), SERVICE_THEME_KEYWORDS (24 Dutch service keywords)

- Created /src/lib/reviews/sentiment-analyzer.ts — Rule-based sentiment and theme analysis:
  - analyzeSentiment() — Full analysis combining all sub-analyses
  - classifySentiment() — Rating-based base score with keyword adjustment (±0.1 per keyword, capped -1 to 1)
  - detectThemes() — Dutch theme detection (Productkwaliteit, Levering, Verpakking, Prijs-kwaliteit, Klantenservice, etc.)
  - detectComplaints() — Dutch complaint extraction (15+ patterns: product defect, trage levering, onvriendelijk, etc.)
  - detectCompliments() — Dutch compliment extraction (13+ patterns: snelle levering, hoge kwaliteit, aanbeveling, etc.)
  - detectProductIssues() — Product-specific issue detection (12 patterns)
  - detectServiceIssues() — Service-specific issue detection (11 patterns)
  - generateFAQOpportunities() — FAQ suggestions from themes/complaints (Dutch)
  - generateContentOpportunities() — Blog/guide/landing page suggestions (Dutch)
  - identifyTrustSignals() — Trust signal extraction (geverifieerde aankoop, aanbeveling, terugkerende klant, etc.)

- Created /src/lib/reviews/review-importer.ts — CSV import and bulk operations:
  - parseReviewCSV() — Flexible CSV parsing with Dutch/English column mapping
  - parseFlexibleDate() — Multi-format date parsing (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY)
  - importReview() — Single review import with deduplication by externalId or authorName+reviewDate+source
  - importReviewsBulk() — Bulk import with individual validation and deduplication
  - importReviewsCSV() — Full CSV import pipeline with batch ID generation
  - All error messages in Dutch

- Created /src/lib/reviews/review-manager.ts — Review CRUD and querying:
  - listReviews() — Paginated listing with 10+ filters (source, sentiment, rating range, dates, search, hasResponse, location)
  - getReview() — Single review details with responses and location
  - getReviewSummary() — Aggregated statistics (avg rating, distributions, top themes/complaints/compliments, response rate, avg response time)
  - analyzeAndSaveReviewSentiment() — Run analysis on a single review and persist results
  - analyzeProjectReviews() — Batch analysis of all unanalyzed reviews in a project
  - deleteReview() — Soft delete with deletedAt timestamp
  - All functions verify projectId for tenant isolation

- Created /src/lib/reviews/response-drafter.ts — Review response drafting with approval workflow:
  - generateResponseDraft() — Template-based Dutch response generation:
    - Positive (4-5 stars): Thank customer, mention specifics (levering, kwaliteit, service, prijs)
    - Neutral (3 stars): Thank and ask for improvement feedback
    - Negative (1-2 stars): Apologize, address specific issues, offer resolution, invite contact
  - CRITICAL: Responses ALWAYS created as DRAFT, never auto-published
  - submitResponseForApproval() — DRAFT → PENDING_APPROVAL transition
  - approveResponse() — PENDING_APPROVAL → APPROVED transition
  - rejectResponse() — PENDING_APPROVAL → REJECTED with Dutch reason
  - updateResponseDraft() — Edit DRAFT or REJECTED responses (REJECTED resets to DRAFT)
  - publishResponse() — APPROVED → PUBLISHED (only from APPROVED, never from DRAFT)
  - getReviewResponses() — List all responses for a review
  - Full approval workflow enforced: DRAFT → PENDING_APPROVAL → APPROVED → PUBLISHED

- Created /src/lib/reviews/index.ts — Barrel export of all public types, functions, and constants

Stage Summary:
- Complete Reviews & Reputation module with 6 files
- Rule-based sentiment analyzer with 32+ Dutch negative keywords, 32+ positive keywords, 24 product themes, 24 service themes
- CSV import with flexible Dutch/English column mapping and multi-format date parsing
- Automatic deduplication by externalId or authorName+reviewDate+source
- Full review CRUD with 10+ filters and aggregated summary statistics
- Template-based Dutch response drafts for positive, neutral, and negative reviews
- Strict approval-first workflow: responses ALWAYS start as DRAFT, must go through approval before PUBLISHED
- Direct publishing from DRAFT is explicitly blocked
- All user-facing text in Dutch
- All functions verify projectId for tenant isolation
- No new TypeScript errors introduced

---
Task ID: 7-2a
Agent: Local SEO Agent
Task: Build Local SEO Module (Subphase I, Phase 7)

Work Log:
- Created /src/lib/local-seo/types.ts — Core type definitions:
  - NAPRecord, DayHours, OpeningHours, LocalKeywordData, LandingPageQuality, LocationHealthResult, LocationComparison interfaces
  - LOCAL_HEALTH_CATEGORY_LABELS (10 categories, Dutch labels)
  - LOCAL_HEALTH_STATUS_LABELS (4 statuses, Dutch labels)
  - LOCAL_KEYWORD_INTENT_LABELS (5 intents, Dutch labels)
  - Re-exports Prisma enums (LocalHealthCategory, LocalHealthStatus, LocalKeywordIntent)

- Created /src/lib/local-seo/location-manager.ts — Location CRUD:
  - createLocation() — Create location with NAP, geo, opening hours, business type, service area
  - updateLocation() — Update location with tenant isolation verification
  - deleteLocation() — Soft delete with tenant isolation verification
  - getLocation() — Get location with all related data (keywords, landing pages, health checks, GBP)
  - listLocations() — List with optional filters (city, businessType, minHealthScore, minRating)
  - compareLocations() — Compare multiple locations with keyword and landing page counts
  - All functions verify projectId for tenant isolation
  - All error messages in Dutch

- Created /src/lib/local-seo/health-checker.ts — 10-category health analysis:
  - checkNAPConsistency() — Verifies name, address, phone completeness with optional fields check
  - checkOpeningHours() — Checks if weekly opening hours are set and complete
  - checkLocalStructuredData() — Validates JSON-LD quality (5 key fields)
  - checkLandingPages() — Counts pages and calculates average quality score
  - checkLocalKeywords() — Checks keyword count, ranking distribution, top 10/3 coverage
  - checkReviews() — Checks avgRating and reviewCount with scoring matrix
  - checkGoogleBusinessProfile() — Checks GBP connection status and profile completeness
  - checkLocalLinks() — Placeholder (NOT_CHECKED)
  - checkPhotos() — Placeholder (NOT_CHECKED)
  - checkServiceAreas() — Checks service area coverage
  - saveHealthChecks() — Upserts results and updates overall health score
  - calculateOverallHealthScore() — Weighted average (NAP=20, LandingPages=15, Keywords=15, etc.)
  - getLocationHealthChecks() — Retrieve existing checks with tenant isolation
  - All titles, descriptions, and recommendations in Dutch
  - Never fabricates data — NOT_CHECKED for unavailable checks

- Created /src/lib/local-seo/rank-import.ts — CSV rank data import:
  - parseRankCSV() — Parses CSV with flexible column mapping (Dutch/English)
  - importRankCSV() — Full import with batch ID, upsert, and error tracking
  - DEFAULT_RANK_COLUMN_MAPPINGS — 7 fields with Dutch/English aliases
  - Supports quoted CSV fields, various delimiters, BOM markers
  - Intent parsing supports Dutch and English names
  - Generates unique import batch ID
  - All error messages in Dutch

- Created /src/lib/local-seo/gbp-adapter.ts — Google Business Profile adapter:
  - connectGBP() — Connect GBP with OAuth tokens, upserts profile record
  - disconnectGBP() — Disconnect, clears tokens, resets sync status
  - syncGBPData() — Placeholder sync (updates timestamp, never fabricates data)
  - getGBPStatus() — Returns connection state, sync status, rating, review count
  - CRITICAL: Never fabricates sync data — real API integration is a stub
  - All error messages in Dutch

- Created /src/lib/local-seo/landing-page-analyzer.ts — Landing page quality:
  - analyzeLandingPageQuality() — 8-element quality scoring (0-100):
    Title (10), Meta description (10), H1 (10), Word count ≥300 (15),
    Structured data (15), NAP (15), Map (10), Opening hours (15)
  - generateLocalStructuredData() — LocalBusiness JSON-LD generator:
    Only includes fields with data, never fabricates missing values
    Maps 60+ business types to schema.org types
    Generates OpeningHoursSpecification and areaServed
  - saveLandingPageAnalysis() — Upsert landing pages with quality scores
  - All issue descriptions in Dutch

- Created /src/lib/local-seo/index.ts — Barrel export

Stage Summary:
- Local SEO module complete with 7 files
- 10 health check categories with weighted scoring
- Full location CRUD with tenant isolation
- CSV rank import with Dutch/English column mapping
- GBP adapter as stub/interface (never fabricates data)
- Landing page quality analysis with 8 scoring elements
- JSON-LD generator never fabricates missing values
- All user-facing text in Dutch
- No new TypeScript compilation errors introduced

---
Task ID: 7
Agent: Main Agent
Task: Build Phase 7 - Local SEO & Reputation

Work Log:
- Updated Prisma schema with 6 new enums (LocalHealthCategory, LocalHealthStatus, ReviewSource, ReviewSentiment, ReviewResponseStatus, LocalKeywordIntent) and 8 new models (expanded Location, LocalKeyword, LocalLandingPage, LocalCompetitor, LocationHealthCheck, GoogleBusinessProfile, RankImport, Review, ReviewResponse)
- Pushed schema changes to SQLite database
- Implemented Local SEO module (src/lib/local-seo/, 7 files): Location CRUD with NAP, 10-category health checker, landing page quality analyzer with JSON-LD generation, rank CSV import with Dutch/English columns, Google Business Profile adapter (stub), opening hours management
- Implemented Reviews & Reputation module (src/lib/reviews/, 6 files): Dutch sentiment analyzer with 60+ keyword patterns, review CSV importer with flexible column mapping, review manager with filters/summary, response drafter with strict approval workflow (DRAFT→PENDING_APPROVAL→APPROVED→PUBLISHED)
- Created 21 API route files: locations CRUD + health + compare (3), location sub-resources (5), rank import (1), reviews CRUD + import + summary + analyze (5), review response workflow (4)
- Created 4 frontend pages: locations list, location detail (6 tabs), reviews list (with summary stats + filters + import), review detail (with sentiment analysis + response workflow)
- Updated project detail page with 2 Phase 7 navigation cards (Locaties, Beoordelingen)
- Wrote 306 tests across 8 test suites - all passing (608 assertions)
- Updated IMPLEMENTATION_STATUS.md

Stage Summary:
- Phase 7 (Local SEO & Reputation) is complete with all definition of done items checked
- 161 requirements implemented out of 218 total (74%)
- All lint passes, Phase 7 TypeScript compiles cleanly
- All user-facing text is in Dutch
- 2 new backend library modules (13 files), 21 API routes, 4 frontend pages
- 306 tests all passing
- Location health checks cover 10 categories with Dutch findings
- Review response workflow enforces approval-before-publish
- GBP adapter is a stub ready for real Google API integration
- Sentiment analysis uses 60+ Dutch keyword patterns

---
Task ID: 8-2
Agent: Sub Agent
Task: Build E-commerce SEO Module (Subphase K)

Work Log:
- Created 9 files under src/lib/ecommerce/ implementing the full E-commerce SEO module
- types.ts: Core type definitions (ProductSEOAnalysis, CategoryQualityResult, RevenuePrioritization, FacetedNavigationResult, SeasonalProductResult, VariationAnalysisResult, Dutch labels, scoring weights, CRUD types)
- product-manager.ts: Product CRUD operations (create, update, soft delete, get, list with filters/sorting/pagination, inventory summary) — all scoped by projectId for tenant isolation
- product-analyzer.ts: Product SEO analysis across 4 dimensions (title quality, description quality, structured data score, image score) with weighted overall score; pure analyzeProductSEO function plus DB-persisting analyzeAndSaveProductSEO and batch analyzeAllProducts
- category-analyzer.ts: Category quality analysis with 7-point scoring (description presence, description length, slug, product count, >5 products, structured data, product description coverage); pure function + DB-persisted analysis
- revenue-prioritizer.ts: Revenue-based SEO investment prioritization (critical/high/medium/low) with Dutch reasoning; margin-aware; getTopRevenueOpportunities for high-ROI targets
- variation-analyzer.ts: Product variation analysis detecting duplicate content, missing unique descriptions, missing variation images, missing structured attributes, and out-of-stock marking issues
- seasonal-analyzer.ts: Seasonal product detection and phase-based recommendations (pre-season, in-season, post-season); markProductSeasonal for manual tagging
- faceted-analyzer.ts: Faceted navigation issue detection from crawled Page data (duplicate content, thin content, missing canonical, noindex needed); CRUD for faceted issues with resolve capability
- index.ts: Barrel export of all public functions and types
- Fixed TypeScript compilation error (string | null | undefined → string | null coercion in product-analyzer.ts)
- All user-facing text is in Dutch throughout the module
- No fabricated data — uses "— —" or null for missing numeric values
- All functions verify projectId for tenant isolation

Stage Summary:
- E-commerce SEO module complete with 9 files, 0 TypeScript errors
- Product SEO analysis covers 4 dimensions with 25/25/25/25 weighting
- Category quality uses 7-point scoring system (max 100)
- Revenue prioritization maps products to critical/high/medium/low with Dutch explanations
- Variation analyzer detects duplicate content groups and missing unique content
- Seasonal analyzer provides timing-based recommendations (pre/in/post season)
- Faceted navigation analyzer detects 4 issue types from crawled page data

---
Task ID: 8
Agent: Main Agent
Task: Build Phase 8 - E-commerce SEO & Product Feeds

Work Log:
- Updated Prisma schema with 4 new enums (ProductStatus, FeedType, FeedValidationStatus, FeedIssueSeverity) and 6 new models (Product, ProductCategory, FacetedNavigationIssue, ProductFeed, ProductFeedItem, FeedValidationRule)
- Pushed schema changes to SQLite database
- Implemented E-commerce SEO module (src/lib/ecommerce/, 9 files): Product CRUD with inventory summary, product SEO analyzer (4 dimensions: title/description/structured data/images), category quality analyzer, revenue-based prioritization (critical/high/medium/low with Dutch reasoning), variation analysis with duplicate detection, seasonal product analysis, faceted navigation issue detection
- Implemented Product Feeds module (src/lib/product-feeds/, 6 files): Feed manager (CRUD), feed parser (XML Merchant Center/CSV/TSV with Dutch/English columns), feed validator (8 validation functions with Dutch messages at ERROR/WARNING/INFO severity), feed importer with product matching by GTIN/SKU/URL
- Created 18 API route files: products (5), product-categories (2), variations (1), seasonal (1), faceted-issues (2), feeds (6)
- Created 4 frontend pages: products list with revenue prioritization, product detail with SEO scores and variations, feeds list, feed detail with validation and import
- Updated project detail page with 2 Phase 8 navigation cards (Producten, Productfeeds)
- Wrote 142 tests across 6 test suites - all passing (202 assertions)
- Updated IMPLEMENTATION_STATUS.md

Stage Summary:
- Phase 8 (E-commerce SEO) is complete with all definition of done items checked
- 169 requirements implemented out of 218 total (78%)
- All lint passes, Phase 8 TypeScript compiles cleanly
- All user-facing text is in Dutch
- 2 new backend library modules (15 files), 18 API routes, 4 frontend pages
- 142 tests all passing
- Product SEO scoring covers 4 dimensions with Dutch issues
- Revenue prioritization drives SEO investment decisions
- Feed validation engine supports 5 feed types with configurable rules
- Never fabricates revenue or margin data
