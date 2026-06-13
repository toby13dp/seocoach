import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/ai-providers/[providerId] — Get provider details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; providerId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, providerId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const provider = await db.aIProvider.findFirst({
      where: { id: providerId, projectId, deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        baseUrl: true,
        defaultModel: true,
        isActive: true,
        isDefault: true,
        maxTokens: true,
        temperature: true,
        timeout: true,
        retryAttempts: true,
        privacySettings: true,
        costPerToken: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { callLogs: true, promptTemplates: true } },
      },
    });

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Parse privacy settings
    const result = {
      ...provider,
      privacySettings: provider.privacySettings ? JSON.parse(provider.privacySettings) : null,
    };

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Get AI provider error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/ai-providers/[providerId] — Update provider
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; providerId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, providerId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await db.aIProvider.findFirst({
      where: { id: providerId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.baseUrl !== undefined) {
      try {
        new URL(body.baseUrl);
        updateData.baseUrl = body.baseUrl.replace(/\/$/, '');
      } catch {
        return NextResponse.json({ error: 'Invalid baseUrl format' }, { status: 400 });
      }
    }
    if (body.apiKey !== undefined) updateData.apiKey = body.apiKey;
    if (body.defaultModel !== undefined) updateData.defaultModel = body.defaultModel;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.maxTokens !== undefined) updateData.maxTokens = body.maxTokens;
    if (body.temperature !== undefined) updateData.temperature = body.temperature;
    if (body.timeout !== undefined) updateData.timeout = body.timeout;
    if (body.retryAttempts !== undefined) updateData.retryAttempts = body.retryAttempts;
    if (body.privacySettings !== undefined) {
      updateData.privacySettings = JSON.stringify(body.privacySettings);
    }
    if (body.costPerToken !== undefined) updateData.costPerToken = body.costPerToken;

    // Handle isDefault specially
    if (body.isDefault === true) {
      await db.aIProvider.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      });
      updateData.isDefault = true;
    }

    const provider = await db.aIProvider.update({
      where: { id: providerId },
      data: updateData,
      select: {
        id: true,
        name: true,
        type: true,
        baseUrl: true,
        defaultModel: true,
        isActive: true,
        isDefault: true,
        maxTokens: true,
        temperature: true,
        timeout: true,
        retryAttempts: true,
        costPerToken: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: provider });
  } catch (error) {
    console.error('Update AI provider error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/ai-providers/[providerId] — Soft delete provider
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; providerId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, providerId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await db.aIProvider.findFirst({
      where: { id: providerId, projectId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    await db.aIProvider.update({
      where: { id: providerId },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ data: { id: providerId, deleted: true } });
  } catch (error) {
    console.error('Delete AI provider error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
