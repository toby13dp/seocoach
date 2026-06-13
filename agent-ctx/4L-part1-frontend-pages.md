# Task 4L-part1: Frontend Pages for CMS Connections, Internal Links, and Structured Data

## Agent: Frontend Agent
## Status: Completed

## Summary
Created three frontend pages for the SEOCoach platform, all with Dutch UI text, responsive design, and consistent patterns.

## Files Created

### 1. CMS Connections Page
**Path:** `/src/app/[locale]/projects/[id]/cms/page.tsx`

Features:
- Lists existing CMS connections with status badges (Verbonden/Verbroken/Fout/In behandeling)
- "Nieuwe verbinding" button opens create dialog with provider type select (WordPress/WooCommerce)
- Conditional form fields: username + application password for WordPress, consumer key + consumer secret for WooCommerce
- Test connection button calling `/test` endpoint
- Edit/delete connection with confirmation dialog
- Last tested timestamp and last error display
- WordPress: detected capabilities and SEO plugin info
- WooCommerce: product count and capabilities
- Empty state: "Geen CMS-verbindingen gevonden. Verbind je eerste CMS om content te publiceren."

### 2. Internal Links Page
**Path:** `/src/app/[locale]/projects/[id]/links/page.tsx`

Features:
- "Genereer linksuggesties" button to trigger POST to internal-links endpoint
- Filter bar: status dropdown (Alle/Pending/Goedgekeurd/Afgewezen/Gepubliceerd/Teruggedraaid), strategy dropdown (Semantisch/Topiccluster/Weespagina/Sterke pagina/Kapotte link)
- Table with: bronpagina → doelpagina, ankertekst, strategie (colored badge), vertrouwen (percentage progress bar), status (badge)
- Click row or eye icon to see detail dialog with:
  - Context snippet (surrounding text)
  - Confidence score with progress bar
  - Diff preview (before/after with red/green highlighting)
  - Approve/reject buttons (for PENDING)
  - Rollback button (for PUBLISHED)
- Bulk approve: checkbox selection + "Goedkeuren" button with count
- Pagination controls
- Strategy badges with distinct colors

### 3. Structured Data Page
**Path:** `/src/app/[locale]/projects/[id]/structured-data/page.tsx`

Features:
- "Genereer gestructureerde data" button with dialog:
  - Type selector (all 15 types with Dutch labels)
  - Page selector (from crawled pages) or URL input toggle
- Table of entries with:
  - Type badge (unique color per type)
  - URL/page title
  - Valid/Invalid status badge
  - Approved status
  - Preview button (shows formatted JSON-LD with syntax highlighting)
  - Edit button (opens JSON editor textarea)
  - Validate button (re-runs validation via GET endpoint)
  - Approve button
  - Delete button
- Detail dialog with two tabs:
  - JSON-LD preview (syntax highlighted with colored keys, strings, numbers, booleans)
  - Validation tab showing:
    - Valid/Invalid status
    - Errors (Dutch, red)
    - Missing fields (Dutch, amber)
    - Warnings (Dutch, yellow)
- Type labels in Dutch: Organisatie, Lokale onderneming, Product, Aanbod, Beoordeling, Broodkruimel, Artikel, FAQ-pagina, Instructie, Persoon, Evenement, Vacature, Dienst, Website, Webpagina

## Technical Details
- All pages use "use client" directive
- Use `use(params)` pattern for async params in Next.js 16
- Use `useRouter` from `@/i18n/routing`
- Use `toast` from `sonner` for notifications
- Use `motion` from `framer-motion` for animations
- Use emerald/green as primary color
- Responsive mobile-first design
- Loading states with Loader2 spinner
- Error states with helpful Dutch messages
- Empty states with icon + Dutch text
- Card-based layout with Badge, Dialog, Table components
- Back navigation with ArrowLeft icon
- Lint passes cleanly with no errors
