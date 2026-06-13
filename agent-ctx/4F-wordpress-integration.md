# Task 4F — WordPress Integration Module

## Summary
Created `/home/z/my-project/src/lib/cms/wordpress.ts` — a comprehensive WordPress CMS integration module for the SEOCoach platform.

## What was created
A single TypeScript module with 15 exported functions and 7 exported interfaces.

### Types (exported)
- `WPConnectionConfig` — connection configuration (name, baseUrl, username, applicationPassword)
- `WPListParams` — pagination/search parameters for listing posts
- `WPCreateDraft` — draft creation payload (title, content, slug, excerpt, type, categories, tags, featuredMedia, meta)
- `WPSEOMeta` — SEO metadata (metaTitle, metaDescription, focusKeyword, canonical, noIndex)
- `WPMediaUpload` — media upload payload (fileName, base64 data, title, altText)
- `WPCapabilities` — detected WordPress capabilities (canCreatePosts, canCreatePages, etc., seoPlugin, version)
- `WPTestResult` — test connection result (success, capabilities, error?)

### Connection Management (4 functions)
- `createWordPressConnection(projectId, config)` — creates CMSConnection with providerType=WORDPRESS, status=PENDING
- `testWordPressConnection(connectionId)` — tests connection via WP REST API root, detects capabilities, updates status
- `updateWordPressConnection(connectionId, config)` — partial update of connection settings, resets status to PENDING on credential changes
- `deleteWordPressConnection(connectionId)` — soft delete (sets deletedAt, status=DISCONNECTED)

### Content Operations (6 functions)
- `wpListPosts(connectionId, params?)` — list posts/pages with pagination support (reads X-WP-Total headers)
- `wpGetPost(connectionId, postId)` — get single post by ID
- `wpCreateDraft(connectionId, draft)` — create draft post/page
- `wpUpdateDraft(connectionId, postId, draft)` — update existing draft
- `wpSchedulePost(connectionId, postId, publishDate)` — schedule for future publishing
- `wpPublishPost(connectionId, postId)` — publish immediately
- `wpGetPostStatus(connectionId, postId)` — check publication status

### Media (1 function)
- `wpUploadMedia(connectionId, file)` — upload media with base64 data, auto-set alt text/title

### Categories & Tags (2 functions)
- `wpListCategories(connectionId)` — list all categories (up to 100)
- `wpListTags(connectionId)` — list all tags (up to 100)

### SEO Metadata (1 function)
- `wpUpdateSEOMeta(connectionId, postId, meta)` — update SEO metadata with automatic plugin detection:
  - Yoast SEO → `_yoast_wpseo_*` meta keys
  - Rank Math → `rank_math_*` meta keys
  - All in One SEO → `_aioseo_*` meta keys
  - No plugin → custom `_seo_*` meta keys

### Capability Detection (1 function + utility helpers)
- `detectWPCapabilities(connectionId)` — detect capabilities and update connection record
- `getWPCapabilities(connectionId)` — retrieve stored capabilities
- `getWPMetadata(connectionId)` — retrieve stored metadata

## Implementation Details
- **Auth**: Basic Auth with `username:applicationPassword` (base64 encoded)
- **API Base**: `${baseUrl}/wp-json/wp/v2/`
- **Retry**: Up to 3 retries with exponential backoff (1s, 2s, 4s delays)
- **Rate Limiting**: 600ms spacing between requests; handles HTTP 429 with Retry-After header
- **Error Messages**: All user-facing messages are in Dutch
- **Audit Trail**: Every CREATE/UPDATE/DELETE/PUBLISH/SCHEDULE action logs a ContentChange record
- **Capability Detection**: Checks REST API namespaces for SEO plugins, tests endpoint access, checks user roles for scheduling permission
- **Storage**: apiKey field stores applicationPassword, username field stores username; capabilities/metadata stored as JSON strings
- **Lint**: Passes cleanly with no errors
