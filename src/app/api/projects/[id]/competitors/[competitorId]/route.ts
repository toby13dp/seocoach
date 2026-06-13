import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getCompetitor, updateCompetitor, softDeleteCompetitor } from '@/lib/competitor';

// GET /api/projects/[id]/competitors/[competitorId] — Competitor details
export async function GET(
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

    const competitor = await getCompetitor(competitorId);

    if (!competitor || competitor.projectId !== projectId || competitor.deletedAt) {
      return NextResponse.json({ error: 'Concurrent niet gevonden' }, { status: 404 });
    }

    return NextResponse.json({ data: competitor });
  } catch (error) {
    console.error('Get competitor error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/competitors/[competitorId] — Update
export async function PATCH(
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

    const body = await request.json();
    const { name, websiteUrl, description, isActive } = body;

    const existing = await getCompetitor(competitorId);
    if (!existing || existing.projectId !== projectId || existing.deletedAt) {
      return NextResponse.json({ error: 'Concurrent niet gevonden' }, { status: 404 });
    }

    const updated = await updateCompetitor(competitorId, {
      name,
      websiteUrl,
      description,
      isActive,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update competitor error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/competitors/[competitorId] — Soft delete
export async function DELETE(
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

    const existing = await getCompetitor(competitorId);
    if (!existing || existing.projectId !== projectId || existing.deletedAt) {
      return NextResponse.json({ error: 'Concurrent niet gevonden' }, { status: 404 });
    }

    await softDeleteCompetitor(competitorId);

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Delete competitor error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
