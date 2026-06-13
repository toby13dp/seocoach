// ============================================================================
// Structured Data Validator — SEOCoach
// Validates schema.org JSON-LD against required fields
// All user-facing messages are in Dutch
// ============================================================================

import type { StructuredDataType } from '@prisma/client'
import type {
  SchemaValidationResult,
  ValidationError,
  ValidationWarning,
} from './types'

// ============================================================================
// Required field definitions per schema type (Dutch names for reporting)
// ============================================================================

interface FieldDefinition {
  path: string
  dutchName: string
  required: boolean
  type?: 'url' | 'date' | 'price' | 'currency' | 'email' | 'positiveNumber'
}

const SCHEMA_REQUIRED_FIELDS: Record<string, FieldDefinition[]> = {
  ORGANIZATION: [
    { path: 'name', dutchName: 'Naam', required: true },
    { path: 'url', dutchName: 'URL', required: false, type: 'url' },
    { path: 'logo', dutchName: 'Logo', required: false, type: 'url' },
    { path: 'sameAs', dutchName: 'Sociale media links', required: false, type: 'url' },
  ],
  LOCAL_BUSINESS: [
    { path: 'name', dutchName: 'Naam', required: true },
    { path: 'address', dutchName: 'Adres', required: true },
    { path: 'url', dutchName: 'URL', required: false, type: 'url' },
    { path: 'telephone', dutchName: 'Telefoonnummer', required: false },
    { path: 'geo', dutchName: 'Geografische locatie', required: false },
    { path: 'openingHours', dutchName: 'Openingstijden', required: false },
    { path: 'priceRange', dutchName: 'Prijscategorie', required: false },
  ],
  PRODUCT: [
    { path: 'name', dutchName: 'Productnaam', required: true },
    { path: 'description', dutchName: 'Beschrijving', required: false },
    { path: 'image', dutchName: 'Afbeelding', required: false, type: 'url' },
    { path: 'brand', dutchName: 'Merk', required: false },
    { path: 'offers', dutchName: 'Aanbod', required: false },
    { path: 'offers.price', dutchName: 'Prijs', required: false, type: 'price' },
    { path: 'offers.priceCurrency', dutchName: 'Valuta', required: false, type: 'currency' },
    { path: 'sku', dutchName: 'SKU', required: false },
  ],
  OFFER: [
    { path: 'price', dutchName: 'Prijs', required: true, type: 'price' },
    { path: 'priceCurrency', dutchName: 'Valuta', required: true, type: 'currency' },
    { path: 'availability', dutchName: 'Beschikbaarheid', required: false },
    { path: 'url', dutchName: 'URL', required: false, type: 'url' },
    { path: 'priceValidUntil', dutchName: 'Geldig tot', required: false, type: 'date' },
  ],
  REVIEW: [
    { path: 'author', dutchName: 'Auteur', required: true },
    { path: 'reviewRating', dutchName: 'Beoordeling', required: true },
    { path: 'reviewRating.ratingValue', dutchName: 'Beoordelingswaarde', required: true, type: 'positiveNumber' },
    { path: 'reviewBody', dutchName: 'Reviewtekst', required: false },
    { path: 'datePublished', dutchName: 'Publicatiedatum', required: false, type: 'date' },
  ],
  BREADCRUMB_LIST: [
    { path: 'itemListElement', dutchName: 'Breadcrumb-items', required: true },
    { path: 'itemListElement[].name', dutchName: 'Itemnaam', required: true },
    { path: 'itemListElement[].position', dutchName: 'Itempositie', required: true },
  ],
  ARTICLE: [
    { path: 'headline', dutchName: 'Kopregel', required: true },
    { path: 'author', dutchName: 'Auteur', required: true },
    { path: 'datePublished', dutchName: 'Publicatiedatum', required: true, type: 'date' },
    { path: 'dateModified', dutchName: 'Wijzigingsdatum', required: false, type: 'date' },
    { path: 'image', dutchName: 'Afbeelding', required: false, type: 'url' },
    { path: 'publisher', dutchName: 'Uitgever', required: false },
    { path: 'description', dutchName: 'Beschrijving', required: false },
  ],
  FAQ_PAGE: [
    { path: 'mainEntity', dutchName: 'Veelgestelde vragen', required: true },
    { path: 'mainEntity[].name', dutchName: 'Vraag', required: true },
    { path: 'mainEntity[].acceptedAnswer', dutchName: 'Antwoord', required: true },
    { path: 'mainEntity[].acceptedAnswer.text', dutchName: 'Antwoordtekst', required: true },
  ],
  HOW_TO: [
    { path: 'name', dutchName: 'Naam', required: true },
    { path: 'step', dutchName: 'Stappen', required: true },
    { path: 'step[].text', dutchName: 'Stapbeschrijving', required: true },
    { path: 'description', dutchName: 'Beschrijving', required: false },
    { path: 'totalTime', dutchName: 'Totale tijd', required: false },
  ],
  PERSON: [
    { path: 'name', dutchName: 'Naam', required: true },
    { path: 'url', dutchName: 'URL', required: false, type: 'url' },
    { path: 'jobTitle', dutchName: 'Functietitel', required: false },
    { path: 'worksFor', dutchName: 'Werkgever', required: false },
    { path: 'image', dutchName: 'Afbeelding', required: false, type: 'url' },
  ],
  EVENT: [
    { path: 'name', dutchName: 'Naam', required: true },
    { path: 'startDate', dutchName: 'Startdatum', required: true, type: 'date' },
    { path: 'location', dutchName: 'Locatie', required: true },
    { path: 'endDate', dutchName: 'Einddatum', required: false, type: 'date' },
    { path: 'organizer', dutchName: 'Organisator', required: false },
    { path: 'offers', dutchName: 'Aanbod', required: false },
    { path: 'description', dutchName: 'Beschrijving', required: false },
  ],
  JOB_POSTING: [
    { path: 'title', dutchName: 'Functietitel', required: true },
    { path: 'description', dutchName: 'Functiebeschrijving', required: true },
    { path: 'hiringOrganization', dutchName: 'Werkgever', required: true },
    { path: 'jobLocation', dutchName: 'Werklocatie', required: true },
    { path: 'employmentType', dutchName: 'Dienstverband', required: false },
    { path: 'datePosted', dutchName: 'Plaatsingsdatum', required: false, type: 'date' },
  ],
  SERVICE: [
    { path: 'name', dutchName: 'Naam', required: true },
    { path: 'provider', dutchName: 'Aanbieder', required: true },
    { path: 'description', dutchName: 'Beschrijving', required: false },
    { path: 'areaServed', dutchName: 'Bedieningsgebied', required: false },
    { path: 'serviceType', dutchName: 'Servicetype', required: false },
  ],
  WEB_SITE: [
    { path: 'name', dutchName: 'Naam', required: true },
    { path: 'url', dutchName: 'URL', required: true, type: 'url' },
    { path: 'potentialAction', dutchName: 'Zoekactie', required: false },
  ],
  WEB_PAGE: [
    { path: 'name', dutchName: 'Naam', required: false },
    { path: 'description', dutchName: 'Beschrijving', required: false },
    { path: 'url', dutchName: 'URL', required: false, type: 'url' },
    { path: 'datePublished', dutchName: 'Publicatiedatum', required: false, type: 'date' },
    { path: 'dateModified', dutchName: 'Wijzigingsdatum', required: false, type: 'date' },
  ],
}

// ============================================================================
// Validation helpers
// ============================================================================

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isValidIsoDate(value: string): boolean {
  const isoPattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/
  if (!isoPattern.test(value)) return false
  const date = new Date(value)
  return !isNaN(date.getTime())
}

function isValidCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value)
}

function isPositiveNumber(value: unknown): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return typeof num === 'number' && !isNaN(num) && num >= 0
}

// ============================================================================
// Get nested value from object by dot-notation path
// ============================================================================

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (path.includes('[]')) {
    // Array path like "mainEntity[].name"
    const parts = path.split('[].')
    const arrayPath = parts[0]
    const subPath = parts[1]
    const array = getNestedValue(obj, arrayPath)
    if (!Array.isArray(array)) return undefined
    return array.map((item: unknown) =>
      typeof item === 'object' && item !== null
        ? getNestedValue(item as Record<string, unknown>, subPath)
        : undefined
    )
  }

  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

// ============================================================================
// Main validation function
// ============================================================================

export function validateStructuredData(
  type: StructuredDataType,
  data: Record<string, unknown>
): SchemaValidationResult {
  const errors: ValidationError[] = []
  const missingRequiredFields: string[] = []
  const warnings: ValidationWarning[] = []

  // Check @context
  if (data['@context'] !== 'https://schema.org') {
    errors.push({
      field: '@context',
      message: '@context moet "https://schema.org" zijn',
      value: data['@context'],
    })
  }

  // Check @type matches
  const expectedType = getExpectedTypeName(type)
  if (data['@type'] !== expectedType) {
    errors.push({
      field: '@type',
      message: `@type moet "${expectedType}" zijn, maar "${String(data['@type'])}" werd gevonden`,
      value: data['@type'],
    })
  }

  // Get field definitions for this type
  const fieldDefs = SCHEMA_REQUIRED_FIELDS[type]
  if (!fieldDefs) {
    warnings.push({
      field: '@type',
      message: `Geen validatieregels gedefinieerd voor type "${type}"`,
    })
    return { isValid: errors.length === 0, errors, missingRequiredFields, warnings }
  }

  // Validate each field
  for (const fieldDef of fieldDefs) {
    const value = getNestedValue(data, fieldDef.path)

    if (value === undefined || value === null || value === '') {
      if (fieldDef.required) {
        missingRequiredFields.push(fieldDef.dutchName)
        errors.push({
          field: fieldDef.path,
          message: `Verplicht veld "${fieldDef.dutchName}" ontbreekt`,
        })
      }
      continue
    }

    // Type-specific validation
    if (fieldDef.type === 'url') {
      if (typeof value === 'string' && !isValidUrl(value)) {
        errors.push({
          field: fieldDef.path,
          message: `"${fieldDef.dutchName}" bevat geen geldige URL: "${value}"`,
          value,
        })
      }
      // Validate array of URLs (e.g., sameAs)
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && !isValidUrl(item)) {
            errors.push({
              field: fieldDef.path,
              message: `"${fieldDef.dutchName}" bevat een ongeldige URL: "${item}"`,
              value: item,
            })
          }
        }
      }
    }

    if (fieldDef.type === 'date') {
      if (typeof value === 'string' && !isValidIsoDate(value)) {
        errors.push({
          field: fieldDef.path,
          message: `"${fieldDef.dutchName}" moet een geldige ISO-datum zijn: "${value}"`,
          value,
        })
      }
    }

    if (fieldDef.type === 'price') {
      if (!isPositiveNumber(value)) {
        errors.push({
          field: fieldDef.path,
          message: `"${fieldDef.dutchName}" moet een positief getal zijn`,
          value,
        })
      }
    }

    if (fieldDef.type === 'currency') {
      if (typeof value === 'string' && !isValidCurrencyCode(value)) {
        errors.push({
          field: fieldDef.path,
          message: `"${fieldDef.dutchName}" moet een geldige valutacode zijn (bijv. EUR, USD): "${value}"`,
          value,
        })
      }
    }

    if (fieldDef.type === 'positiveNumber') {
      if (!isPositiveNumber(value)) {
        errors.push({
          field: fieldDef.path,
          message: `"${fieldDef.dutchName}" moet een positief getal zijn`,
          value,
        })
      }
    }
  }

  // Additional cross-field validation
  validateCrossFieldRules(type, data, errors, warnings)

  const isValid = errors.length === 0 && missingRequiredFields.length === 0

  return { isValid, errors, missingRequiredFields, warnings }
}

// ============================================================================
// Cross-field validation rules
// ============================================================================

function validateCrossFieldRules(
  type: StructuredDataType,
  data: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  switch (type) {
    case 'PRODUCT': {
      // If offers exist, check for price and currency
      const offers = data.offers as Record<string, unknown> | undefined
      if (offers && typeof offers === 'object') {
        if (offers.price === undefined || offers.price === null) {
          errors.push({
            field: 'offers.price',
            message: 'Verplicht veld "Prijs" ontbreekt in het aanbod',
          })
        }
        if (!offers.priceCurrency) {
          errors.push({
            field: 'offers.priceCurrency',
            message: 'Verplicht veld "Valuta" ontbreekt in het aanbod',
          })
        }
      }

      // If reviews exist, validate each review
      const reviews = data.review as Array<Record<string, unknown>> | undefined
      if (Array.isArray(reviews)) {
        for (let i = 0; i < reviews.length; i++) {
          const review = reviews[i]
          if (!review.author) {
            errors.push({
              field: `review[${i}].author`,
              message: `Review ${i + 1}: Verplicht veld "Auteur" ontbreekt`,
            })
          }
          const rating = review.reviewRating as Record<string, unknown> | undefined
          if (!rating || rating.ratingValue === undefined) {
            errors.push({
              field: `review[${i}].reviewRating.ratingValue`,
              message: `Review ${i + 1}: Verplicht veld "Beoordelingswaarde" ontbreekt`,
            })
          } else if (typeof rating.ratingValue === 'number' && (rating.ratingValue < 1 || rating.ratingValue > 5)) {
            warnings.push({
              field: `review[${i}].reviewRating.ratingValue`,
              message: `Review ${i + 1}: Beoordelingswaarde valt buiten het normale bereik (1-5)`,
            })
          }
        }
      }
      break
    }

    case 'FAQ_PAGE': {
      const mainEntity = data.mainEntity as Array<Record<string, unknown>> | undefined
      if (Array.isArray(mainEntity)) {
        if (mainEntity.length === 0) {
          errors.push({
            field: 'mainEntity',
            message: 'FAQPage moet minimaal één vraag bevatten',
          })
        }
        for (let i = 0; i < mainEntity.length; i++) {
          const q = mainEntity[i]
          if (!q.name) {
            errors.push({
              field: `mainEntity[${i}].name`,
              message: `Vraag ${i + 1}: Verplicht veld "Vraag" ontbreekt`,
            })
          }
          const answer = q.acceptedAnswer as Record<string, unknown> | undefined
          if (!answer || !answer.text) {
            errors.push({
              field: `mainEntity[${i}].acceptedAnswer.text`,
              message: `Vraag ${i + 1}: Verplicht veld "Antwoordtekst" ontbreekt`,
            })
          }
        }
      }
      break
    }

    case 'HOW_TO': {
      const steps = data.step as Array<Record<string, unknown>> | undefined
      if (Array.isArray(steps)) {
        if (steps.length === 0) {
          errors.push({
            field: 'step',
            message: 'HowTo moet minimaal één stap bevatten',
          })
        }
        for (let i = 0; i < steps.length; i++) {
          if (!steps[i].text) {
            errors.push({
              field: `step[${i}].text`,
              message: `Stap ${i + 1}: Verplicht veld "Stapbeschrijving" ontbreekt`,
            })
          }
        }
      }
      break
    }

    case 'BREADCRUMB_LIST': {
      const items = data.itemListElement as Array<Record<string, unknown>> | undefined
      if (Array.isArray(items)) {
        if (items.length === 0) {
          errors.push({
            field: 'itemListElement',
            message: 'BreadcrumbList moet minimaal één item bevatten',
          })
        }
        // Check positions are sequential
        const positions = items
          .map((item) => item.position as number)
          .filter((p) => p !== undefined)
        if (positions.length > 0) {
          const sorted = [...positions].sort((a, b) => a - b)
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i] !== i + 1) {
              warnings.push({
                field: 'itemListElement[].position',
                message: 'Breadcrumb-positiewaarden worden aangeraden opeenvolgend te zijn vanaf 1',
              })
              break
            }
          }
        }
      }
      break
    }

    case 'EVENT': {
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate as string)
        const end = new Date(data.endDate as string)
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
          errors.push({
            field: 'endDate',
            message: 'Einddatum mag niet voor de startdatum liggen',
          })
        }
      }
      break
    }

    case 'ARTICLE': {
      // Warn if dateModified is older than datePublished
      if (data.datePublished && data.dateModified) {
        const published = new Date(data.datePublished as string)
        const modified = new Date(data.dateModified as string)
        if (!isNaN(published.getTime()) && !isNaN(modified.getTime()) && modified < published) {
          warnings.push({
            field: 'dateModified',
            message: 'Wijzigingsdatum ligt voor de publicatiedatum — controleer of dit correct is',
          })
        }
      }
      // Warn if no publisher
      if (!data.publisher) {
        warnings.push({
          field: 'publisher',
          message: 'Google raadt aan een uitgever (publisher) op te geven voor artikelen',
        })
      }
      // Warn if no image
      if (!data.image) {
        warnings.push({
          field: 'image',
          message: 'Google raadt aan een afbeelding op te geven voor artikelen',
        })
      }
      break
    }

    case 'JOB_POSTING': {
      if (data.datePosted && typeof data.datePosted === 'string') {
        const posted = new Date(data.datePosted)
        const now = new Date()
        if (!isNaN(posted.getTime()) && posted > now) {
          warnings.push({
            field: 'datePosted',
            message: 'Plaatsingsdatum ligt in de toekomst — controleer of dit correct is',
          })
        }
      }
      break
    }

    case 'LOCAL_BUSINESS': {
      // Warn if no opening hours
      if (!data.openingHours) {
        warnings.push({
          field: 'openingHours',
          message: 'Openingstijden worden sterk aanbevolen voor lokale bedrijven',
        })
      }
      // Warn if no telephone
      if (!data.telephone) {
        warnings.push({
          field: 'telephone',
          message: 'Een telefoonnummer wordt sterk aanbevolen voor lokale bedrijven',
        })
      }
      break
    }

    case 'WEB_SITE': {
      if (data.potentialAction) {
        const action = data.potentialAction as Record<string, unknown>
        if (action['@type'] !== 'SearchAction') {
          errors.push({
            field: 'potentialAction.@type',
            message: 'De potentialAction van een WebSite moet een SearchAction zijn',
          })
        }
        if (!action.target && !action['query-input']) {
          warnings.push({
            field: 'potentialAction',
            message: 'SearchAction moet een target en query-input bevatten',
          })
        }
      }
      break
    }

    default:
      break
  }
}

// ============================================================================
// Map StructuredDataType enum to schema.org @type value
// ============================================================================

function getExpectedTypeName(type: StructuredDataType): string {
  const typeMap: Record<string, string> = {
    ORGANIZATION: 'Organization',
    LOCAL_BUSINESS: 'LocalBusiness',
    PRODUCT: 'Product',
    OFFER: 'Offer',
    REVIEW: 'Review',
    BREADCRUMB_LIST: 'BreadcrumbList',
    ARTICLE: 'Article',
    FAQ_PAGE: 'FAQPage',
    HOW_TO: 'HowTo',
    PERSON: 'Person',
    EVENT: 'Event',
    JOB_POSTING: 'JobPosting',
    SERVICE: 'Service',
    WEB_SITE: 'WebSite',
    WEB_PAGE: 'WebPage',
  }
  return typeMap[type] ?? type
}
