# Task 12c - Content Studio, AI Providers, and Content Decay Frontend Pages

## Agent: Frontend Agent

## Summary
Created 4 frontend pages and 1 API route for the SEOCoach platform (Dutch market):

### Pages Created

1. **Content Briefs List** (`/src/app/[locale]/projects/[id]/briefs/page.tsx`)
   - "use client" component with brief listing table
   - Columns: Titel, Doeltrefwoord, Intentie, Trechter, Status, Aangemaakt
   - Status badges with Dutch labels and color coding:
     - Concept (gray), In beoordeling (yellow), Goedgekeurd (green), Gepubliceerd (blue), Gearchiveerd (dark gray)
   - Search and status filter
   - "Nieuwe contentbrief" button → create brief dialog with all fields
   - Click on brief navigates to Content Studio
   - All text in Dutch

2. **Content Studio Editor** (`/src/app/[locale]/projects/[id]/briefs/[briefId]/page.tsx`)
   - Two-panel layout (brief details/outline + content editor)
   - Left panel: Title, target keyword, secondary keywords, outline editor
     - Drag-and-drop outline reordering (up/down buttons)
     - Each outline item: heading, level (H1-H4), key points
     - "Genereren" button for AI-assisted outline generation
   - Right panel: Content editor
     - "Concept genereren" button for AI draft generation
     - Text area for editing with word count display
     - "Opslaan" button to save changes
     - Version selector dropdown
     - Diff view toggle (compare current with previous version)
   - Bottom panel: Quality analysis
     - "Kwaliteit analyseren" button
     - Horizontal bar chart with 11 quality dimensions (all Dutch labels):
       Intentie, Dekking, Leesbaarheid, Originaliteit, Merkconsistentie, E-E-A-T, Interne links, Entiteiten, Conversie, GEO-gereedheid, Publicatiegereedheid
     - Overall score prominently displayed with color coding
     - Recommendations section
     - [VERIFICATIE_NODIG] claims highlighted in yellow
   - Approval flow:
     - "Ter beoordeling indienen" button (draft → in_review)
     - "Goedkeuren" button with confirmation dialog (in_review → approved)
   - All text in Dutch

3. **AI Provider Settings** (`/src/app/[locale]/projects/[id]/ai-providers/page.tsx`)
   - Provider listing with columns: Naam, Type, Basis-URL, Standaardmodel, Actief, Standaard
   - "Provider toevoegen" dialog with:
     - Naam, Type (Ollama/OpenAI-compatibel/Aangepast)
     - Basis-URL (auto-fills http://localhost:11434 for Ollama)
     - API-sleutel (only shown for non-Ollama)
     - Standaardmodel, Max tokens, Temperatuur, Timeout, Kosten per token
     - Privacy checkbox: "Externe provider toestaan voor dit project"
   - "Verbinding testen" button per provider
   - Set as default toggle
   - Active/inactive switch
   - Token usage summary cards (API calls, input/output tokens, cost)
   - Delete with confirmation dialog
   - All text in Dutch

4. **Content Decay** (`/src/app/[locale]/projects/[id]/decay/page.tsx`)
   - Table with columns: URL, Huidige positie, Vorige positie, Vervalpercentage, Aanbeveling
   - Color-coded pruning action badges:
     - Behouden (KEEP) → green
     - Verbeteren (IMPROVE) → yellow
     - Samenvoegen (MERGE) → orange
     - Doorverwijzen (REDIRECT) → red
     - Noindex → dark red
     - Verwijderen (REMOVE) → dark gray
   - "Verval detecteren" button
   - Click on entry → detail dialog with risk analysis, recommendations, traffic data
   - When no data: "Er is nog niet genoeg historische data om een trend te berekenen. Kom later terug voor een analyse."
   - Summary cards with action counts and average decay
   - All text in Dutch

### API Route Created

5. **AI Provider Test** (`/src/app/api/projects/[id]/ai-providers/[providerId]/test/route.ts`)
   - POST endpoint to test provider connection
   - Supports Ollama and OpenAI-compatible provider types
   - Returns success/failure, duration, tokens used
   - Logs test call to AICallLog
   - Proper timeout handling with AbortController

### Technical Details
- All pages follow existing project patterns (useEffect, useState, toast, motion)
- Use shadcn/ui components throughout
- Responsive design with mobile-first approach
- Dutch language for all user-facing text
- Lint passes with 0 errors (1 pre-existing warning unrelated to this task)
