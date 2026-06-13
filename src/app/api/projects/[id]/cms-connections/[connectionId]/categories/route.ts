import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';
import { wpListCategories } from '@/lib/cms/wordpress';
import { wooListCategories } from '@/lib/cms/woocommerce';

// GET /api/projects/[id]/cms-connections/[connectionId]/categories — List categories from CMS
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

    let categories;

    if (connection.providerType === 'WORDPRESS') {
      categories = await wpListCategories(connectionId);
    } else if (connection.providerType === 'WOOCOMMERCE') {
      categories = await wooListCategories(connectionId);
    } else {
      return NextResponse.json(
        { error: `Categorieën ophalen wordt niet ondersteund voor providertype "${connection.providerType}"` },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error('List CMS categories error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
