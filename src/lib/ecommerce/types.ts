// ============================================================================
// E-commerce SEO Types — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Type definitions for the E-commerce SEO module. Covers product analysis,
// category quality, revenue prioritization, faceted navigation, seasonal
// analysis, and product variations. All user-facing strings are in Dutch.
// ============================================================================

import { ProductStatus, FeedType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Product SEO Analysis
// ---------------------------------------------------------------------------

/**
 * Result of a product SEO analysis across 4 scoring dimensions.
 */
export interface ProductSEOAnalysis {
  productId: string;
  titleQuality: number;       // 0-100
  descriptionQuality: number; // 0-100
  structuredDataScore: number; // 0-100
  imageScore: number;         // 0-100
  overallSeoScore: number;    // 0-100
  issues: ProductSEOIssue[];
}

/**
 * A single SEO issue found in a product.
 */
export interface ProductSEOIssue {
  /** The field where the issue was found */
  field: string;              // e.g. "title", "description", "image", "structured_data"
  /** How severe the issue is */
  severity: 'error' | 'warning' | 'info';
  /** Dutch description of the issue */
  message: string;
  /** Dutch recommendation for fixing the issue */
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Category Quality
// ---------------------------------------------------------------------------

/**
 * Quality analysis result for a product category.
 */
export interface CategoryQualityResult {
  categoryId: string;
  name: string;
  qualityScore: number;     // 0-100
  productCount: number;
  hasDescription: boolean;
  hasStructuredData: boolean;
  /** Dutch issue descriptions */
  issues: string[];
}

// ---------------------------------------------------------------------------
// Revenue Prioritization
// ---------------------------------------------------------------------------

/**
 * Revenue-based prioritization of a product for SEO investment.
 */
export interface RevenuePrioritization {
  productId: string;
  productName: string;
  revenue30d: number;
  revenue90d: number;
  margin: number | null;
  seoScore: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Dutch explanation of the priority */
  priorityReason: string;
}

// ---------------------------------------------------------------------------
// Faceted Navigation
// ---------------------------------------------------------------------------

/**
 * A single issue found in faceted navigation.
 */
export interface FacetedNavigationResult {
  url: string;
  issueType: string;
  severity: string;
  /** Dutch description of the issue */
  description: string;
  /** Dutch recommendation for fixing the issue */
  recommendation: string;
  parameterName?: string;
  parameterValue?: string;
  canonicalUrl?: string;
}

// ---------------------------------------------------------------------------
// Seasonal Analysis
// ---------------------------------------------------------------------------

/**
 * Seasonal analysis result for a product.
 */
export interface SeasonalProductResult {
  productId: string;
  productName: string;
  isSeasonal: boolean;
  /** Months (1-12) where the product is in season */
  seasonalMonths: number[];
  /** Dutch recommendation for seasonal optimization */
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Dutch Labels
// ---------------------------------------------------------------------------

/**
 * Dutch labels for ProductStatus enum values.
 */
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  ACTIVE: "Actief",
  OUT_OF_STOCK: "Uit voorraad",
  DISCONTINUED: "Stopgezet",
  SEASONAL: "Seizoensgebonden",
  DRAFT: "Concept",
};

/**
 * Dutch labels for FeedType enum values.
 */
export const FEED_TYPE_LABELS: Record<FeedType, string> = {
  MERCHANT: "Merchant feed",
  META_CATALOGUE: "Meta-catalogus",
  COMPARISON: "Vergelijkingsfeed",
  MARKETPLACE: "Marketplace",
  AFFILIATE: "Affiliate feed",
};

// ---------------------------------------------------------------------------
// Product SEO Scoring Weights
// ---------------------------------------------------------------------------

/**
 * Weights for each dimension in the overall SEO score calculation.
 * Each value represents the percentage contribution (sum = 100).
 */
export const PRODUCT_SEO_WEIGHTS = {
  titleQuality: 25,
  descriptionQuality: 25,
  structuredDataScore: 25,
  imageScore: 25,
} as const;

// ---------------------------------------------------------------------------
// Product Management Types
// ---------------------------------------------------------------------------

/**
 * Data required to create a new product.
 */
export interface ProductCreateData {
  sku?: string;
  gtin?: string;
  mpn?: string;
  name: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  categoryId?: string;
  productType?: string;
  brand?: string;
  regularPrice?: number;
  salePrice?: number;
  currency?: string;
  costPrice?: number;
  stockStatus?: ProductStatus;
  stockQuantity?: number;
  manageStock?: boolean;
  parentProductId?: string;
  variationAttributes?: Record<string, string>;
  imageUrl?: string;
  imageAlt?: string;
  additionalImages?: string[];
  productUrl?: string;
  isSeasonal?: boolean;
  seasonalMonths?: number[];
  source?: string;
  externalId?: string;
  importBatch?: string;
}

/**
 * Data for updating an existing product. All fields optional.
 */
export interface ProductUpdateData {
  sku?: string;
  gtin?: string;
  mpn?: string;
  name?: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  categoryId?: string;
  productType?: string;
  brand?: string;
  regularPrice?: number;
  salePrice?: number;
  currency?: string;
  costPrice?: number;
  stockStatus?: ProductStatus;
  stockQuantity?: number;
  manageStock?: boolean;
  parentProductId?: string;
  variationAttributes?: Record<string, string>;
  imageUrl?: string;
  imageAlt?: string;
  additionalImages?: string[];
  productUrl?: string;
  isSeasonal?: boolean;
  seasonalMonths?: number[];
  source?: string;
  externalId?: string;
  importBatch?: string;
}

/**
 * Filters for listing products.
 */
export interface ProductListFilters {
  categoryId?: string;
  stockStatus?: ProductStatus;
  minSeoScore?: number;
  maxSeoScore?: number;
  minRevenue?: number;
  isSeasonal?: boolean;
  hasVariations?: boolean;
  search?: string;
  sortBy?: 'revenue' | 'seoScore' | 'name' | 'stockStatus';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Inventory summary for a project's product catalog.
 */
export interface ProductInventorySummary {
  totalProducts: number;
  activeProducts: number;
  outOfStock: number;
  seasonalProducts: number;
  avgSeoScore: number;
  totalRevenue30d: number;
  totalRevenue90d: number;
  productsWithVariations: number;
}

// ---------------------------------------------------------------------------
// Variation Analysis
// ---------------------------------------------------------------------------

/**
 * Analysis result for a product's variations.
 */
export interface VariationAnalysisResult {
  totalVariations: number;
  variationsWithUniqueDescriptions: number;
  variationsWithImages: number;
  duplicateContentGroups: number;
  /** Dutch issue descriptions */
  issues: string[];
  /** Dutch recommendations */
  recommendations: string[];
}
