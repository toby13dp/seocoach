# Task 7-5a: Local SEO Frontend Pages

## Summary
Created two complete Dutch-language frontend pages for the Local SEO module:

### 1. Locations List Page
**File**: `/src/app/[locale]/projects/[id]/locations/page.tsx`

Features:
- Header with "Locaties" title, back button, description "Beheer je locaties en lokale SEO"
- Stats bar with total locations, avg health score, avg rating (3 cards)
- Add location dialog with all required fields (name required, address, city, postal code, country default "NL", phone, email, website, lat/lng, business type, notes)
- Location cards grid with:
  - Name, city with MapPin icon
  - NAP consistency badge (color-coded: green ≥80, yellow ≥50, red <50)
  - Local health score badge (same color coding)
  - Avg rating with star display
  - Review count
  - GBP status badge ("Verbonden" green, "Niet verbonden" gray, "Fout" red)
  - Left border color matches health score
  - Click navigates to location detail
- Filter bar with city and business type Select dropdowns
- Empty state with Dutch message
- API calls: GET/POST `/api/projects/${id}/locations`

### 2. Location Detail Page
**File**: `/src/app/[locale]/projects/[id]/locations/[locationId]/page.tsx`

Features:
- Header with location name, city, back button
- Health score card with large number + progress bar + "Controleer nu" button
- 6 tabs:
  1. **Overzicht**: NAP info card, opening hours card (parsed from JSON), GBP status card, review stats card, health check results grid (10 categories with status badges)
  2. **Zoekwoorden**: Keywords table with keyword, intent badge (5 types in Dutch), volume, rank, URL. Add keyword dialog.
  3. **Bestemmingspagina's**: Landing pages table with URL, quality score, issue count, NAP/Schema/Map/Hours checkmarks. Add page dialog.
  4. **Concurrenten**: Competitors table with name, distance, rating stars, review count, website. Add competitor dialog.
  5. **Google Bedrijfsprofiel**: Connection status, connect/disconnect buttons, last sync time, GBP details grid, sync error display
  6. **Gestructureerde gegevens**: JSON-LD preview in dark code block, generate button

All Dutch labels implemented:
- Health categories: NAP-consistentie, Openingstijden, Gestructureerde gegevens, etc.
- Health statuses: Goed (green), Verbetering nodig (yellow), Onvoldoende (red), Niet gecontroleerd (gray)
- Intent labels: Navigatie, Informatief, Transactioneel, Commercieel, Lokaal

## Lint Results
- 0 errors, 2 warnings (pre-existing in review-manager.ts, not in our files)
