# Task 8-5: E-commerce SEO & Product Feeds Frontend Pages

## Agent: Frontend Developer

## Task Summary
Built 4 frontend pages for the E-commerce SEO & Product Feeds module of the SEOCoach project. All user-facing text is in Dutch (Nederlands).

## Files Created

### 1. Products List Page
**Path**: `/src/app/[locale]/projects/[id]/products/page.tsx`

Features:
- Header with "Producten" title, back button, description "E-commerce SEO en productbeheer"
- Stats bar: Total products, Active, Out of stock, Avg SEO score, Revenue 30d
- Add product dialog with all required fields (name required, SKU, GTIN, brand, category, price, sale price, description, image URL, product URL)
- Filter bar: Category dropdown, Stock status dropdown, SEO score range, Search, Sort by (revenue/SEO/name)
- Card/table toggle view for products
- Product cards showing: name, SKU, brand, category badge, SEO score badge (≥80 green, ≥50 yellow, <50 red), stock status badge, revenue, image thumbnail, variation count
- Revenue prioritization section (top 5 high revenue + low SEO products)
- Empty state: "Nog geen producten. Voeg producten toe of importeer ze via een feed."
- API calls: GET products, GET inventory, GET revenue-prioritization, POST products

### 2. Product Detail Page
**Path**: `/src/app/[locale]/projects/[id]/products/[productId]/page.tsx`

Features:
- Header: Product name, SKU, brand, back button
- SEO Score card: Large overall score, 4 sub-scores (title, description, structured data, images) with Progress bars, "Analyseer" button
- Tabs:
  - **Overzicht**: Product info, image, revenue data, internal links count, SEO summary
  - **SEO-analyse**: Issues grouped by severity (errors/warnings/info), each with Dutch description and recommendation
  - **Variaties**: Variation table with attributes, stock, images, prices, SEO scores
  - **Seizoensanalyse**: Seasonal status with month calendar, active months, recommendations (pre-season, in-season, post-season)
- API calls: GET product, POST analyze, GET variations

### 3. Feeds List Page
**Path**: `/src/app/[locale]/projects/[id]/feeds/page.tsx`

Features:
- Header: "Productfeeds" with back button, description "Importeer en valideer productfeeds"
- Add feed dialog: Name (required), feed type (5 Dutch options), source URL, format (XML/CSV/TSV), notes
- Feed cards: Name, feed type badge (color-coded), status badge, total/valid/warning/invalid counts, last validated date, Import & Validate buttons
- Empty state: "Nog geen feeds. Maak een feed aan om producten te importeren en valideren."
- API calls: GET feeds, POST feeds

### 4. Feed Detail Page
**Path**: `/src/app/[locale]/projects/[id]/feeds/[feedId]/page.tsx`

Features:
- Header: Feed name, type badge, back button
- Stats bar: Total items, valid, warnings, invalid, errors
- Tabs:
  - **Items**: Table of feed items with title, GTIN, SKU, price, status badge, issues count, linked status. Filter by validation status.
  - **Validatie**: Severity breakdown (errors/warnings/info), top issues list, "Valideer" button
  - **Importeren**: Drag & drop upload area, import button, match to products button, import info
  - **Instellingen**: Feed settings form (name, URL, format, notes), save button
- API calls: GET feed, POST import, POST validate, POST match, GET summary, PATCH feed

## Dutch Labels Implemented
- Feed types: Merchant feed, Meta-catalogus, Vergelijkingsfeed, Marketplace, Affiliate feed
- Validation status: In afwachting, Valideren, Geldig, Geldig met waarschuwingen, Ongeldig, Fout
- Stock status: Actief, Uit voorraad, Stopgezet, Seizoensgebonden, Concept
- SEO scores: ≥80 green, ≥50 yellow, <50 red
- Priority labels: Kritiek (red), Hoog (orange), Gemiddeld (yellow), Laag (blue)

## Design Patterns
- Followed exact pattern from existing pages (use client, use hook for params, framer-motion animations, shadcn/ui components)
- Consistent emerald/green color scheme
- Responsive layouts (mobile-first)
- All text in Dutch
- Lint check passed with 0 errors

## Dependencies
- All pages use existing shadcn/ui components and lucide-react icons
- No new dependencies installed
