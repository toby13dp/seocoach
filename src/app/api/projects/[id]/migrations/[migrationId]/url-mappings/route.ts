import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/migrations/[migrationId]/url-mappings — List URL mappings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; migrationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, migrationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));

    const mappings = await db.migrationUrlMapping.findMany({
      where: { migrationProjectId: migrationId, deletedAt: null },
      orderBy: { oldUrl: 'asc' },
      take: limit,
      skip: offset,
    });

    const total = await db.migrationUrlMapping.count({
      where: { migrationProjectId: migrationId, deletedAt: null },
    });

    return NextResponse.json({ mappings, total });
  } catch (error) {
    console.error('List URL mappings error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
