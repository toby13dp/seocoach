import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getAuthorityRecord, updateAuthorityRecord, markAsLost } from '@/lib/authority';

// GET /api/projects/[id]/authority/[recordId] — Record details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, recordId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const record = await getAuthorityRecord(recordId);

    if (!record || record.projectId !== projectId || record.deletedAt) {
      return NextResponse.json({ error: 'Record niet gevonden' }, { status: 404 });
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error('Get authority record error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/authority/[recordId] — Update (mark as lost, add notes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, recordId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { notes, status, markLost } = body;

    const existing = await getAuthorityRecord(recordId);
    if (!existing || existing.projectId !== projectId || existing.deletedAt) {
      return NextResponse.json({ error: 'Record niet gevonden' }, { status: 404 });
    }

    if (markLost) {
      const updated = await markAsLost(recordId);
      return NextResponse.json({ data: updated });
    }

    const updated = await updateAuthorityRecord(recordId, { notes, status });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update authority record error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
