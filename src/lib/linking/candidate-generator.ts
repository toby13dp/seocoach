// ============================================================================
// Link Candidate Generator — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Generates internal link candidates using five strategies:
//   1. SEMANTIC — AI-driven semantic relationship detection
//   2. TOPIC_CLUSTER — Links pages within the same topic cluster
//   3. ORPHAN_PAGE — Suggests links to pages with no incoming links
//   4. STRONG_PAGE — Links from high-authority pages to related newer pages
//   5. BROKEN_REPLACEMENT — Suggests replacement targets for broken links
//
// All user-facing strings and recommendations are in Dutch.
// Approval-first: no link is published without explicit approval.
// ============================================================================

import { db } from '@/lib/db';
import { providerManager } from '@/lib/ai/provider-manager';
import type {
  LinkCandidate,
  LinkStrategy,
  CannibalizationWarning,
  PageLinkProfile,
  CandidateGenerationResult,
} from './types';
import { generateAnchorVariations } from './anchor-variation';

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Generate link candidates for a project using all available strategies.
 *
 * Fetches the latest crawl data, topic clusters, and technical issues,
 * then runs each strategy to produce candidates. Candidates are saved
 * to the InternalLink table in the database.
 *
 * @param projectId - The project to generate candidates for
 * @returns Summary of the generation results including counts and warnings
 */
export async function generateLinkCandidates(
  projectId: string
): Promise<CandidateGenerationResult> {
  // 1. Fetch pages from the latest completed crawl
  const pages = await fetchLatestCrawlPages(projectId);
  if (pages.length < 2) {
    return {
      totalCandidates: 0,
      byStrategy: {
        SEMANTIC: 0,
        TOPIC_CLUSTER: 0,
        ORPHAN_PAGE: 0,
        STRONG_PAGE: 0,
        BROKEN_REPLACEMENT: 0,
      },
      cannibalizationWarnings: [],
      summary: 'Niet genoeg pagina\'s gevonden om interne links te suggereren. Zorg ervoor dat er minstens twee gecrawlde pagina\'s beschikbaar zijn.',
    };
  }

  // 2. Build page link profiles
  const profiles = await buildPageLinkProfiles(projectId, pages);

  // 3. Detect existing links for deduplication
  const existingLinks = await fetchExistingLinks(projectId);

  // 4. Fetch topic clusters and their pages
  const clusterPageMap = await fetchTopicClusterMap(projectId);

  // 5. Fetch broken links from technical issues
  const brokenLinks = await fetchBrokenLinks(projectId);

  // 6. Run all strategies
  const allCandidates: LinkCandidate[] = [];
  const strategyCounts: Record<LinkStrategy, number> = {
    SEMANTIC: 0,
    TOPIC_CLUSTER: 0,
    ORPHAN_PAGE: 0,
    STRONG_PAGE: 0,
    BROKEN_REPLACEMENT: 0,
  };

  // SEMANTIC strategy
  const semanticCandidates = await generateSemanticCandidates(projectId, profiles, existingLinks);
  for (const c of semanticCandidates) {
    allCandidates.push(c);
    strategyCounts.SEMANTIC++;
  }

  // TOPIC_CLUSTER strategy
  const clusterCandidates = generateTopicClusterCandidates(profiles, clusterPageMap, existingLinks);
  for (const c of clusterCandidates) {
    allCandidates.push(c);
    strategyCounts.TOPIC_CLUSTER++;
  }

  // ORPHAN_PAGE strategy
  const orphanCandidates = generateOrphanPageCandidates(profiles, existingLinks);
  for (const c of orphanCandidates) {
    allCandidates.push(c);
    strategyCounts.ORPHAN_PAGE++;
  }

  // STRONG_PAGE strategy
  const strongCandidates = generateStrongPageCandidates(profiles, existingLinks);
  for (const c of strongCandidates) {
    allCandidates.push(c);
    strategyCounts.STRONG_PAGE++;
  }

  // BROKEN_REPLACEMENT strategy
  const brokenCandidates = generateBrokenReplacementCandidates(profiles, brokenLinks, existingLinks);
  for (const c of brokenCandidates) {
    allCandidates.push(c);
    strategyCounts.BROKEN_REPLACEMENT++;
  }

  // 7. Deduplicate candidates (same source-target pair)
  const deduped = deduplicateCandidates(allCandidates);

  // 8. Check for cannibalization
  const cannibalizationWarnings = detectCannibalization(profiles, deduped);

  // 9. Adjust confidence for cannibalization warnings
  const adjustedCandidates = adjustConfidenceForCannibalization(deduped, cannibalizationWarnings);

  // 10. Save candidates to database
  const savedCandidates = await saveCandidatesToDatabase(adjustedCandidates);

  // Build summary
  const totalSaved = savedCandidates.length;
  const warningCount = cannibalizationWarnings.length;
  const summary = `Er zijn ${totalSaved} interne link-suggesties gegenereerd over ${pages.length} pagina's. ` +
    `Strategieën: semantisch (${strategyCounts.SEMANTIC}), topic cluster (${strategyCounts.TOPIC_CLUSTER}), ` +
    `weespagina (${strategyCounts.ORPHAN_PAGE}), sterke pagina (${strategyCounts.STRONG_PAGE}), ` +
    `gebroken vervanging (${strategyCounts.BROKEN_REPLACEMENT}). ` +
    (warningCount > 0
      ? `Er zijn ${warningCount} kannibalisatie-waarschuwingen gevonden.`
      : 'Geen kannibalisatie-waarschuwingen gevonden.');

  return {
    totalCandidates: totalSaved,
    byStrategy: strategyCounts,
    cannibalizationWarnings,
    summary,
  };
}

// ============================================================================
// Data Fetching Helpers
// ============================================================================

/**
 * Fetch pages from the latest completed crawl session for a project.
 */
async function fetchLatestCrawlPages(projectId: string): Promise<Array<{
  id: string;
  url: string;
  normalizedUrl: string;
  title: string | null;
  description: string | null;
  h1: string | null;
  wordCount: number;
  internalLinkCount: number;
  externalLinkCount: number;
  isOrphan: boolean;
  mainContent: string | null;
  internalLinks: string | null;
  projectId: string;
}>> {
  // Find the latest completed crawl session
  const latestSession = await db.crawlSession.findFirst({
    where: {
      projectId,
      status: 'COMPLETED',
    },
    orderBy: { completedAt: 'desc' },
  });

  if (!latestSession) {
    return [];
  }

  // Fetch all pages from this session
  const pages = await db.page.findMany({
    where: {
      crawlSessionId: latestSession.id,
      deletedAt: null,
      status: 'OK',
    },
    select: {
      id: true,
      url: true,
      normalizedUrl: true,
      title: true,
      description: true,
      h1: true,
      wordCount: true,
      internalLinkCount: true,
      externalLinkCount: true,
      isOrphan: true,
      mainContent: true,
      internalLinks: true,
      projectId: true,
    },
  });

  return pages;
}

/**
 * Build detailed link profiles for each page.
 * Enriches page data with keyword targeting and topic cluster membership.
 */
async function buildPageLinkProfiles(
  projectId: string,
  pages: Array<{
    id: string;
    url: string;
    normalizedUrl: string;
    title: string | null;
    description: string | null;
    h1: string | null;
    wordCount: number;
    internalLinkCount: number;
    externalLinkCount: number;
    isOrphan: boolean;
    mainContent: string | null;
    internalLinks: string | null;
    projectId: string;
  }>
): Promise<PageLinkProfile[]> {
  // Fetch keyword-page relationships for the project
  const keywordPages = await db.keywordPage.findMany({
    where: {
      keyword: {
        projectId,
        deletedAt: null,
      },
      page: {
        projectId,
      },
    },
    select: {
      pageId: true,
      relevance: true,
      keyword: {
        select: {
          keyword: true,
        },
      },
    },
    orderBy: {
      relevance: 'desc',
    },
  });

  // Map pageId → primary keyword (highest relevance)
  const pageKeywordMap = new Map<string, string>();
  for (const kp of keywordPages) {
    if (!pageKeywordMap.has(kp.pageId)) {
      pageKeywordMap.set(kp.pageId, kp.keyword.keyword);
    }
  }

  // Fetch topic assignments for pages
  const topics = await db.topic.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      clusterId: true,
      isPillar: true,
      pillarPageId: true,
    },
  });

  // Build a map of pillarPageId → clusterId
  const pageClusterMap = new Map<string, { clusterId: string | null; isPillar: boolean }>();
  for (const topic of topics) {
    if (topic.pillarPageId) {
      pageClusterMap.set(topic.pillarPageId, {
        clusterId: topic.clusterId,
        isPillar: topic.isPillar,
      });
    }
  }

  // Build initial profiles (without incoming link counts)
  const initialProfiles: PageLinkProfile[] = pages.map((page) => {
    // Parse existing outgoing URLs from the internalLinks JSON field
    let existingOutgoingUrls: string[] = [];
    if (page.internalLinks) {
      try {
        const parsed = JSON.parse(page.internalLinks) as unknown;
        if (Array.isArray(parsed)) {
          existingOutgoingUrls = parsed.filter((u): u is string => typeof u === 'string');
        }
      } catch {
        // Invalid JSON, treat as no known outgoing links
        existingOutgoingUrls = [];
      }
    }

    // Build snippet from description, h1, or title
    const snippet = page.description ?? page.h1 ?? page.title ?? null;
    const clusterInfo = pageClusterMap.get(page.id);

    return {
      pageId: page.id,
      url: page.url,
      normalizedUrl: page.normalizedUrl,
      title: page.title,
      snippet,
      primaryKeyword: pageKeywordMap.get(page.id) ?? null,
      incomingLinks: 0, // Will be computed below
      outgoingLinks: page.internalLinkCount,
      wordCount: page.wordCount,
      isOrphan: page.isOrphan,
      clusterId: clusterInfo?.clusterId ?? null,
      isPillar: clusterInfo?.isPillar ?? false,
      existingOutgoingUrls,
      mainContent: page.mainContent,
    };
  });

  // Compute incoming links for each page by analyzing all pages' outgoing link arrays
  const normalizedUrlToId = new Map<string, string>();
  for (const p of initialProfiles) {
    normalizedUrlToId.set(p.normalizedUrl, p.pageId);
  }
  const incomingCounts = computeIncomingLinks(initialProfiles, normalizedUrlToId);

  // Apply incoming link counts to profiles
  for (const profile of initialProfiles) {
    profile.incomingLinks = incomingCounts.get(profile.pageId) ?? 0;
  }

  return initialProfiles;
}

/**
 * Count incoming links for each page by analyzing all pages' outgoing link arrays.
 * Returns a map of page normalizedUrl → incoming link count.
 */
function computeIncomingLinks(
  profiles: PageLinkProfile[],
  pageNormalizedUrls: Map<string, string> // normalizedUrl → pageId
): Map<string, number> {
  const incomingCount = new Map<string, number>();
  for (const profile of profiles) {
    incomingCount.set(profile.pageId, 0);
  }

  for (const profile of profiles) {
    for (const url of profile.existingOutgoingUrls) {
      const targetId = pageNormalizedUrls.get(url);
      if (targetId && incomingCount.has(targetId)) {
        incomingCount.set(targetId, (incomingCount.get(targetId) ?? 0) + 1);
      }
    }
  }

  return incomingCount;
}

/**
 * Fetch existing approved/published internal links from the database
 * for deduplication purposes.
 */
async function fetchExistingLinks(
  projectId: string
): Promise<Set<string>> {
  const links = await db.internalLink.findMany({
    where: {
      projectId,
      deletedAt: null,
      status: { in: ['PENDING', 'APPROVED', 'PUBLISHED'] },
    },
    select: {
      sourceUrl: true,
      targetUrl: true,
    },
  });

  const existing = new Set<string>();
  for (const link of links) {
    existing.add(`${link.sourceUrl}→${link.targetUrl}`);
  }
  return existing;
}

/**
 * Fetch the mapping of topic clusters to their member page IDs.
 * Returns a map of clusterId → array of PageLinkProfile indices.
 */
async function fetchTopicClusterMap(
  projectId: string
): Promise<Map<string, string[]>> {
  // Fetch topics with their cluster assignments
  const topics = await db.topic.findMany({
    where: {
      projectId,
      deletedAt: null,
      clusterId: { not: null },
    },
    select: {
      id: true,
      clusterId: true,
      pillarPageId: true,
      name: true,
    },
  });

  const clusterMap = new Map<string, string[]>();
  for (const topic of topics) {
    const clusterId = topic.clusterId;
    if (!clusterId) continue;

    if (!clusterMap.has(clusterId)) {
      clusterMap.set(clusterId, []);
    }
    // Use pillarPageId as the page identifier for this topic
    if (topic.pillarPageId) {
      const pages = clusterMap.get(clusterId) ?? [];
      if (!pages.includes(topic.pillarPageId)) {
        pages.push(topic.pillarPageId);
        clusterMap.set(clusterId, pages);
      }
    }
  }

  return clusterMap;
}

/**
 * Fetch broken links from TechnicalIssue data.
 * Looks for issues related to broken internal links (4xx/5xx errors).
 */
async function fetchBrokenLinks(
  projectId: string
): Promise<Array<{
  id: string;
  ruleName: string;
  affectedUrls: string[];
  evidence: string | null;
  pageId: string | null;
}>> {
  const issues = await db.technicalIssue.findMany({
    where: {
      projectId,
      dismissed: false,
      ruleName: {
        in: [
          'broken_internal_link',
          'broken_link',
          'link_404',
          'link_5xx',
          'broken_internal_links',
        ],
      },
    },
    select: {
      id: true,
      ruleName: true,
      affectedUrls: true,
      evidence: true,
      pageId: true,
    },
  });

  // Parse affected URLs from JSON
  return issues.map((issue) => ({
    id: issue.id,
    ruleName: issue.ruleName,
    affectedUrls: parseJsonArray(issue.affectedUrls),
    evidence: issue.evidence,
    pageId: issue.pageId,
  }));
}

// ============================================================================
// Strategy: SEMANTIC
// ============================================================================

/**
 * Generate link candidates based on semantic relationships between pages.
 * Uses AI to find pages where a link would be natural and helpful.
 */
async function generateSemanticCandidates(
  projectId: string,
  profiles: PageLinkProfile[],
  existingLinks: Set<string>
): Promise<LinkCandidate[]> {
  if (profiles.length < 2) {
    return [];
  }

  const candidates: LinkCandidate[] = [];

  try {
    // Build a concise page inventory for the AI prompt
    const pageInventory = profiles
      .slice(0, 50) // Limit to avoid token overflow
      .map((p, i) => {
        const keywordStr = p.primaryKeyword ? ` (keyword: "${p.primaryKeyword}")` : '';
        const snippetStr = p.snippet ? ` — "${p.snippet.slice(0, 80)}"` : '';
        return `[${i + 1}] ${p.url}${keywordStr}${snippetStr}`;
      })
      .join('\n');

    const prompt = `Je bent een SEO-expert voor de Nederlandse markt. Analyseer de volgende lijst van webpagina's en stel interne links voor tussen semantisch gerelateerde pagina's.

Regels:
- Stel alleen links voor tussen pagina's die inhoudelijk gerelateerd zijn
- Geef specifieke ankertekst in het Nederlands
- Geef een betrouwbaarheidsscore van 0.0 tot 1.0
- Maximale 10 suggesties
- Geef NIET links tussen pagina's die al naar elkaar linken

Pagina's:
${pageInventory}

Antwoord in JSON-formaat als een array:
[{"source_index": 1, "target_index": 2, "anchor_text": "voorbeeld ankertekst", "reason": "waarom deze link natuurlijk is", "confidence": 0.8}]`;

    const response = await providerManager.fallbackGenerate(projectId, {
      messages: [
        {
          role: 'system',
          content: 'Je bent een SEO-expert die interne link-suggesties genereert voor Nederlandse websites. Antwoord altijd in geldig JSON-formaat.',
        },
        { role: 'user', content: prompt },
      ],
      purpose: 'internal-linking-semantic',
      temperature: 0.3,
      maxTokens: 2048,
      jsonMode: true,
    });

    if (response.success && response.content) {
      // Parse the AI response
      const parsed = parseAIResponse(response.content);
      for (const suggestion of parsed) {
        const sourceIndex = (suggestion.source_index as number) - 1;
        const targetIndex = (suggestion.target_index as number) - 1;

        if (sourceIndex < 0 || sourceIndex >= profiles.length) continue;
        if (targetIndex < 0 || targetIndex >= profiles.length) continue;
        if (sourceIndex === targetIndex) continue;

        const source = profiles[sourceIndex];
        const target = profiles[targetIndex];
        const linkKey = `${source.url}→${target.url}`;

        // Skip if already existing
        if (existingLinks.has(linkKey)) continue;
        // Skip if source already links to target
        if (source.existingOutgoingUrls.some((u) => target.url.includes(u))) continue;

        const anchorText = typeof suggestion.anchor_text === 'string' && suggestion.anchor_text.length > 0
          ? suggestion.anchor_text
          : (target.title ?? target.url);

        const confidence = typeof suggestion.confidence === 'number'
          ? Math.max(0, Math.min(1, suggestion.confidence))
          : 0.6;

        candidates.push({
          projectId,
          sourcePageId: source.pageId,
          targetPageId: target.pageId,
          sourceUrl: source.url,
          targetUrl: target.url,
          anchorText,
          surroundingText: typeof suggestion.reason === 'string' ? suggestion.reason : null,
          strategy: 'SEMANTIC',
          confidence,
          isExisting: false,
          isBroken: false,
          replacesLinkId: null,
        });
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[LinkCandidateGenerator] Fout bij semantische kandidaatgeneratie: ${msg}`);
  }

  return candidates;
}

// ============================================================================
// Strategy: TOPIC_CLUSTER
// ============================================================================

/**
 * Generate link candidates between pages within the same topic cluster.
 * Links pages that belong to the same cluster but aren't already connected.
 */
function generateTopicClusterCandidates(
  profiles: PageLinkProfile[],
  clusterPageMap: Map<string, string[]>,
  existingLinks: Set<string>
): LinkCandidate[] {
  const candidates: LinkCandidate[] = [];

  for (const entry of Array.from(clusterPageMap.entries())) {
    const clusterId = entry[0];
    const pageIds = entry[1];
    // Find profiles for pages in this cluster
    const clusterProfiles = profiles.filter((p) =>
      pageIds.includes(p.pageId) || p.clusterId === clusterId
    );

    if (clusterProfiles.length < 2) continue;

    // Suggest links between pillar page and sub-pages, and between sub-pages
    const pillarPages = clusterProfiles.filter((p) => p.isPillar);
    const subPages = clusterProfiles.filter((p) => !p.isPillar);

    for (const pillar of pillarPages) {
      for (const sub of subPages) {
        // Link from pillar to sub-page
        const linkKey = `${pillar.url}→${sub.url}`;
        if (!existingLinks.has(linkKey) && !pillar.existingOutgoingUrls.some((u) => sub.url.includes(u))) {
          const anchorText = sub.primaryKeyword ?? sub.title ?? sub.url;
          candidates.push({
            projectId: '',
            sourcePageId: pillar.pageId,
            targetPageId: sub.pageId,
            sourceUrl: pillar.url,
            targetUrl: sub.url,
            anchorText,
            surroundingText: `Link van pijlerpagina naar sub-pagina binnen cluster`,
            strategy: 'TOPIC_CLUSTER',
            confidence: 0.8,
            isExisting: false,
            isBroken: false,
            replacesLinkId: null,
          });
        }

        // Link from sub-page to pillar page
        const reverseKey = `${sub.url}→${pillar.url}`;
        if (!existingLinks.has(reverseKey) && !sub.existingOutgoingUrls.some((u) => pillar.url.includes(u))) {
          const anchorText = pillar.primaryKeyword ?? pillar.title ?? pillar.url;
          candidates.push({
            projectId: '',
            sourcePageId: sub.pageId,
            targetPageId: pillar.pageId,
            sourceUrl: sub.url,
            targetUrl: pillar.url,
            anchorText,
            surroundingText: `Link van sub-pagina naar pijlerpagina binnen cluster`,
            strategy: 'TOPIC_CLUSTER',
            confidence: 0.75,
            isExisting: false,
            isBroken: false,
            replacesLinkId: null,
          });
        }
      }
    }

    // Also suggest links between sub-pages that are related
    for (let i = 0; i < subPages.length; i++) {
      for (let j = i + 1; j < subPages.length; j++) {
        const a = subPages[i];
        const b = subPages[j];

        // a → b
        const keyAB = `${a.url}→${b.url}`;
        if (!existingLinks.has(keyAB) && !a.existingOutgoingUrls.some((u) => b.url.includes(u))) {
          candidates.push({
            projectId: '',
            sourcePageId: a.pageId,
            targetPageId: b.pageId,
            sourceUrl: a.url,
            targetUrl: b.url,
            anchorText: b.primaryKeyword ?? b.title ?? b.url,
            surroundingText: `Gerelateerde pagina binnen hetzelfde cluster`,
            strategy: 'TOPIC_CLUSTER',
            confidence: 0.65,
            isExisting: false,
            isBroken: false,
            replacesLinkId: null,
          });
        }

        // b → a
        const keyBA = `${b.url}→${a.url}`;
        if (!existingLinks.has(keyBA) && !b.existingOutgoingUrls.some((u) => a.url.includes(u))) {
          candidates.push({
            projectId: '',
            sourcePageId: b.pageId,
            targetPageId: a.pageId,
            sourceUrl: b.url,
            targetUrl: a.url,
            anchorText: a.primaryKeyword ?? a.title ?? a.url,
            surroundingText: `Gerelateerde pagina binnen hetzelfde cluster`,
            strategy: 'TOPIC_CLUSTER',
            confidence: 0.65,
            isExisting: false,
            isBroken: false,
            replacesLinkId: null,
          });
        }
      }
    }
  }

  // projectId will be resolved during saveCandidatesToDatabase
  return candidates;
}

// ============================================================================
// Strategy: ORPHAN_PAGE
// ============================================================================

/**
 * Generate link candidates for orphan pages (pages with no internal links
 * pointing to them). Suggests links from strong, related pages.
 */
function generateOrphanPageCandidates(
  profiles: PageLinkProfile[],
  existingLinks: Set<string>
): LinkCandidate[] {
  const candidates: LinkCandidate[] = [];
  const orphanPages = profiles.filter((p) => p.isOrphan);

  if (orphanPages.length === 0) {
    return candidates;
  }

  // Use pre-computed incoming link counts from profiles
  // (already computed in buildPageLinkProfiles)

  // Find strong pages: those with the most incoming links
  const strongPages = profiles
    .filter((p) => !p.isOrphan && p.incomingLinks > 0)
    .sort((a, b) => b.incomingLinks - a.incomingLinks)
    .slice(0, 20); // Top 20 strong pages

  for (const orphan of orphanPages) {
    // Find the best source pages for this orphan
    // Prioritize pages that are thematically related (same keyword topic)
    const potentialSources = strongPages.filter((sp) => {
      // Don't link from the orphan to itself
      if (sp.pageId === orphan.pageId) return false;
      // Check if not already linked
      const linkKey = `${sp.url}→${orphan.url}`;
      if (existingLinks.has(linkKey)) return false;
      // Check if source doesn't already link to this orphan
      if (sp.existingOutgoingUrls.some((u) => orphan.url.includes(u))) return false;
      return true;
    });

    // Score potential sources by relevance
    const scoredSources = potentialSources.map((sp) => {
      let relevanceScore = 0;

      // Same cluster bonus
      if (sp.clusterId && sp.clusterId === orphan.clusterId) {
        relevanceScore += 0.3;
      }

      // Keyword overlap bonus
      if (sp.primaryKeyword && orphan.primaryKeyword && sp.primaryKeyword !== orphan.primaryKeyword) {
        // Different keywords in same domain = good link opportunity
        relevanceScore += 0.2;
      }

      // Authority bonus (more incoming links = more authority)
      relevanceScore += Math.min(sp.incomingLinks * 0.05, 0.3);

      // Pillar page bonus
      if (sp.isPillar) {
        relevanceScore += 0.2;
      }

      return { source: sp, score: Math.min(relevanceScore, 1.0) };
    });

    // Sort by relevance and take top 3
    const topSources = scoredSources
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    for (const { source, score } of topSources) {
      const anchorText = orphan.primaryKeyword ?? orphan.title ?? orphan.url;
      candidates.push({
        projectId: '',
        sourcePageId: source.pageId,
        targetPageId: orphan.pageId,
        sourceUrl: source.url,
        targetUrl: orphan.url,
        anchorText,
        surroundingText: `Voorgestelde link naar weespagina vanaf sterke pagina`,
        strategy: 'ORPHAN_PAGE',
        confidence: Math.max(0.4, Math.min(0.9, score + 0.4)),
        isExisting: false,
        isBroken: false,
        replacesLinkId: null,
      });
    }
  }

  return candidates;
}

// ============================================================================
// Strategy: STRONG_PAGE
// ============================================================================

/**
 * Generate link candidates from high-authority pages to related newer pages.
 * Identifies pages with the most internal links pointing to them
 * and suggests linking from them to related content.
 */
function generateStrongPageCandidates(
  profiles: PageLinkProfile[],
  existingLinks: Set<string>
): LinkCandidate[] {
  const candidates: LinkCandidate[] = [];

  // Use pre-computed incoming link counts from profiles
  // (already computed in buildPageLinkProfiles)

  // Identify strong pages: top 15% by incoming links
  const sortedByIncoming = [...profiles]
    .sort((a, b) => b.incomingLinks - a.incomingLinks);

  const topCount = Math.max(3, Math.ceil(sortedByIncoming.length * 0.15));
  const strongPages = sortedByIncoming.slice(0, topCount);

  // Identify "newer" pages: pages with few incoming links but good content
  const newerPages = profiles.filter((p) => {
    return p.incomingLinks <= 2 && !p.isOrphan && p.wordCount > 300;
  });

  for (const strongPage of strongPages) {
    // Find related newer pages to link to
    const relatedNewPages = newerPages.filter((np) => {
      if (np.pageId === strongPage.pageId) return false;
      const linkKey = `${strongPage.url}→${np.url}`;
      if (existingLinks.has(linkKey)) return false;
      if (strongPage.existingOutgoingUrls.some((u) => np.url.includes(u))) return false;
      return true;
    });

    // Score by relevance
    const scored = relatedNewPages.map((np) => {
      let relevance = 0;

      // Same cluster
      if (strongPage.clusterId && strongPage.clusterId === np.clusterId) {
        relevance += 0.3;
      }

      // Complementary keywords
      if (strongPage.primaryKeyword && np.primaryKeyword && strongPage.primaryKeyword !== np.primaryKeyword) {
        relevance += 0.25;
      }

      return { page: np, relevance: Math.min(relevance, 1.0) };
    });

    const topRelated = scored
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 2);

    for (const { page, relevance } of topRelated) {
      const anchorText = page.primaryKeyword ?? page.title ?? page.url;
      candidates.push({
        projectId: '',
        sourcePageId: strongPage.pageId,
        targetPageId: page.pageId,
        sourceUrl: strongPage.url,
        targetUrl: page.url,
        anchorText,
        surroundingText: `Link van sterke pagina naar gerelateerde content`,
        strategy: 'STRONG_PAGE',
        confidence: Math.max(0.4, Math.min(0.85, relevance + 0.45)),
        isExisting: false,
        isBroken: false,
        replacesLinkId: null,
      });
    }
  }

  return candidates;
}

// ============================================================================
// Strategy: BROKEN_REPLACEMENT
// ============================================================================

/**
 * Generate link candidates to replace broken links.
 * Finds broken internal links from TechnicalIssue data and suggests
 * appropriate replacement target pages.
 */
function generateBrokenReplacementCandidates(
  profiles: PageLinkProfile[],
  brokenLinks: Array<{
    id: string;
    ruleName: string;
    affectedUrls: string[];
    evidence: string | null;
    pageId: string | null;
  }>,
  existingLinks: Set<string>
): LinkCandidate[] {
  const candidates: LinkCandidate[] = [];

  if (brokenLinks.length === 0) {
    return candidates;
  }

  // Build a URL → profile lookup
  const urlProfileMap = new Map<string, PageLinkProfile>();
  for (const p of profiles) {
    urlProfileMap.set(p.url, p);
    urlProfileMap.set(p.normalizedUrl, p);
  }

  for (const brokenLink of brokenLinks) {
    // Find the source page where the broken link exists
    const sourcePage = brokenLink.pageId
      ? profiles.find((p) => p.pageId === brokenLink.pageId)
      : null;

    if (!sourcePage) continue;

    // Parse broken target URLs from evidence
    const brokenTargetUrls = brokenLink.affectedUrls;
    if (brokenTargetUrls.length === 0) continue;

    for (const brokenUrl of brokenTargetUrls) {
      // Find a suitable replacement page
      // Look for pages with similar URL patterns or same keyword topics
      const replacementCandidates = findReplacementCandidates(
        brokenUrl,
        sourcePage,
        profiles,
        existingLinks
      );

      for (const replacement of replacementCandidates) {
        candidates.push({
          projectId: '',
          sourcePageId: sourcePage.pageId,
          targetPageId: replacement.pageId,
          sourceUrl: sourcePage.url,
          targetUrl: replacement.url,
          anchorText: replacement.primaryKeyword ?? replacement.title ?? replacement.url,
          surroundingText: `Vervanging voor gebroken link naar ${brokenUrl}`,
          strategy: 'BROKEN_REPLACEMENT',
          confidence: replacement.confidence,
          isExisting: false,
          isBroken: false,
          replacesLinkId: brokenLink.id,
        });
      }
    }
  }

  return candidates;
}

/**
 * Find suitable replacement pages for a broken link URL.
 * Scores candidates by URL similarity and keyword relevance.
 */
function findReplacementCandidates(
  brokenUrl: string,
  sourcePage: PageLinkProfile,
  allProfiles: PageLinkProfile[],
  existingLinks: Set<string>
): Array<PageLinkProfile & { confidence: number }> {
  const results: Array<PageLinkProfile & { confidence: number }> = [];

  // Extract path segments from the broken URL for matching
  const brokenPath = extractPath(brokenUrl).toLowerCase();
  const brokenSegments = brokenPath.split('/').filter((s) => s.length > 0);

  for (const profile of allProfiles) {
    if (profile.pageId === sourcePage.pageId) continue;

    // Skip if already linked
    const linkKey = `${sourcePage.url}→${profile.url}`;
    if (existingLinks.has(linkKey)) continue;
    if (sourcePage.existingOutgoingUrls.some((u) => profile.url.includes(u))) continue;

    let score = 0;

    // URL path similarity
    const profilePath = extractPath(profile.url).toLowerCase();
    const profileSegments = profilePath.split('/').filter((s) => s.length > 0);

    // Check for common path segments
    const commonSegments = brokenSegments.filter((s) => profileSegments.includes(s));
    score += commonSegments.length * 0.15;

    // Check if the page title contains parts of the broken URL
    if (profile.title) {
      const titleLower = profile.title.toLowerCase();
      for (const segment of brokenSegments) {
        if (segment.length > 3 && titleLower.includes(segment)) {
          score += 0.1;
        }
      }
    }

    // Same cluster bonus
    if (sourcePage.clusterId && sourcePage.clusterId === profile.clusterId) {
      score += 0.2;
    }

    // Complementary keyword bonus
    if (sourcePage.primaryKeyword && profile.primaryKeyword && sourcePage.primaryKeyword !== profile.primaryKeyword) {
      score += 0.15;
    }

    const confidence = Math.max(0.3, Math.min(0.9, score));
    if (confidence >= 0.4) {
      results.push({ ...profile, confidence });
    }
  }

  // Return top 3 replacements sorted by confidence
  return results.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

// ============================================================================
// Cannibalization Detection
// ============================================================================

/**
 * Detect potential keyword cannibalization between pages.
 * Warns when two pages target the same primary keyword and
 * a link between them might confuse search engines.
 */
function detectCannibalization(
  profiles: PageLinkProfile[],
  candidates: LinkCandidate[]
): CannibalizationWarning[] {
  const warnings: CannibalizationWarning[] = [];

  // Build a map of keyword → pages targeting it
  const keywordPageMap = new Map<string, PageLinkProfile[]>();
  for (const profile of profiles) {
    if (profile.primaryKeyword) {
      const keyword = profile.primaryKeyword.toLowerCase();
      if (!keywordPageMap.has(keyword)) {
        keywordPageMap.set(keyword, []);
      }
      keywordPageMap.get(keyword)!.push(profile);
    }
  }

  // Find candidates where both source and target target the same keyword
  for (const candidate of candidates) {
    const sourceProfile = profiles.find((p) => p.pageId === candidate.sourcePageId);
    const targetProfile = profiles.find((p) => p.pageId === candidate.targetPageId);

    if (!sourceProfile || !targetProfile) continue;

    if (
      sourceProfile.primaryKeyword &&
      targetProfile.primaryKeyword &&
      sourceProfile.primaryKeyword.toLowerCase() === targetProfile.primaryKeyword.toLowerCase()
    ) {
      const sharedKeyword = sourceProfile.primaryKeyword;

      // Check if we already have a warning for this pair
      const existingWarning = warnings.find(
        (w) =>
          (w.pageId1 === sourceProfile.pageId && w.pageId2 === targetProfile.pageId) ||
          (w.pageId1 === targetProfile.pageId && w.pageId2 === sourceProfile.pageId)
      );

      if (!existingWarning) {
        const severity = determineCannibalizationSeverity(sourceProfile, targetProfile);

        warnings.push({
          pageUrl1: sourceProfile.url,
          pageId1: sourceProfile.pageId,
          pageUrl2: targetProfile.url,
          pageId2: targetProfile.pageId,
          sharedKeyword,
          warning: `De pagina's "${sourceProfile.title ?? sourceProfile.url}" en "${targetProfile.title ?? targetProfile.url}" richten zich beide op het keyword "${sharedKeyword}". Een interne link tussen deze pagina's kan zoekmachines in de war brengen over welke pagina het meest relevant is.`,
          severity,
          suggestedAction: severity === 'high'
            ? 'Overweeg om één pagina te canonicaliseren naar de andere, of de content te herschrijven zodat elke pagina een unieke zoekintent bedient.'
            : severity === 'medium'
              ? 'Zorg dat de ankertekst duidelijk het onderscheid tussen beide pagina\'s maakt, of overweeg de link niet te plaatsen.'
              : 'De link kan geplaatst worden, maar monitor de rangposities van beide pagina\'s na plaatsing.',
        });
      }
    }
  }

  return warnings;
}

/**
 * Determine the severity of a cannibalization warning.
 */
function determineCannibalizationSeverity(
  page1: PageLinkProfile,
  page2: PageLinkProfile
): 'low' | 'medium' | 'high' {
  // High severity if both pages are well-established (both have incoming links)
  if (!page1.isOrphan && !page2.isOrphan && page1.incomingLinks > 0 && page2.incomingLinks > 0) {
    return 'high';
  }

  // Medium severity if one page is established and the other is not
  if (!page1.isOrphan || !page2.isOrphan) {
    return 'medium';
  }

  return 'low';
}

/**
 * Adjust confidence scores for candidates that are affected by cannibalization warnings.
 * Reduces confidence for candidates linking pages that target the same keyword.
 */
function adjustConfidenceForCannibalization(
  candidates: LinkCandidate[],
  warnings: CannibalizationWarning[]
): LinkCandidate[] {
  if (warnings.length === 0) return candidates;

  // Build a set of page pairs that have cannibalization warnings
  const warningPairs = new Set<string>();
  for (const w of warnings) {
    warningPairs.add(`${w.pageId1}→${w.pageId2}`);
    warningPairs.add(`${w.pageId2}→${w.pageId1}`);
  }

  return candidates.map((c) => {
    const pairKey = `${c.sourcePageId}→${c.targetPageId}`;
    if (warningPairs.has(pairKey)) {
      const warning = warnings.find(
        (w) =>
          (w.pageId1 === c.sourcePageId && w.pageId2 === c.targetPageId) ||
          (w.pageId1 === c.targetPageId && w.pageId2 === c.sourcePageId)
      );
      const penalty = warning?.severity === 'high' ? 0.3 : warning?.severity === 'medium' ? 0.2 : 0.1;
      return {
        ...c,
        confidence: Math.max(0.1, c.confidence - penalty),
      };
    }
    return c;
  });
}

// ============================================================================
// Deduplication & Persistence
// ============================================================================

/**
 * Deduplicate candidates by source-target URL pair.
 * When duplicates exist, keep the one with the highest confidence.
 */
function deduplicateCandidates(candidates: LinkCandidate[]): LinkCandidate[] {
  const bestByPair = new Map<string, LinkCandidate>();

  for (const c of candidates) {
    const key = `${c.sourceUrl}→${c.targetUrl}`;
    const existing = bestByPair.get(key);
    if (!existing || c.confidence > existing.confidence) {
      bestByPair.set(key, c);
    }
  }

  return Array.from(bestByPair.values());
}

/**
 * Save link candidates to the InternalLink table in the database.
 * Sets the projectId from the first candidate or derives it from the profiles.
 */
async function saveCandidatesToDatabase(
  candidates: LinkCandidate[]
): Promise<LinkCandidate[]> {
  if (candidates.length === 0) return [];

  // Get the projectId from the first candidate that has one
  // For candidates where projectId was not set, we need to resolve it
  const projectIds = new Set(candidates.map((c) => c.projectId).filter((id) => id.length > 0));

  // If projectIds are missing, try to resolve from page data
  const candidatesWithProjectId: LinkCandidate[] = [];
  for (const c of candidates) {
    if (c.projectId && c.projectId.length > 0) {
      candidatesWithProjectId.push(c);
    } else {
      // Try to resolve projectId from sourcePageId
      const page = await db.page.findUnique({
        where: { id: c.sourcePageId ?? '' },
        select: { projectId: true },
      });
      if (page) {
        candidatesWithProjectId.push({ ...c, projectId: page.projectId });
      }
    }
  }

  // Batch create candidates in the database
  const saved: LinkCandidate[] = [];

  for (const candidate of candidatesWithProjectId) {
    try {
      // Generate anchor variations for this candidate
      const sourcePage = await db.page.findUnique({
        where: { id: candidate.sourcePageId ?? '' },
        select: { mainContent: true },
      });

      const anchorVariations = generateAnchorVariations(
        candidate.targetUrl, // fallback title
        candidate.anchorText, // use the generated anchor as keyword
        sourcePage?.mainContent ?? candidate.surroundingText ?? ''
      );

      // Pick the best anchor variation
      const bestAnchor = anchorVariations[0]?.anchorText ?? candidate.anchorText;

      const record = await db.internalLink.create({
        data: {
          projectId: candidate.projectId,
          sourcePageId: candidate.sourcePageId,
          targetPageId: candidate.targetPageId,
          sourceUrl: candidate.sourceUrl,
          targetUrl: candidate.targetUrl,
          anchorText: bestAnchor,
          surroundingText: candidate.surroundingText,
          strategy: candidate.strategy,
          status: 'PENDING',
          confidence: candidate.confidence,
          isExisting: candidate.isExisting,
          isBroken: candidate.isBroken,
          replacesLinkId: candidate.replacesLinkId,
        },
      });

      saved.push({
        id: record.id,
        projectId: record.projectId,
        sourcePageId: record.sourcePageId,
        targetPageId: record.targetPageId,
        sourceUrl: record.sourceUrl,
        targetUrl: record.targetUrl,
        anchorText: record.anchorText,
        surroundingText: record.surroundingText,
        strategy: record.strategy as LinkStrategy,
        confidence: record.confidence,
        isExisting: record.isExisting,
        isBroken: record.isBroken,
        replacesLinkId: record.replacesLinkId,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[LinkCandidateGenerator] Fout bij opslaan kandidaat ${candidate.sourceUrl}→${candidate.targetUrl}: ${msg}`);
    }
  }

  return saved;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse a JSON array from a potentially stringified field.
 */
function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((u): u is string => typeof u === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Parse AI response content into structured suggestions.
 * Handles both raw JSON and markdown-wrapped JSON.
 */
function parseAIResponse(content: string): Array<Record<string, unknown>> {
  // Try to extract JSON from the response
  let jsonStr = content.trim();

  // Remove markdown code fences if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Try to find a JSON array in the content
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    jsonStr = arrayMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null
      );
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Extract the path portion from a URL.
 */
function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    // If URL parsing fails, try a simple split
    const match = url.match(/https?:\/\/[^/]+(\/.*)?/);
    return match?.[1] ?? '/';
  }
}
