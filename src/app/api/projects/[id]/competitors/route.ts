import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getCompetitors, addCompetitor } from '@/lib/competitor';

// GET /api/projects/[id]/competitors — List competitors
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

    const competitors = await getCompetitors(projectId);

    return NextResponse.json({
      data: competitors,
      meta: { total: competitors.length },
    });
  } catch (error) {
    console.error('List competitors error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/competitors — Add competitor
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
    const { name, websiteUrl, description } = body;

    if (!name || !websiteUrl) {
      return NextResponse.json({ error: 'Naam en website-URL zijn vereist' }, { status: 400 });
    }

    const competitor = await addCompetitor(projectId, { name, websiteUrl, description });

    return NextResponse.json({ data: competitor }, { status: 201 });
  } catch (error) {
    console.error('Add competitor error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
