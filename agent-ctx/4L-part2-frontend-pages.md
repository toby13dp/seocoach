# Task 4L-part2: SEOCoach Frontend Pages

## Summary
Created 4 frontend pages for the SEOCoach SEO automation platform. All UI text is in Dutch.

## Pages Created

### 1. Programmatic SEO Page
- **Path**: `/src/app/[locale]/projects/[id]/programmatic/page.tsx`
- **Features**:
  - Template list with name, type (Dutch labels), max pages, published count, status
  - "Nieuw sjabloon" dialog with full template creation form
  - Type selector with 9 Dutch-labeled options (Dienst + Locatie, etc.)
  - Content template textarea with {{variable}} placeholders
  - Variables editor (add/remove with name, label, type)
  - Data rows editor (add/remove rows with variable values)
  - Quality gates config with 6 checkboxes
  - Template detail view with 4 tabs: Overzicht, Data, Gegenereerde pagina's, Kwaliteit
  - Generate/Publish buttons with confirmation dialogs
  - Pages table with status badges, quality scores (color-coded), approve/reject/preview actions
  - Preview dialog for generated content
  - Rejection reasons shown in red

### 2. Content Studio (Workflow) Page
- **Path**: `/src/app/[locale]/projects/[id]/studio/page.tsx`
- **Features**:
  - Visual stepper showing all 14 steps with Dutch labels
  - Progress bar showing completion percentage
  - Step 1: Keyword selector from project keywords
  - Step 2: Content type selector (17 types with Dutch labels and descriptions)
  - Step 3: Generated brief preview with regenerate option
  - Step 4: Outline editor (add/remove sections, add/remove key points)
  - Step 5: Source selector with checkboxes and relevance scores
  - Step 6: Draft generation with loading state, then content preview
  - Step 7: Quality check results (BLOCKING=red, WARNING=yellow, INFO=blue)
  - Step 8: Claim review (SUPPORTED/PARTIAL/UNSUPPORTED badges)
  - Step 9: Internal link suggestions with approve/reject
  - Step 10: Full content preview
  - Step 11: Approve button (disabled if blocking findings)
  - Step 12: CMS connection selector + save button
  - Step 13: Schedule date picker or publish now
  - Step 14: Publication status display
  - Vorige/Volgende navigation buttons
  - Save progress indicator

### 3. Content History Page
- **Path**: `/src/app/[locale]/projects/[id]/history/page.tsx`
- **Features**:
  - Timeline view of all content changes
  - Filter bar: change type, date range, user
  - Each change shows: type badge (Dutch), summary, user/AI agent, timestamp
  - "Bekijk details" button → dialog with:
    - Content diff (red for removed, green for added)
    - CMS result display
    - Rollback button (if rollback data exists)
    - Approval info
  - 9 change types with Dutch labels (Aanmaken, Bijwerken, etc.)
  - Color-coded timeline with icons per change type

### 4. Decay Workflow Page
- **Path**: `/src/app/[locale]/projects/[id]/decay-workflow/page.tsx`
- **Features**:
  - Stats cards: total decaying, avg decay, critical count, prune actions
  - Pages sorted by decay percentage (descending)
  - Decay percentage color-coded: green < 15%, yellow 15-40%, orange 40-70%, red > 70%
  - Recommended action badges (Dutch: Behouden, Verbeteren, Samenvoegen, etc.)
  - "Update brief maken" button per page
  - "Snoeiactie goedkeuren" button for REMOVE/REDIRECT/NOINDEX actions
  - Detail dialog with:
    - Evidence section (traffic/ranking/click drops)
    - Risk assessment (LOW/MEDIUM/HIGH/CRITICAL)
    - Affected internal links count
    - Proposed redirect target
    - Action buttons
  - Confirmation dialogs for destructive actions with warning

## Design Patterns Used
- Emerald/green primary color throughout
- Dutch by default for all UI text
- Responsive, mobile-first design
- Loading/error/empty states for all pages
- Card-based layout
- framer-motion for page transitions
- sonner toast for notifications
- "use client" directive on all pages
- `use(params)` for async params
- `useRouter` from `@/i18n/routing`
- fetch for API calls to documented endpoints
