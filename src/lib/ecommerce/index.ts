// ============================================================================
// E-commerce SEO Module — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Central export point for the e-commerce SEO module.
// Import from '@/lib/ecommerce' to access all e-commerce functionality.
// ============================================================================

// Types
export type {
  ProductSEOAnalysis,
  ProductSEOIssue,
  CategoryQualityResult,
  RevenuePrioritization,
  FacetedNavigationResult,
  SeasonalProductResult,
  ProductCreateData,
  ProductUpdateData,
  ProductListFilters,
  ProductInventorySummary,
  VariationAnalysisResult,
} from './types';

export {
  PRODUCT_STATUS_LABELS,
  FEED_TYPE_LABELS,
  PRODUCT_SEO_WEIGHTS,
} from './types';

// Product Manager
export {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  listProducts,
  getProductInventorySummary,
} from './product-manager';

// Product Analyzer
export {
  analyzeProductSEO,
  analyzeAndSaveProductSEO,
  analyzeAllProducts,
} from './product-analyzer';

// Category Analyzer
export {
  analyzeCategoryQuality,
  analyzeProjectCategories,
  saveCategoryAnalysis,
} from './category-analyzer';

// Revenue Prioritizer
export {
  prioritizeProductsByRevenue,
  getTopRevenueOpportunities,
} from './revenue-prioritizer';

// Variation Analyzer
export {
  analyzeProductVariations,
} from './variation-analyzer';

// Seasonal Analyzer
export {
  analyzeSeasonalProducts,
  markProductSeasonal,
  getSeasonalRecommendations,
} from './seasonal-analyzer';

// Faceted Analyzer
export {
  analyzeFacetedNavigation,
  saveFacetedIssues,
  getFacetedIssues,
  resolveFacetedIssue,
} from './faceted-analyzer';
