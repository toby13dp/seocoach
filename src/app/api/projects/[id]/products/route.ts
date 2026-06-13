import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { listProducts, createProduct } from '@/lib/ecommerce';
import type { ProductListFilters } from '@/lib/ecommerce';
import { ProductStatus } from '@prisma/client';

// GET /api/projects/[id]/products — List products with filters
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

    const { searchParams } = new URL(request.url);

    const filters: ProductListFilters = {
      categoryId: searchParams.get('categoryId') ?? undefined,
      stockStatus: searchParams.get('stockStatus') as ProductStatus | null ?? undefined,
      minSeoScore: searchParams.get('minSeoScore')
        ? parseFloat(searchParams.get('minSeoScore')!)
        : undefined,
      maxSeoScore: searchParams.get('maxSeoScore')
        ? parseFloat(searchParams.get('maxSeoScore')!)
        : undefined,
      minRevenue: searchParams.get('minRevenue')
        ? parseFloat(searchParams.get('minRevenue')!)
        : undefined,
      isSeasonal: searchParams.get('isSeasonal')
        ? searchParams.get('isSeasonal') === 'true'
        : undefined,
      hasVariations: searchParams.get('hasVariations')
        ? searchParams.get('hasVariations') === 'true'
        : undefined,
      search: searchParams.get('search') ?? undefined,
      sortBy: (searchParams.get('sortBy') as ProductListFilters['sortBy']) ?? undefined,
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') ?? undefined,
      limit: searchParams.get('limit')
        ? Math.min(100, Math.max(1, parseInt(searchParams.get('limit')!, 10)))
        : 50,
      offset: searchParams.get('offset')
        ? Math.max(0, parseInt(searchParams.get('offset')!, 10))
        : 0,
    };

    const { products, total } = await listProducts(projectId, filters);

    return NextResponse.json({
      data: products,
      meta: { total, limit: filters.limit ?? 50, offset: filters.offset ?? 0 },
    });
  } catch (error) {
    console.error('List products error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen producten' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/products — Create a product
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

    if (!body.name) {
      return NextResponse.json(
        { error: 'Productnaam is verplicht' },
        { status: 400 }
      );
    }

    const product = await createProduct(projectId, body);

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij aanmaken product' },
      { status: 500 }
    );
  }
}
