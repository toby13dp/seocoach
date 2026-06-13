// ============================================================================
// Structured Data Types — SEOCoach
// TypeScript interfaces for schema.org JSON-LD structured data
// ============================================================================

import type { StructuredDataType } from '@prisma/client'

// ============================================================================
// Base Schema.org context
// ============================================================================

export interface SchemaOrgBase {
  '@context'?: 'https://schema.org'
  '@type': string
}

// ============================================================================
// ContactPoint (nested in Organization)
// ============================================================================

export interface ContactPointSchema {
  '@type': 'ContactPoint'
  telephone?: string
  contactType?: string
  email?: string
  availableLanguage?: string[]
}

// ============================================================================
// PostalAddress (nested in Organization / LocalBusiness)
// ============================================================================

export interface PostalAddressSchema {
  '@type': 'PostalAddress'
  streetAddress?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  addressCountry?: string
}

// ============================================================================
// Organization
// ============================================================================

export interface OrganizationSchema extends SchemaOrgBase {
  '@type': 'Organization'
  name: string
  url?: string
  logo?: string
  contactPoint?: ContactPointSchema[]
  sameAs?: string[]
  address?: PostalAddressSchema
}

// ============================================================================
// GeoCoordinates (nested in LocalBusiness)
// ============================================================================

export interface GeoCoordinatesSchema {
  '@type': 'GeoCoordinates'
  latitude: number
  longitude: number
}

// ============================================================================
// LocalBusiness (extends Organization)
// ============================================================================

export interface LocalBusinessSchema extends SchemaOrgBase {
  '@type': 'LocalBusiness'
  name: string
  url?: string
  logo?: string
  contactPoint?: ContactPointSchema[]
  sameAs?: string[]
  address?: PostalAddressSchema
  geo?: GeoCoordinatesSchema
  openingHours?: string[]
  telephone?: string
  priceRange?: string
}

// ============================================================================
// Offer (nested in Product)
// ============================================================================

export interface OfferSchema extends SchemaOrgBase {
  '@type': 'Offer'
  price: number | string
  priceCurrency: string
  availability?: string
  url?: string
  priceValidUntil?: string
}

// ============================================================================
// Rating (nested in Review)
// ============================================================================

export interface RatingSchema {
  '@type': 'Rating'
  ratingValue: number
  bestRating?: number
  worstRating?: number
}

// ============================================================================
// Review (nested in Product)
// ============================================================================

export interface ReviewSchema extends SchemaOrgBase {
  '@type': 'Review'
  author: string | { '@type': 'Person'; name: string }
  reviewRating: RatingSchema
  reviewBody?: string
  datePublished?: string
}

// ============================================================================
// Product
// ============================================================================

export interface ProductSchema extends SchemaOrgBase {
  '@type': 'Product'
  name: string
  description?: string
  image?: string | string[]
  brand?: string | { '@type': 'Brand'; name: string }
  offers?: OfferSchema
  review?: ReviewSchema[]
  sku?: string
  mpn?: string
}

// ============================================================================
// BreadcrumbList
// ============================================================================

export interface BreadcrumbItem {
  '@type': 'ListItem'
  position: number
  name: string
  item?: string
}

export interface BreadcrumbListSchema extends SchemaOrgBase {
  '@type': 'BreadcrumbList'
  itemListElement: BreadcrumbItem[]
}

// ============================================================================
// Article
// ============================================================================

export interface ArticleSchema extends SchemaOrgBase {
  '@type': 'Article'
  headline: string
  author: string | { '@type': 'Person'; name: string } | { '@type': 'Organization'; name: string }
  datePublished: string
  dateModified?: string
  image?: string | string[]
  publisher?: { '@type': 'Organization'; name: string; logo?: string | { '@type': 'ImageObject'; url: string } }
  description?: string
}

// ============================================================================
// FAQPage
// ============================================================================

export interface FAQQuestion {
  '@type': 'Question'
  name: string
  acceptedAnswer: {
    '@type': 'Answer'
    text: string
  }
}

export interface FAQPageSchema extends SchemaOrgBase {
  '@type': 'FAQPage'
  mainEntity: FAQQuestion[]
}

// ============================================================================
// HowTo
// ============================================================================

export interface HowToStep {
  '@type': 'HowToStep'
  name?: string
  text: string
  url?: string
  image?: string
  position?: number
}

export interface HowToSchema extends SchemaOrgBase {
  '@type': 'HowTo'
  name: string
  description?: string
  step: HowToStep[]
  tool?: string | { '@type': 'HowToTool'; name: string }[]
  totalTime?: string
}

// ============================================================================
// Person
// ============================================================================

export interface PersonSchema extends SchemaOrgBase {
  '@type': 'Person'
  name: string
  url?: string
  jobTitle?: string
  worksFor?: string | { '@type': 'Organization'; name: string }
  image?: string
  sameAs?: string[]
}

// ============================================================================
// Event
// ============================================================================

export interface EventSchema extends SchemaOrgBase {
  '@type': 'Event'
  name: string
  startDate: string
  endDate?: string
  location: string | PostalAddressSchema | { '@type': 'VirtualLocation'; url: string }
  organizer?: string | { '@type': 'Organization'; name: string }
  offers?: OfferSchema
  description?: string
}

// ============================================================================
// JobPosting
// ============================================================================

export interface JobPostingSchema extends SchemaOrgBase {
  '@type': 'JobPosting'
  title: string
  description: string
  hiringOrganization: string | { '@type': 'Organization'; name: string }
  jobLocation: PostalAddressSchema
  employmentType?: string
  datePosted?: string
}

// ============================================================================
// Service
// ============================================================================

export interface ServiceSchema extends SchemaOrgBase {
  '@type': 'Service'
  name: string
  description?: string
  provider: string | { '@type': 'Organization'; name: string }
  areaServed?: string | PostalAddressSchema
  serviceType?: string
}

// ============================================================================
// SearchAction (nested in WebSite)
// ============================================================================

export interface SearchActionSchema {
  '@type': 'SearchAction'
  target: string | { '@type': 'EntryPoint'; urlTemplate: string }
  'query-input': string
}

// ============================================================================
// WebSite
// ============================================================================

export interface WebSiteSchema extends SchemaOrgBase {
  '@type': 'WebSite'
  name: string
  url: string
  potentialAction?: SearchActionSchema
}

// ============================================================================
// WebPage
// ============================================================================

export interface WebPageSchema extends SchemaOrgBase {
  '@type': 'WebPage'
  name?: string
  description?: string
  url?: string
  breadcrumb?: string | BreadcrumbListSchema
  datePublished?: string
  dateModified?: string
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  field: string
  message: string // Dutch description
  value?: unknown
}

export interface ValidationWarning {
  field: string
  message: string // Dutch description
}

export interface SchemaValidationResult {
  isValid: boolean
  errors: ValidationError[]
  missingRequiredFields: string[] // Dutch field names
  warnings: ValidationWarning[]
}

// ============================================================================
// Generation Request Types
// ============================================================================

export interface StructuredDataGenerationRequest {
  type: StructuredDataType
  projectId: string
  pageId?: string
  url?: string
  existingData?: Record<string, unknown>
}

// ============================================================================
// Generation Result
// ============================================================================

export interface StructuredDataGenerationResult {
  jsonLd: string
  validation: SchemaValidationResult
  structuredDataId: string
}

// ============================================================================
// FAQ Input (for generator function)
// ============================================================================

export interface FAQInput {
  question: string
  answer: string
}

// ============================================================================
// Breadcrumb Input (for generator function)
// ============================================================================

export interface BreadcrumbInput {
  name: string
  url: string
}

// ============================================================================
// HowTo Step Input (for generator function)
// ============================================================================

export interface HowToStepInput {
  name?: string
  text: string
  url?: string
  image?: string
}

// ============================================================================
// All Schema Type Union
// ============================================================================

export type AnySchemaObject =
  | OrganizationSchema
  | LocalBusinessSchema
  | ProductSchema
  | OfferSchema
  | ReviewSchema
  | BreadcrumbListSchema
  | ArticleSchema
  | FAQPageSchema
  | HowToSchema
  | PersonSchema
  | EventSchema
  | JobPostingSchema
  | ServiceSchema
  | WebSiteSchema
  | WebPageSchema
