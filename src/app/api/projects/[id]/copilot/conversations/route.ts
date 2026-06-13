import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getProjectConversations, createConversation } from '@/lib/copilot';

// GET /api/projects/[id]/copilot/conversations — List conversations for project
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
      return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 });
    }

    const conversations = await getProjectConversations(projectId, user.id);

    return NextResponse.json({
      data: conversations,
      meta: { total: conversations.length },
    });
  } catch (error) {
    console.error('List copilot conversations error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/copilot/conversations — Create new conversation
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
      return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 });
    }

    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Titel is vereist voor een nieuw gesprek' },
        { status: 400 }
      );
    }

    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Titel mag maximaal 200 tekens bevatten' },
        { status: 400 }
      );
    }

    const conversation = await createConversation(
      access.project.organizationId,
      projectId,
      user.id,
      title.trim()
    );

    return NextResponse.json({ data: conversation }, { status: 201 });
  } catch (error) {
    console.error('Create copilot conversation error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
