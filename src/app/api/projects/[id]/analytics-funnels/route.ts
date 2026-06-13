import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { analyzeFunnel } from '@/lib/first-party-analytics';

// POST /api/projects/[id]/analytics-funnels — Analyze a funnel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { steps } = body as { steps?: { name: string; url: string }[] };

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: 'steps is vereist en moet een niet-lege array zijn met name en url velden' },
        { status: 400 }
      );
    }

    // Validate each step has name and url
    for (let i = 0; i < steps.length; i++) {
      if (!steps[i].name || !steps[i].url) {
        return NextResponse.json(
          { error: `Stap ${i + 1} moet zowel name als url bevatten` },
          { status: 400 }
        );
      }
    }

    const analysis = await analyzeFunnel(projectId, steps);

    return NextResponse.json({ data: analysis });
  } catch (error) {
    console.error('Analyze funnel error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
