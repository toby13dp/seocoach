// ============================================================================
// Structured Data Module — SEOCoach
// Barrel export of all public functions and types
// ============================================================================

// Types
export type {
  SchemaOrgBase,
  ContactPointSchema,
  PostalAddressSchema,
  OrganizationSchema,
  GeoCoordinatesSchema,
  LocalBusinessSchema,
  OfferSchema,
  RatingSchema,
  ReviewSchema,
  ProductSchema,
  BreadcrumbItem,
  BreadcrumbListSchema,
  ArticleSchema,
  FAQQuestion,
  FAQPageSchema,
  HowToStep,
  HowToSchema,
  PersonSchema,
  EventSchema,
  JobPostingSchema,
  ServiceSchema,
  SearchActionSchema,
  WebSiteSchema,
  WebPageSchema,
  ValidationError,
  ValidationWarning,
  SchemaValidationResult,
  StructuredDataGenerationRequest,
  StructuredDataGenerationResult,
  FAQInput,
  BreadcrumbInput,
  HowToStepInput,
  AnySchemaObject,
} from './types'

// Validator
export { validateStructuredData } from './validator'

// Generator - Main function
export { generateStructuredData } from './generator'

// Generator - Individual schema generators
export {
  generateOrganizationSchema,
  generateLocalBusinessSchema,
  generateProductSchema,
  generateFAQPageSchema,
  generateBreadcrumbSchema,
  generateArticleSchema,
  generateHowToSchema,
  generatePersonSchema,
  generateEventSchema,
  generateJobPostingSchema,
  generateServiceSchema,
  generateWebSiteSchema,
  generateWebPageSchema,
  generateReviewSchema,
  generateOfferSchema,
} from './generator'

// Generator - CRUD operations
export {
  updateStructuredData,
  approveStructuredData,
  getProjectStructuredData,
  getPageStructuredData,
  deleteStructuredData,
} from './generator'
