import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { wooListProducts } from '@/lib/cms/woocommerce';

// GET /api/projects/[id]/cms-connections/[connectionId]/products — List products from WooCommerce
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, connectionId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const connection = await db.cMSConnection.findFirst({
      where: { id: connectionId, projectId, deletedAt: null },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'CMS-verbinding niet gevonden' },
        { status: 404 }
      );
    }

    if (connection.providerType !== 'WOOCOMMERCE') {
      return NextResponse.json(
        { error: 'Deze bewerking is alleen beschikbaar voor WooCommerce-verbindingen' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') ?? '20', 10)));
    const search = searchParams.get('search') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const category = searchParams.get('category') ? parseInt(searchParams.get('category')!, 10) : undefined;

    const products = await wooListProducts(connectionId, {
      page,
      perPage,
      search,
      status,
      category,
    });

    return NextResponse.json({ data: products });
  } catch (error) {
    console.error('List WooCommerce products error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
