# Task 4G — WooCommerce Integration Module

## Agent: Code Agent
## Date: 2026-03-04

## Task Summary
Created the WooCommerce Integration module at `/home/z/my-project/src/lib/cms/woocommerce.ts` for the SEOCoach SEO automation platform.

## Work Completed

### File Created
- **`/home/z/my-project/src/lib/cms/woocommerce.ts`** — Complete WooCommerce integration module

### Implemented Functions

#### Connection Management
1. **`createWooCommerceConnection(projectId, config)`** — Creates a CMSConnection record with providerType=WOOCOMMERCE, stores credentials in apiKey/apiSecret fields
2. **`testWooCommerceConnection(connectionId)`** — Tests connection by fetching system_status and products endpoints, detects capabilities (products, categories, tags, reviews, reports, coupons, settings), updates connection status and capabilities JSON
3. **`updateWooCommerceConnection(connectionId, config)`** — Partial update of connection config; resets status to PENDING if credentials change
4. **`deleteWooCommerceConnection(connectionId)`** — Soft delete via deletedAt timestamp + DISCONNECTED status

#### Product Operations
5. **`wooListProducts(connectionId, params?)`** — Lists products with pagination, search, status, and category filters; extracts X-WP-Total/X-WP-TotalPages headers
6. **`wooGetProduct(connectionId, productId)`** — Gets single product with full details
7. **`wooUpdateProductDescription(connectionId, productId, description, shortDescription?)`** — Updates product descriptions with audit trail and rollback data
8. **`wooUpdateProductSEO(connectionId, productId, meta)`** — Updates Yoast SEO and Rank Math meta fields via meta_data; includes rollback support
9. **`wooListCategories(connectionId)`** — Lists all product categories (auto-paginated)
10. **`wooUpdateCategoryDescription(connectionId, categoryId, description)`** — Updates category description with audit trail
11. **`wooListVariations(connectionId, productId)`** — Lists all variations for a product (auto-paginated)
12. **`wooGetProductReviews(connectionId, productId)`** — Gets reviews; returns empty array if endpoint unavailable
13. **`wooGetInventoryStatus(connectionId, productId)`** — Gets stock status including variation stock
14. **`wooGetProductPricing(connectionId, productId)`** — Gets pricing info including variation pricing

#### Import & Sync
15. **`wooImportProducts(projectId, connectionId)`** — Imports all products as ContentSource records (type=PRODUCT_DATA); upserts existing records
16. **`wooSyncProduct(connectionId, productId)`** — Syncs a single product's data with ContentSource; returns created/updated action

### Types Defined
- `WooConnectionConfig` — Connection configuration (name, baseUrl, consumerKey, consumerSecret)
- `WooListParams` — Pagination and filter parameters
- `WooProductSEO` — SEO metadata (metaTitle, metaDescription, focusKeyword, canonical)
- `WooProduct` — Public product data shape
- `WooCategory` — Product category shape
- `WooVariation` — Product variation shape
- `WooReview` — Product review shape
- `WooMetaItem` — Meta data key/value pair
- `WooListResult<T>` — Generic paginated result wrapper

### Key Implementation Details
- WooCommerce REST API v3 base URL pattern: `${baseUrl}/wp-json/wc/v3/`
- Basic auth with base64-encoded consumerKey:consumerSecret
- Retry logic: up to 3 attempts with exponential backoff (500ms, 1s, 2s) for 408, 429, 5xx, and network errors
- Custom error classes: `WooApiError` and `WooEndpointError` for better error discrimination
- All user-facing error messages in Dutch
- Full audit trail via ContentChange model for all update operations
- Rollback data stored in ContentChange.rollbackData
- 404 responses handled gracefully (endpoint not available)
- Public metadata only — no order/customer data access
- Products imported as ContentSource records with type=PRODUCT_DATA

### Prisma Models Used
- `CMSConnection` — Connection storage (apiKey=consumerKey, apiSecret=consumerSecret)
- `ContentChange` — Audit trail for all mutations
- `ContentSource` — Product data storage for import/sync

### Lint Status
✅ ESLint passes cleanly with no errors
