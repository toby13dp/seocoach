# Task ID: 8+10+11 — Topic Clusters, Content Briefs/Studio, Content Quality/Decay/Pruning

## Agent: Main Agent

## Task Summary
Created the Topic Clusters, Content Briefs/Studio, and Content Quality/Decay/Pruning libraries for the SEOCoach AI-driven SEO automation platform (Dutch market).

## Files Created

### 1. `/src/lib/topics/types.ts` — Topic Type Definitions
- `TopicNode` — Represents a topic node in the topic graph
- `TopicEdge` — Represents a directed edge between topics
- `TopicGraph` — Complete graph structure (nodes + edges) for visualization
- `ClusterGroup` — A cluster with its topics and pillar topic
- `CreateTopicData` — Data required for topic creation

### 2. `/src/lib/topics/manager.ts` — Topic & Cluster Manager
- `createTopic(projectId, data)` — Create a topic with enum mapping
- `updateTopic(topicId, data)` — Update topic fields
- `deleteTopic(topicId)` — Soft delete by setting deletedAt
- `createCluster(projectId, name, description?)` — Create a topic cluster
- `updateCluster(clusterId, data)` — Update cluster name/description
- `deleteCluster(clusterId)` — Detach topics, then soft-delete cluster
- `addKeywordToTopic(topicId, keywordId)` — Associate keyword with topic (upsert)
- `removeKeywordFromTopic(topicId, keywordId)` — Remove keyword association
- `addRelation(fromId, toId, type, label?)` — Create topic relationship
- `removeRelation(relationId)` — Remove a relationship
- `getTopicGraph(projectId)` — Get full graph for visualization
- `getClusterGroups(projectId)` — Get clusters with their topics
- `suggestPillarPage(topicId)` — AI-powered URL suggestion with rule-based fallback

### 3. `/src/lib/content/types.ts` — Content Type Definitions
- `ContentBriefData` — Brief creation data
- `OutlineItem` — Hierarchical outline structure
- `ContentDraftRequest` — Draft generation request
- `QualityDimension` — Quality dimension with Dutch name, score, explanation
- `BriefFilters`, `PaginatedBriefs`, `BriefSummary` — Listing types
- `ContentBriefWithDetails`, `ContentVersionSummary` — Detail types
- `PruningActionType` — KEEP | IMPROVE | MERGE | REDIRECT | NOINDEX | REMOVE
- `RiskAnalysis`, `RiskFactor` — Pruning risk assessment types

### 4. `/src/lib/content/brief-manager.ts` — Content Brief Management
- `createBrief(projectId, data)` — Create brief with JSON serialization
- `updateBrief(briefId, data)` — Update brief fields
- `deleteBrief(briefId)` — Archive brief (set status to ARCHIVED)
- `getBrief(briefId)` — Get brief with versions and parsed JSON fields
- `listBriefs(projectId, filters?)` — Paginated listing with filters
- `approveBrief(briefId, userId)` — Approve brief (DRAFT/IN_REVIEW → APPROVED)
- `generateOutline(projectId, keyword, intent)` — AI-powered with template fallback

### 5. `/src/lib/content/draft-generator.ts` — Content Draft Generation
- `generateDraft(request)` — AI-powered draft with brand profile injection
  - Injects brand context (tone, terminology, claims, editorial rules)
  - Adds `[VERIFICATIE_NODIG]` claim markers for factual assertions
  - Tracks AI usage (model, provider, tokens via ProviderManager)
  - Falls back to structured placeholder when AI unavailable
- `regenerateDraft(briefId, feedback?)` — Regenerate with feedback
- `saveManualDraft(briefId, content)` — Save manually written draft

### 6. `/src/lib/content/quality-analyzer.ts` — Content Quality Analysis
- `analyzeQuality(contentVersionId, projectId)` — Full 11-dimension quality analysis
  - AI-powered analysis with JSON-structured prompt
  - Rule-based fallback with heuristic scoring
  - Dimensions: intentScore, coverageScore, readabilityScore, originalityScore,
    brandConsistencyScore, eeatScore, internalLinkScore, entityScore,
    conversionScore, geoReadinessScore, publicationReadinessScore
  - Each dimension: 0-100 score, Dutch explanation, Dutch recommendations
  - Weighted overall score calculation
  - Persists to ContentQuality table (upsert)
- `getQualityDimensions()` — Get all dimension definitions

### 7. `/src/lib/content/decay-detector.ts` — Content Decay Detection
- `detectDecay(projectId)` — Detect content decay across all pages
  - Handles missing historical data: sets `dataAvailable = false` with Dutch note
  - Calculates weighted decay percentage (clicks 40%, impressions 30%, position 30%)
  - Recommends pruning actions based on decay severity
  - Persists results to ContentDecay table
- `recommendPruningAction(decay)` — KEEP/IMPROVE/MERGE/REDIRECT/NOINDEX/REMOVE
  - KEEP: <15% decay
  - IMPROVE: 15-39% decay
  - MERGE: 15-39% with overlap
  - REDIRECT: 40-69% decay
  - NOINDEX: low clicks despite impressions
  - REMOVE: >70% decay with no traffic
- `assessPruningRisk(decay)` — Risk analysis before destructive actions
  - Factors: backlinks, traffic, authority, redirect_target, content_value
  - Risk levels: low, medium, high, critical
  - Dutch summaries and precautions

### 8. `/src/lib/content/index.ts` — Barrel Export
- Re-exports all types and functions from the content module

## Key Design Decisions
- **Dutch-first**: All user-facing strings (explanations, recommendations, notes) are in plain Dutch
- **AI + rule-based dual paths**: Every AI-powered feature has a deterministic fallback
- **Graceful degradation**: Missing data is handled with clear Dutch messages rather than errors
- **Claim markers**: AI-generated factual claims are wrapped in `[VERIFICATIE_NODIG]` markers
- **Enum mapping**: String values are mapped to Prisma enums with validation and fallbacks
- **JSON serialization**: Complex fields (outline, keywords, recommendations) are stored as JSON strings

## Lint Status
✅ All lint checks pass with zero errors
