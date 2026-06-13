# Task 6+7 — Keyword Management and Opportunity Scoring Libraries

## Agent: Keyword & Scoring Agent

## Task
Build Keyword Management and Opportunity Scoring libraries for the SEOCoach platform (Dutch market).

## Files Created

| File | Purpose |
|------|---------|
| `/src/lib/keywords/types.ts` | Core type definitions (10 interfaces/types) |
| `/src/lib/keywords/import.ts` | CSV parsing with flexible columns, validation, bulk import |
| `/src/lib/keywords/intent-classifier.ts` | Rule-based + AI-assisted intent classification |
| `/src/lib/keywords/opportunity-scorer.ts` | 7-component opportunity scoring with Dutch calculation traces |
| `/src/lib/keywords/index.ts` | Barrel export |

## Key Design Decisions

1. **Flexible CSV parsing**: 30+ column name aliases covering Dutch, English, and common SEO tool column names (Ahrefs, SEMrush, Moz format)
2. **Rule-based classifier first**: 150+ Dutch language patterns provide deterministic classification without AI dependency
3. **AI with fallback**: `classifyIntentWithAI()` uses ProviderManager but falls back gracefully to rule-based on any failure
4. **Quick-win detection**: Position 11-20 gets the highest currentRankScore (95) because these are the best ROI keywords
5. **Diminishing returns**: Volume uses logarithmic scaling to avoid over-valuing high-volume keywords
6. **Full explainability**: Every score comes with a Dutch calculation trace showing raw values, scores, weights, and explanations
7. **Edge case handling**: Null/zero/missing values get neutral defaults (usually 40-50) rather than zero

## Dependencies Used
- `@/lib/db` — Prisma client for database operations
- `@/lib/ai` — ProviderManager for AI-assisted classification

## Lint Status
All lint checks pass cleanly.
