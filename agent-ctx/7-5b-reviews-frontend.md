# Task 7-5b: Reviews & Reputation Frontend Pages

## Agent: Frontend Developer

## Task
Build frontend pages for the Reviews & Reputation module of the SEOCoach project.

## Work Completed

### 1. Reviews List Page (`/src/app/[locale]/projects/[id]/reviews/page.tsx`)
- Full "use client" component following established project patterns
- **Header**: "Beoordelingen" with back button and description "Beheer beoordelingen en je online reputatie"
- **Stats bar** (5 cards):
  - Total reviews count (MessageSquare icon)
  - Average rating with star display (Star icon)
  - Positive sentiment count (green, ThumbsUp icon)
  - Negative sentiment count (red, ThumbsDown icon)
  - Response rate percentage with progress bar (BarChart3 icon)
- **Import dialog**: CSV file upload with source selector (Google, WooCommerce, Trustpilot, CSV-import, Enquête, Klantenservice-feedback)
- **Add manual review dialog**: Rating (1-5 interactive stars), title, content, author name, location dropdown
- **Filter bar** (6 filters):
  - Source filter (dropdown with all 7 sources)
  - Sentiment filter (Positief, Neutraal, Negatief, Gemengd)
  - Rating min/max
  - Search text with icon
  - Location filter (dynamic from API)
- **Review cards** with:
  - Author avatar placeholder, name, verified badge
  - Star rating + numeric rating
  - Date (reviewDate or createdAt)
  - Title (bold), content preview (2 line clamp)
  - Source badge (color-coded per spec)
  - Sentiment badge (color-coded per spec)
  - Location badge with MapPin icon
  - Response status badge (color-coded per workflow)
  - Theme tags (up to 3 shown + overflow count)
  - "Analyseer" button (if not yet analyzed)
  - "Genereer reactie" button (if no response draft)
  - "Details" button → navigates to review detail
- Empty state with helpful actions
- API calls: GET reviews (with filters), GET summary, POST create manual, POST import CSV, POST analyze, POST generate response

### 2. Review Detail Page (`/src/app/[locale]/projects/[id]/reviews/[reviewId]/page.tsx`)
- Full "use client" component with `use(params)` pattern for both `id` and `reviewId`
- **Header**: Back button, author name, verified badge, source badge, sentiment badge, star rating, date, location, source URL link
- **Review content card**: Full title, full content, "Analyseer beoordeling" button if no analysis
- **Sentiment analysis card** (conditional on analysis data):
  - Sentiment score gauge (-1 to +1 with color gradient and labels)
  - Themes (badge list)
  - Complaints (red-tinted panel with bullet points)
  - Compliments (green-tinted panel with bullet points)
  - Product issues (orange-tinted panel)
  - Service issues (orange-tinted panel)
  - FAQ opportunities (blue-tinted panel)
  - Content opportunities (blue-tinted panel)
  - Trust signals (emerald badges with Shield icon)
- **Response workflow card** with full approval workflow:
  1. **No response**: "Genereer reactie" button
  2. **DRAFT**: Step indicator (1/4), editable content, "Dien in ter goedkeuring" + "Bewerk" buttons
  3. **PENDING_APPROVAL**: Step indicator (2/4), content display, "Keur goed" + "Wijs af" buttons
  4. **APPROVED**: Step indicator (3/4), content display, "Publiceer" button
  5. **REJECTED**: Step indicator, content + rejection reason (red panel), "Bewerk en dien opnieuw in" button
  6. **PUBLISHED**: Step indicator (4/4), green-tinted content, published date, green "Gepubliceerd" badge
- **Reject dialog**: Rejection reason textarea, "Wijs af" button
- **Response history card**: Scrollable list of all responses with status, date, content preview, rejection reasons
- **Quick info card**: Source, rating, sentiment, verified, language, external ID, created date
- API calls: GET review detail, POST analyze, POST generate response, PATCH response, POST submit/approve/reject/publish

### Dutch Labels (All Implemented)
- Source labels: Google, WooCommerce, Trustpilot, CSV-import, Enquête, Klantenservice-feedback, Handmatig
- Sentiment labels: Positief, Neutraal, Negatief, Gemengd
- Response status labels: Concept, Wacht op goedkeuring, Goedgekeurd, Afgewezen, Gepubliceerd
- All buttons, descriptions, error messages, and UI text in Dutch

### Color Coding (Per Spec)
- Source colors: Google=blue, WooCommerce=purple, Trustpilot=green, CSV_IMPORT=gray, SURVEY=teal, SUPPORT_FEEDBACK=orange, MANUAL=slate
- Sentiment colors: POSITIVE/Positief=green, NEUTRAL/Neutraal=gray, NEGATIVE/Negatief=red, MIXED/Gemengd=yellow
- Response status colors: DRAFT=gray, PENDING_APPROVAL=yellow, APPROVED=green, REJECTED=red, PUBLISHED=blue

## Lint Results
- 0 errors, 2 pre-existing warnings (unrelated to this task)

## Dev Server
- Running normally, no errors
