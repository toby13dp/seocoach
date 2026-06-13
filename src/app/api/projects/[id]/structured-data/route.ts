import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { generateStructuredData, getProjectStructuredData } from '@/lib/structured-data/generator';
import type { StructuredDataType } from '@prisma/client';

// GET /api/projects/[id]/structured-data — List structured data entries
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
    const type = searchParams.get('type') as StructuredDataType | null;

    const entries = await getProjectStructuredData(projectId, type ?? undefined);

    return NextResponse.json({ data: entries });
  } catch (error) {
    console.error('List structured data error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/structured-data — Generate structured data
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

    if (!body.type) {
      return NextResponse.json(
        { error: 'Type gestructureerde data is vereist' },
        { status: 400 }
      );
    }

    const validTypes: StructuredDataType[] = [
      'ORGANIZATION', 'LOCAL_BUSINESS', 'PRODUCT', 'OFFER', 'REVIEW',
      'BREADCRUMB_LIST', 'ARTICLE', 'FAQ_PAGE', 'HOW_TO', 'PERSON',
      'EVENT', 'JOB_POSTING', 'SERVICE', 'WEB_SITE', 'WEB_PAGE',
    ];

    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `Ongeldig type. Geldige types: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await generateStructuredData({
      type: body.type,
      projectId,
      pageId: body.pageId,
      url: body.url,
      existingData: body.existingData,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error('Generate structured data error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
