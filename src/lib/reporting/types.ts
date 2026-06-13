// ============================================================================
// Reporting Types — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Type definitions for the Reporting module — report building, white-labeling,
// sharing, and rendering. All user-facing strings are in Dutch.
// ============================================================================

import type { ReportType, ReportStatus, ReportSectionType } from '@prisma/client';

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * A single section within a report.
 * Stored as JSON in the Report.sections field.
 */
export interface ReportSection {
  /** Unique section identifier within the report */
  id: string;
  /** The type of section (determines rendering) */
  type: ReportSectionType;
  /** Dutch title for the section */
  title: string;
  /** JSON configuration for the section (chart type, data source, columns, etc.) */
  config: string;
  /** Sort order within the report (0-based) */
  sortOrder: number;
}

/**
 * KPI card data for report sections.
 * Used as the config structure for KPI_CARDS sections.
 */
export interface KpiCardConfig {
  /** KPI metric identifier */
  metric: string;
  /** Dutch label for the KPI */
  dutchLabel: string;
  /** Data source reference */
  dataSource: string;
  /** Whether to show comparison with previous period */
  showComparison: boolean;
}

/**
 * Chart section configuration.
 * Used as the config structure for CHART sections.
 */
export interface ChartConfig {
  /** Chart type (line, bar, pie, area, etc.) */
  chartType: string;
  /** Data source reference */
  dataSource: string;
  /** Dutch x-axis label */
  xLabel: string;
  /** Dutch y-axis label */
  yLabel: string;
  /** Whether to show comparison with previous period */
  showComparison: boolean;
}

/**
 * Table section configuration.
 * Used as the config structure for TABLE sections.
 */
export interface TableConfig {
  /** Data source reference */
  dataSource: string;
  /** Column definitions */
  columns: TableColumn[];
  /** Maximum rows to display */
  maxRows: number;
}

/**
 * A column definition for a table section.
 */
export interface TableColumn {
  /** Column key matching the data field */
  key: string;
  /** Dutch column header */
  dutchLabel: string;
  /** Column alignment */
  align: 'left' | 'center' | 'right';
}

/**
 * Configuration for creating a new report.
 */
export interface ReportCreateConfig {
  /** Report type */
  type: ReportType;
  /** Dutch title */
  title?: string;
  /** Dutch description */
  description?: string;
  /** Report start date */
  startDate?: Date;
  /** Report end date */
  endDate?: Date;
  /** Comparison period start date */
  comparisonStartDate?: Date;
  /** Comparison period end date */
  comparisonEndDate?: Date;
  /** White-label profile ID */
  whiteLabelId?: string;
  /** User ID of the creator */
  createdById?: string;
}

/**
 * White-label profile data for creating/updating profiles.
 */
export interface WhiteLabelProfileData {
  /** Profile name */
  name: string;
  /** Logo URL */
  logoUrl?: string;
  /** Primary brand color (hex) */
  primaryColor?: string;
  /** Secondary brand color (hex) */
  secondaryColor?: string;
  /** Accent color (hex) */
  accentColor?: string;
  /** Font family */
  fontFamily?: string;
  /** Company name */
  companyName?: string;
  /** Company tagline */
  companyTagline?: string;
  /** Company address */
  companyAddress?: string;
  /** Company phone */
  companyPhone?: string;
  /** Company email */
  companyEmail?: string;
  /** Company website */
  companyWebsite?: string;
  /** KvK number (Dutch Chamber of Commerce) */
  companyKvk?: string;
  /** Dutch introduction text for reports */
  introductionText?: string;
  /** Dutch closing text for reports */
  closingText?: string;
  /** Dutch footer text */
  footerText?: string;
  /** Sender identity ("Van: [name]") */
  senderIdentity?: string;
  /** Whether this is the default profile */
  isDefault?: boolean;
}

/**
 * Options for creating a share link.
 */
export interface ShareLinkOptions {
  /** Optional password for accessing the report */
  password?: string;
  /** Expiry date for the share link */
  expiresAt?: Date;
}

/**
 * Result of accessing a shared report.
 */
export interface SharedReportAccess {
  /** Whether access was granted */
  granted: boolean;
  /** Reason if access was denied (Dutch) */
  reason?: string;
  /** The report data (if access was granted) */
  report?: {
    id: string;
    title: string;
    type: ReportType;
    htmlOutput: string | null;
    snapshotData: string | null;
  };
}

// ============================================================================
// Constants — Dutch Labels
// ============================================================================

/**
 * Dutch labels for each report type.
 */
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  MONTHLY: 'Maandelijks rapport',
  QUARTERLY: 'Kwartaalrapport',
  TECHNICAL_AUDIT: 'Technische audit',
  CONTENT: 'Inhoudrapport',
  KEYWORDS: 'Zoekwoordrapport',
  COMPETITORS: 'Concurrentieanalyse',
  LOCAL_SEO: 'Lokale SEO-rapport',
  GEO: 'GEO-rapport',
  WOOCOMMERCE: 'WooCommerce-rapport',
  CRO: 'CRO-rapport',
  REVENUE: 'Omzetrapport',
  EXECUTIVE: 'Uitvoerend rapport',
  HOLISTIC: 'Holistisch rapport',
  CUSTOM: 'Aangepast rapport',
};

/**
 * Dutch labels for each report status.
 */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: 'Concept',
  IN_REVIEW: 'In behandeling',
  APPROVED: 'Goedgekeurd',
  PUBLISHED: 'Gepubliceerd',
  ARCHIVED: 'Gearchiveerd',
};

/**
 * Dutch labels for each section type.
 */
export const SECTION_TYPE_LABELS: Record<ReportSectionType, string> = {
  KPI_CARDS: 'KPI-kaarten',
  CHART: 'Grafiek',
  TABLE: 'Tabel',
  TEXT: 'Tekst',
  RECOMMENDATIONS: 'Aanbevelingen',
  ROADMAP: 'Roadmap',
  PAGE_BREAK: 'Pagina-einde',
};

/**
 * Dutch labels for each report type's default description.
 */
export const REPORT_TYPE_DESCRIPTIONS: Record<ReportType, string> = {
  MONTHLY: 'Maandelijks overzicht van SEO-prestaties en aanbevelingen',
  QUARTERLY: 'Kwartaaloverzicht met trends, prestaties en strategische aanbevelingen',
  TECHNICAL_AUDIT: 'Uitgebreid rapport over technische SEO-problemen en oplossingen',
  CONTENT: 'Analyse van contentkwaliteit, -prestaties en -lacunes',
  KEYWORDS: 'Overzicht van zoekwoordprestaties en -kansen',
  COMPETITORS: 'Vergelijking met concurrenten op SEO-gebied',
  LOCAL_SEO: 'Analyse van lokale zoekprestaties en optimalisatiemogelijkheden',
  GEO: 'Rapport over Generative Engine Optimization',
  WOOCOMMERCE: 'WooCommerce-specifiek SEO- en omzetrapport',
  CRO: 'Conversieoptimalisatie-analyse en aanbevelingen',
  REVENUE: 'Overzicht van SEO-gedreven omzet en ROI',
  EXECUTIVE: 'Samenvattend rapport voor het management',
  HOLISTIC: 'Geïntegreerd rapport over alle SEO-aspecten',
  CUSTOM: 'Aangepast rapport met geselecteerde secties',
};
