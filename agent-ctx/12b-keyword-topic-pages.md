# Task 12b - Keyword and Topic Cluster Frontend Pages

## Agent: Frontend Agent
## Task: Build Keyword and Topic Cluster frontend pages for SEOCoach (Dutch market)

## Work Log

### Files Created
1. **`/home/z/my-project/src/app/[locale]/projects/[id]/keywords/page.tsx`** — Keywords Management page
   - "use client" component with full CRUD functionality
   - Table with columns: Trefwoord, Zoekintentie, Trechterfase, Volume, Moeilijkheid, CPC, Positie, Kansscore
   - Search/filter bar: text search, intent filter, funnel filter, group filter, volume range, difficulty range
   - Column sorting with ascending/descending toggle
   - Pagination with page navigation
   - "Trefwoord toevoegen" dialog with all keyword input fields
   - "CSV importeren" dialog with file upload
   - "Intentie classificeren" button on each keyword row (sparkles icon)
   - Click keyword row to navigate to detail page
   - Color-coded intent badges: Informatief (blue), Navigatie (green), Transactioneel (orange), Commercieel onderzoek (purple), Lokaal (teal), Merk (gray)
   - Color-coded funnel badges: Bewustwording (sky), Overweging (yellow), Beslissing (emerald), Behoud (gray)
   - Score color coding: green (70+), yellow (40-69), red (<40)
   - Empty state with Dutch text
   - All text in Dutch

2. **`/home/z/my-project/src/app/[locale]/projects/[id]/keywords/[keywordId]/page.tsx`** — Keyword Detail page
   - "use client" component with full keyword details
   - Metrics summary cards: Volume, Moeilijkheid, CPC, Positie
   - Opportunity score visualization: circular gauge for total score
   - 7 component bar charts with scores, weights, and color coding
   - Calculation trace showing each step with Dutch explanations
   - "Score herberekenen" button to recalculate opportunity score
   - Related pages table (from KeywordPage)
   - Associated topics list with pillar badge
   - Additional info section: group, current URL, source, tags, notes
   - All text in Dutch

3. **`/home/z/my-project/src/app/[locale]/projects/[id]/topics/page.tsx`** — Topic Clusters page
   - "use client" component with two view modes
   - **Graph view** (Grafiek):
     - Visual node graph showing topics as positioned nodes
     - Edges drawn as SVG lines with color coding (green=supports, red=contradicts, gray=related)
     - Pillar pages shown as larger nodes with badge
     - Cluster-based coloring of nodes
     - Drag to reposition nodes (mouse-based CSS positioning)
     - Click node to select and show details panel
     - Click edge to show relation details
     - Delete relation from details panel
   - **List view** (Lijst):
     - Topics grouped by cluster in separate cards
     - Table with columns: Naam, Cluster, Type, Intentie, Trechter, Prioriteit
     - Expandable rows showing keywords per topic
     - Drag-and-drop reordering within a cluster using @dnd-kit
     - Unclustered topics section
   - "Onderwerp toevoegen" dialog with all topic fields
   - "Cluster toevoegen" dialog
   - "Relatie toevoegen" dialog (from/to topics, type, label)
   - Edit topic dialog (pre-filled with current values)
   - Delete topic action in dropdown menu
   - Empty state with Dutch text
   - All text in Dutch

4. **`/home/z/my-project/messages/nl.json`** — Added translation keys
   - `keywords` namespace: 40+ keys for keywords pages
   - `topics` namespace: 50+ keys for topics page

### API Endpoints Used
- GET/POST `/api/projects/[id]/keywords`
- POST `/api/projects/[id]/keywords/import`
- GET/PATCH/DELETE `/api/projects/[id]/keywords/[keywordId]`
- POST `/api/projects/[id]/keywords/[keywordId]/classify`
- POST `/api/projects/[id]/keywords/[keywordId]/score`
- GET/POST `/api/projects/[id]/topics`
- GET/PATCH/DELETE `/api/projects/[id]/topics/[topicId]`
- GET/POST `/api/projects/[id]/clusters`
- POST/DELETE `/api/projects/[id]/topic-relations`

### Bug Fix
- Fixed `Topic` icon import from lucide-react (doesn't exist) → replaced with `BookOpen`

## Verification
- Lint: ✅ All checks pass (0 errors, 0 warnings from new code)
- Dev server: ✅ All three routes return 200
  - `/nl/projects/[id]/keywords` → 200
  - `/nl/projects/[id]/keywords/[keywordId]` → 200
  - `/nl/projects/[id]/topics` → 200

## Stage Summary
All three pages created successfully with full Dutch UI, following existing project patterns and conventions.
