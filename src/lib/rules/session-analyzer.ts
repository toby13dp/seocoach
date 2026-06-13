// ============================================================================
// SEO Rule Engine — Session-Wide Analysis
// ============================================================================
//
// Analyzes all pages from a crawl session:
//  1. Converts Prisma Page models to PageAnalysis objects
//  2. Runs per-page rules on each page
//  3. Runs cross-page rules on the full set
//  4. Saves issues to the TechnicalIssue table
//  5. Returns summary statistics
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';
import { getRuleEngine, type RuleEngine } from './engine';
import { checkBrokenLinksCrossPage } from './rules/broken-links';
import type { PageAnalysis, TechnicalIssueResult } from './types';

// ---------------------------------------------------------------------------
// Conversion: Prisma Page → PageAnalysis
// ---------------------------------------------------------------------------

function safeParseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function pageToAnalysis(page: {
  url: string;
  statusCode: number | null;
  title: string | null;
  description: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  metaRobots: string | null;
  wordCount: number;
  internalLinkCount: number;
  externalLinkCount: number;
  imageCount: number;
  imagesWithoutAlt: number;
  structuredData: string | null;
  crawlDepth: number;
  isOrphan: boolean;
  contentType: string;
  language: string | null;
  indexability: string;
  duplicateGroup: string | null;
  similarityScore: number | null;
  redirectChain: string | null;
  loadTimeMs: number | null;
  htmlSizeBytes: number | null;
  internalLinks: string | null;
  externalLinks: string | null;
  images: string | null;
  hreflang?: string | null;
  headings?: string | null;
}): PageAnalysis {
  return {
    url: page.url,
    statusCode: page.statusCode,
    title: page.title,
    description: page.description,
    h1: page.h1,
    canonicalUrl: page.canonicalUrl,
    metaRobots: page.metaRobots,
    wordCount: page.wordCount,
    internalLinkCount: page.internalLinkCount,
    externalLinkCount: page.externalLinkCount,
    imageCount: page.imageCount,
    imagesWithoutAlt: page.imagesWithoutAlt,
    structuredData: safeParseJson<any[]>(page.structuredData, []),
    crawlDepth: page.crawlDepth,
    isOrphan: page.isOrphan,
    contentType: page.contentType,
    language: page.language,
    indexability: page.indexability,
    duplicateGroup: page.duplicateGroup,
    similarityScore: page.similarityScore,
    redirectChain: safeParseJson<string[] | null>(page.redirectChain, null),
    loadTimeMs: page.loadTimeMs,
    htmlSizeBytes: page.htmlSizeBytes,
    hreflang: safeParseJson<any[]>(page.hreflang ?? null, []),
    headings: safeParseJson<{ level: number; text: string }[] | null>(page.headings ?? null, null),
    internalLinks: safeParseJson<{ href: string; anchor: string }[] | null>(page.internalLinks, null),
    externalLinks: safeParseJson<{ href: string; anchor: string }[] | null>(page.externalLinks, null),
    images: safeParseJson<{ src: string; alt: string | null; width?: number; height?: number; sizeBytes?: number }[] | null>(page.images, null),
  };
}

// ---------------------------------------------------------------------------
// Summary statistics
// ---------------------------------------------------------------------------

export interface AnalysisSummary {
  sessionId: string;
  projectId: string;
  totalPagesAnalyzed: number;
  totalIssuesFound: number;
  issuesBySeverity: Record<string, number>;
  issuesByCategory: Record<string, number>;
  issuesByPriority: Record<string, number>;
  topAffectedUrls: { url: string; issueCount: number }[];
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

/**
 * Analyze all pages from a crawl session:
 *  1. Fetch all pages from the session
 *  2. Convert to PageAnalysis objects
 *  3. Run per-page rules
 *  4. Run cross-page rules
 *  5. Save all issues to the database
 *  6. Update the crawl session's issuesFound count
 *  7. Return the issues + summary
 */
export async function analyzeCrawlSession(
  sessionId: string,
  engine?: RuleEngine
): Promise<{ issues: TechnicalIssueResult[]; summary: AnalysisSummary }> {
  const ruleEngine = engine ?? getRuleEngine();

  // 1. Fetch the crawl session and its pages
  const session = await db.crawlSession.findUnique({
    where: { id: sessionId },
    include: { pages: true },
  });

  if (!session) {
    throw new Error(`Crawl session "${sessionId}" not found`);
  }

  // 2. Convert pages to PageAnalysis
  const analyses: PageAnalysis[] = session.pages.map(p => pageToAnalysis(p));

  // 3. Run per-page rules
  const allIssues: TechnicalIssueResult[] = [];

  for (const analysis of analyses) {
    const pageIssues = ruleEngine.runAllRules(analysis);
    allIssues.push(...pageIssues);
  }

  // 4. Run cross-page rules
  const crossPageIssues = ruleEngine.runAllCrossPageRules(analyses);
  allIssues.push(...crossPageIssues);

  // 4b. Run broken links cross-page check
  const pageUrlMap = new Map<string, number>();
  for (const page of analyses) {
    if (page.statusCode !== null) {
      pageUrlMap.set(page.url, page.statusCode);
    }
  }
  const brokenLinkIssues = checkBrokenLinksCrossPage(analyses, pageUrlMap);
  allIssues.push(...brokenLinkIssues);

  // 5. Save issues to the database
  // First, delete existing issues for this session (idempotent)
  await db.technicalIssue.deleteMany({
    where: { crawlSessionId: sessionId },
  });

  // Build a map of page URL → page ID for linking issues to pages
  const pageUrlToId = new Map<string, string>();
  for (const page of session.pages) {
    pageUrlToId.set(page.url, page.id);
  }

  // Insert issues in batches (SQLite has a limit on variables)
  const BATCH_SIZE = 50;
  for (let i = 0; i < allIssues.length; i += BATCH_SIZE) {
    const batch = allIssues.slice(i, i + BATCH_SIZE);

    await db.$transaction(
      batch.map(issue => {
        // Find the page ID for the first affected URL
        const pageId = issue.affectedUrls.length > 0
          ? pageUrlToId.get(issue.affectedUrls[0]) ?? null
          : null;

        return db.technicalIssue.create({
          data: {
            projectId: session.projectId,
            pageId: pageId,
            crawlSessionId: sessionId,
            ruleId: issue.ruleId,
            ruleName: issue.ruleName,
            dutchExplanation: issue.dutchExplanation,
            technicalDetails: issue.technicalDetails ?? null,
            evidence: JSON.stringify(issue.evidence),
            severity: issue.severity as any,
            priority: issue.priority as any,
            impact: issue.impact ?? null,
            effort: issue.effort as any,
            affectedUrls: JSON.stringify(issue.affectedUrls),
            recommendedAction: issue.recommendedAction ?? null,
            autoFixAvailable: issue.autoFixAvailable,
            confidence: issue.confidence,
          },
        });
      })
    );
  }

  // 6. Update the crawl session's issuesFound count
  await db.crawlSession.update({
    where: { id: sessionId },
    data: { issuesFound: allIssues.length },
  });

  // 7. Build summary
  const issuesBySeverity: Record<string, number> = {};
  const issuesByCategory: Record<string, number> = {};
  const issuesByPriority: Record<string, number> = {};
  const urlIssueCounts: Record<string, number> = {};

  for (const issue of allIssues) {
    issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] ?? 0) + 1;
    issuesByPriority[issue.priority] = (issuesByPriority[issue.priority] ?? 0) + 1;

    const category = ruleEngine.getRuleDefinition(issue.ruleId)?.category ?? 'unknown';
    issuesByCategory[category] = (issuesByCategory[category] ?? 0) + 1;

    for (const url of issue.affectedUrls) {
      urlIssueCounts[url] = (urlIssueCounts[url] ?? 0) + 1;
    }
  }

  const topAffectedUrls = Object.entries(urlIssueCounts)
    .map(([url, issueCount]) => ({ url, issueCount }))
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 20);

  const summary: AnalysisSummary = {
    sessionId,
    projectId: session.projectId,
    totalPagesAnalyzed: analyses.length,
    totalIssuesFound: allIssues.length,
    issuesBySeverity,
    issuesByCategory,
    issuesByPriority,
    topAffectedUrls,
  };

  return { issues: allIssues, summary };
}

/**
 * Get the issues that have already been saved for a crawl session.
 */
export async function getSessionIssues(
  sessionId: string
): Promise<TechnicalIssueResult[]> {
  const dbIssues = await db.technicalIssue.findMany({
    where: { crawlSessionId: sessionId, dismissed: false },
    orderBy: [
      { severity: 'desc' },
      { priority: 'desc' },
    ],
  });

  return dbIssues.map(issue => ({
    ruleId: issue.ruleId,
    ruleName: issue.ruleName,
    dutchExplanation: issue.dutchExplanation,
    technicalDetails: issue.technicalDetails ?? undefined,
    evidence: safeParseJson(issue.evidence, []),
    severity: issue.severity as TechnicalIssueResult['severity'],
    priority: issue.priority as TechnicalIssueResult['priority'],
    impact: issue.impact ?? '',
    effort: issue.effort as TechnicalIssueResult['effort'],
    affectedUrls: safeParseJson(issue.affectedUrls, []),
    recommendedAction: issue.recommendedAction ?? '',
    autoFixAvailable: issue.autoFixAvailable,
    confidence: issue.confidence,
  }));
}

/**
 * Get a summary for an already-analyzed session.
 */
export async function getSessionSummary(
  sessionId: string
): Promise<AnalysisSummary | null> {
  const session = await db.crawlSession.findUnique({
    where: { id: sessionId },
    include: {
      _count: { select: { pages: true, issues: true } },
    },
  });

  if (!session) return null;

  const issues = await db.technicalIssue.findMany({
    where: { crawlSessionId: sessionId, dismissed: false },
    select: {
      ruleId: true,
      severity: true,
      priority: true,
      affectedUrls: true,
    },
  });

  const ruleEngine = getRuleEngine();
  const issuesBySeverity: Record<string, number> = {};
  const issuesByCategory: Record<string, number> = {};
  const issuesByPriority: Record<string, number> = {};
  const urlIssueCounts: Record<string, number> = {};

  for (const issue of issues) {
    issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] ?? 0) + 1;
    issuesByPriority[issue.priority] = (issuesByPriority[issue.priority] ?? 0) + 1;

    const category = ruleEngine.getRuleDefinition(issue.ruleId)?.category ?? 'unknown';
    issuesByCategory[category] = (issuesByCategory[category] ?? 0) + 1;

    const urls = safeParseJson<string[]>(issue.affectedUrls, []);
    for (const url of urls) {
      urlIssueCounts[url] = (urlIssueCounts[url] ?? 0) + 1;
    }
  }

  const topAffectedUrls = Object.entries(urlIssueCounts)
    .map(([url, issueCount]) => ({ url, issueCount }))
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 20);

  return {
    sessionId,
    projectId: session.projectId,
    totalPagesAnalyzed: session._count.pages,
    totalIssuesFound: session._count.issues,
    issuesBySeverity,
    issuesByCategory,
    issuesByPriority,
    topAffectedUrls,
  };
}
