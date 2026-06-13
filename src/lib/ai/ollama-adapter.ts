// ============================================================================
// AI Provider Layer — Ollama Adapter
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Connects to a local Ollama instance for zero-cost AI generation.
// Default endpoint: http://localhost:11434
// Uses /api/chat for completions and /api/tags for model discovery.
// ============================================================================

import type {
  AIProviderAdapter,
  AIProviderConfig,
  AIGenerateRequest,
  AIGenerateResponse,
} from './types';

/**
 * Ollama API chat request format.
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md
 */
interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  format?: string; // "json" for structured output
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

/**
 * Ollama API chat response format.
 */
interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}

/**
 * Ollama API tags (model list) response format.
 */
interface OllamaTagsResponse {
  models: Array<{
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details: {
      parent_model: string;
      format: string;
      family: string;
      families: string[];
      parameter_size: string;
      quantization_level: string;
    };
  }>;
}

/**
 * Sleep utility for retry backoff.
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * AI Provider adapter for Ollama — a local LLM runtime.
 *
 * Key characteristics:
 * - **Zero cost**: Ollama runs locally, so costPerToken is always 0
 * - **No API key required**: Local connections need no authentication
 * - **Privacy-first**: All data stays on the local machine
 * - **Retry with exponential backoff**: Handles transient connection issues
 *
 * @example
 * ```typescript
 * const config: AIProviderConfig = {
 *   id: 'local-ollama',
 *   name: 'Local Ollama',
 *   type: 'OLLAMA',
 *   baseUrl: 'http://localhost:11434',
 *   defaultModel: 'llama3.1',
 *   maxTokens: 4096,
 *   temperature: 0.7,
 *   timeout: 60000,
 *   retryAttempts: 3,
 *   costPerToken: 0,
 *   isActive: true,
 *   isDefault: true,
 * };
 *
 * const adapter = new OllamaAdapter(config);
 * const response = await adapter.generate({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export class OllamaAdapter implements AIProviderAdapter {
  private readonly config: AIProviderConfig;

  /**
   * Create a new Ollama adapter instance.
   * @param config - Provider configuration including baseUrl and model settings
   */
  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Generate a chat completion using Ollama's /api/chat endpoint.
   *
   * Implements retry logic with exponential backoff for transient failures.
   * Ollama responses have zero cost since the model runs locally.
   *
   * @param request - The generation request with messages and parameters
   * @returns Generation response with content, usage metrics, and zero cost
   * @throws Error after all retry attempts are exhausted
   */
  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const model = request.model || this.config.defaultModel;
    const temperature = request.temperature ?? this.config.temperature;
    const maxTokens = request.maxTokens ?? this.config.maxTokens;

    const ollamaRequest: OllamaChatRequest = {
      model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    };

    // Enable JSON mode if requested
    if (request.jsonMode) {
      ollamaRequest.format = 'json';
    }

    const startTime = Date.now();
    let lastError: Error | null = null;

    // Retry with exponential backoff
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        if (attempt > 0) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          await sleep(backoffMs);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout
        );

        const response = await fetch(`${this.config.baseUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ollamaRequest),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'Unknown error');
          throw new Error(
            `Ollama API error (${response.status}): ${errorBody}`
          );
        }

        const data = (await response.json()) as OllamaChatResponse;
        const durationMs = Date.now() - startTime;

        // Ollama may not always provide token counts
        const inputTokens = data.prompt_eval_count ?? 0;
        const outputTokens = data.eval_count ?? 0;
        const totalTokens = inputTokens + outputTokens;

        return {
          content: data.message?.content ?? '',
          model: data.model ?? model,
          inputTokens,
          outputTokens,
          totalTokens,
          cost: 0, // Ollama is always zero-cost (local)
          durationMs,
          providerId: this.config.id,
          providerName: this.config.name,
          success: true,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on abort (timeout) — it's unlikely to succeed
        if (lastError.name === 'AbortError') {
          break;
        }

        // Log retry attempt (never expose sensitive data)
        console.warn(
          `[OllamaAdapter] Attempt ${attempt + 1}/${this.config.retryAttempts + 1} failed for model "${model}": ${lastError.message}`
        );
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      content: '',
      model: model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      durationMs,
      providerId: this.config.id,
      providerName: this.config.name,
      success: false,
      errorMessage: lastError?.message ?? 'Unknown error after all retry attempts',
    };
  }

  /**
   * Test connectivity to the Ollama instance.
   * Sends a simple request to the /api/tags endpoint.
   *
   * @returns true if Ollama is reachable and responding, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models on the Ollama instance.
   * Queries the /api/tags endpoint to discover installed models.
   *
   * @returns Array of model name strings (e.g. ["llama3.1:latest", "mistral:latest"])
   */
  async listModels(): Promise<string[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          `[OllamaAdapter] Failed to list models: HTTP ${response.status}`
        );
        return [];
      }

      const data = (await response.json()) as OllamaTagsResponse;
      return (data.models ?? []).map((m) => m.name);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[OllamaAdapter] Error listing models: ${msg}`);
      return [];
    }
  }
}
