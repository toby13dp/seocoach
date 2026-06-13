# Task 9-3b: Phase 9 CRO & Business Intelligence Frontend Pages

## Summary
Created 3 frontend pages for the SEOCoach Phase 9 CRO & Business Intelligence modules. All text is in Dutch, following the existing "use client" pattern with `use(params)` for Next.js 16.

## Pages Created

### 1. CRO & Gedrag — `/src/app/[locale]/projects/[id]/cro/page.tsx`
- **Header**: "CRO & Gedrag" with back button and description
- **Stats bar**: 4 cards — Total behaviour records, Open findings, Critical findings, Avg scroll depth
- **3 Tabs**:
  - **Gedragsgegevens**: CSV import dialog, behaviour table with type/page/element/value/device/date, filter by behaviour type
  - **CRO-bevindingen**: Grid of finding cards with category+severity badges (color-coded), description, recommendation, page URL. Filter by category and severity. "Analyseer" button and "Nieuwe bevinding" dialog
  - **Experimenten**: Table with status badges (color-coded), KPI, improvement %, confidence, dates. Click navigates to detail. Create experiment dialog
- **API calls**: GET/POST behaviour, POST import, GET/POST cro-findings, GET/POST experiments
- **All Dutch labels**: Behaviour types, CRO categories, Severity levels, Experiment statuses

### 2. Experiment Detail — `/src/app/[locale]/projects/[id]/experiments/[experimentId]/page.tsx`
- **Header**: Experiment name + status badge + back button
- **Experiment info card**: Hypothesis, KPI name, baseline, target, group sizes
- **Status workflow**: Visual 3-step (Concept → Actief → Afgerond) with colored circles and connecting lines
- **Action buttons**: Start (from DRAFT), Record results + Complete (from RUNNING), Cancel (from DRAFT/RUNNING)
- **Results card** (when completed): Test vs control group comparison, improvement % (color-coded), confidence gauge with 95% threshold marker, significance badge (Wel/Niet statistisch significant), sample size warning if < 100, Dutch conclusion text
- **Recommendations section** (when completed): List of recommendation cards with priority badges
- **Record results dialog**: Test group + control group result inputs
- **API calls**: GET experiment, POST start/complete/cancel/results, GET recommendations

### 3. Prognoses & Budget — `/src/app/[locale]/projects/[id]/forecasts/page.tsx`
- **Header**: "Prognoses & Budget" with back button and description
- **2 Tabs**:
  - **Prognoses**: Generate forecast dialog (scenario selection, metrics input, period), Dutch disclaimer, forecast cards grouped by period showing 3 scenarios (Conservatief/Realistisch/Ambitieus) with key metrics, confidence level, assumptions list
  - **Budget**: Active budget card with color-coded progress bars for 10 categories, create/edit budget dialog with 10 allocation sliders (validates sum = 100%), budget recommendations section with Dutch explanations, error validation in Dutch
- **API calls**: GET/POST forecasts, GET/DELETE forecast by ID, GET/POST budgets, GET/PATCH/DELETE budget by ID, GET budget recommendations
- **All Dutch labels**: Scenarios (Conservatief/Realistisch/Ambitieus), Budget categories (Technische SEO, Content, etc.), Period labels

## Key Design Decisions
- Used the same "use client" pattern with `use(params)` as other SEOCoach pages
- All labels, buttons, toasts, and error messages in Dutch
- Consistent use of shadcn/ui components (Tabs, Dialog, Select, Badge, Progress, Slider, Table, etc.)
- Framer Motion for page transitions
- Responsive grid layouts (mobile-first with md: breakpoints)
- Loading skeleton states for all pages
- Empty states with icons and action buttons
- Color-coded severity/status badges matching the spec
- Dutch disclaimer for forecasts: "Dit is een prognose, geen garantie."
- Budget allocation validation with Dutch error message when percentages don't sum to 100%

## Lint Check
- 0 errors, 3 pre-existing warnings (unrelated to new pages)
