import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers/auth';
import { validateProjectAccess } from '@/lib/tenant';
import { db } from '@/lib/db';

// POST /api/projects/[id]/ai-providers/[providerId]/test — Test provider connection
export async function POST(
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
    });

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    if (!provider.isActive) {
      return NextResponse.json(
        { data: { success: false, error: 'Provider is not active' } },
        { status: 200 }
      );
    }

    const startTime = Date.now();

    try {
      // Build the test request based on provider type
      const baseUrl = provider.baseUrl.replace(/\/$/, '');
      let testUrl: string;
      let testBody: Record<string, unknown>;

      if (provider.type === 'OLLAMA') {
        testUrl = `${baseUrl}/api/generate`;
        testBody = {
          model: provider.defaultModel || 'llama3.2',
          prompt: 'Zeg hallo in het Nederlands.',
          stream: false,
          options: {
            num_predict: 20,
          },
        };
      } else {
        // OpenAI-compatible or custom
        testUrl = `${baseUrl}/v1/chat/completions`;
        testBody = {
          model: provider.defaultModel || 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: 'Zeg hallo in het Nederlands.' },
          ],
          max_tokens: 20,
        };
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), provider.timeout || 30000);

      const response = await fetch(testUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(testBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        const tokens = data?.usage?.total_tokens || data?.eval_count || 0;

        // Log the test call
        await db.aICallLog.create({
          data: {
            providerId: provider.id,
            projectId,
            model: provider.defaultModel || 'unknown',
            inputTokens: data?.usage?.prompt_tokens || data?.prompt_eval_count || 0,
            outputTokens: data?.usage?.completion_tokens || data?.eval_count || 0,
            totalTokens: tokens,
            cost: 0,
            durationMs: duration,
            success: true,
            purpose: 'test',
          },
        });

        return NextResponse.json({
          data: {
            success: true,
            duration,
            tokens,
            model: provider.defaultModel || 'unknown',
          },
        });
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        return NextResponse.json({
          data: {
            success: false,
            error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
            duration,
          },
        });
      }
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      const errorMessage =
        fetchError instanceof Error
          ? fetchError.name === 'AbortError'
            ? 'Verbinding verbroken (timeout)'
            : fetchError.message
          : 'Onbekende fout';

      return NextResponse.json({
        data: {
          success: false,
          error: errorMessage,
          duration,
        },
      });
    }
  } catch (error) {
    console.error('Test AI provider error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
