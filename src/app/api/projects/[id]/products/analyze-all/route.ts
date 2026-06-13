import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { analyzeAllProducts } from '@/lib/ecommerce';

// POST /api/projects/[id]/products/analyze-all — Run SEO analysis on all products
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

    const result = await analyzeAllProducts(projectId);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Analyze all products error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij analyseren van alle producten' },
      { status: 500 }
    );
  }
}
