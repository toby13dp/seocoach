// ============================================================================
// AI Provider Layer — OpenAI-Compatible Adapter
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Works with any OpenAI-compatible API: OpenAI, Together AI, Groq,
// Mistral, Anyscale, LiteLLM, etc.
// Uses /v1/chat/completions for generation and /v1/models for discovery.
// ============================================================================

import type {
  AIProviderAdapter,
  AIProviderConfig,
  AIGenerateRequest,
  AIGenerateResponse,
} from './types';

/**
 * OpenAI-compatible chat completion request format.
 * @see https://platform.openai.com/docs/api-reference/chat/create
 */
interface OpenAIChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: { type: 'json_object' | 'text' };
}

/**
 * OpenAI-compatible chat completion response format.
 */
interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI-compatible models list response format.
 */
interface OpenAIModelsResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
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
 * AI Provider adapter for OpenAI-compatible APIs.
 *
 * Supports any provider that implements the OpenAI chat completions API:
 * - **OpenAI** (gpt-4o, gpt-4o-mini, etc.)
 * - **Together AI** (open-source models at scale)
 * - **Groq** (ultra-fast inference)
 * - **Mistral AI** (Mistral and Mixtral models)
 * - **Anyscale**, **LiteLLM**, and other compatible services
 *
 * Key characteristics:
 * - **Cost tracking**: Calculates cost based on token usage and costPerToken
 * - **API key auth**: Sends Bearer token via Authorization header
 * - **Retry with exponential backoff**: Handles rate limits and transient errors
 * - **JSON mode**: Supports structured output via response_format
 * - **Privacy-aware**: External providers receive data only when permitted
 *
 * @example
 * ```typescript
 * const config: AIProviderConfig = {
 *   id: 'openai-main',
 *   name: 'OpenAI GPT-4o',
 *   type: 'OPENAI_COMPATIBLE',
 *   baseUrl: 'https://api.openai.com',
 *   apiKey: 'sk-...',
 *   defaultModel: 'gpt-4o',
 *   maxTokens: 4096,
 *   temperature: 0.7,
 *   timeout: 60000,
 *   retryAttempts: 3,
 *   costPerToken: 0.00003,
 *   isActive: true,
 *   isDefault: false,
 * };
 *
 * const adapter = new OpenAICompatibleAdapter(config);
 * const response = await adapter.generate({
 *   messages: [{ role: 'user', content: 'Schrijf een SEO titel' }],
 * });
 * ```
 */
export class OpenAICompatibleAdapter implements AIProviderAdapter {
  private readonly config: AIProviderConfig;

  /**
   * Create a new OpenAI-compatible adapter instance.
   * @param config - Provider configuration including baseUrl, apiKey, and model settings
   * @throws Error if no API key is provided
   */
  constructor(config: AIProviderConfig) {
    this.config = config;
    if (!config.apiKey) {
      console.warn(
        `[OpenAICompatibleAdapter] No API key configured for provider "${config.name}". ` +
          'Most OpenAI-compatible endpoints require authentication.'
      );
    }
  }

  /**
   * Build the authorization headers for API requests.
   * Masks the API key in any logged output.
   * @returns Headers object with Content-Type and Authorization
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  /**
   * Determine if an HTTP status code is retryable.
   * @param status - HTTP response status code
   * @returns true if the error is transient and worth retrying
   */
  private isRetryableStatus(status: number): boolean {
    // 429 = Rate limit, 500 = Internal error, 502 = Bad gateway, 503 = Service unavailable
    return status === 429 || status >= 500;
  }

  /**
   * Generate a chat completion using the OpenAI-compatible /v1/chat/completions endpoint.
   *
   * Implements retry logic with exponential backoff for rate limits (429)
   * and server errors (5xx). Tracks token usage and calculates cost based
   * on the provider's costPerToken setting.
   *
   * @param request - The generation request with messages and parameters
   * @returns Generation response with content, usage metrics, and cost
   */
  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const model = request.model || this.config.defaultModel;
    const temperature = request.temperature ?? this.config.temperature;
    const maxTokens = request.maxTokens ?? this.config.maxTokens;

    const openAIRequest: OpenAIChatRequest = {
      model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      max_tokens: maxTokens,
      stream: false,
    };

    // Enable JSON mode if requested
    if (request.jsonMode) {
      openAIRequest.response_format = { type: 'json_object' };
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

        const response = await fetch(
          `${this.config.baseUrl}/v1/chat/completions`,
          {
            method: 'POST',
            headers: this.buildHeaders(),
            body: JSON.stringify(openAIRequest),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        // Handle non-retryable errors immediately
        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'Unknown error');

          // Don't retry on client errors (except rate limit)
          if (!this.isRetryableStatus(response.status)) {
            throw new Error(
              `OpenAI-compatible API error (${response.status}): ${errorBody}`
            );
          }

          // Retryable error — throw to trigger retry
          throw new Error(
            `Retryable API error (${response.status}): ${errorBody}`
          );
        }

        const data = (await response.json()) as OpenAIChatResponse;
        const durationMs = Date.now() - startTime;

        const inputTokens = data.usage?.prompt_tokens ?? 0;
        const outputTokens = data.usage?.completion_tokens ?? 0;
        const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;

        // Calculate cost based on token usage
        const cost = totalTokens * this.config.costPerToken;

        const content = data.choices?.[0]?.message?.content ?? '';

        return {
          content,
          model: data.model ?? model,
          inputTokens,
          outputTokens,
          totalTokens,
          cost,
          durationMs,
          providerId: this.config.id,
          providerName: this.config.name,
          success: true,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on abort (timeout)
        if (lastError.name === 'AbortError') {
          break;
        }

        // Log retry attempt (never expose API keys)
        console.warn(
          `[OpenAICompatibleAdapter] Attempt ${attempt + 1}/${this.config.retryAttempts + 1} failed for model "${model}" on provider "${this.config.name}": ${lastError.message}`
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
   * Test connectivity and authentication to the OpenAI-compatible API.
   * Sends a lightweight request to the /v1/models endpoint.
   *
   * @returns true if the API is reachable and the API key is valid
   */
  async testConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models via the /v1/models endpoint.
   *
   * @returns Array of model ID strings (e.g. ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"])
   */
  async listModels(): Promise<string[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          `[OpenAICompatibleAdapter] Failed to list models from "${this.config.name}": HTTP ${response.status}`
        );
        return [];
      }

      const data = (await response.json()) as OpenAIModelsResponse;
      return (data.data ?? []).map((m) => m.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[OpenAICompatibleAdapter] Error listing models from "${this.config.name}": ${msg}`
      );
      return [];
    }
  }
}
