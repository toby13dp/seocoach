import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// DELETE /api/projects/[id]/content-sources/[sourceId] — Remove source
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, sourceId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const source = await db.contentSource.findFirst({
      where: { id: sourceId, projectId, deletedAt: null },
    });

    if (!source) {
      return NextResponse.json(
        { error: 'Bron niet gevonden' },
        { status: 404 }
      );
    }

    await db.contentSource.update({
      where: { id: sourceId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ data: { id: sourceId, deleted: true } });
  } catch (error) {
    console.error('Delete content source error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
