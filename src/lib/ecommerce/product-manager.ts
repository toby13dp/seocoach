// ============================================================================
// Product Manager — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// CRUD operations for the e-commerce product catalog. Every function verifies
// projectId for tenant isolation. Soft deletes via deletedAt.
// ============================================================================

import { db } from '@/lib/db';
import { ProductStatus } from '@prisma/client';
import type {
  ProductCreateData,
  ProductUpdateData,
  ProductListFilters,
  ProductInventorySummary,
} from './types';

// ---------------------------------------------------------------------------
// Create Product
// ---------------------------------------------------------------------------

/**
 * Create a new product within a project.
 * Serialises JSON fields (variationAttributes, additionalImages, seasonalMonths)
 * before storage.
 */
export async function createProduct(
  projectId: string,
  data: ProductCreateData,
) {
  return db.product.create({
    data: {
      projectId,
      sku: data.sku,
      gtin: data.gtin,
      mpn: data.mpn,
      name: data.name,
      slug: data.slug,
      description: data.description,
      shortDescription: data.shortDescription,
      categoryId: data.categoryId,
      productType: data.productType,
      brand: data.brand,
      regularPrice: data.regularPrice,
      salePrice: data.salePrice,
      currency: data.currency ?? 'EUR',
      costPrice: data.costPrice,
      stockStatus: data.stockStatus ?? ProductStatus.ACTIVE,
      stockQuantity: data.stockQuantity,
      manageStock: data.manageStock ?? false,
      parentProductId: data.parentProductId,
      variationAttributes: data.variationAttributes
        ? JSON.stringify(data.variationAttributes)
        : undefined,
      imageUrl: data.imageUrl,
      imageAlt: data.imageAlt,
      additionalImages: data.additionalImages
        ? JSON.stringify(data.additionalImages)
        : undefined,
      productUrl: data.productUrl,
      isSeasonal: data.isSeasonal ?? false,
      seasonalMonths: data.seasonalMonths
        ? JSON.stringify(data.seasonalMonths)
        : undefined,
      source: data.source,
      externalId: data.externalId,
      importBatch: data.importBatch,
    },
    include: {
      category: true,
      variations: true,
      feedItems: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Update Product
// ---------------------------------------------------------------------------

/**
 * Update an existing product. Verifies projectId for tenant isolation.
 * Serialises JSON fields before storage.
 */
export async function updateProduct(
  productId: string,
  projectId: string,
  data: ProductUpdateData,
) {
  // Verify ownership
  const existing = await db.product.findFirst({
    where: { id: productId, projectId, deletedAt: null },
  });
  if (!existing) {
    throw new Error('Product niet gevonden of geen toegang.');
  }

  // Build update payload, only including defined fields
  const updateData: Record<string, unknown> = {};

  const simpleFields: (keyof ProductUpdateData)[] = [
    'sku', 'gtin', 'mpn', 'name', 'slug', 'description', 'shortDescription',
    'categoryId', 'productType', 'brand', 'regularPrice', 'salePrice',
    'currency', 'costPrice', 'stockStatus', 'stockQuantity', 'manageStock',
    'parentProductId', 'imageUrl', 'imageAlt', 'productUrl', 'isSeasonal',
    'source', 'externalId', 'importBatch',
  ];

  for (const field of simpleFields) {
    if (data[field] !== undefined) {
      (updateData as Record<string, unknown>)[field] = data[field];
    }
  }

  // JSON fields
  if (data.variationAttributes !== undefined) {
    updateData.variationAttributes = JSON.stringify(data.variationAttributes);
  }
  if (data.additionalImages !== undefined) {
    updateData.additionalImages = JSON.stringify(data.additionalImages);
  }
  if (data.seasonalMonths !== undefined) {
    updateData.seasonalMonths = JSON.stringify(data.seasonalMonths);
  }

  // Recalculate margin if costPrice or regularPrice changed
  if (data.costPrice !== undefined || data.regularPrice !== undefined) {
    const costPrice = data.costPrice ?? existing.costPrice;
    const regularPrice = data.regularPrice ?? existing.regularPrice;
    if (costPrice !== null && costPrice !== undefined && regularPrice && regularPrice > 0) {
      updateData.margin = ((regularPrice - costPrice) / regularPrice) * 100;
    }
  }

  return db.product.update({
    where: { id: productId },
    data: updateData,
    include: {
      category: true,
      variations: true,
      feedItems: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Soft Delete Product
// ---------------------------------------------------------------------------

/**
 * Soft-delete a product by setting deletedAt. Verifies projectId.
 */
export async function deleteProduct(productId: string, projectId: string) {
  const existing = await db.product.findFirst({
    where: { id: productId, projectId, deletedAt: null },
  });
  if (!existing) {
    throw new Error('Product niet gevonden of geen toegang.');
  }

  return db.product.update({
    where: { id: productId },
    data: { deletedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Get Product
// ---------------------------------------------------------------------------

/**
 * Retrieve a single product with its category, variations, and feed items.
 * Verifies projectId for tenant isolation.
 */
export async function getProduct(productId: string, projectId: string) {
  return db.product.findFirst({
    where: { id: productId, projectId, deletedAt: null },
    include: {
      category: true,
      variations: {
        where: { deletedAt: null },
      },
      feedItems: true,
    },
  });
}

// ---------------------------------------------------------------------------
// List Products
// ---------------------------------------------------------------------------

/**
 * List products with filtering, sorting, and pagination.
 * All queries are scoped to the given projectId.
 */
export async function listProducts(
  projectId: string,
  filters?: ProductListFilters,
) {
  const where: Record<string, unknown> = {
    projectId,
    deletedAt: null,
  };

  // Filter: parentProductId null (exclude variations unless explicitly requested)
  if (filters?.hasVariations !== undefined) {
    if (filters.hasVariations) {
      // Products that have at least one variation
      where.variations = { some: { deletedAt: null } };
    }
  }

  // Only list parent products (not variations) by default
  where.parentProductId = null;

  if (filters?.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters?.stockStatus) {
    where.stockStatus = filters.stockStatus;
  }

  if (filters?.isSeasonal !== undefined) {
    where.isSeasonal = filters.isSeasonal;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { sku: { contains: filters.search } },
      { brand: { contains: filters.search } },
    ];
  }

  if (filters?.minSeoScore !== undefined) {
    where.overallSeoScore = {
      ...(where.overallSeoScore as Record<string, unknown> ?? {}),
      gte: filters.minSeoScore,
    };
  }

  if (filters?.maxSeoScore !== undefined) {
    where.overallSeoScore = {
      ...(where.overallSeoScore as Record<string, unknown> ?? {}),
      lte: filters.maxSeoScore,
    };
  }

  if (filters?.minRevenue !== undefined) {
    where.revenue30d = { gte: filters.minRevenue };
  }

  // Sorting
  const sortBy = filters?.sortBy ?? 'name';
  const sortOrder = filters?.sortOrder ?? 'asc';

  const orderBy: Record<string, string> = {};
  switch (sortBy) {
    case 'revenue':
      orderBy.revenue30d = sortOrder;
      break;
    case 'seoScore':
      orderBy.overallSeoScore = sortOrder;
      break;
    case 'stockStatus':
      orderBy.stockStatus = sortOrder;
      break;
    case 'name':
    default:
      orderBy.name = sortOrder;
      break;
  }

  // Pagination
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { variations: { where: { deletedAt: null } } } },
      },
    }),
    db.product.count({ where }),
  ]);

  return { products, total };
}

// ---------------------------------------------------------------------------
// Inventory Summary
// ---------------------------------------------------------------------------

/**
 * Get an inventory summary for a project's product catalog.
 * Aggregates counts, SEO scores, and revenue across all non-deleted products.
 */
export async function getProductInventorySummary(
  projectId: string,
): Promise<ProductInventorySummary> {
  const products = await db.product.findMany({
    where: { projectId, deletedAt: null, parentProductId: null },
    select: {
      stockStatus: true,
      isSeasonal: true,
      overallSeoScore: true,
      revenue30d: true,
      revenue90d: true,
      variations: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  });

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.stockStatus === 'ACTIVE').length;
  const outOfStock = products.filter((p) => p.stockStatus === 'OUT_OF_STOCK').length;
  const seasonalProducts = products.filter((p) => p.isSeasonal).length;
  const productsWithVariations = products.filter((p) => p.variations.length > 0).length;

  // Average SEO score (only from products that have been analyzed)
  const seoScores = products
    .map((p) => p.overallSeoScore)
    .filter((s): s is number => s !== null && s > 0);
  const avgSeoScore = seoScores.length > 0
    ? seoScores.reduce((sum, s) => sum + s, 0) / seoScores.length
    : 0;

  // Revenue totals — never fabricate, use actual values
  const totalRevenue30d = products.reduce((sum, p) => sum + (p.revenue30d ?? 0), 0);
  const totalRevenue90d = products.reduce((sum, p) => sum + (p.revenue90d ?? 0), 0);

  return {
    totalProducts,
    activeProducts,
    outOfStock,
    seasonalProducts,
    avgSeoScore: Math.round(avgSeoScore * 10) / 10,
    totalRevenue30d,
    totalRevenue90d,
    productsWithVariations,
  };
}
