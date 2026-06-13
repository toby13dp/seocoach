import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getTemplate } from '@/lib/programmatic/template-manager';
import { publishApprovedPages } from '@/lib/programmatic/generator';

// POST /api/projects/[id]/programmatic/[templateId]/publish — Publish approved pages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, templateId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const template = await getTemplate(templateId);
    if (!template || template.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Sjabloon niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const cmsConnectionId = body.cmsConnectionId ?? undefined;

    const publishedCount = await publishApprovedPages(templateId, cmsConnectionId);

    return NextResponse.json({
      data: {
        templateId,
        publishedCount,
        message: `${publishedCount} pagina's gepubliceerd.`,
      },
    });
  } catch (error) {
    console.error('Publish programmatic pages error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
