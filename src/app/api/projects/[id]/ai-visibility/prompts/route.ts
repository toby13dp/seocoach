import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { getPrompts, createPrompt, getClusters } from '@/lib/ai-visibility';

// GET /api/projects/[id]/ai-visibility/prompts — List prompts
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
    const clusterId = searchParams.get('clusterId') ?? undefined;
    const funnelStage = searchParams.get('funnelStage') ?? undefined;
    const searchIntent = searchParams.get('searchIntent') ?? undefined;

    const [prompts, clusters] = await Promise.all([
      getPrompts(projectId, { clusterId, funnelStage, searchIntent }),
      getClusters(projectId),
    ]);

    return NextResponse.json({
      data: { prompts, clusters },
      meta: { total: prompts.length },
    });
  } catch (error) {
    console.error('List AI prompts error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST /api/projects/[id]/ai-visibility/prompts — Create prompt
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
    const { name, prompt, clusterId, funnelStage, searchIntent } = body;

    if (!name || !prompt) {
      return NextResponse.json({ error: 'Naam en prompt zijn vereist' }, { status: 400 });
    }

    // Handle cluster creation if it's a new cluster name
    let resolvedClusterId = clusterId;
    if (clusterId && clusterId.startsWith('new:')) {
      const clusterName = clusterId.replace('new:', '');
      const cluster = await (await import('@/lib/ai-visibility')).createCluster(projectId, { name: clusterName });
      resolvedClusterId = cluster.id;
    }

    const newPrompt = await createPrompt(projectId, {
      name,
      prompt,
      clusterId: resolvedClusterId,
      funnelStage,
      searchIntent,
    });

    return NextResponse.json({ data: newPrompt }, { status: 201 });
  } catch (error) {
    console.error('Create AI prompt error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
