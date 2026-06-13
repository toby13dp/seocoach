/**
 * Source vs Rendered Comparison
 * 
 * Compares the source HTML (from the crawler's fetch) with the rendered HTML
 * (from Playwright) to detect JavaScript rendering differences.
 */

export interface DiffResult {
  field: string;
  sourceValue: string;
  renderedValue: string;
  isSignificant: boolean;
}

export interface RenderedComparisonResult {
  textDiff: DiffResult[];
  linkDiff: DiffResult[];
  canonicalDiff: DiffResult | null;
  robotsDiff: DiffResult | null;
  structuredDataDiff: DiffResult[];
  headingDiff: DiffResult[];
  navigationDiff: DiffResult[];
  hasSignificantDiff: boolean;
  summary: string; // Dutch summary
}

/**
 * Compare two text strings and generate a simple diff
 */
function textDiff(source: string | null, rendered: string | null, fieldName: string, threshold = 0.1): DiffResult | null {
  if (source === rendered) return null;
  if (!source && !rendered) return null;
  
  const sourceNorm = (source || '').trim().toLowerCase();
  const renderedNorm = (rendered || '').trim().toLowerCase();
  
  if (sourceNorm === renderedNorm) return null;
  
  // Calculate similarity
  const maxLen = Math.max(sourceNorm.length, renderedNorm.length);
  const similarity = maxLen === 0 ? 1 : 1 - (levenshteinDistance(sourceNorm, renderedNorm) / maxLen);
  const isSignificant = similarity < (1 - threshold);
  
  return {
    field: fieldName,
    sourceValue: source || '(leeg)',
    renderedValue: rendered || '(leeg)',
    isSignificant,
  };
}

/**
 * Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Compare arrays of items and find differences
 */
function arrayDiff(
  source: string[],
  rendered: string[],
  fieldName: string,
  threshold = 0.1
): DiffResult[] {
  const results: DiffResult[] = [];
  
  const sourceSet = new Set(source.map(s => s.trim().toLowerCase()));
  const renderedSet = new Set(rendered.map(r => r.trim().toLowerCase()));
  
  // Items in rendered but not in source (added by JS)
  const added = rendered.filter(r => !sourceSet.has(r.trim().toLowerCase()));
  // Items in source but not in rendered (removed by JS)
  const removed = source.filter(s => !renderedSet.has(s.trim().toLowerCase()));
  
  if (added.length > 0) {
    results.push({
      field: `${fieldName}.added`,
      sourceValue: '(niet aanwezig)',
      renderedValue: added.join('; '),
      isSignificant: added.length > Math.max(source.length * threshold, 1),
    });
  }
  
  if (removed.length > 0) {
    results.push({
      field: `${fieldName}.removed`,
      sourceValue: removed.join('; '),
      renderedValue: '(verwijderd)',
      isSignificant: removed.length > Math.max(source.length * threshold, 1),
    });
  }
  
  return results;
}

/**
 * Compare parsed source and rendered page data
 */
export function compareSourceAndRendered(
  sourceData: {
    title?: string | null;
    description?: string | null;
    h1?: string | null;
    canonicalUrl?: string | null;
    metaRobots?: string | null;
    wordCount?: number;
    internalLinks?: string[];
    externalLinks?: string[];
    headings?: string[];
    structuredData?: string[];
    navigation?: string[];
  },
  renderedData: {
    title?: string | null;
    description?: string | null;
    h1?: string | null;
    canonicalUrl?: string | null;
    metaRobots?: string | null;
    wordCount?: number;
    internalLinks?: string[];
    externalLinks?: string[];
    headings?: string[];
    structuredData?: string[];
    navigation?: string[];
  }
): RenderedComparisonResult {
  const textDiffs: DiffResult[] = [];
  const linkDiffs: DiffResult[] = [];
  const structuredDiffs: DiffResult[] = [];
  const headingDiffs: DiffResult[] = [];
  const navDiffs: DiffResult[] = [];
  
  // Text content comparison
  const titleDiff = textDiff(sourceData.title ?? null, renderedData.title ?? null, 'title');
  if (titleDiff) textDiffs.push(titleDiff);
  
  const descDiff = textDiff(sourceData.description ?? null, renderedData.description ?? null, 'description');
  if (descDiff) textDiffs.push(descDiff);
  
  const h1Diff = textDiff(sourceData.h1 ?? null, renderedData.h1 ?? null, 'h1');
  if (h1Diff) textDiffs.push(h1Diff);
  
  // Word count comparison
  if (sourceData.wordCount !== undefined && renderedData.wordCount !== undefined) {
    const diff = Math.abs(sourceData.wordCount - renderedData.wordCount);
    const pct = sourceData.wordCount > 0 ? diff / sourceData.wordCount : (renderedData.wordCount > 0 ? 1 : 0);
    if (pct > 0.1) {
      textDiffs.push({
        field: 'wordCount',
        sourceValue: String(sourceData.wordCount),
        renderedValue: String(renderedData.wordCount),
        isSignificant: pct > 0.3,
      });
    }
  }
  
  // Link comparison
  if (sourceData.internalLinks && renderedData.internalLinks) {
    linkDiffs.push(...arrayDiff(sourceData.internalLinks, renderedData.internalLinks, 'internalLinks'));
  }
  if (sourceData.externalLinks && renderedData.externalLinks) {
    linkDiffs.push(...arrayDiff(sourceData.externalLinks, renderedData.externalLinks, 'externalLinks'));
  }
  
  // Canonical comparison
  const canonicalDiff = textDiff(sourceData.canonicalUrl ?? null, renderedData.canonicalUrl ?? null, 'canonicalUrl');
  
  // Robots comparison
  const robotsDiff = textDiff(sourceData.metaRobots ?? null, renderedData.metaRobots ?? null, 'metaRobots');
  
  // Structured data comparison
  if (sourceData.structuredData && renderedData.structuredData) {
    structuredDiffs.push(...arrayDiff(sourceData.structuredData, renderedData.structuredData, 'structuredData'));
  }
  
  // Heading comparison
  if (sourceData.headings && renderedData.headings) {
    headingDiffs.push(...arrayDiff(sourceData.headings, renderedData.headings, 'headings'));
  }
  
  // Navigation comparison
  if (sourceData.navigation && renderedData.navigation) {
    navDiffs.push(...arrayDiff(sourceData.navigation, renderedData.navigation, 'navigation'));
  }
  
  const allDiffs = [...textDiffs, ...linkDiffs, ...headingDiffs, ...structuredDiffs, ...navDiffs];
  const hasSignificantDiff = allDiffs.some(d => d.isSignificant);
  
  // Generate Dutch summary
  let summary = '';
  const significantCount = allDiffs.filter(d => d.isSignificant).length;
  const minorCount = allDiffs.filter(d => !d.isSignificant).length;
  
  if (significantCount === 0 && minorCount === 0) {
    summary = 'Geen verschillen gevonden tussen de broncode en de weergave. De pagina wordt correct weergegeven.';
  } else if (significantCount === 0) {
    summary = `${minorCount} kleine verschil(len) gevonden tussen broncode en weergave. Dit zijn kleine verschillen die waarschijnlijk geen impact hebben op SEO.`;
  } else {
    const parts: string[] = [];
    if (textDiffs.length > 0) parts.push(`${textDiffs.length} verschil(len) in tekstinhoud`);
    if (linkDiffs.length > 0) parts.push(`${linkDiffs.length} verschil(len) in verwijzingen`);
    if (headingDiffs.length > 0) parts.push(`${headingDiffs.length} verschil(len) in opschriften`);
    if (structuredDiffs.length > 0) parts.push(`${structuredDiffs.length} verschil(len) in gestructureerde gegevens`);
    if (navDiffs.length > 0) parts.push(`${navDiffs.length} verschil(len) in navigatie`);
    
    summary = `Belangrijke verschillen gevonden tussen broncode en weergave: ${parts.join(', ')}. Dit betekent dat JavaScript de pagina inhoud aanpast. Controleer of zoekmachines de juiste inhoud zien.`;
  }
  
  return {
    textDiff: textDiffs,
    linkDiff: linkDiffs,
    canonicalDiff,
    robotsDiff,
    structuredDataDiff: structuredDiffs,
    headingDiff: headingDiffs,
    navigationDiff: navDiffs,
    hasSignificantDiff,
    summary,
  };
}
