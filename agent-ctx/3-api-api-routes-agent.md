# Task 3-api: API Routes Agent

## Task
Build API routes for Phase 2-3 of the SEOCoach platform connecting frontend to backend libraries.

## Work Completed
- Created 24 API route files covering all Phase 2-3 functionality
- Created topics barrel export (was missing)
- All routes authenticated with getAuthenticatedUser() and validateProjectAccess()
- Consistent JSON response format: { data, meta? }
- Proper HTTP status codes throughout
- Crawl start runs asynchronously with Job tracking + rule analysis after completion
- All lint checks pass

## Route Files Created
1. crawls/route.ts - GET (list), POST (start crawl)
2. crawls/[crawlId]/route.ts - GET (details), DELETE (cancel)
3. pages/route.ts - GET (list with filters)
4. pages/[pageId]/route.ts - GET (details)
5. issues/route.ts - GET (list with filters)
6. issues/[issueId]/route.ts - PATCH (dismiss), DELETE (blocked)
7. keywords/route.ts - GET (list), POST (add)
8. keywords/import/route.ts - POST (CSV import)
9. keywords/[keywordId]/route.ts - GET, PATCH, DELETE
10. keywords/[keywordId]/classify/route.ts - POST (intent classification)
11. keywords/[keywordId]/score/route.ts - POST (opportunity scoring)
12. topics/route.ts - GET (list/graph), POST (create)
13. topics/[topicId]/route.ts - GET, PATCH, DELETE
14. clusters/route.ts - GET, POST
15. clusters/[clusterId]/route.ts - GET, PATCH, DELETE
16. topic-relations/route.ts - POST, DELETE
17. ai-providers/route.ts - GET, POST
18. ai-providers/[providerId]/route.ts - GET, PATCH, DELETE
19. ai-providers/[providerId]/test/route.ts - POST
20. briefs/route.ts - GET, POST
21. briefs/[briefId]/route.ts - GET, PATCH, DELETE
22. briefs/[briefId]/draft/route.ts - POST
23. briefs/[briefId]/quality/route.ts - POST
24. decay/route.ts - GET, POST

## Also Created
- /src/lib/topics/index.ts - Barrel export for topics module

## Dependencies
- Uses existing auth helpers from /src/app/api/_helpers/auth.ts
- Uses tenant isolation from /src/lib/tenant.ts
- Integrates with all backend libraries: crawler, rules, keywords, topics, ai, content
