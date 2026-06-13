// ============================================================================
// Structured Data Generator — SEOCoach
// Generates schema.org JSON-LD structured data
// ============================================================================

import type { StructuredDataType } from '@prisma/client'
import { db } from '@/lib/db'
import type {
  StructuredDataGenerationRequest,
  StructuredDataGenerationResult,
  AnySchemaObject,
  OrganizationSchema,
  LocalBusinessSchema,
  ProductSchema,
  OfferSchema,
  ReviewSchema,
  BreadcrumbListSchema,
  ArticleSchema,
  FAQPageSchema,
  HowToSchema,
  PersonSchema,
  EventSchema,
  JobPostingSchema,
  ServiceSchema,
  WebSiteSchema,
  WebPageSchema,
  FAQInput,
  BreadcrumbInput,
  HowToStepInput,
  ContactPointSchema,
  PostalAddressSchema,
  GeoCoordinatesSchema,
  RatingSchema,
  BreadcrumbItem,
  FAQQuestion,
  HowToStep,
  SearchActionSchema,
} from './types'
import { validateStructuredData } from './validator'

// ============================================================================
// Helper: clean object of undefined/null values
// ============================================================================

function cleanObject<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          cleaned[key] = value
        }
      } else if (typeof value === 'object' && !('@type' in (value as Record<string, unknown>))) {
        const nested = cleanObject(value as Record<string, unknown>)
        if (Object.keys(nested).length > 0) {
          cleaned[key] = nested
        }
      } else {
        cleaned[key] = value
      }
    }
  }
  return cleaned
}

// ============================================================================
// Parse JSON field from database (safely)
// ============================================================================

function safeParseJson<T>(jsonString: string | null | undefined): T | null {
  if (!jsonString) return null
  try {
    return JSON.parse(jsonString) as T
  } catch {
    return null
  }
}

// ============================================================================
// Load brand profile from database
// ============================================================================

interface BrandProfileData {
  brandName: string | null
  description: string | null
  contactInformation: {
    phone?: string
    email?: string
    website?: string
    address?: string
    city?: string
    postalCode?: string
    country?: string
    socialLinks?: string[]
  } | null
  services: string[] | null
  products: string[] | null
}

async function loadBrandProfile(projectId: string): Promise<BrandProfileData | null> {
  const profile = await db.brandProfile.findUnique({
    where: { projectId },
  })

  if (!profile) return null

  const contactInfo = safeParseJson<BrandProfileData['contactInformation']>(
    profile.contactInformation
  )

  const services = safeParseJson<string[]>(profile.services)
  const products = safeParseJson<string[]>(profile.products)

  return {
    brandName: profile.brandName,
    description: profile.description,
    contactInformation: contactInfo,
    services,
    products,
  }
}

// ============================================================================
// Load project data
// ============================================================================

async function loadProject(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    include: {
      brandProfile: true,
      domains: { where: { isPrimary: true } },
    },
  })
}

// ============================================================================
// Load page data
// ============================================================================

async function loadPage(pageId: string) {
  return db.page.findUnique({
    where: { id: pageId },
  })
}

// ============================================================================
// Load content brief with latest version
// ============================================================================

async function loadContentBrief(briefId: string) {
  return db.contentBrief.findUnique({
    where: { id: briefId },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  })
}

// ============================================================================
// Load location data
// ============================================================================

async function loadLocation(locationId: string) {
  return db.location.findUnique({
    where: { id: locationId },
  })
}

// ============================================================================
// Main generation function
// ============================================================================

export async function generateStructuredData(
  request: StructuredDataGenerationRequest
): Promise<StructuredDataGenerationResult> {
  const { type, projectId, pageId, url, existingData } = request

  // Load contextual data
  const project = await loadProject(projectId)
  const brandProfile = project?.brandProfile
    ? await loadBrandProfile(projectId)
    : null

  let pageData: Awaited<ReturnType<typeof loadPage>> = null
  if (pageId) {
    pageData = await loadPage(pageId)
  }

  let schemaObject: AnySchemaObject

  switch (type) {
    case 'ORGANIZATION':
      schemaObject = await buildOrganizationSchema(projectId, brandProfile, project)
      break
    case 'LOCAL_BUSINESS':
      schemaObject = await buildLocalBusinessSchema(projectId, brandProfile, project)
      break
    case 'PRODUCT':
      schemaObject = buildProductSchema(projectId, pageData, existingData)
      break
    case 'OFFER':
      schemaObject = buildOfferSchema(existingData)
      break
    case 'REVIEW':
      schemaObject = buildReviewSchema(existingData)
      break
    case 'BREADCRUMB_LIST':
      schemaObject = buildBreadcrumbSchemaFromPage(pageData, url, existingData)
      break
    case 'ARTICLE':
      schemaObject = await buildArticleSchema(projectId, pageData, brandProfile, existingData)
      break
    case 'FAQ_PAGE':
      schemaObject = buildFAQPageSchemaFromExisting(existingData)
      break
    case 'HOW_TO':
      schemaObject = buildHowToSchemaFromExisting(existingData)
      break
    case 'PERSON':
      schemaObject = buildPersonSchema(existingData)
      break
    case 'EVENT':
      schemaObject = buildEventSchema(existingData)
      break
    case 'JOB_POSTING':
      schemaObject = buildJobPostingSchema(brandProfile, existingData)
      break
    case 'SERVICE':
      schemaObject = buildServiceSchema(brandProfile, existingData)
      break
    case 'WEB_SITE':
      schemaObject = buildWebSiteSchema(project, brandProfile)
      break
    case 'WEB_PAGE':
      schemaObject = buildWebPageSchema(pageData, url)
      break
    default:
      schemaObject = { '@context': 'https://schema.org', '@type': type } as AnySchemaObject
  }

  // Ensure @context is set for top-level schema
  if (!schemaObject['@context']) {
    schemaObject = { ...schemaObject, '@context': 'https://schema.org' } as AnySchemaObject
  }

  // Validate the generated schema
  const validation = validateStructuredData(type, schemaObject as unknown as Record<string, unknown>)

  // Generate JSON-LD string
  const jsonLd = JSON.stringify(schemaObject, null, 2)

  // Save to database
  const structuredDataRecord = await db.structuredData.create({
    data: {
      projectId,
      pageId: pageId ?? null,
      url: url ?? pageData?.url ?? null,
      type,
      data: jsonLd,
      isValid: validation.isValid,
      validationErrors: validation.errors.length > 0
        ? JSON.stringify(validation.errors)
        : null,
      missingFields: validation.missingRequiredFields.length > 0
        ? JSON.stringify(validation.missingRequiredFields)
        : null,
      isAutoGenerated: true,
    },
  })

  return {
    jsonLd,
    validation,
    structuredDataId: structuredDataRecord.id,
  }
}

// ============================================================================
// Organization Schema Builder
// ============================================================================

async function buildOrganizationSchema(
  projectId: string,
  brandProfile: BrandProfileData | null,
  project: Awaited<ReturnType<typeof loadProject>>
): Promise<OrganizationSchema> {
  const schema: OrganizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brandProfile?.brandName ?? project?.name ?? '',
  }

  // URL from project or brand
  const websiteUrl = brandProfile?.contactInformation?.website ?? project?.websiteUrl
  if (websiteUrl) {
    schema.url = websiteUrl
  }

  // Logo - use project website URL as base (logo URL would come from brand profile data)
  // We don't fabricate a logo URL if none exists

  // Address
  const contact = brandProfile?.contactInformation
  if (contact?.address || contact?.city || contact?.postalCode || contact?.country) {
    const address: PostalAddressSchema = {
      '@type': 'PostalAddress',
    }
    if (contact.address) address.streetAddress = contact.address
    if (contact.city) address.addressLocality = contact.city
    if (contact.postalCode) address.postalCode = contact.postalCode
    if (contact.country) address.addressCountry = contact.country

    schema.address = address
  }

  // Contact point
  if (contact?.phone || contact?.email) {
    const contactPoint: ContactPointSchema = {
      '@type': 'ContactPoint',
    }
    if (contact.phone) contactPoint.telephone = contact.phone
    if (contact.email) contactPoint.email = contact.email
    contactPoint.contactType = 'klantenservice'

    schema.contactPoint = [contactPoint]
  }

  // Social links as sameAs
  if (contact?.socialLinks && contact.socialLinks.length > 0) {
    schema.sameAs = contact.socialLinks
  }

  return schema as OrganizationSchema
}

// ============================================================================
// LocalBusiness Schema Builder
// ============================================================================

async function buildLocalBusinessSchema(
  projectId: string,
  brandProfile: BrandProfileData | null,
  project: Awaited<ReturnType<typeof loadProject>>
): Promise<LocalBusinessSchema> {
  // Start with Organization base
  const orgSchema = await buildOrganizationSchema(projectId, brandProfile, project)

  const schema: LocalBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: orgSchema.name,
  }

  // Copy optional fields from Organization
  if (orgSchema.url) schema.url = orgSchema.url
  if (orgSchema.logo) schema.logo = orgSchema.logo
  if (orgSchema.contactPoint) schema.contactPoint = orgSchema.contactPoint
  if (orgSchema.sameAs) schema.sameAs = orgSchema.sameAs
  if (orgSchema.address) schema.address = orgSchema.address

  // Try to load first location for LocalBusiness-specific fields
  const location = await db.location.findFirst({
    where: { projectId, deletedAt: null },
  })

  if (location) {
    // Override address with location-specific address if available
    if (location.address || location.city || location.postalCode || location.country) {
      const address: PostalAddressSchema = {
        '@type': 'PostalAddress',
      }
      if (location.address) address.streetAddress = location.address
      if (location.city) address.addressLocality = location.city
      if (location.postalCode) address.postalCode = location.postalCode
      if (location.country) address.addressCountry = location.country
      schema.address = address
    }

    if (location.phone) {
      schema.telephone = location.phone
    }

    if (location.latitude !== null && location.latitude !== undefined &&
        location.longitude !== null && location.longitude !== undefined) {
      const geo: GeoCoordinatesSchema = {
        '@type': 'GeoCoordinates',
        latitude: location.latitude,
        longitude: location.longitude,
      }
      schema.geo = geo
    }
  }

  return schema
}

// ============================================================================
// Product Schema Builder
// ============================================================================

function buildProductSchema(
  projectId: string,
  pageData: Awaited<ReturnType<typeof loadPage>>,
  existingData?: Record<string, unknown>
): ProductSchema {
  const schema: ProductSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: (existingData?.productName as string) ?? pageData?.h1 ?? pageData?.title ?? '',
  }

  if (pageData?.description || existingData?.description) {
    schema.description = (existingData?.description as string) ?? pageData?.description ?? undefined
  }

  if (existingData?.image) {
    schema.image = existingData.image as string
  }

  if (existingData?.brand) {
    if (typeof existingData.brand === 'string') {
      schema.brand = { '@type': 'Brand', name: existingData.brand }
    } else {
      schema.brand = existingData.brand as { '@type': 'Brand'; name: string }
    }
  }

  if (existingData?.sku) {
    schema.sku = existingData.sku as string
  }

  if (existingData?.mpn) {
    schema.mpn = existingData.mpn as string
  }

  // Build offers if price data is available
  if (existingData?.price !== undefined || existingData?.priceCurrency) {
    const offer: OfferSchema = {
      '@type': 'Offer',
      price: (existingData?.price as number) ?? 0,
      priceCurrency: (existingData?.priceCurrency as string) ?? 'EUR',
    }
    if (existingData?.availability) {
      offer.availability = existingData.availability as string
    }
    if (existingData?.offerUrl) {
      offer.url = existingData.offerUrl as string
    }
    if (existingData?.priceValidUntil) {
      offer.priceValidUntil = existingData.priceValidUntil as string
    }
    schema.offers = offer
  }

  // Build reviews if provided
  if (Array.isArray(existingData?.reviews)) {
    schema.review = (existingData.reviews as Array<Record<string, unknown>>).map((r) => {
      const review: ReviewSchema = {
        '@type': 'Review',
        author: typeof r.author === 'string'
          ? r.author
          : { '@type': 'Person', name: String((r.author as Record<string, unknown>)?.name ?? '') },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: r.ratingValue as number ?? 0,
        },
      }
      if (r.reviewBody) review.reviewBody = r.reviewBody as string
      if (r.datePublished) review.datePublished = r.datePublished as string
      return review
    })
  }

  return schema
}

// ============================================================================
// Offer Schema Builder
// ============================================================================

function buildOfferSchema(existingData?: Record<string, unknown>): OfferSchema {
  const schema: OfferSchema = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    price: (existingData?.price as number) ?? 0,
    priceCurrency: (existingData?.priceCurrency as string) ?? 'EUR',
  }

  if (existingData?.availability) {
    schema.availability = existingData.availability as string
  }
  if (existingData?.url) {
    schema.url = existingData.url as string
  }
  if (existingData?.priceValidUntil) {
    schema.priceValidUntil = existingData.priceValidUntil as string
  }

  return schema
}

// ============================================================================
// Review Schema Builder
// ============================================================================

function buildReviewSchema(existingData?: Record<string, unknown>): ReviewSchema {
  const rating: RatingSchema = {
    '@type': 'Rating',
    ratingValue: (existingData?.ratingValue as number) ?? 0,
  }
  if (existingData?.bestRating !== undefined) {
    rating.bestRating = existingData.bestRating as number
  }
  if (existingData?.worstRating !== undefined) {
    rating.worstRating = existingData.worstRating as number
  }

  const schema: ReviewSchema = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    author: (existingData?.author as string) ?? '',
    reviewRating: rating,
  }

  if (existingData?.reviewBody) {
    schema.reviewBody = existingData.reviewBody as string
  }
  if (existingData?.datePublished) {
    schema.datePublished = existingData.datePublished as string
  }

  return schema
}

// ============================================================================
// Breadcrumb Schema Builder (from page data)
// ============================================================================

function buildBreadcrumbSchemaFromPage(
  pageData: Awaited<ReturnType<typeof loadPage>>,
  url?: string,
  existingData?: Record<string, unknown>
): BreadcrumbListSchema {
  // If items are provided via existingData, use them
  if (Array.isArray(existingData?.items)) {
    const items = existingData.items as Array<{ name: string; url: string }>
    return generateBreadcrumbSchema(items)
  }

  // Otherwise, try to build from URL path
  const pageUrl = url ?? pageData?.url ?? ''
  const items: BreadcrumbInput[] = []

  if (pageUrl) {
    try {
      const parsedUrl = new URL(pageUrl)
      const pathSegments = parsedUrl.pathname
        .split('/')
        .filter((segment) => segment.length > 0)

      // Home breadcrumb
      items.push({
        name: 'Home',
        url: `${parsedUrl.protocol}//${parsedUrl.host}`,
      })

      // Build path progressively
      let currentPath = ''
      for (const segment of pathSegments) {
        currentPath += `/${segment}`
        // Convert segment to readable name
        const name = segment
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase())
        items.push({
          name,
          url: `${parsedUrl.protocol}//${parsedUrl.host}${currentPath}`,
        })
      }
    } catch {
      // Invalid URL, return empty breadcrumb
    }
  }

  return generateBreadcrumbSchema(items)
}

// ============================================================================
// Article Schema Builder
// ============================================================================

async function buildArticleSchema(
  projectId: string,
  pageData: Awaited<ReturnType<typeof loadPage>>,
  brandProfile: BrandProfileData | null,
  existingData?: Record<string, unknown>
): Promise<ArticleSchema> {
  const schema: ArticleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: (existingData?.headline as string) ?? pageData?.title ?? pageData?.h1 ?? '',
    author: (existingData?.author as string) ?? '',
    datePublished: (existingData?.datePublished as string)
      ?? (pageData?.publicationDate ? new Date(pageData.publicationDate).toISOString() : ''),
  }

  if (existingData?.dateModified || pageData?.modificationDate) {
    schema.dateModified = (existingData?.dateModified as string)
      ?? (pageData?.modificationDate ? new Date(pageData.modificationDate).toISOString() : undefined)
  }

  if (existingData?.image || pageData?.url) {
    schema.image = (existingData?.image as string) ?? undefined
  }

  if (existingData?.description || pageData?.description) {
    schema.description = (existingData?.description as string) ?? pageData?.description ?? undefined
  }

  // Publisher from brand profile
  if (brandProfile?.brandName) {
    schema.publisher = {
      '@type': 'Organization',
      name: brandProfile.brandName,
    }
  }

  return schema
}

// ============================================================================
// FAQPage Schema Builder (from existing data)
// ============================================================================

function buildFAQPageSchemaFromExisting(existingData?: Record<string, unknown>): FAQPageSchema {
  if (Array.isArray(existingData?.questions)) {
    const questions = existingData.questions as Array<{ question: string; answer: string }>
    return generateFAQPageSchema(questions)
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [],
  }
}

// ============================================================================
// HowTo Schema Builder (from existing data)
// ============================================================================

function buildHowToSchemaFromExisting(existingData?: Record<string, unknown>): HowToSchema {
  const schema: HowToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: (existingData?.name as string) ?? '',
    step: [],
  }

  if (existingData?.description) {
    schema.description = existingData.description as string
  }

  if (existingData?.totalTime) {
    schema.totalTime = existingData.totalTime as string
  }

  if (Array.isArray(existingData?.steps)) {
    const steps = existingData.steps as HowToStepInput[]
    schema.step = steps.map((s, index) => ({
      '@type': 'HowToStep' as const,
      ...(s.name ? { name: s.name } : {}),
      text: s.text,
      ...(s.url ? { url: s.url } : {}),
      ...(s.image ? { image: s.image } : {}),
      position: index + 1,
    }))
  }

  if (Array.isArray(existingData?.tools)) {
    schema.tool = (existingData.tools as string[]).map((tool) => ({
      '@type': 'HowToTool' as const,
      name: tool,
    }))
  }

  return schema
}

// ============================================================================
// Person Schema Builder
// ============================================================================

function buildPersonSchema(existingData?: Record<string, unknown>): PersonSchema {
  const schema: PersonSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: (existingData?.name as string) ?? '',
  }

  if (existingData?.url) schema.url = existingData.url as string
  if (existingData?.jobTitle) schema.jobTitle = existingData.jobTitle as string
  if (existingData?.image) schema.image = existingData.image as string

  if (existingData?.worksFor) {
    if (typeof existingData.worksFor === 'string') {
      schema.worksFor = { '@type': 'Organization', name: existingData.worksFor }
    } else {
      schema.worksFor = existingData.worksFor as { '@type': 'Organization'; name: string }
    }
  }

  if (Array.isArray(existingData?.sameAs)) {
    schema.sameAs = existingData.sameAs as string[]
  }

  return schema
}

// ============================================================================
// Event Schema Builder
// ============================================================================

function buildEventSchema(existingData?: Record<string, unknown>): EventSchema {
  const schema: EventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: (existingData?.name as string) ?? '',
    startDate: (existingData?.startDate as string) ?? '',
    location: (existingData?.location as string) ?? '',
  }

  if (existingData?.endDate) schema.endDate = existingData.endDate as string
  if (existingData?.description) schema.description = existingData.description as string

  if (existingData?.organizer) {
    if (typeof existingData.organizer === 'string') {
      schema.organizer = { '@type': 'Organization', name: existingData.organizer }
    } else {
      schema.organizer = existingData.organizer as { '@type': 'Organization'; name: string }
    }
  }

  if (existingData?.offers) {
    const offerData = existingData.offers as Record<string, unknown>
    schema.offers = {
      '@type': 'Offer',
      price: (offerData.price as number) ?? 0,
      priceCurrency: (offerData.priceCurrency as string) ?? 'EUR',
      ...(offerData.availability ? { availability: offerData.availability as string } : {}),
      ...(offerData.url ? { url: offerData.url as string } : {}),
    }
  }

  return schema
}

// ============================================================================
// JobPosting Schema Builder
// ============================================================================

function buildJobPostingSchema(
  brandProfile: BrandProfileData | null,
  existingData?: Record<string, unknown>
): JobPostingSchema {
  const schema: JobPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: (existingData?.title as string) ?? '',
    description: (existingData?.description as string) ?? '',
    hiringOrganization: (existingData?.hiringOrganization as string)
      ?? brandProfile?.brandName
      ?? '',
    jobLocation: (existingData?.jobLocation as PostalAddressSchema) ?? {
      '@type': 'PostalAddress',
    },
  }

  if (existingData?.employmentType) {
    schema.employmentType = existingData.employmentType as string
  }
  if (existingData?.datePosted) {
    schema.datePosted = existingData.datePosted as string
  }

  return schema
}

// ============================================================================
// Service Schema Builder
// ============================================================================

function buildServiceSchema(
  brandProfile: BrandProfileData | null,
  existingData?: Record<string, unknown>
): ServiceSchema {
  const schema: ServiceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: (existingData?.name as string) ?? '',
    provider: (existingData?.provider as string)
      ?? brandProfile?.brandName
      ?? '',
  }

  if (existingData?.description) {
    schema.description = existingData.description as string
  }
  if (existingData?.areaServed) {
    schema.areaServed = existingData.areaServed as string | PostalAddressSchema
  }
  if (existingData?.serviceType) {
    schema.serviceType = existingData.serviceType as string
  }

  return schema
}

// ============================================================================
// WebSite Schema Builder
// ============================================================================

function buildWebSiteSchema(
  project: Awaited<ReturnType<typeof loadProject>>,
  brandProfile: BrandProfileData | null
): WebSiteSchema {
  const websiteUrl = brandProfile?.contactInformation?.website ?? project?.websiteUrl ?? ''

  const schema: WebSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brandProfile?.brandName ?? project?.name ?? '',
    url: websiteUrl,
  }

  // Add SearchAction if website URL is available
  if (websiteUrl) {
    const searchAction: SearchActionSchema = {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${websiteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    }
    schema.potentialAction = searchAction
  }

  return schema
}

// ============================================================================
// WebPage Schema Builder
// ============================================================================

function buildWebPageSchema(
  pageData: Awaited<ReturnType<typeof loadPage>>,
  url?: string
): WebPageSchema {
  const schema: WebPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
  }

  if (pageData?.title || pageData?.h1) {
    schema.name = pageData.title ?? pageData.h1 ?? undefined
  }

  if (pageData?.description) {
    schema.description = pageData.description
  }

  const pageUrl = url ?? pageData?.url
  if (pageUrl) {
    schema.url = pageUrl
  }

  if (pageData?.publicationDate) {
    schema.datePublished = new Date(pageData.publicationDate).toISOString()
  }

  if (pageData?.modificationDate) {
    schema.dateModified = new Date(pageData.modificationDate).toISOString()
  }

  return schema
}

// ============================================================================
// Public Individual Generator Functions
// ============================================================================

/**
 * Generate Organization schema from BrandProfile data
 */
export async function generateOrganizationSchema(
  projectId: string
): Promise<OrganizationSchema> {
  const brandProfile = await loadBrandProfile(projectId)
  const project = await loadProject(projectId)
  return buildOrganizationSchema(projectId, brandProfile, project)
}

/**
 * Generate LocalBusiness schema from BrandProfile and optional Location
 */
export async function generateLocalBusinessSchema(
  projectId: string,
  locationId?: string
): Promise<LocalBusinessSchema> {
  const brandProfile = await loadBrandProfile(projectId)
  const project = await loadProject(projectId)
  const baseSchema = await buildLocalBusinessSchema(projectId, brandProfile, project)

  // If a specific location is provided, override with that location's data
  if (locationId) {
    const location = await loadLocation(locationId)
    if (location) {
      if (location.address || location.city || location.postalCode || location.country) {
        const address: PostalAddressSchema = {
          '@type': 'PostalAddress',
        }
        if (location.address) address.streetAddress = location.address
        if (location.city) address.addressLocality = location.city
        if (location.postalCode) address.postalCode = location.postalCode
        if (location.country) address.addressCountry = location.country
        baseSchema.address = address
      }

      if (location.phone) {
        baseSchema.telephone = location.phone
      }

      if (location.latitude !== null && location.latitude !== undefined &&
          location.longitude !== null && location.longitude !== undefined) {
        baseSchema.geo = {
          '@type': 'GeoCoordinates',
          latitude: location.latitude,
          longitude: location.longitude,
        }
      }

      // Use location name as the business name if available
      if (location.name) {
        baseSchema.name = location.name
      }
    }
  }

  return baseSchema
}

/**
 * Generate Product schema
 */
export function generateProductSchema(
  projectId: string,
  productName: string,
  price?: number,
  priceCurrency?: string,
  description?: string,
  image?: string,
  brand?: string,
  sku?: string,
  mpn?: string,
  availability?: string
): ProductSchema {
  const schema: ProductSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName,
  }

  if (description) schema.description = description
  if (image) schema.image = image
  if (brand) schema.brand = { '@type': 'Brand', name: brand }
  if (sku) schema.sku = sku
  if (mpn) schema.mpn = mpn

  if (price !== undefined) {
    const offer: OfferSchema = {
      '@type': 'Offer',
      price,
      priceCurrency: priceCurrency ?? 'EUR',
    }
    if (availability) offer.availability = availability
    schema.offers = offer
  }

  return schema
}

/**
 * Generate FAQPage schema from questions
 */
export function generateFAQPageSchema(
  questions: Array<FAQInput>
): FAQPageSchema {
  const mainEntity: FAQQuestion[] = questions.map((q) => ({
    '@type': 'Question' as const,
    name: q.question,
    acceptedAnswer: {
      '@type': 'Answer' as const,
      text: q.answer,
    },
  }))

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  }
}

/**
 * Generate BreadcrumbList schema from items
 */
export function generateBreadcrumbSchema(
  items: Array<BreadcrumbInput>
): BreadcrumbListSchema {
  const itemListElement: BreadcrumbItem[] = items.map((item, index) => ({
    '@type': 'ListItem' as const,
    position: index + 1,
    name: item.name,
    ...(item.url ? { item: item.url } : {}),
  }))

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  }
}

/**
 * Generate Article schema from ContentBrief
 */
export async function generateArticleSchema(
  briefId: string
): Promise<ArticleSchema> {
  const brief = await loadContentBrief(briefId)
  if (!brief) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: '',
      author: '',
      datePublished: '',
    }
  }

  const latestVersion = brief.versions[0]
  const brandProfile = await loadBrandProfile(brief.projectId)

  const schema: ArticleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: brief.title,
    author: '', // Would need author data from the system
    datePublished: latestVersion
      ? new Date(latestVersion.createdAt).toISOString()
      : new Date(brief.createdAt).toISOString(),
  }

  if (latestVersion) {
    schema.dateModified = new Date(latestVersion.updatedAt).toISOString()
  }

  // Publisher from brand profile
  if (brandProfile?.brandName) {
    schema.publisher = {
      '@type': 'Organization',
      name: brandProfile.brandName,
    }
  }

  // Description from target keyword or secondary keywords
  if (brief.targetKeyword) {
    schema.description = `Artikel over ${brief.targetKeyword}`
  }

  return schema
}

/**
 * Generate HowTo schema from steps
 */
export function generateHowToSchema(
  name: string,
  steps: Array<HowToStepInput>,
  description?: string,
  tools?: string[],
  totalTime?: string
): HowToSchema {
  const howToSteps: HowToStep[] = steps.map((s, index) => ({
    '@type': 'HowToStep' as const,
    ...(s.name ? { name: s.name } : {}),
    text: s.text,
    ...(s.url ? { url: s.url } : {}),
    ...(s.image ? { image: s.image } : {}),
    position: index + 1,
  }))

  const schema: HowToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    step: howToSteps,
  }

  if (description) schema.description = description
  if (totalTime) schema.totalTime = totalTime

  if (tools && tools.length > 0) {
    schema.tool = tools.map((tool) => ({
      '@type': 'HowToTool' as const,
      name: tool,
    }))
  }

  return schema
}

/**
 * Generate Person schema
 */
export function generatePersonSchema(
  name: string,
  url?: string,
  jobTitle?: string,
  worksFor?: string,
  image?: string,
  sameAs?: string[]
): PersonSchema {
  const schema: PersonSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
  }

  if (url) schema.url = url
  if (jobTitle) schema.jobTitle = jobTitle
  if (worksFor) schema.worksFor = { '@type': 'Organization', name: worksFor }
  if (image) schema.image = image
  if (sameAs && sameAs.length > 0) schema.sameAs = sameAs

  return schema
}

/**
 * Generate Event schema
 */
export function generateEventSchema(
  name: string,
  startDate: string,
  location: string | PostalAddressSchema,
  endDate?: string,
  organizer?: string,
  description?: string,
  offers?: { price: number; priceCurrency: string; availability?: string }
): EventSchema {
  const schema: EventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    startDate,
    location,
  }

  if (endDate) schema.endDate = endDate
  if (description) schema.description = description
  if (organizer) schema.organizer = { '@type': 'Organization', name: organizer }
  if (offers) {
    schema.offers = {
      '@type': 'Offer',
      price: offers.price,
      priceCurrency: offers.priceCurrency,
      ...(offers.availability ? { availability: offers.availability } : {}),
    }
  }

  return schema
}

/**
 * Generate JobPosting schema
 */
export function generateJobPostingSchema(
  title: string,
  description: string,
  hiringOrganization: string,
  jobLocation: PostalAddressSchema,
  employmentType?: string,
  datePosted?: string
): JobPostingSchema {
  const schema: JobPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title,
    description,
    hiringOrganization: { '@type': 'Organization', name: hiringOrganization },
    jobLocation,
  }

  if (employmentType) schema.employmentType = employmentType
  if (datePosted) schema.datePosted = datePosted

  return schema
}

/**
 * Generate Service schema
 */
export function generateServiceSchema(
  name: string,
  provider: string,
  description?: string,
  areaServed?: string,
  serviceType?: string
): ServiceSchema {
  const schema: ServiceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    provider: { '@type': 'Organization', name: provider },
  }

  if (description) schema.description = description
  if (areaServed) schema.areaServed = areaServed
  if (serviceType) schema.serviceType = serviceType

  return schema
}

/**
 * Generate WebSite schema
 */
export function generateWebSiteSchema(
  name: string,
  url: string,
  searchUrlTemplate?: string
): WebSiteSchema {
  const schema: WebSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
  }

  if (searchUrlTemplate) {
    schema.potentialAction = {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: searchUrlTemplate,
      },
      'query-input': 'required name=search_term_string',
    }
  }

  return schema
}

/**
 * Generate WebPage schema
 */
export function generateWebPageSchema(
  name: string,
  url: string,
  description?: string,
  breadcrumb?: BreadcrumbListSchema,
  datePublished?: string,
  dateModified?: string
): WebPageSchema {
  const schema: WebPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    url,
  }

  if (description) schema.description = description
  if (breadcrumb) schema.breadcrumb = breadcrumb
  if (datePublished) schema.datePublished = datePublished
  if (dateModified) schema.dateModified = dateModified

  return schema
}

/**
 * Generate Review schema
 */
export function generateReviewSchema(
  author: string,
  ratingValue: number,
  reviewBody?: string,
  datePublished?: string,
  bestRating?: number,
  worstRating?: number
): ReviewSchema {
  const rating: RatingSchema = {
    '@type': 'Rating',
    ratingValue,
  }
  if (bestRating !== undefined) rating.bestRating = bestRating
  if (worstRating !== undefined) rating.worstRating = worstRating

  const schema: ReviewSchema = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    author,
    reviewRating: rating,
  }

  if (reviewBody) schema.reviewBody = reviewBody
  if (datePublished) schema.datePublished = datePublished

  return schema
}

/**
 * Generate Offer schema
 */
export function generateOfferSchema(
  price: number,
  priceCurrency: string,
  availability?: string,
  url?: string,
  priceValidUntil?: string
): OfferSchema {
  const schema: OfferSchema = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    price,
    priceCurrency,
  }

  if (availability) schema.availability = availability
  if (url) schema.url = url
  if (priceValidUntil) schema.priceValidUntil = priceValidUntil

  return schema
}

/**
 * Update existing structured data record
 */
export async function updateStructuredData(
  id: string,
  data: Record<string, unknown>,
  type: StructuredDataType
): Promise<StructuredDataGenerationResult> {
  const validation = validateStructuredData(type, data)
  const jsonLd = JSON.stringify(data, null, 2)

  const updated = await db.structuredData.update({
    where: { id },
    data: {
      data: jsonLd,
      isValid: validation.isValid,
      validationErrors: validation.errors.length > 0
        ? JSON.stringify(validation.errors)
        : null,
      missingFields: validation.missingRequiredFields.length > 0
        ? JSON.stringify(validation.missingRequiredFields)
        : null,
      isAutoGenerated: false,
    },
  })

  return {
    jsonLd,
    validation,
    structuredDataId: updated.id,
  }
}

/**
 * Approve structured data
 */
export async function approveStructuredData(
  id: string,
  approvedBy: string
): Promise<void> {
  await db.structuredData.update({
    where: { id },
    data: {
      approvedBy,
      approvedAt: new Date(),
    },
  })
}

/**
 * Get structured data for a project
 */
export async function getProjectStructuredData(
  projectId: string,
  type?: StructuredDataType
) {
  return db.structuredData.findMany({
    where: {
      projectId,
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get structured data for a specific page
 */
export async function getPageStructuredData(pageId: string) {
  return db.structuredData.findMany({
    where: { pageId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Delete structured data
 */
export async function deleteStructuredData(id: string): Promise<void> {
  await db.structuredData.delete({
    where: { id },
  })
}
