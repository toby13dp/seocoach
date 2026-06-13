// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// Benchmarking Types — Phase 10

import type { BenchmarkCategory } from '@prisma/client';

/**
 * Benchmarkcategorieën met Nederlandse labels
 */
export const BENCHMARK_CATEGORY_LABELS: Record<BenchmarkCategory, string> = {
  CTR: 'Clickthroughratio',
  TECHNICAL_HEALTH: 'Technische gezondheid',
  PUBLISHING_FREQUENCY: 'Publicatiefrequentie',
  CONTENT_GROWTH: 'Contentgroei',
  CONVERSION_RATE: 'Conversieratio',
  ISSUE_RESOLUTION_SPEED: 'Probleemoplossingssnelheid',
  GEO_READINESS: 'GEO-gereedheid',
  AI_VISIBILITY: 'AI-zichtbaarheid',
  ORGANIC_GROWTH: 'Organische groei',
  PUBLICATION_SPEED: 'Publicatiesnelheid',
};

/**
 * Alle benchmarkcategorieën
 */
export const ALL_BENCHMARK_CATEGORIES: BenchmarkCategory[] = [
  'CTR',
  'TECHNICAL_HEALTH',
  'PUBLISHING_FREQUENCY',
  'CONTENT_GROWTH',
  'CONVERSION_RATE',
  'ISSUE_RESOLUTION_SPEED',
  'GEO_READINESS',
  'AI_VISIBILITY',
  'ORGANIC_GROWTH',
  'PUBLICATION_SPEED',
];

/**
 * Minimum aantal peers voor geanonimiseerde vergelijking
 */
export const MIN_PEERS_FOR_ANONYMISATION = 5;

/**
 * Benchmarkresultaat met optionele peer-vergelijking
 */
export interface BenchmarkScore {
  category: BenchmarkCategory;
  score: number;
  previousScore?: number;
  change?: number;
  percentile?: number;
  peerCount?: number;
}

/**
 * Benchmarkberekeningsinput per categorie
 */
export interface BenchmarkInput {
  category: BenchmarkCategory;
  projectId: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  // Ruwe gegevens per categorie
  metrics: Record<string, number>;
}
