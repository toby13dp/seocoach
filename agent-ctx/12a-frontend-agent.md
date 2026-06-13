# Task 12a — Crawl and Content Inventory Frontend Pages

## Agent: Frontend Agent
## Task: Create Crawl Management, Content Inventory, Page Detail, and Technical Issues pages

### Work Completed

1. **Updated Dutch translations** (`messages/nl.json`)
   - Added `crawl` namespace with 20+ keys (status labels, form fields, progress labels, toast messages)
   - Added `inventory` namespace with 20+ keys (column names, filter labels, pagination, export)
   - Added `pageDetail` namespace with 30+ keys (simple/technical view labels, status descriptions)
   - Added `issues` namespace with 25+ keys (severity, priority, category names, filter labels)

2. **Crawl Management page** (`src/app/[locale]/projects/[id]/crawls/page.tsx`)
   - Lists crawl sessions with status icons, badges, and stats (pages crawled, pages found, issues, errors)
   - "Nieuwe crawl starten" button opens a dialog form with all configuration options:
     - Start-URL (pre-filled from project websiteUrl)
     - Maximum pagina's (default 500), Maximum diepte (default 10)
     - Wachttijd (default 1000ms), robots.txt respecteren (default true)
     - Subdomeinen meenemen (default false), JavaScript rendering (default false, with warning)
   - Progress bar for running crawls with 3-second polling
   - Cancel button for running/pending crawls
   - Click on crawl session navigates to inventory view for that session
   - Empty state with icon and call-to-action

3. **Content Inventory page** (`src/app/[locale]/projects/[id]/inventory/page.tsx`)
   - Searchable, filterable, sortable table of crawled pages
   - All 14 columns: URL, Status, Titel, H1, Woorden, Canoniek, Indexeerbaar, Type, Taal, Interne links, Externe links, Afbeeldingen, Diepte
   - Filters: search text, status code, indexability, content type, word count range
   - Sortable columns with direction indicators
   - Pagination with configurable page size (10/25/50/100)
   - Bulk selection with checkboxes (select all / individual)
   - CSV export button
   - Color-coded status codes and indexability badges
   - Empty state: "Je hebt nog geen pagina's gescand. Start een crawl om je website te analyseren."

4. **Page Detail page** (`src/app/[locale]/projects/[id]/inventory/[pageId]/page.tsx`)
   - Two tabs: "Eenvoudig" (Simple) and "Technisch" (Technical)
   - Simple view: URL, title, description, H1, word count, indexability with Dutch explanation, link counts, image alt status, issues with Dutch explanations
   - Technical view: HTTP status, response time, HTML size, canonical URL, meta robots, content hash, structured data (JSON-LD formatted), internal/external links lists, images with alt status, redirect chain, source vs rendered comparison, snapshots
   - All data parsed safely from JSON fields
   - Color-coded severity badges for issues

5. **Technical Issues page** (`src/app/[locale]/projects/[id]/issues/page.tsx`)
   - Summary stats at top: total, critical, warnings, info
   - Filters: severity, priority, category, show dismissed toggle
   - Group by category option with Dutch category names
   - Each issue shows: Dutch explanation, severity badge (color-coded), priority badge, affected URLs count, recommended action, dismiss/undismiss button
   - Expandable "Details bekijken" section with technical details, evidence (JSON), affected URLs list, rule ID, auto-fix availability
   - Dismiss/undismiss via PATCH API with toast notifications
   - Pagination for large issue lists

### Technical Details
- All pages follow the existing project pattern: "use client", useEffect for data fetching, useState for state, toast for notifications
- Uses shadcn/ui components: Card, Button, Badge, Table, Select, Switch, Dialog, Tabs, Progress, Checkbox, Collapsible, Separator, Input, Label
- Uses framer-motion for animations
- All user-facing text is in Dutch via next-intl useTranslations
- API endpoints used: GET/POST /crawls, DELETE /crawls/[crawlId], GET /pages, GET /pages/[pageId], GET /issues, PATCH /issues/[issueId]
- Fixed icon import: Spider → Bug (Spider doesn't exist in this lucide-react version)
- Fixed icon import: Image → ImageIcon (to avoid ESLint jsx-a11y/alt-text false positive)

### Lint: All checks pass ✓
### All 4 pages load successfully (200 status) ✓
