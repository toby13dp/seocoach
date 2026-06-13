import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { crawlCompetitor } from '@/lib/competitor';

// POST /api/projects/[id]/competitors/[competitorId]/crawl — Trigger competitor crawl
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; competitorId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, competitorId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const result = await crawlCompetitor(competitorId);

    return NextResponse.json({
      data: result,
      meta: {
        note: 'Crawlen is een achtergrondproces. Resultaten worden automatisch bijgewerkt.',
      },
    });
  } catch (error) {
    console.error('Crawl competitor error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
