import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getTemplate, updateTemplate, deleteTemplate } from '@/lib/programmatic/template-manager';

// GET /api/projects/[id]/programmatic/[templateId] — Get template with pages
export async function GET(
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

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error('Get programmatic template error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/programmatic/[templateId] — Update template
export async function PATCH(
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

    const existing = await getTemplate(templateId);
    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Sjabloon niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updated = await updateTemplate(templateId, body);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update programmatic template error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/programmatic/[templateId] — Soft delete
export async function DELETE(
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

    const existing = await getTemplate(templateId);
    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Sjabloon niet gevonden' },
        { status: 404 }
      );
    }

    await deleteTemplate(templateId);

    return NextResponse.json({ data: { id: templateId, deleted: true } });
  } catch (error) {
    console.error('Delete programmatic template error:', error);
    const message = error instanceof Error ? error.message : 'Interne serverfout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
