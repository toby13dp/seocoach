# SEOCoach — UX Design Principles

**Document version:** 1.0  
**Date:** 2026-03-04  
**Status:** Active  

---

## 1. Design Philosophy

SEOCoach is built for people who need SEO results, not SEO knowledge. Our users are Dutch entrepreneurs, marketers, content editors, e-commerce managers, and agency team members who want to improve their organic visibility without becoming SEO technicians. Every design decision must serve this principle: **the platform does the heavy lifting; the user makes the important decisions.**

The design philosophy rests on three pillars:

1. **Dutch-first accessibility** — The platform speaks the user's language, literally and figuratively. Every word on screen is in plain Dutch. Every concept is explained without jargon. Every interaction feels natural to someone working in the Dutch-language market.

2. **Safe exploration** — Users should feel confident trying things. Nothing irreversible happens without explicit approval. Every score is explainable. Every action can be undone (or at least understood). Safe defaults mean the user cannot accidentally harm their website.

3. **Progressive depth** — The surface is simple. The depth is available when needed. A bakery owner sees "Verbeter je titels" (Improve your titles). An SEO specialist clicks through to see character counts, keyword positioning, competitor comparison, and historical trends. Both users start at the same screen but go as deep as they need.

---

## 2. Core Principles

### 2.1 One Primary Action Per Screen

Every screen has exactly one primary call to action. This is the single most important thing the user can do on this screen. It is visually dominant, clearly labelled in Dutch, and positioned where the eye naturally falls.

**Rules:**
- There is always exactly one primary button. It uses the primary colour and is the largest interactive element.
- Secondary actions exist but are de-emphasised: outline buttons, text links, or menu items.
- Destructive actions (delete, remove, unpublish) are never the primary action. They are always secondary and always require confirmation.
- Navigation is separate from action. The sidebar navigates; the content area acts.

**Example:** On the technical issues screen, the primary action is "Bekijk probleem" (View issue). Secondary actions are "Markeer als opgelost" (Mark as resolved) and "Negeer" (Ignore). Deleting the issue is not available from this screen — it requires a separate confirmation flow.

### 2.2 Plain Dutch Language

All user-facing text is written in plain Dutch (nl-NL preferred, nl-BE variant supported). Technical SEO terminology is translated or explained on first use. English acronyms are never used without a Dutch explanation.

**Rules:**
- Use "Zoekintentie" instead of "Search Intent"
- Use "Technische SEO" instead of "Technical SEO"
- Use "Sneeuwschuiver" or "Paginastructuur" instead of "Cannibalisation" (with explanation)
- When an English term is genuinely standard in the Dutch SEO industry (like "301-redirect"), use it but provide a tooltip: "Een 301-redirect stuurt bezoekers en zoekmachines permanent door naar een nieuwe pagina."
- Numbers use Dutch formatting: 1.234,56 (period for thousands, comma for decimals)
- Dates follow Dutch conventions: 4 maart 2026, not March 4, 2026
- Currency uses the euro symbol with Dutch placement: € 1.234,56

**Anti-patterns:**
- Never mix Dutch and English in a single heading or label
- Never use English-only error messages
- Never use internal technical identifiers (like "RULE_042") as user-facing labels

### 2.3 Visible Progress

Users must always understand what is happening, what has happened, and what will happen next. Progress is never invisible.

**Rules:**
- Background jobs show a progress indicator with estimated completion when possible
- Crawl progress shows: pages found, pages crawled, errors encountered, and estimated time remaining
- Content generation shows: which step is active, what the AI is doing, and what comes next
- Publication workflows show: current status, next step, and required action
- Loading states are never empty: skeletons, spinners with context, or progressive content reveal

**Example:** When a crawl is running, the user sees: "Crawlen bezig — 47 van ~200 pagina's verwerkt. Geschatte tijd: 3 minuten." Not just a spinning wheel.

### 2.4 Safe Defaults

Every setting, configuration, and workflow ships with the safest reasonable default. The user should never need to configure anything before their first productive action. Advanced settings exist but are behind explicit controls.

**Rules:**
- New projects default to the safest crawl settings (respectful rate, reasonable limits)
- Automation defaults to "off" — the user must explicitly enable automated actions
- Publishing defaults to "draft" — the user must explicitly choose "publish"
- AI content defaults to "suggest" — the user must explicitly accept or modify
- Deletion defaults to "soft delete" — hard deletion requires explicit confirmation
- Notification defaults are conservative — the user opts in to more, not out of less
- All dangerous operations have a confirmation step that requires reading and clicking

**Example:** When connecting WordPress, the default mode is "Alleen lezen" (Read-only). The user must explicitly enable "Kan publiceren" (Can publish) after confirming they understand the implications.

### 2.5 Explainable Scores

Every score, rating, or metric displayed in the platform is decomposable into its contributing factors. The user can always answer: "Why is this number what it is?"

**Rules:**
- Every score has a "Hoe wordt dit berekend?" (How is this calculated?) link or tooltip
- Score breakdowns are shown in plain Dutch with the actual values used
- Scores never appear before the data needed to calculate them exists
- When a score cannot be calculated due to missing data, the UI says: "Nog niet beschikbaar — er is meer data nodig om deze score te berekenen." (Not yet available — more data is needed to calculate this score.)
- Confidence levels are shown when scores are based on partial data
- Score weights are visible to administrators and explained in Dutch

**Example:** An opportunity score of 78 shows: "Kansscore: 78/100. Samenstelling: Zoekvolume (32/40), Concurrentie (22/30), Relevantie (24/30)."

### 2.6 No Fabricated Metrics Before Data Exists

The platform never displays a metric, score, trend, or chart when the underlying data does not exist. Empty states are honest and constructive.

**Rules:**
- Dashboard widgets that lack data show a clear empty state: "Voeg je eerste website toe om te beginnen" (Add your first website to get started) — not a zero-value chart
- Trends are only shown when enough historical data points exist
- Comparisons (period-over-period) are only shown when both periods have data
- If a metric requires an integration that is not connected, the widget says: "Verbind Google Search Console om deze gegevens te zien" (Connect Google Search Console to see this data)
- Never show a "health score" or "SEO score" that is fabricated from assumptions rather than actual crawl or integration data

**Anti-patterns:**
- Never show a "0%" chart as though it represents real data
- Never show placeholder trend lines
- Never display "No data" as a tiny footnote beneath a large, empty visualisation

### 2.7 Contextual Help

Every complex or domain-specific concept has contextual help available exactly where the user encounters it. Help is not a separate manual; it is woven into the interface.

**Rules:**
- Help icons (?) appear next to labels that might be unfamiliar
- Clicking a help icon shows a short Dutch explanation (1-3 sentences) in a tooltip or popover
- Longer explanations link to a contextual help page
- First-time user guidance: the first visit to a complex screen shows a brief, dismissible introduction
- Error messages include: what went wrong, why, and what the user can do about it — all in Dutch
- Help content is versioned and maintained alongside the feature it describes

**Example:** Next to "Hreflang" appears a (?) icon. Clicking it shows: "Hreflang vertelt zoekmachines welke taalversie van een pagina getoond moet worden. Bijvoorbeeld: als je een Nederlandse en Vlaamse versie hebt, helpt hreflang Google de juiste versie te tonen."

### 2.8 Consistent Labels

Labels for priority, status, severity, and other categorical values are consistent across the entire platform. The same concept always uses the same word and the same colour.

**Priority labels:**
| Level | Dutch Label | Colour |
|-------|------------|--------|
| Critical | Kritiek | Red |
| High | Hoog | Orange |
| Medium | Gemiddeld | Yellow |
| Low | Laag | Blue |

**Status labels:**
| Status | Dutch Label | Colour |
|--------|------------|--------|
| New | Nieuw | Blue |
| In progress | Bezig | Yellow |
| Waiting | Wachtend | Orange |
| Done | Afgerond | Green |
| Cancelled | Geannuleerd | Grey |

**Severity labels (issues):**
| Severity | Dutch Label | Colour |
|----------|------------|--------|
| Critical | Kritiek | Red |
| Warning | Waarschuwing | Orange |
| Info | Informatie | Blue |

**Approval status:**
| Status | Dutch Label | Colour |
|--------|------------|--------|
| Pending | In afwachting | Yellow |
| Approved | Goedgekeurd | Green |
| Rejected | Afgewezen | Red |
| Expired | Verlopen | Grey |

---

## 3. Navigation & Information Architecture

### 3.1 Main Navigation

The main navigation uses a persistent sidebar (desktop) and a bottom tab bar or hamburger menu (mobile). Navigation is role-aware: users see only the sections relevant to their role.

**Primary sections (Dutch labels):**
1. **Overzicht** — Dashboard with key metrics and actions
2. **Mijn acties** — "Mijn belangrijkste acties" — prioritised action list
3. **Website** — Crawl data, pages, technical issues
4. **Zoekwoorden** — Keywords, intent, opportunities
5. **Content** — Topic clusters, content briefs, studio
6. **Publiceren** — WordPress, WooCommerce, programmatic SEO
7. **Inzichten** — Analytics, monitoring, competitors, GEO
8. **Lokaal** — Local SEO, reviews, reputation
9. **E-commerce** — Products, feeds, revenue
10. **Rapporten** — White-label reporting
11. **Instellingen** — Organisation, project, and user settings

**Agency-specific sections:**
- **Klanten** — Client management and portal
- **Team** — Team management and capacity

### 3.2 Project Navigation

Projects are the primary organising unit. A project selector in the header allows switching between projects. All navigation within a project is scoped to that project.

**Rules:**
- The current project name is always visible in the header
- Switching projects preserves the user's current section context
- Data from different projects is never mixed on a single screen

### 3.3 Role-Specific Dashboards

Each role sees a dashboard tailored to their responsibilities:

| Role | Dashboard Focus |
|------|----------------|
| Ondernemer | Top actions, business impact, simple health indicators |
| Marketeer | Content opportunities, keyword trends, publishing queue |
| SEO-specialist | Technical issues, crawl status, competitor changes, advanced analytics |
| Contentredacteur | Content briefs, drafts needing review, quality feedback, brand reminders |
| E-commerce manager | Product opportunities, revenue prioritisation, feed issues, WooCommerce status |
| Bureau-eigenaar | Client health, deliverables, team capacity, profitability, pending approvals |
| Klant | Shared reports, approval requests, KPI summaries |
| Ontwikkelaar | Integration status, API health, deployment monitoring, technical views |

---

## 4. Interaction Patterns

### 4.1 Approval-First Workflows

All publishing, destructive, and high-impact actions follow an approval pattern:

1. **Propose** — The system or user proposes an action (e.g., publish to WordPress)
2. **Preview** — The user sees exactly what will happen before confirming
3. **Confirm** — The user explicitly confirms with a deliberate action (not just clicking "OK")
4. **Execute** — The action is performed
5. **Report** — The result is shown (success or failure with details)

**Rules:**
- Confirmation dialogs use a different button label than the action itself (e.g., "Ja, publiceren" not just "OK")
- Preview shows the actual content or change, not a summary
- Failed actions show the error in Dutch with suggested next steps
- All approvals are audit-logged

### 4.2 Guided Onboarding

New users follow a step-by-step onboarding wizard. Each step:
- Has a clear title and a one-sentence Dutch explanation
- Collects one piece of information at a time
- Provides sensible defaults the user can accept
- Shows progress (step 3 of 10)
- Can be paused and resumed

### 4.3 Empty States

Every screen and widget has a designed empty state that:
- Explains what data is needed: "Voer je eerste crawl uit om pagina's te zien" (Run your first crawl to see pages)
- Provides a clear call to action: "Start crawlen" (Start crawl)
- Never shows zeroed-out charts or tables with "No data" as an afterthought

### 4.4 Error States

Errors are handled gracefully and communicated clearly:
- User-facing errors are in Dutch with a specific explanation and suggested action
- Technical errors are logged but not shown to non-technical users
- Retry is offered when appropriate
- Error messages never expose internal system details, stack traces, or credentials

### 4.5 Loading States

Loading is never invisible:
- Skeleton screens for initial page loads
- Progress bars for background jobs
- Inline spinners for quick actions (under 2 seconds)
- Contextual messages for long operations: "Je crawl wordt voorbereid..."

### 4.6 Undo & Rollback

Wherever technically possible, actions can be undone:
- Content edits: version history with diff view and one-click restore
- CMS publications: rollback metadata enables reverting to the previous state
- Internal links: diff preview before applying, rollback metadata after
- Programmatic SEO: bulk rollback for template-generated pages
- For actions that cannot be fully undone (e.g., a published page that was already crawled by Google), the platform explains the limitation honestly

---

## 5. Visual Design Rules

### 5.1 Colour System

The colour system is built on the shadcn/ui theme with Tailwind CSS. Colours are accessible (WCAG 2.1 AA contrast ratios) and semantically consistent.

| Purpose | Token | Usage |
|---------|-------|-------|
| Primary | `--primary` | Primary buttons, active states, key metrics |
| Destructive | `--destructive` | Delete, remove, critical errors |
| Warning | `--warning` | Warnings, medium-priority items |
| Success | `--success` | Completed actions, positive trends |
| Muted | `--muted` | Secondary text, disabled states |
| Accent | `--accent` | Highlights, selected items |

### 5.2 Typography

- **Base language**: Dutch
- **Font**: System font stack (Inter as web font fallback)
- **Body**: 16px base, 1.5 line height
- **Headings**: Bold, clear hierarchy (H1 → H4 only)
- **Labels**: Sentence case in Dutch (e.g., "Start crawlen", not "Start Crawlen")
- **Numbers**: Dutch locale formatting

### 5.3 Spacing & Layout

- 8px grid system for spacing consistency
- Maximum content width: 1280px for main content, 320px for sidebar
- Responsive breakpoints: mobile (<640px), tablet (640–1024px), desktop (>1024px)
- Card-based layouts for dashboard widgets
- Consistent padding: 16px mobile, 24px tablet, 32px desktop

### 5.4 Iconography

- Icons are supplementary, never the sole carrier of meaning
- All icons have accessible labels (aria-label in Dutch)
- Use Lucide icons (shadcn/ui default) consistently
- Icon + label pairs are preferred over icon-only buttons

---

## 6. Accessibility (WCAG 2.1 AA)

Accessibility is a first-class requirement, not an afterthought.

### 6.1 Keyboard Access

- All interactive elements are reachable via keyboard (Tab order follows visual order)
- Focus indicators are clearly visible (custom focus ring using primary colour)
- Modal dialogs trap focus and return focus on close
- Keyboard shortcuts are documented and do not conflict with assistive technology

### 6.2 Screen Reader Support

- All images have alt text in Dutch
- Form inputs have associated labels
- Dynamic content updates use aria-live regions
- Tables have proper headers and scope attributes
- Charts have text alternatives or data tables

### 6.3 Drag-and-Drop Alternatives

Every drag-and-drop interaction has an accessible alternative:

| Feature | Drag-and-Drop | Accessible Alternative |
|---------|--------------|----------------------|
| Topic cluster editing | Visual graph drag | List view with move buttons |
| Report builder | Section drag | Section list with up/down buttons |
| Kanban board | Card drag | Card list with status dropdown |
| Automation builder | Block drag | Block list with order controls |

### 6.4 Reduced Motion

- Animations respect `prefers-reduced-motion`
- No auto-playing animations without user initiation
- Loading indicators have a static fallback

---

## 7. Content Design

### 7.1 Writing Style

- **Tone**: Professional but approachable. Like a knowledgeable colleague, not a textbook.
- **Voice**: Active voice. Direct address ("Je" not "U" — modern Dutch, not formal).
- **Clarity**: Short sentences. One idea per sentence. No subordinate clauses that hide the main point.
- **Honesty**: Say "We weten dit niet zeker" (We're not sure about this) when uncertain. Never bluff.

### 7.2 Score Communication

All scores follow this communication pattern:
1. **The score itself** (prominent, with colour coding)
2. **What it means** (one-sentence Dutch explanation)
3. **How it was calculated** (expandable breakdown)
4. **What to do** (recommended action or "No action needed")

**Example:**
```
Technische gezondheid: 72/100
Je website heeft 12 technische problemen, waarvan 3 kritiek.
▼ Hoe berekend?   →   [expandable: breakdown of issues and weights]
Aanbevolen actie: Los de 3 kritieke problemen op first.
```

### 7.3 Metric Communication

Metrics are never presented without context:
- Absolute numbers include comparison: "1.234 bezoeken (+12% vs. vorige maand)"
- Percentages include the base: "3,2% conversieratio (van 38.500 bezoeken)"
- Ranks include the keyword: "Positie 4 voor 'bloemen bezorgen amsterdam'"
- Missing data is stated explicitly: "Geen Search Console-data beschikbaar voor deze periode"

---

## 8. Responsive Design

The platform is responsive and fully usable on mobile devices, though the primary target is desktop.

### 8.1 Mobile Adaptations

- Sidebar collapses to bottom tab bar with key sections
- Tables become card lists
- Multi-column layouts stack vertically
- Charts adapt to narrower viewports with simplified legends
- Touch targets are at least 44x44px

### 8.2 Desktop Optimisation

- Sidebar is always visible (collapsible)
- Multi-column layouts for data-rich screens
- Keyboard shortcuts for power users
- Split-screen views for content comparison (diff, before/after)

---

## 9. Dutch-Specific Design Considerations

### 9.1 Language Variants

The platform supports nl-NL (Netherlands) and nl-BE (Belgium). Differences are handled gracefully:
- Number formatting: both use European style (1.234,56)
- Date formatting: both use day-month-year (4 maart 2026)
- Spelling: the platform uses one consistent variant (nl-NL) but accepts input in both
- Cultural references: examples and help text reference both Dutch and Belgian contexts

### 9.2 Dutch SEO Terminology Mapping

| English Term | Dutch Term Used | First-Use Explanation |
|-------------|----------------|----------------------|
| Crawl | Crawlen | "Crawlen betekent dat ons systeem je website doorzoekt en alle pagina's inventariseert." |
| Index | Indexeren | "Indexeren betekent dat Google je pagina toevoegt aan de zoekresultaten." |
| Canonical | Canonical | "Een canonical-tag vertelt Google welke versie van een pagina de belangrijkste is." |
| Redirect | Redirect | "Een redirect stuurt bezoekers automatisch door naar een andere pagina." |
| Backlink | Backlink | "Een backlink is een link van een andere website naar jouw website." |
| SERP | Zoekresultaten | "De SERP (Search Engine Results Page) is de pagina met zoekresultaten die je ziet na een zoekopdracht." |
| CTR | Klikratio | "CTR (Click-Through Rate) is het percentage mensen dat op jouw resultaat klikt in de zoekmachine." |
| Keyword | Zoekwoord | "Een zoekwoord (keyword) is de term die iemand intypt in een zoekmachine." |
| Search intent | Zoekintentie | "Zoekintentie is de reden waarom iemand zoekt: informatie, een aankoop, of navigatie." |
| Hreflang | Hreflang | "Hreflang is een tag die Google vertelt welke taalversie van een pagina getoond moet worden." |

---

## 10. Design Review Checklist

Before any screen or feature is considered complete, it must pass this checklist:

- [ ] Is the primary action clear and singular on this screen?
- [ ] Is all text in plain Dutch? Are there any unexplained acronyms?
- [ ] Are empty states designed? Do they guide the user to the next step?
- [ ] Are error states designed? Do they explain the problem and solution in Dutch?
- [ ] Are loading states designed? Is progress visible?
- [ ] Can every score be decomposed into its factors?
- [ ] Are no metrics shown before the underlying data exists?
- [ ] Does the screen work with keyboard only?
- [ ] Do drag-and-drop interactions have accessible alternatives?
- [ ] Are confirmation dialogs used for destructive or publishing actions?
- [ ] Are safe defaults applied? Does the user need to configure anything before their first action?
- [ ] Are priority and status labels consistent with the platform-wide system?
- [ ] Is contextual help available for domain-specific terms?
- [ ] Is the screen responsive at mobile, tablet, and desktop breakpoints?
- [ ] Does the screen respect `prefers-reduced-motion`?

---

*These principles are binding. No feature is considered complete unless it satisfies every applicable principle. Violations must be documented and resolved before a feature can be marked as done.*
