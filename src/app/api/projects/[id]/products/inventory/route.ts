import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getProductInventorySummary } from '@/lib/ecommerce';

// GET /api/projects/[id]/products/inventory — Get product inventory summary stats
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

    const summary = await getProductInventorySummary(projectId);

    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error('Get inventory summary error:', error);
    return NextResponse.json(
      { error: 'Interne serverfout bij ophalen voorraadoverzicht' },
      { status: 500 }
    );
  }
}
