import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import {
  getConversationMessages,
  addMessage,
  detectPromptInjection,
  sanitizeInput,
} from '@/lib/copilot';
import { db } from '@/lib/db';

// GET /api/projects/[id]/copilot/conversations/[conversationId]/messages — Get messages for conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, conversationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 });
    }

    // Verify conversation belongs to this project and user
    const conversation = await db.copilotConversation.findFirst({
      where: {
        id: conversationId,
        projectId,
        userId: user.id,
        deletedAt: null,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Gesprek niet gevonden' },
        { status: 404 }
      );
    }

    const messages = await getConversationMessages(conversationId);

    return NextResponse.json({
      data: messages,
      meta: { total: messages.length },
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/copilot/conversations/[conversationId]/messages — Send message to copilot
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 });
    }

    const { id: projectId, conversationId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 });
    }

    // Verify conversation belongs to this project and user
    const conversation = await db.copilotConversation.findFirst({
      where: {
        id: conversationId,
        projectId,
        userId: user.id,
        deletedAt: null,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Gesprek niet gevonden' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Berichtinhoud is vereist' },
        { status: 400 }
      );
    }

    // Detect prompt injection
    const injectionCheck = detectPromptInjection(content);
    if (injectionCheck.isInjection) {
      // Log the injection attempt
      await db.auditLog.create({
        data: {
          organizationId: access.project.organizationId,
          userId: user.id,
          action: 'PROMPT_INJECTION_DETECTED',
          entity: 'copilot_conversation',
          entityId: conversationId,
          changes: JSON.stringify({
            patterns: injectionCheck.patterns,
            originalLength: content.length,
          }),
        },
      });

      return NextResponse.json(
        {
          error: 'Potentieel onveilige invoer gedetecteerd. Pas uw bericht aan en probeer opnieuw.',
          warning: true,
          warningType: 'prompt_injection',
        },
        { status: 400 }
      );
    }

    // Sanitize input
    const sanitizedContent = sanitizeInput(content);

    // Add user message
    const userMessage = await addMessage(conversationId, 'user', sanitizedContent);

    // Update conversation timestamp
    await db.copilotConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      data: {
        message: userMessage,
        sanitized: sanitizedContent !== content,
      },
    });
  } catch (error) {
    console.error('Send copilot message error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
