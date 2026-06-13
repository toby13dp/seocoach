// ============================================================================
// WooCommerce Integration Module — SEOCoach
// ============================================================================
// Provides connection management, product operations, and import/sync
// functionality for WooCommerce stores via the WC REST API v3.
// ============================================================================

import { db } from '@/lib/db'

// ============================================================================
// Types
// ============================================================================

export interface WooConnectionConfig {
  name: string
  baseUrl: string
  consumerKey: string
  consumerSecret: string
}

export interface WooListParams {
  page?: number
  perPage?: number
  search?: string
  status?: string
  category?: number
}

export interface WooProductSEO {
  metaTitle?: string
  metaDescription?: string
  focusKeyword?: string
  canonical?: string
}

/** Minimal product shape returned by the WC REST API (public fields only) */
export interface WooProduct {
  id: number
  name: string
  slug: string
  permalink: string
  type: string
  status: string
  description: string
  short_description: string
  sku: string
  price: string
  regular_price: string
  sale_price: string
  on_sale: boolean
  stock_status: string
  stock_quantity: number | null
  manage_stock: boolean
  categories: WooCategory[]
  tags: { id: number; name: string; slug: string }[]
  images: { id: number; src: string; alt: string }[]
  meta_data?: WooMetaItem[]
  variations?: number[]
  /** Yoast / RankMath SEO fields embedded in meta_data */
  yoast_head_json?: Record<string, unknown>
}

export interface WooCategory {
  id: number
  name: string
  slug: string
  parent: number
  description: string
  count: number
  permalink?: string
}

export interface WooVariation {
  id: number
  sku: string
  price: string
  regular_price: string
  sale_price: string
  on_sale: boolean
  stock_status: string
  stock_quantity: number | null
  manage_stock: boolean
  attributes: { id: number; name: string; option: string }[]
  image?: { id: number; src: string; alt: string }
  permalink: string
}

export interface WooReview {
  id: number
  date_created: string
  product_id: number
  reviewer: string
  reviewer_email: string
  review: string
  rating: number
  verified: boolean
}

export interface WooMetaItem {
  id: number
  key: string
  value: string | null
}

/** Paginated list result */
export interface WooListResult<T> {
  data: T[]
  total: number
  totalPages: number
  page: number
}

// ============================================================================
// Internal helpers
// ============================================================================

const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 500

/**
 * Build the Basic Authorization header value from consumer key & secret.
 */
function buildAuthHeader(consumerKey: string, consumerSecret: string): string {
  const encoded = btoa(`${consumerKey}:${consumerSecret}`)
  return `Basic ${encoded}`
}

/**
 * Resolve the WooCommerce REST API v3 base URL, ensuring trailing slash.
 */
function apiBase(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}/wp-json/wc/v3/`
}

/**
 * Generic fetch wrapper with retry logic (up to MAX_RETRIES attempts).
 * Only retries on network errors, 408, 429, and 5xx status codes.
 */
async function wooFetch<T>(
  baseUrl: string,
  consumerKey: string,
  consumerSecret: string,
  endpoint: string,
  options: RequestInit = {},
  attempt = 1,
): Promise<T> {
  const url = `${apiBase(baseUrl)}${endpoint}`
  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(consumerKey, consumerSecret),
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  try {
    const response = await fetch(url, { ...options, headers })

    // Handle 404 — endpoint not available on this store
    if (response.status === 404) {
      throw new WooEndpointError(
        'Het opgevraagde WooCommerce-eindpunt is niet beschikbaar op deze winkel.',
        response.status,
      )
    }

    // Retryable status codes
    if (
      !response.ok &&
      (response.status === 408 ||
        response.status === 429 ||
        response.status >= 500)
    ) {
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
        await sleep(delay)
        return wooFetch(baseUrl, consumerKey, consumerSecret, endpoint, options, attempt + 1)
      }
    }

    if (!response.ok) {
      let detail = ''
      try {
        const body = (await response.json()) as { message?: string; code?: string }
        detail = body.message || body.code || ''
      } catch {
        // ignore json parse errors
      }
      throw new WooApiError(
        detail
          ? `WooCommerce API-fout (${response.status}): ${detail}`
          : `WooCommerce API-fout: onverwachte status ${response.status}`,
        response.status,
      )
    }

    // Some endpoints (DELETE) may return no body
    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  } catch (error) {
    // Re-throw our own error types
    if (error instanceof WooApiError || error instanceof WooEndpointError) {
      throw error
    }
    // Network / fetch errors — retry
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
      await sleep(delay)
      return wooFetch(baseUrl, consumerKey, consumerSecret, endpoint, options, attempt + 1)
    }
    throw new WooApiError(
      'Kon geen verbinding maken met de WooCommerce winkel. Controleer de URL en probeer het opnieuw.',
      0,
    )
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Custom error classes for better error discrimination.
 */
class WooApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message)
    this.name = 'WooApiError'
  }
}

class WooEndpointError extends WooApiError {
  constructor(message: string, statusCode: number) {
    super(message, statusCode)
    this.name = 'WooEndpointError'
  }
}

/**
 * Retrieve a CMSConnection record that must be of type WOOCOMMERCE and not
 * soft-deleted. Throws with a Dutch error message if not found.
 */
async function getWooConnectionOrFail(connectionId: string) {
  const connection = await db.cMSConnection.findFirst({
    where: {
      id: connectionId,
      providerType: 'WOOCOMMERCE',
      deletedAt: null,
    },
  })

  if (!connection) {
    throw new WooApiError(
      'WooCommerce-verbinding niet gevonden of verwijderd.',
      404,
    )
  }

  if (!connection.apiKey || !connection.apiSecret) {
    throw new WooApiError(
      'De verbinding mist API-sleutels. Controleer de configuratie.',
      400,
    )
  }

  return connection
}

/**
 * Create a ContentChange audit record for an operation.
 */
async function logContentChange(params: {
  projectId: string
  changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'PUBLISH'
  previousContent?: string
  newContent?: string
  summary: string
  cmsResult?: string
  rollbackData?: string
}) {
  await db.contentChange.create({
    data: {
      projectId: params.projectId,
      changeType: params.changeType,
      previousContent: params.previousContent ?? null,
      newContent: params.newContent ?? null,
      summary: params.summary,
      cmsResult: params.cmsResult ?? null,
      rollbackData: params.rollbackData ?? null,
    },
  })
}

// ============================================================================
// Connection Management
// ============================================================================

/**
 * Create a new WooCommerce CMS connection for a project.
 */
export async function createWooCommerceConnection(
  projectId: string,
  config: WooConnectionConfig,
) {
  // Validate required fields
  if (!config.name.trim()) {
    throw new Error('Verbindingsnaam is vereist.')
  }
  if (!config.baseUrl.trim()) {
    throw new Error('Basis-URL is vereist.')
  }
  if (!config.consumerKey.trim() || !config.consumerSecret.trim()) {
    throw new Error('Consumer Key en Consumer Secret zijn vereist.')
  }

  const connection = await db.cMSConnection.create({
    data: {
      projectId,
      name: config.name.trim(),
      providerType: 'WOOCOMMERCE',
      status: 'PENDING',
      baseUrl: config.baseUrl.trim().replace(/\/+$/, ''),
      apiKey: config.consumerKey,
      apiSecret: config.consumerSecret,
    },
  })

  // Audit log
  await logContentChange({
    projectId,
    changeType: 'CREATE',
    newContent: JSON.stringify({ connectionId: connection.id, name: config.name }),
    summary: `WooCommerce-verbinding "${config.name}" aangemaakt.`,
  })

  return connection
}

/**
 * Test a WooCommerce connection by fetching store info and detecting
 * capabilities, then updating the connection status accordingly.
 */
export async function testWooCommerceConnection(connectionId: string) {
  const connection = await getWooConnectionOrFail(connectionId)

  const capabilities: string[] = []
  let storeInfo: Record<string, unknown> | null = null

  try {
    // Try to fetch system status / store info
    storeInfo = await wooFetch<Record<string, unknown>>(
      connection.baseUrl,
      connection.apiKey!,
      connection.apiSecret!,
      'system_status',
      { method: 'GET' },
    )
    capabilities.push('system_status')
  } catch (error) {
    // System status may not be available for all user roles; that's okay
    if (!(error instanceof WooEndpointError)) {
      // Real error — update connection status
      await db.cMSConnection.update({
        where: { id: connectionId },
        data: {
          status: 'ERROR',
          lastTestedAt: new Date(),
          lastError: error instanceof Error ? error.message : 'Onbekende fout bij verbindingscontrole.',
        },
      })
      throw error
    }
  }

  // Test products endpoint (core capability)
  try {
    await wooFetch<WooProduct[]>(
      connection.baseUrl,
      connection.apiKey!,
      connection.apiSecret!,
      'products?per_page=1',
      { method: 'GET' },
    )
    capabilities.push('products')
  } catch {
    // Products endpoint failure is fatal for a WooCommerce connection
    await db.cMSConnection.update({
      where: { id: connectionId },
      data: {
        status: 'ERROR',
        lastTestedAt: new Date(),
        lastError: 'Kan geen producten ophalen. Controleer de API-rechten.',
      },
    })
    throw new WooApiError(
      'Kan geen producten ophalen van de WooCommerce winkel. Controleer of de API-sleutels de juiste rechten hebben.',
      403,
    )
  }

  // Detect additional capabilities
  const capabilityTests: [string, string][] = [
    ['products/categories', 'categories'],
    ['products/tags', 'tags'],
    ['products/reviews', 'reviews'],
    ['reports/sales', 'reports'],
    ['coupons', 'coupons'],
    ['settings', 'settings'],
  ]

  for (const [endpoint, capability] of capabilityTests) {
    try {
      await wooFetch<unknown[]>(
        connection.baseUrl,
        connection.apiKey!,
        connection.apiSecret!,
        `${endpoint}?per_page=1`,
        { method: 'GET' },
      )
      capabilities.push(capability)
    } catch {
      // Capability not available — skip silently
    }
  }

  // Update connection with detected capabilities and mark connected
  const updated = await db.cMSConnection.update({
    where: { id: connectionId },
    data: {
      status: 'CONNECTED',
      capabilities: JSON.stringify(capabilities),
      lastTestedAt: new Date(),
      lastError: null,
    },
  })

  // Audit log
  await logContentChange({
    projectId: connection.projectId,
    changeType: 'UPDATE',
    newContent: JSON.stringify({ status: 'CONNECTED', capabilities }),
    summary: `WooCommerce-verbinding getest. Mogelijkheden gedetecteerd: ${capabilities.join(', ')}`,
  })

  return {
    connection: updated,
    capabilities,
    storeInfo,
  }
}

/**
 * Update an existing WooCommerce connection's configuration.
 */
export async function updateWooCommerceConnection(
  connectionId: string,
  config: Partial<WooConnectionConfig>,
) {
  const connection = await getWooConnectionOrFail(connectionId)

  const updateData: Record<string, unknown> = {}
  if (config.name !== undefined) updateData.name = config.name.trim()
  if (config.baseUrl !== undefined)
    updateData.baseUrl = config.baseUrl.trim().replace(/\/+$/, '')
  if (config.consumerKey !== undefined) updateData.apiKey = config.consumerKey
  if (config.consumerSecret !== undefined) updateData.apiSecret = config.consumerSecret

  // If credentials changed, reset status to pending so it can be re-tested
  if (config.consumerKey || config.consumerSecret || config.baseUrl) {
    updateData.status = 'PENDING'
    updateData.lastError = null
  }

  const previousSnapshot = JSON.stringify({
    name: connection.name,
    baseUrl: connection.baseUrl,
  })

  const updated = await db.cMSConnection.update({
    where: { id: connectionId },
    data: updateData,
  })

  // Audit log
  await logContentChange({
    projectId: connection.projectId,
    changeType: 'UPDATE',
    previousContent: previousSnapshot,
    newContent: JSON.stringify(updateData),
    summary: `WooCommerce-verbinding "${connection.name}" bijgewerkt.`,
  })

  return updated
}

/**
 * Soft-delete a WooCommerce connection.
 */
export async function deleteWooCommerceConnection(connectionId: string) {
  const connection = await getWooConnectionOrFail(connectionId)

  const updated = await db.cMSConnection.update({
    where: { id: connectionId },
    data: {
      deletedAt: new Date(),
      status: 'DISCONNECTED',
    },
  })

  // Audit log
  await logContentChange({
    projectId: connection.projectId,
    changeType: 'DELETE',
    previousContent: JSON.stringify({
      id: connection.id,
      name: connection.name,
      baseUrl: connection.baseUrl,
    }),
    summary: `WooCommerce-verbinding "${connection.name}" verwijderd.`,
  })

  return updated
}

// ============================================================================
// Product Operations
// ============================================================================

/**
 * List products with pagination and optional filtering.
 */
export async function wooListProducts(
  connectionId: string,
  params: WooListParams = {},
): Promise<WooListResult<WooProduct>> {
  const connection = await getWooConnectionOrFail(connectionId)

  const queryParams = new URLSearchParams()
  if (params.page) queryParams.set('page', String(params.page))
  if (params.perPage) queryParams.set('per_page', String(params.perPage))
  if (params.search) queryParams.set('search', params.search)
  if (params.status) queryParams.set('status', params.status)
  if (params.category) queryParams.set('category', String(params.category))

  const queryString = queryParams.toString()
  const endpoint = `products${queryString ? `?${queryString}` : ''}`

  // We need total count from response headers — fetch with manual fetch to access headers
  const url = `${apiBase(connection.baseUrl)}${endpoint}`
  const authHeader = buildAuthHeader(connection.apiKey!, connection.apiSecret!)

  let data: WooProduct[]
  let total = 0
  let totalPages = 0

  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    })

    data = (await response.json()) as WooProduct[]
    total = parseInt(response.headers.get('X-WP-Total') || '0', 10)
    totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '0', 10)
  } catch (error) {
    if (error instanceof WooApiError) throw error
    throw new WooApiError(
      'Fout bij het ophalen van producten uit de WooCommerce winkel.',
      0,
    )
  }

  return {
    data,
    total,
    totalPages,
    page: params.page || 1,
  }
}

/**
 * Fetch wrapper that supports retries and provides access to the full
 * Response object (including headers) — used for paginated list queries
 * where we need the X-WP-Total / X-WP-TotalPages headers.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempt = 1,
): Promise<Response> {
  try {
    const response = await fetch(url, options)

    if (response.status === 404) {
      throw new WooEndpointError(
        'Het opgevraagde WooCommerce-eindpunt is niet beschikbaar op deze winkel.',
        response.status,
      )
    }

    if (
      !response.ok &&
      (response.status === 408 ||
        response.status === 429 ||
        response.status >= 500)
    ) {
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
        await sleep(delay)
        return fetchWithRetry(url, options, attempt + 1)
      }
    }

    if (!response.ok) {
      let detail = ''
      try {
        const body = (await response.clone().json()) as { message?: string; code?: string }
        detail = body.message || body.code || ''
      } catch {
        // ignore
      }
      throw new WooApiError(
        detail
          ? `WooCommerce API-fout (${response.status}): ${detail}`
          : `WooCommerce API-fout: onverwachte status ${response.status}`,
        response.status,
      )
    }

    return response
  } catch (error) {
    if (error instanceof WooApiError || error instanceof WooEndpointError) {
      throw error
    }
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
      await sleep(delay)
      return fetchWithRetry(url, options, attempt + 1)
    }
    throw new WooApiError(
      'Kon geen verbinding maken met de WooCommerce winkel. Controleer de URL en probeer het opnieuw.',
      0,
    )
  }
}

/**
 * Get a single product with full details.
 */
export async function wooGetProduct(
  connectionId: string,
  productId: number,
): Promise<WooProduct> {
  const connection = await getWooConnectionOrFail(connectionId)

  return wooFetch<WooProduct>(
    connection.baseUrl,
    connection.apiKey!,
    connection.apiSecret!,
    `products/${productId}`,
    { method: 'GET' },
  )
}

/**
 * Update a product's description and optionally its short description.
 * Creates an audit trail entry for the change.
 */
export async function wooUpdateProductDescription(
  connectionId: string,
  productId: number,
  description: string,
  shortDescription?: string,
): Promise<WooProduct> {
  const connection = await getWooConnectionOrFail(connectionId)

  // Fetch current product for rollback data
  const current = await wooFetch<WooProduct>(
    connection.baseUrl,
    connection.apiKey!,
    connection.apiSecret!,
    `products/${productId}`,
    { method: 'GET' },
  )

  const body: Record<string, string> = { description }
  if (shortDescription !== undefined) {
    body.short_description = shortDescription
  }

  const updated = await wooFetch<WooProduct>(
    connection.baseUrl,
    connection.apiKey!,
    connection.apiSecret!,
    `products/${productId}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  )

  // Audit log
  await logContentChange({
    projectId: connection.projectId,
    changeType: 'UPDATE',
    previousContent: JSON.stringify({
      description: current.description,
      short_description: current.short_description,
    }),
    newContent: JSON.stringify(body),
    summary: `Productbeschrijving bijgewerkt voor "${current.name}" (ID: ${productId}).`,
    rollbackData: JSON.stringify({
      productId,
      previousDescription: current.description,
      previousShortDescription: current.short_description,
    }),
  })

  return updated
}

/**
 * Update SEO metadata for a WooCommerce product.
 *
 * This function updates Yoast SEO / Rank Math fields through the product
 * meta_data. It also sets meta_key values that common SEO plugins expose
 * via the REST API.
 */
export async function wooUpdateProductSEO(
  connectionId: string,
  productId: number,
  meta: WooProductSEO,
): Promise<WooProduct> {
  const connection = await getWooConnectionOrFail(connectionId)

  // Fetch current product for rollback
  const current = await wooFetch<WooProduct>(
    connection.baseUrl,
    connection.apiKey!,
    connection.apiSecret!,
    `products/${productId}`,
    { method: 'GET' },
  )

  // Build meta_data array for common SEO plugin fields
  const metaData: { key: string; value: string }[] = []

  if (meta.metaTitle !== undefined) {
    metaData.push({ key: '_yoast_wpseo_title', value: meta.metaTitle })
    metaData.push({ key: 'rank_math_title', value: meta.metaTitle })
  }
  if (meta.metaDescription !== undefined) {
    metaData.push({ key: '_yoast_wpseo_metadesc', value: meta.metaDescription })
    metaData.push({ key: 'rank_math_description', value: meta.metaDescription })
  }
  if (meta.focusKeyword !== undefined) {
    metaData.push({ key: '_yoast_wpseo_focuskw', value: meta.focusKeyword })
    metaData.push({ key: 'rank_math_focus_keyword', value: meta.focusKeyword })
  }
  if (meta.canonical !== undefined) {
    metaData.push({ key: '_yoast_wpseo_canonical', value: meta.canonical })
    metaData.push({ key: 'rank_math_canonical_url', value: meta.canonical })
  }

  const body = { meta_data: metaData }

  const updated = await wooFetch<WooProduct>(
    connection.baseUrl,
    connection.apiKey!,
    connection.apiSecret!,
    `products/${productId}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  )

  // Audit log
  const previousSeo = extractSeoFromProduct(current)
  await logContentChange({
    projectId: connection.projectId,
    changeType: 'UPDATE',
    previousContent: JSON.stringify(previousSeo),
    newContent: JSON.stringify(meta),
    summary: `SEO-metadata bijgewerkt voor product "${current.name}" (ID: ${productId}).`,
    rollbackData: JSON.stringify({
      productId,
      previousSeo,
    }),
  })

  return updated
}

/**
 * Extract SEO-related meta values from a product for audit/rollback purposes.
 */
function extractSeoFromProduct(product: WooProduct): Record<string, string | null> {
  const seoKeys = [
    '_yoast_wpseo_title',
    '_yoast_wpseo_metadesc',
    '_yoast_wpseo_focuskw',
    '_yoast_wpseo_canonical',
    'rank_math_title',
    'rank_math_description',
    'rank_math_focus_keyword',
    'rank_math_canonical_url',
  ]

  const result: Record<string, string | null> = {}
  for (const key of seoKeys) {
    const item = product.meta_data?.find((m) => m.key === key)
    result[key] = item?.value ?? null
  }
  return result
}

/**
 * List all product categories.
 */
export async function wooListCategories(
  connectionId: string,
): Promise<WooCategory[]> {
  const connection = await getWooConnectionOrFail(connectionId)

  const allCategories: WooCategory[] = []
  let page = 1
  const perPage = 100

  // WooCommerce may paginate categories; fetch all pages
  while (true) {
    const categories = await wooFetch<WooCategory[]>(
      connection.baseUrl,
      connection.apiKey!,
      connection.apiSecret!,
      `products/categories?per_page=${perPage}&page=${page}&orderby=name&order=asc`,
      { method: 'GET' },
    )

    allCategories.push(...categories)

    if (categories.length < perPage) {
      break
    }
    page++
  }

  return allCategories
}

/**
 * Update a product category's description.
 */
export async function wooUpdateCategoryDescription(
  connectionId: string,
  categoryId: number,
  description: string,
): Promise<WooCategory> {
  const connection = await getWooConnectionOrFail(connectionId)

  // Fetch current category for rollback
  const current = await wooFetch<WooCategory>(
    connection.baseUrl,
    connection.apiKey!,
    connection.apiSecret!,
    `products/categories/${categoryId}`,
    { method: 'GET' },
  )

  const updated = await wooFetch<WooCategory>(
    connection.baseUrl,
    connection.apiKey!,
    connection.apiSecret!,
    `products/categories/${categoryId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ description }),
    },
  )

  // Audit log
  await logContentChange({
    projectId: connection.projectId,
    changeType: 'UPDATE',
    previousContent: JSON.stringify({ description: current.description }),
    newContent: JSON.stringify({ description }),
    summary: `Categoriebeschrijving bijgewerkt voor "${current.name}" (ID: ${categoryId}).`,
    rollbackData: JSON.stringify({
      categoryId,
      previousDescription: current.description,
    }),
  })

  return updated
}

/**
 * List all variations for a given product.
 */
export async function wooListVariations(
  connectionId: string,
  productId: number,
): Promise<WooVariation[]> {
  const connection = await getWooConnectionOrFail(connectionId)

  const allVariations: WooVariation[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const variations = await wooFetch<WooVariation[]>(
      connection.baseUrl,
      connection.apiKey!,
      connection.apiSecret!,
      `products/${productId}/variations?per_page=${perPage}&page=${page}`,
      { method: 'GET' },
    )

    allVariations.push(...variations)

    if (variations.length < perPage) {
      break
    }
    page++
  }

  return allVariations
}

/**
 * Get product reviews where available.
 */
export async function wooGetProductReviews(
  connectionId: string,
  productId: number,
): Promise<WooReview[]> {
  const connection = await getWooConnectionOrFail(connectionId)

  try {
    const reviews = await wooFetch<WooReview[]>(
      connection.baseUrl,
      connection.apiKey!,
      connection.apiSecret!,
      `products/reviews?product=${productId}`,
      { method: 'GET' },
    )
    return reviews
  } catch (error) {
    // Reviews endpoint may not be available on all WooCommerce installs
    if (error instanceof WooEndpointError) {
      return []
    }
    throw error
  }
}

/**
 * Get inventory / stock status for a product.
 */
export async function wooGetInventoryStatus(
  connectionId: string,
  productId: number,
): Promise<{
  stockStatus: string
  stockQuantity: number | null
  manageStock: boolean
  variations: { id: number; stockStatus: string; stockQuantity: number | null }[]
}> {
  const connection = await getWooConnectionOrFail(connectionId)

  const product = await wooFetch<WooProduct>(
    connection.baseUrl,
    connection.apiKey!,
    connection.apiSecret!,
    `products/${productId}`,
    { method: 'GET' },
  )

  // If the product has variations, fetch their stock info too
  let variations: { id: number; stockStatus: string; stockQuantity: number | null }[] = []

  if (product.variations && product.variations.length > 0) {
    try {
      const variationData = await wooListVariations(connectionId, productId)
      variations = variationData.map((v) => ({
        id: v.id,
        stockStatus: v.stock_status,
        stockQuantity: v.stock_quantity,
      }))
    } catch {
      // If variations can't be fetched, return empty array
      variations = []
    }
  }

  return {
    stockStatus: product.stock_status,
    stockQuantity: product.stock_quantity,
    manageStock: product.manage_stock,
    variations,
  }
}

/**
 * Get pricing information for a product.
 */
export async function wooGetProductPricing(
  connectionId: string,
  productId: number,
): Promise<{
  price: string
  regularPrice: string
  salePrice: string
  onSale: boolean
  variations: { id: number; price: string; regularPrice: string; salePrice: string; onSale: boolean }[]
}> {
  const connection = await getWooConnectionOrFail(connectionId)

  const product = await wooFetch<WooProduct>(
    connection.baseUrl,
    connection.apiKey!,
    connection.apiSecret!,
    `products/${productId}`,
    { method: 'GET' },
  )

  let variations: {
    id: number
    price: string
    regularPrice: string
    salePrice: string
    onSale: boolean
  }[] = []

  if (product.variations && product.variations.length > 0) {
    try {
      const variationData = await wooListVariations(connectionId, productId)
      variations = variationData.map((v) => ({
        id: v.id,
        price: v.price,
        regularPrice: v.regular_price,
        salePrice: v.sale_price,
        onSale: v.on_sale,
      }))
    } catch {
      variations = []
    }
  }

  return {
    price: product.price,
    regularPrice: product.regular_price,
    salePrice: product.sale_price,
    onSale: product.on_sale,
    variations,
  }
}

// ============================================================================
// Import & Sync
// ============================================================================

/**
 * Import all products from a WooCommerce store into the project's
 * ContentSource records (type = PRODUCT_DATA).
 *
 * Returns the number of products imported.
 */
export async function wooImportProducts(
  projectId: string,
  connectionId: string,
): Promise<{ imported: number; skipped: number; errors: number }> {
  const connection = await getWooConnectionOrFail(connectionId)

  let imported = 0
  let skipped = 0
  let errors = 0

  // Paginate through all products
  let page = 1
  const perPage = 50
  let hasMore = true

  while (hasMore) {
    let products: WooProduct[]
    try {
      const result = await wooListProducts(connectionId, { page, perPage })
      products = result.data
      hasMore = page < result.totalPages
    } catch {
      errors++
      break
    }

    for (const product of products) {
      try {
        // Check if this product is already imported (by URL in ContentSource)
        const existing = await db.contentSource.findFirst({
          where: {
            projectId,
            type: 'PRODUCT_DATA',
            url: product.permalink,
            deletedAt: null,
          },
        })

        const productContent = JSON.stringify({
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          short_description: product.short_description,
          sku: product.sku,
          price: product.price,
          regular_price: product.regular_price,
          sale_price: product.sale_price,
          status: product.status,
          categories: product.categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
          images: product.images.map((i) => ({ src: i.src, alt: i.alt })),
          stock_status: product.stock_status,
        })

        if (existing) {
          // Update existing record
          await db.contentSource.update({
            where: { id: existing.id },
            data: {
              content: productContent,
              metadata: JSON.stringify({
                wooId: product.id,
                sku: product.sku,
                importedAt: new Date().toISOString(),
                connectionId,
              }),
            },
          })
          skipped++
        } else {
          // Create new record
          await db.contentSource.create({
            data: {
              projectId,
              name: product.name,
              type: 'PRODUCT_DATA',
              url: product.permalink,
              content: productContent,
              metadata: JSON.stringify({
                wooId: product.id,
                sku: product.sku,
                importedAt: new Date().toISOString(),
                connectionId,
              }),
            },
          })
          imported++
        }
      } catch {
        errors++
      }
    }

    page++
  }

  // Audit log
  await logContentChange({
    projectId,
    changeType: 'CREATE',
    newContent: JSON.stringify({ imported, skipped, errors, connectionId }),
    summary: `Producten geïmporteerd uit WooCommerce: ${imported} nieuw, ${skipped} bijgewerkt, ${errors} fouten.`,
  })

  return { imported, skipped, errors }
}

/**
 * Synchronize a single product's data with the project's ContentSource.
 */
export async function wooSyncProduct(
  connectionId: string,
  productId: number,
): Promise<{ synced: boolean; action: 'created' | 'updated' }> {
  const connection = await getWooConnectionOrFail(connectionId)

  // Fetch the latest product data
  const product = await wooFetch<WooProduct>(
    connection.baseUrl,
    connection.apiKey!,
    connection.apiSecret!,
    `products/${productId}`,
    { method: 'GET' },
  )

  const productContent = JSON.stringify({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    short_description: product.short_description,
    sku: product.sku,
    price: product.price,
    regular_price: product.regular_price,
    sale_price: product.sale_price,
    status: product.status,
    categories: product.categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    images: product.images.map((i) => ({ src: i.src, alt: i.alt })),
    stock_status: product.stock_status,
  })

  // Check if this product already exists in ContentSource
  const existing = await db.contentSource.findFirst({
    where: {
      projectId: connection.projectId,
      type: 'PRODUCT_DATA',
      url: product.permalink,
      deletedAt: null,
    },
  })

  let action: 'created' | 'updated'

  if (existing) {
    await db.contentSource.update({
      where: { id: existing.id },
      data: {
        name: product.name,
        content: productContent,
        metadata: JSON.stringify({
          wooId: product.id,
          sku: product.sku,
          syncedAt: new Date().toISOString(),
          connectionId,
        }),
      },
    })
    action = 'updated'
  } else {
    await db.contentSource.create({
      data: {
        projectId: connection.projectId,
        name: product.name,
        type: 'PRODUCT_DATA',
        url: product.permalink,
        content: productContent,
        metadata: JSON.stringify({
          wooId: product.id,
          sku: product.sku,
          syncedAt: new Date().toISOString(),
          connectionId,
        }),
      },
    })
    action = 'created'
  }

  // Audit log
  await logContentChange({
    projectId: connection.projectId,
    changeType: action === 'created' ? 'CREATE' : 'UPDATE',
    previousContent: existing?.content ?? undefined,
    newContent: productContent,
    summary: `Product "${product.name}" (ID: ${productId}) ${action === 'created' ? 'geïmporteerd' : 'gesynchroniseerd'}.`,
    rollbackData: existing?.content ?? undefined,
  })

  return { synced: true, action }
}
