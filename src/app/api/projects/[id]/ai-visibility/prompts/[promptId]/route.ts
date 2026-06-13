import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getPrompt, updatePrompt, softDeletePrompt } from '@/lib/ai-visibility';

// GET /api/projects/[id]/ai-visibility/prompts/[promptId] — Prompt details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promptId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, promptId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const prompt = await getPrompt(promptId);

    if (!prompt || prompt.projectId !== projectId) {
      return NextResponse.json({ error: 'Prompt niet gevonden' }, { status: 404 });
    }

    return NextResponse.json({ data: prompt });
  } catch (error) {
    console.error('Get AI prompt error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/ai-visibility/prompts/[promptId] — Update prompt
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promptId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, promptId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const body = await request.json();
    const { name, prompt, clusterId, funnelStage, searchIntent, isActive } = body;

    const existing = await getPrompt(promptId);
    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json({ error: 'Prompt niet gevonden' }, { status: 404 });
    }

    const updated = await updatePrompt(promptId, {
      name,
      prompt,
      clusterId,
      funnelStage,
      searchIntent,
      isActive,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update AI prompt error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/ai-visibility/prompts/[promptId] — Soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promptId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, promptId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const existing = await getPrompt(promptId);
    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json({ error: 'Prompt niet gevonden' }, { status: 404 });
    }

    await softDeletePrompt(promptId);

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Delete AI prompt error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
