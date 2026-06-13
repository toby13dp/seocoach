import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { matchFeedItemsToProducts } from '@/lib/product-feeds';

// POST /api/projects/[id]/feeds/[feedId]/match — Match feed items to existing products
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feedId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, feedId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const result = await matchFeedItemsToProducts(feedId, projectId);

    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Match feed items error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij koppelen feed-items aan producten' },
      { status: 500 }
    );
  }
}
