// ============================================================================
// Report Renderer — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Renders reports to HTML and self-contained printable HTML (for PDF export).
// Applies white-label branding, formats dates/numbers in Dutch locale,
// and generates professional print-ready layouts.
//
// IMPORTANT: Since Puppeteer is not available in this project, PDF
// generation is handled by producing a self-contained HTML file with
// proper print CSS that can be printed to PDF via the browser.
// ============================================================================

import { db } from '@/lib/db';
import type { ReportSection } from './types';
import { SECTION_TYPE_LABELS } from './types';
import { applyWhiteLabeling } from './white-label';

// ============================================================================
// Dutch Formatting Helpers
// ============================================================================

/**
 * Format a Date in Dutch locale format (e.g. "12 maart 2025").
 */
function formatDutchDate(date: Date): string {
  const months = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Format a number with Dutch locale conventions (period for thousands, comma for decimals).
 */
function formatDutchNumber(value: number, decimals: number = 0): string {
  return value.toLocaleString('nl-NL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a percentage in Dutch locale.
 */
function formatDutchPercentage(value: number, decimals: number = 1): string {
  return `${formatDutchNumber(value, decimals)}%`;
}

/**
 * Format a currency value in EUR with Dutch conventions.
 */
function formatDutchCurrency(value: number): string {
  return value.toLocaleString('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  });
}

// ============================================================================
// Section Renderers
// ============================================================================

/**
 * Render a single report section to HTML based on its type and data.
 *
 * Each section type has its own rendering logic:
 * - KPI_CARDS: Grid of metric cards with comparison indicators
 * - CHART: Placeholder for chart (with data attributes for client-side rendering)
 * - TABLE: HTML table with columns and rows
 * - TEXT: Rich text content
 * - RECOMMENDATIONS: List of actionable recommendations
 * - ROADMAP: Roadmap items in a structured list
 * - PAGE_BREAK: CSS page break
 *
 * @param section - The section definition
 * @param data - The snapshot data for this section's data source
 * @returns HTML string for the section
 */
export function renderSection(
  section: ReportSection,
  data: unknown,
): string {
  const sectionLabel = SECTION_TYPE_LABELS[section.type] || section.type;

  switch (section.type) {
    case 'KPI_CARDS':
      return renderKpiCards(section, data);
    case 'CHART':
      return renderChart(section, data);
    case 'TABLE':
      return renderTable(section, data);
    case 'TEXT':
      return renderText(section, data);
    case 'RECOMMENDATIONS':
      return renderRecommendations(section, data);
    case 'ROADMAP':
      return renderRoadmap(section, data);
    case 'PAGE_BREAK':
      return '<div style="page-break-after:always;"></div>';
    default:
      return `
        <div class="section" style="margin-bottom:24px;">
          <h2 class="section-title" style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(section.title || sectionLabel)}</h2>
          <p style="color:#9ca3af;font-style:italic;">Sectietype "${escapeHtml(section.type)}" wordt nog niet ondersteund.</p>
        </div>
      `;
  }
}

/**
 * Render KPI cards section.
 */
function renderKpiCards(section: ReportSection, data: unknown): string {
  let config: { metrics?: Array<{ metric: string; dutchLabel: string; dataSource: string }>; showComparison?: boolean } = {};
  try {
    config = JSON.parse(section.config);
  } catch {
    // Use empty config
  }

  const metrics = config.metrics || [];

  if (!data || !Array.isArray(metrics) || metrics.length === 0) {
    return `
      <div class="section" style="margin-bottom:24px;">
        <h2 class="section-title" style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(section.title)}</h2>
        <div style="padding:20px;background:#f9fafb;border-radius:8px;text-align:center;color:#9ca3af;">
          Nog geen KPI-gegevens beschikbaar. Verbind een gegevensbron om KPI's te tonen.
        </div>
      </div>
    `;
  }

  const cards = metrics.map((metric) => {
    // Extract metric value from data if available
    const value = extractMetricValue(data, metric.metric);
    const displayValue = value !== null
      ? formatMetricValue(value, metric.metric)
      : '—';

    return `
      <div class="kpi-card" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;border-left:4px solid var(--wl-primary, #059669);">
        <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${escapeHtml(metric.dutchLabel)}</div>
        <div style="font-size:24px;font-weight:700;color:#111827;">${displayValue}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="section" style="margin-bottom:24px;">
      <h2 class="section-title" style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(section.title)}</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
        ${cards}
      </div>
    </div>
  `;
}

/**
 * Render chart section as a placeholder with data attributes.
 * Client-side JavaScript will render the actual chart.
 */
function renderChart(section: ReportSection, data: unknown): string {
  let config: { chartType?: string; xLabel?: string; yLabel?: string } = {};
  try {
    config = JSON.parse(section.config);
  } catch {
    // Use empty config
  }

  const hasData = data !== null && data !== undefined;

  return `
    <div class="section" style="margin-bottom:24px;">
      <h2 class="section-title" style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(section.title)}</h2>
      <div class="chart-container" data-chart-type="${escapeHtml(config.chartType || 'line')}" data-x-label="${escapeHtml(config.xLabel || '')}" data-y-label="${escapeHtml(config.yLabel || '')}" style="min-height:250px;background:${hasData ? '#f9fafb' : '#ffffff'};border:1px solid #e5e7eb;border-radius:8px;padding:16px;display:flex;align-items:center;justify-content:center;">
        ${hasData
          ? `<span style="color:#6b7280;">Grafiek wordt weergegeven bij interactieve weergave</span>`
          : `<span style="color:#9ca3af;">Nog geen grafiekgegevens beschikbaar</span>`
        }
      </div>
    </div>
  `;
}

/**
 * Render table section with data rows.
 */
function renderTable(section: ReportSection, data: unknown): string {
  let config: { columns?: Array<{ key: string; dutchLabel: string; align: string }>; maxRows?: number } = {};
  try {
    config = JSON.parse(section.config);
  } catch {
    // Use empty config
  }

  const columns = config.columns || [];
  const maxRows = config.maxRows || 20;

  if (!columns.length) {
    return `
      <div class="section" style="margin-bottom:24px;">
        <h2 class="section-title" style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(section.title)}</h2>
        <p style="color:#9ca3af;">Geen kolommen gedefinieerd voor deze tabel.</p>
      </div>
    `;
  }

  // Build table header
  const headerCells = columns.map((col) =>
    `<th style="padding:8px 12px;text-align:${col.align || 'left'};font-weight:600;font-size:13px;color:#374151;border-bottom:2px solid #e5e7eb;">${escapeHtml(col.dutchLabel)}</th>`
  ).join('');

  // Build table rows from data
  let rows = '';
  if (Array.isArray(data) && data.length > 0) {
    const limitedData = data.slice(0, maxRows);
    rows = limitedData.map((row: Record<string, unknown>) => {
      const cells = columns.map((col) => {
        const rawValue = row[col.key];
        const displayValue = formatCellValue(rawValue, col.key);
        return `<td style="padding:8px 12px;text-align:${col.align || 'left'};font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">${displayValue}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
  } else {
    rows = `<tr><td colspan="${columns.length}" style="padding:20px;text-align:center;color:#9ca3af;">Geen gegevens beschikbaar</td></tr>`;
  }

  return `
    <div class="section" style="margin-bottom:24px;">
      <h2 class="section-title" style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(section.title)}</h2>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Render text section.
 */
function renderText(section: ReportSection, data: unknown): string {
  let config: { content?: string; source?: string } = {};
  try {
    config = JSON.parse(section.config);
  } catch {
    // Use empty config
  }

  const content = config.content || (typeof data === 'string' ? data : '');

  return `
    <div class="section" style="margin-bottom:24px;">
      ${section.title ? `<h2 class="section-title" style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(section.title)}</h2>` : ''}
      <div style="font-size:14px;line-height:1.7;color:#374151;">
        ${content ? escapeHtml(content).replace(/\n/g, '<br/>') : '<em style="color:#9ca3af;">Geen tekstinhoud beschikbaar</em>'}
      </div>
    </div>
  `;
}

/**
 * Render recommendations section.
 */
function renderRecommendations(section: ReportSection, data: unknown): string {
  let config: { maxItems?: number } = {};
  try {
    config = JSON.parse(section.config);
  } catch {
    // Use empty config
  }

  const maxItems = config.maxItems || 10;

  if (!Array.isArray(data) || data.length === 0) {
    return `
      <div class="section" style="margin-bottom:24px;">
        <h2 class="section-title" style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(section.title)}</h2>
        <div style="padding:20px;background:#f9fafb;border-radius:8px;text-align:center;color:#9ca3af;">
          Nog geen aanbevelingen beschikbaar. Genereer eerst een roadmap.
        </div>
      </div>
    `;
  }

  const items = data.slice(0, maxItems);
  const listItems = items.map((item: Record<string, unknown>) => {
    const title = String(item.title || item.recommendation || item.dutchExplanation || 'Onbekend');
    const priority = String(item.priority || 'MEDIUM');
    const recommendation = item.recommendation ? String(item.recommendation) : null;
    const impact = item.impact ? String(item.impact) : null;

    const priorityColors: Record<string, string> = {
      CRITICAL: '#dc2626',
      HIGH: '#f59e0b',
      MEDIUM: '#059669',
      LOW: '#9ca3af',
    };
    const priorityDutch: Record<string, string> = {
      CRITICAL: 'Kritiek',
      HIGH: 'Hoog',
      MEDIUM: 'Gemiddeld',
      LOW: 'Laag',
    };

    return `
      <div class="recommendation-item" style="margin-bottom:12px;padding:12px 16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;border-left:3px solid ${priorityColors[priority] || '#059669'};">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;color:white;background:${priorityColors[priority] || '#059669'};">${priorityDutch[priority] || priority}</span>
          <strong style="font-size:14px;color:#111827;">${escapeHtml(title)}</strong>
        </div>
        ${recommendation ? `<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;">${escapeHtml(recommendation)}</p>` : ''}
        ${impact ? `<p style="font-size:12px;color:#9ca3af;margin:4px 0 0 0;"><em>Impact:</em> ${escapeHtml(impact)}</p>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="section" style="margin-bottom:24px;">
      <h2 class="section-title" style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(section.title)}</h2>
      ${listItems}
    </div>
  `;
}

/**
 * Render roadmap section.
 */
function renderRoadmap(section: ReportSection, data: unknown): string {
  let config: { view?: string } = {};
  try {
    config = JSON.parse(section.config);
  } catch {
    // Use empty config
  }

  if (!Array.isArray(data) || data.length === 0) {
    return `
      <div class="section" style="margin-bottom:24px;">
        <h2 class="section-title" style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(section.title)}</h2>
        <div style="padding:20px;background:#f9fafb;border-radius:8px;text-align:center;color:#9ca3af;">
          Nog geen roadmap-items beschikbaar.
        </div>
      </div>
    `;
  }

  // Group by view
  const byView: Record<string, Array<Record<string, unknown>>> = {};
  for (const item of data) {
    const view = String(item.view || 'LATER');
    if (!byView[view]) byView[view] = [];
    byView[view].push(item);
  }

  const viewLabels: Record<string, string> = {
    TODAY: 'Vandaag',
    THIS_WEEK: 'Deze week',
    THIS_MONTH: 'Deze maand',
    NINETY_DAYS: '90 dagen',
    LATER: 'Later',
  };

  // If config specifies a view, only show that view
  const targetView = config.view;
  const views = targetView ? [targetView] : Object.keys(byView);

  const viewSections = views
    .filter((v) => byView[v])
    .map((view) => {
      const items = byView[view];
      const itemHtml = items.map((item) => {
        const title = String(item.title || 'Onbekend');
        const priority = String(item.priority || 'MEDIUM');
        const status = String(item.status || 'PENDING');

        const statusLabels: Record<string, string> = {
          PENDING: 'Openstaand',
          IN_PROGRESS: 'In uitvoering',
          COMPLETED: 'Voltooid',
          SKIPPED: 'Overgeslagen',
        };
        const priorityColors: Record<string, string> = {
          CRITICAL: '#dc2626',
          HIGH: '#f59e0b',
          MEDIUM: '#059669',
          LOW: '#9ca3af',
        };

        return `
          <div style="padding:8px 12px;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${priorityColors[priority] || '#059669'};flex-shrink:0;"></span>
            <span style="font-size:14px;color:#111827;flex:1;">${escapeHtml(title)}</span>
            <span style="font-size:11px;color:#9ca3af;">${statusLabels[status] || status}</span>
          </div>
        `;
      }).join('');

      return `
        <div style="margin-bottom:16px;">
          <h3 style="font-size:15px;font-weight:600;color:#374151;margin-bottom:8px;">${viewLabels[view] || view} (${items.length})</h3>
          ${itemHtml}
        </div>
      `;
    }).join('');

  return `
    <div class="section" style="margin-bottom:24px;">
      <h2 class="section-title" style="font-size:18px;font-weight:600;margin-bottom:12px;">${escapeHtml(section.title)}</h2>
      ${viewSections}
    </div>
  `;
}

// ============================================================================
// Full Report Rendering
// ============================================================================

/**
 * Render a complete report to HTML.
 *
 * Uses the report's snapshot data if available (frozen data), otherwise
 * falls back to live data. Applies white-label branding if a profile
 * is attached.
 *
 * Dutch formatting is applied for dates, numbers, and currency.
 *
 * @param reportId - The report ID to render
 * @returns Complete HTML string for the report
 */
export async function renderReportToHTML(reportId: string): Promise<string> {
  const report = await db.report.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new Error(`Rapport niet gevonden: ${reportId}`);
  }

  // Parse sections
  const sections: ReportSection[] = JSON.parse(report.sections);

  // Parse snapshot data (or use empty object)
  let snapshotData: Record<string, unknown> = {};
  if (report.snapshotData) {
    try {
      snapshotData = JSON.parse(report.snapshotData);
    } catch {
      snapshotData = {};
    }
  }

  // Get white-label profile if attached
  let profile: Parameters<typeof applyWhiteLabeling>[1] = null;
  if (report.whiteLabelId) {
    profile = await db.whiteLabelProfile.findUnique({
      where: { id: report.whiteLabelId },
    });
  }

  // Render each section
  const sectionsHtml = sections
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => {
      // Get the data source for this section
      let dataSource: string | undefined;
      try {
        const config = JSON.parse(section.config);
        dataSource = config.dataSource || config.source;
      } catch {
        // No data source
      }

      // Look up data from snapshot (never fabricate)
      const sectionData = dataSource ? (snapshotData[dataSource] ?? null) : null;

      return renderSection(section, sectionData);
    })
    .join('\n');

  // Build report metadata header
  const dateRange = `
    <div style="margin-bottom:20px;font-size:14px;color:#6b7280;">
      Periode: ${formatDutchDate(report.startDate)} — ${formatDutchDate(report.endDate)}
    </div>
  `;

  // Assemble full report body
  const reportBody = `
    <div class="report-header-info">
      <h1 style="font-size:24px;font-weight:700;color:#111827;margin-bottom:4px;">${escapeHtml(report.title)}</h1>
      ${report.description ? `<p style="font-size:15px;color:#6b7280;margin-bottom:0;">${escapeHtml(report.description)}</p>` : ''}
      ${dateRange}
      ${report.snapshotGeneratedAt
        ? `<p style="font-size:12px;color:#9ca3af;">Gegevens vastgelegd op: ${formatDutchDate(new Date(report.snapshotGeneratedAt))}</p>`
        : ''
      }
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    ${sectionsHtml}
  `;

  // Apply white-label branding
  const brandedHtml = applyWhiteLabeling(reportBody, profile);

  // Wrap in full HTML document with print CSS
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    /* Base styles */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, system-ui, -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #111827;
      background: #ffffff;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    a { color: #059669; text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Print styles */
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      .section { page-break-inside: avoid; }
      .kpi-card { break-inside: avoid; }
    }

    /* Screen-only styles */
    @media screen {
      body {
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        margin: 40px auto;
        border-radius: 8px;
      }
    }
  </style>
</head>
<body>
  ${brandedHtml}
</body>
</html>`;
}

/**
 * Render a report to a self-contained HTML file suitable for PDF printing.
 *
 * Since Puppeteer is not available in this project, we generate a complete
 * HTML file with embedded print styles. The user can open this in a browser
 * and use "Print to PDF" to create a PDF.
 *
 * The HTML includes:
 * - All CSS inlined/embedded
 * - Print-friendly styles with page breaks
 * - Proper Dutch formatting
 * - White-label branding if attached
 *
 * @param reportId - The report ID to render
 * @returns Object with htmlContent and a note about PDF generation
 */
export async function renderReportToPDF(
  reportId: string,
): Promise<{ htmlContent: string; note: string }> {
  const html = await renderReportToHTML(reportId);

  return {
    htmlContent: html,
    note: 'Open dit HTML-bestand in een browser en gebruik "Afdrukken naar PDF" om een PDF te genereren. De pagina-indeling is geoptimaliseerd voor afdrukken.',
  };
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extract a metric value from snapshot data.
 * Tries common data structures (object with metric key, array of objects, etc.)
 */
function extractMetricValue(data: unknown, metric: string): number | string | null {
  if (data === null || data === undefined) return null;

  // If data is an object with the metric as a key
  if (typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (obj[metric] !== undefined) {
      const val = obj[metric];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return val;
    }
    // Try nested structures
    if (obj.summary && typeof obj.summary === 'object') {
      const summary = obj.summary as Record<string, unknown>;
      if (summary[metric] !== undefined) {
        const val = summary[metric];
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return val;
      }
    }
  }

  // If data is an array, look for the metric in the first item
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown>;
    if (first[metric] !== undefined) {
      const val = first[metric];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return val;
    }
  }

  return null;
}

/**
 * Format a metric value based on the metric type.
 */
function formatMetricValue(value: number | string, metric: string): string {
  if (typeof value === 'string') return value;

  // Choose formatting based on metric name
  if (metric === 'ctr') return formatDutchPercentage(value);
  if (metric === 'position' || metric === 'currentRanking') return formatDutchNumber(value, 1);
  if (metric === 'cpc') return formatDutchCurrency(value);
  if (metric === 'decayPercentage') return formatDutchPercentage(value);
  if (metric === 'totalScore' || metric === 'opportunityScore') return formatDutchNumber(value, 0);
  if (metric === 'difficulty') return formatDutchNumber(value, 0);
  if (metric === 'health_score' || metric === 'confidence') return formatDutchPercentage(value);
  if (metric.includes('clicks') || metric.includes('impressions') || metric.includes('volume')) {
    return formatDutchNumber(value, 0);
  }

  // Default: format as number
  return formatDutchNumber(value, 0);
}

/**
 * Format a cell value for table display.
 */
function formatCellValue(value: unknown, key: string): string {
  if (value === null || value === undefined) return '—';

  if (typeof value === 'number') {
    return formatMetricValue(value, key);
  }

  if (typeof value === 'boolean') {
    return value ? 'Ja' : 'Nee';
  }

  if (value instanceof Date) {
    return formatDutchDate(value);
  }

  if (typeof value === 'object') {
    // JSON objects — show a summary
    try {
      return JSON.stringify(value).substring(0, 100);
    } catch {
      return '—';
    }
  }

  return escapeHtml(String(value));
}
