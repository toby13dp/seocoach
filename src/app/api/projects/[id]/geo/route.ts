import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getGeoReadiness, analyzeGeoReadiness } from '@/lib/geo';

// GET /api/projects/[id]/geo — Get GEO readiness summary and checks
export async function GET(
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

    const { checks, summary } = await getGeoReadiness(projectId);

    return NextResponse.json({
      data: { checks, summary },
      meta: {
        totalChecks: checks.length,
        note: 'Dit is geen meting van werkelijke AI-zichtbaarheid, maar een analyse van je gereedheid.',
      },
    });
  } catch (error) {
    console.error('Get GEO readiness error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/geo — Run GEO readiness analysis
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

    const { checks, summary } = await analyzeGeoReadiness(projectId);

    return NextResponse.json({
      data: { checks, summary },
      meta: {
        totalChecks: checks.length,
        note: 'Dit is geen meting van werkelijke AI-zichtbaarheid, maar een analyse van je gereedheid.',
      },
    });
  } catch (error) {
    console.error('Run GEO analysis error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
