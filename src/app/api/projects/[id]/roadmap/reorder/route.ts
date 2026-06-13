import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { reorderRoadmapItems } from '@/lib/roadmap';

// POST /api/projects/[id]/roadmap/reorder — Reorder items
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
    const { itemIds } = body as { itemIds?: string[] };

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'itemIds is vereist en moet een niet-lege array zijn' },
        { status: 400 }
      );
    }

    // Validate all IDs are strings
    if (!itemIds.every((id) => typeof id === 'string' && id.length > 0)) {
      return NextResponse.json(
        { error: 'Alle itemIds moeten geldige tekenreeksen zijn' },
        { status: 400 }
      );
    }

    const updatedCount = await reorderRoadmapItems(itemIds);

    return NextResponse.json({
      data: {
        reordered: true,
        count: updatedCount,
      },
    });
  } catch (error) {
    console.error('Reorder roadmap items error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
