import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/geo/[checkId] — Check details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; checkId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, checkId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const check = await db.geoReadinessCheck.findUnique({
      where: { id: checkId },
    });

    if (!check || check.projectId !== projectId) {
      return NextResponse.json({ error: 'Controle niet gevonden' }, { status: 404 });
    }

    return NextResponse.json({ data: check });
  } catch (error) {
    console.error('Get GEO check error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/geo/[checkId] — Dismiss/undismiss a check
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; checkId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, checkId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { dismissed } = body;

    if (typeof dismissed !== 'boolean') {
      return NextResponse.json({ error: 'dismissed moet een boolean zijn' }, { status: 400 });
    }

    const check = await db.geoReadinessCheck.findUnique({
      where: { id: checkId },
    });

    if (!check || check.projectId !== projectId) {
      return NextResponse.json({ error: 'Controle niet gevonden' }, { status: 404 });
    }

    const evidence = check.evidence ? JSON.parse(check.evidence) : {};
    evidence.dismissed = dismissed;

    const updated = await db.geoReadinessCheck.update({
      where: { id: checkId },
      data: { evidence: JSON.stringify(evidence) },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Patch GEO check error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
