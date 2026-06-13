import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { analyzeAndSaveProductSEO } from '@/lib/ecommerce';

// POST /api/projects/[id]/products/[productId]/analyze — Run SEO analysis on a product
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, productId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const analysis = await analyzeAndSaveProductSEO(productId, projectId);

    return NextResponse.json({ data: analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Analyze product error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij analyseren product' },
      { status: 500 }
    );
  }
}
