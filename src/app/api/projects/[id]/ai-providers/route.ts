import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/projects/[id]/ai-providers — List AI providers for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const providers = await db.aIProvider.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
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

    return NextResponse.json({ data: providers });
  } catch (error) {
    console.error('List AI providers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/ai-providers — Add an AI provider
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await validateProjectAccess(user.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Provider name is required' },
        { status: 400 }
      );
    }

    if (!body.baseUrl || typeof body.baseUrl !== 'string') {
      return NextResponse.json(
        { error: 'baseUrl is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(body.baseUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid baseUrl format' },
        { status: 400 }
      );
    }

    const validTypes = ['OLLAMA', 'OPENAI_COMPATIBLE', 'CUSTOM'];
    const providerType = body.type ?? 'OLLAMA';
    if (!validTypes.includes(providerType)) {
      return NextResponse.json(
        { error: `Invalid provider type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // If this is set as default, unset any existing default
    if (body.isDefault) {
      await db.aIProvider.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const provider = await db.aIProvider.create({
      data: {
        projectId,
        name: body.name,
        type: providerType as never,
        baseUrl: body.baseUrl.replace(/\/$/, ''), // Remove trailing slash
        apiKey: body.apiKey ?? null,
        defaultModel: body.defaultModel ?? null,
        isActive: body.isActive ?? true,
        isDefault: body.isDefault ?? false,
        maxTokens: body.maxTokens ?? 4096,
        temperature: body.temperature ?? 0.7,
        timeout: body.timeout ?? 60000,
        retryAttempts: body.retryAttempts ?? 3,
        privacySettings: body.privacySettings ? JSON.stringify(body.privacySettings) : null,
        costPerToken: body.costPerToken ?? 0,
      },
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

    return NextResponse.json({ data: provider }, { status: 201 });
  } catch (error) {
    console.error('Create AI provider error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
