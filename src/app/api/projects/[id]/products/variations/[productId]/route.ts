import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { analyzeProductVariations } from '@/lib/ecommerce';

// GET /api/projects/[id]/products/variations/[productId] — Get variation analysis for a parent product
export async function GET(
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

    const analysis = await analyzeProductVariations(productId, projectId);

    return NextResponse.json({ data: analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    if (message.includes('niet gevonden')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Variation analysis error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij analyseren variaties' },
      { status: 500 }
    );
  }
}
