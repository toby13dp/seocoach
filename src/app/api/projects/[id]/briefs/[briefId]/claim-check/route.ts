import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// POST /api/projects/[id]/briefs/[briefId]/claim-check — Check claim support against sources
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; briefId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, briefId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const brief = await db.contentBrief.findFirst({
      where: { id: briefId, projectId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief niet gevonden' },
        { status: 404 }
      );
    }

    const latestVersion = brief.versions[0];
    if (!latestVersion) {
      return NextResponse.json(
        { error: 'Geen contentversie beschikbaar voor claimcontrole' },
        { status: 400 }
      );
    }

    // Get approved sources for this brief
    const sources = await db.contentSource.findMany({
      where: {
        projectId,
        deletedAt: null,
        approvedAt: { not: null },
      },
    });

    const content = latestVersion.content;
    const claimMarkers = latestVersion.claimMarkers
      ? JSON.parse(latestVersion.claimMarkers)
      : [];

    // Perform claim verification against sources
    const results = verifyClaimsAgainstSources(content, claimMarkers, sources);

    // Store findings for unsupported claims
    for (const result of results.unsupported) {
      await db.qualityFinding.create({
        data: {
          projectId,
          briefId,
          versionId: latestVersion.id,
          checkType: 'UNSUPPORTED_CLAIM',
          severity: 'WARNING',
          title: `Niet-ondersteunde claim: "${result.claim.substring(0, 80)}..."`,
          description: result.reason,
          evidence: JSON.stringify({ claim: result.claim, sourceCount: sources.length }),
          recommendation: 'Voeg een bron toe die deze claim ondersteunt, of herformuleer de claim.',
        },
      });
    }

    return NextResponse.json({
      data: {
        briefId,
        versionId: latestVersion.id,
        totalClaims: results.total,
        supported: results.supported.length,
        unsupported: results.unsupported.length,
        unsupportedClaims: results.unsupported,
        sourcesChecked: sources.length,
      },
    });
  } catch (error) {
    console.error('Claim check error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Simple claim verification logic
function verifyClaimsAgainstSources(
  content: string,
  claimMarkers: string[],
  sources: { id: string; name: string; content: string | null; type: string }[]
) {
  const supported: { claim: string; supportingSource: string }[] = [];
  const unsupported: { claim: string; reason: string }[] = [];

  // Use claimMarkers if available, otherwise extract sentences with claims
  const claims = claimMarkers.length > 0
    ? claimMarkers
    : extractClaimSentences(content);

  for (const claim of claims) {
    let isSupported = false;

    for (const source of sources) {
      if (!source.content) continue;

      // Simple keyword overlap check
      const claimWords = claim.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const sourceWords = source.content.toLowerCase();

      const overlap = claimWords.filter(w => sourceWords.includes(w));
      if (overlap.length >= Math.ceil(claimWords.length * 0.3)) {
        supported.push({ claim, supportingSource: source.name });
        isSupported = true;
        break;
      }
    }

    if (!isSupported) {
      unsupported.push({
        claim,
        reason: 'Geen van de goedgekeurde bronnen ondersteunt deze claim met voldoende overlap.',
      });
    }
  }

  return { total: claims.length, supported, unsupported };
}

// Extract sentences that look like claims from content
function extractClaimSentences(content: string): string[] {
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  // Filter for sentences that look like claims (contain numbers, superlatives, or definitive statements)
  const claimIndicators = [
    /\d+%/g, /\d+\s*(keer|maal|procent|jaar|maand|week|dag)/gi,
    /beste|snelste|grootste|meest|minst|altijd|nooit|allemaal|geen enkele/gi,
    /bewezen|wetenschappelijk|onderzoek|studies|experts/gi,
  ];

  return sentences.filter(sentence =>
    claimIndicators.some(pattern => pattern.test(sentence))
  ).slice(0, 20); // Limit to 20 claims max
}
