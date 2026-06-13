// ============================================================================
// AI Provider Layer — Provider Manager
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Central orchestrator for AI provider selection, fallback, privacy checks,
// and call logging. Follows a local-first approach: Ollama providers are
// preferred over external ones unless the project explicitly allows it.
// ============================================================================

import { db } from '@/lib/db';
import type {
  AIProviderAdapter,
  AIProviderConfig,
  AIGenerateRequest,
  AIGenerateResponse,
  AIPrivacySettings,
} from './types';
import { OllamaAdapter } from './ollama-adapter';
import { OpenAICompatibleAdapter } from './openai-adapter';

/**
 * Default privacy settings for new projects.
 * Conservative: disallow sending content to external providers by default.
 */
const DEFAULT_PRIVACY_SETTINGS: AIPrivacySettings = {
  allowExternalContent: false,
  allowExternalKeywords: false,
  allowExternalUrls: true,
  anonymizeContent: true,
  preferredProviderType: 'OLLAMA',
};

/**
 * Parse privacy settings from a JSON string, falling back to defaults.
 * @param json - JSON string from the database, or null/undefined
 * @returns Parsed privacy settings
 */
function parsePrivacySettings(json?: string | null): AIPrivacySettings {
  if (!json) return { ...DEFAULT_PRIVACY_SETTINGS };
  try {
    return { ...DEFAULT_PRIVACY_SETTINGS, ...JSON.parse(json) };
  } catch {
    return { ...DEFAULT_PRIVACY_SETTINGS };
  }
}

/**
 * Convert a Prisma AIProvider record to an AIProviderConfig.
 * Masks the API key for safety in logs.
 * @param provider - Prisma AIProvider record
 * @returns Provider configuration object
 */
function prismaToConfig(provider: {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string | null;
  defaultModel: string | null;
  maxTokens: number;
  temperature: number;
  timeout: number;
  retryAttempts: number;
  costPerToken: number;
  isActive: boolean;
  isDefault: boolean;
  privacySettings: string | null;
}): AIProviderConfig {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type as AIProviderConfig['type'],
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey ?? undefined,
    defaultModel: provider.defaultModel ?? 'llama3.1',
    maxTokens: provider.maxTokens,
    temperature: provider.temperature,
    timeout: provider.timeout,
    retryAttempts: provider.retryAttempts,
    costPerToken: provider.costPerToken,
    isActive: provider.isActive,
    isDefault: provider.isDefault,
    privacySettings: provider.privacySettings ?? undefined,
  };
}

/**
 * Create the appropriate adapter instance for a provider configuration.
 * Factory method that selects the adapter class based on provider type.
 * @param config - Provider configuration
 * @returns An adapter instance for the given provider type
 * @throws Error for unsupported provider types
 */
function createAdapter(config: AIProviderConfig): AIProviderAdapter {
  switch (config.type) {
    case 'OLLAMA':
      return new OllamaAdapter(config);
    case 'OPENAI_COMPATIBLE':
      return new OpenAICompatibleAdapter(config);
    case 'CUSTOM':
      // Custom providers default to OpenAI-compatible protocol
      return new OpenAICompatibleAdapter(config);
    default:
      throw new Error(`Unsupported provider type: ${config.type}`);
  }
}

/**
 * Check if a provider is local (runs on the same machine/network).
 * Local providers don't require privacy checks since data doesn't leave the machine.
 * @param config - Provider configuration
 * @returns true if the provider is local (Ollama or localhost-based)
 */
function isLocalProvider(config: AIProviderConfig): boolean {
  if (config.type === 'OLLAMA') return true;
  // Also consider localhost-based OpenAI-compatible endpoints as local
  const url = config.baseUrl.toLowerCase();
  return (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('0.0.0.0') ||
    url.includes('[::1]')
  );
}

/**
 * Provider Manager — the central orchestrator for AI operations.
 *
 * Responsibilities:
 * - **Provider selection**: Retrieve specific or default providers for a project
 * - **Fallback generation**: Try providers in order, falling back on failure
 * - **Privacy enforcement**: Respect project privacy settings before sending
 *   data to external providers
 * - **Call logging**: Record every AI call to the database for analytics
 * - **Token & cost tracking**: Aggregate usage metrics per project
 *
 * Designed with a **local-first** philosophy: Ollama providers are always
 * preferred unless the project explicitly allows external providers.
 *
 * @example
 * ```typescript
 * const manager = new ProviderManager();
 *
 * // Simple generation with automatic provider selection
 * const response = await manager.fallbackGenerate('project-123', {
 *   messages: [{ role: 'user', content: 'Schrijf een meta-beschrijving' }],
 *   purpose: 'meta-description',
 * });
 * ```
 */
export class ProviderManager {
  /**
   * Get a specific provider adapter by ID, or the default provider for a project.
   *
   * If `providerId` is specified, returns that provider (if it exists and is active).
   * Otherwise, returns the project's default provider.
   * If no providers are configured, creates a default Ollama provider.
   *
   * @param projectId - The project to get a provider for
   * @param providerId - Optional specific provider ID
   * @returns An AIProviderAdapter instance ready for use
   * @throws Error if the specified provider is not found or inactive
   */
  async getProvider(
    projectId: string,
    providerId?: string
  ): Promise<AIProviderAdapter> {
    if (providerId) {
      const provider = await db.aIProvider.findUnique({
        where: { id: providerId },
      });

      if (!provider || provider.projectId !== projectId) {
        throw new Error(
          `Provider "${providerId}" not found for project "${projectId}"`
        );
      }

      if (!provider.isActive) {
        throw new Error(`Provider "${provider.name}" is not active`);
      }

      if (provider.deletedAt) {
        throw new Error(`Provider "${provider.name}" has been deleted`);
      }

      return createAdapter(prismaToConfig(provider));
    }

    return this.getDefaultProvider(projectId);
  }

  /**
   * Get the default provider adapter for a project.
   *
   * Selection logic:
   * 1. Look for the project's explicitly marked default provider
   * 2. Fall back to the first active Ollama provider (local-first)
   * 3. Fall back to the first active provider of any type
   * 4. Create a default Ollama provider if none exist
   *
   * @param projectId - The project to get the default provider for
   * @returns An AIProviderAdapter instance
   */
  async getDefaultProvider(
    projectId: string
  ): Promise<AIProviderAdapter> {
    // 1. Try to find the explicitly marked default provider
    const defaultProvider = await db.aIProvider.findFirst({
      where: {
        projectId,
        isDefault: true,
        isActive: true,
        deletedAt: null,
      },
    });

    if (defaultProvider) {
      return createAdapter(prismaToConfig(defaultProvider));
    }

    // 2. Fall back to the first active Ollama provider (local-first)
    const ollamaProvider = await db.aIProvider.findFirst({
      where: {
        projectId,
        type: 'OLLAMA',
        isActive: true,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (ollamaProvider) {
      return createAdapter(prismaToConfig(ollamaProvider));
    }

    // 3. Fall back to any active provider
    const anyProvider = await db.aIProvider.findFirst({
      where: {
        projectId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (anyProvider) {
      return createAdapter(prismaToConfig(anyProvider));
    }

    // 4. Create a default Ollama provider for the project
    const newProvider = await db.aIProvider.create({
      data: {
        projectId,
        name: 'Local Ollama',
        type: 'OLLAMA',
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama3.1',
        isActive: true,
        isDefault: true,
        maxTokens: 4096,
        temperature: 0.7,
        timeout: 60000,
        retryAttempts: 3,
        costPerToken: 0,
        privacySettings: JSON.stringify(DEFAULT_PRIVACY_SETTINGS),
      },
    });

    return createAdapter(prismaToConfig(newProvider));
  }

  /**
   * Generate AI content with automatic provider fallback.
   *
   * Tries all active providers for the project in order of preference:
   * 1. Default provider
   * 2. Other Ollama providers (local-first)
   * 3. Other active providers
   *
   * If a provider fails, logs the error and tries the next one.
   * Privacy checks are performed before sending data to external providers.
   *
   * @param projectId - The project to generate content for
   * @param request - The generation request
   * @returns The first successful generation response
   * @throws Error if all providers fail
   */
  async fallbackGenerate(
    projectId: string,
    request: AIGenerateRequest
  ): Promise<AIGenerateResponse> {
    // Get project settings for privacy checks
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { settings: true },
    });

    // Get project-level privacy settings from the project's settings JSON
    const projectSettings = project?.settings
      ? JSON.parse(project.settings)
      : {};

    // Get all active providers for the project, ordered by preference
    const providers = await db.aIProvider.findMany({
      where: {
        projectId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: [
        { isDefault: 'desc' },
        { type: 'asc' }, // OLLAMA comes before OPENAI_COMPATIBLE alphabetically
        { createdAt: 'asc' },
      ],
    });

    if (providers.length === 0) {
      // Auto-create a default Ollama provider and use it
      const adapter = await this.getDefaultProvider(projectId);
      const response = await adapter.generate(request);
      await this.logAICall(
        (adapter as unknown as { config: AIProviderConfig }).config?.id ?? 'auto',
        projectId,
        response,
        request
      );
      return response;
    }

    const errors: string[] = [];

    for (const providerRecord of providers) {
      const config = prismaToConfig(providerRecord);

      // Privacy check: skip external providers if not allowed
      if (!isLocalProvider(config)) {
        const privacySettings = parsePrivacySettings(
          providerRecord.privacySettings
        );
        const allowExternal =
          projectSettings.allowExternalProviders ??
          privacySettings.allowExternalContent;

        if (!allowExternal) {
          console.info(
            `[ProviderManager] Skipping external provider "${config.name}" due to privacy settings for project "${projectId}"`
          );
          continue;
        }
      }

      try {
        const adapter = createAdapter(config);
        const response = await adapter.generate(request);

        // Log the call (success or failure)
        await this.logAICall(providerRecord.id, projectId, response, request);

        if (response.success) {
          return response;
        }

        // Response returned but not successful — try next provider
        errors.push(
          `Provider "${config.name}": ${response.errorMessage ?? 'Unknown error'}`
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Provider "${config.name}": ${msg}`);
        console.warn(
          `[ProviderManager] Provider "${config.name}" failed for project "${projectId}": ${msg}`
        );
      }
    }

    // All providers failed — return an error response
    const errorMessage =
      errors.length > 0
        ? `All providers failed: ${errors.join('; ')}`
        : 'No providers available (all blocked by privacy settings)';

    return {
      content: '',
      model: '',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      durationMs: 0,
      providerId: '',
      providerName: '',
      success: false,
      errorMessage,
    };
  }

  /**
   * Test connectivity to a specific provider.
   *
   * @param providerConfig - The provider configuration to test
   * @returns true if the provider is reachable and responding
   */
  async testProvider(providerConfig: AIProviderConfig): Promise<boolean> {
    try {
      const adapter = createAdapter(providerConfig);
      return await adapter.testConnection();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[ProviderManager] Connection test failed for "${providerConfig.name}": ${msg}`
      );
      return false;
    }
  }

  /**
   * Log an AI call to the database for analytics and cost tracking.
   *
   * Records the call outcome, token usage, cost, and duration.
   * Failed calls are also logged for debugging and monitoring.
   *
   * @param providerId - The database ID of the provider used
   * @param projectId - The project the call was made for
   * @param response - The generation response with usage metrics
   * @param request - The original request (for purpose and template tracking)
   */
  async logAICall(
    providerId: string,
    projectId: string,
    response: AIGenerateResponse,
    request: AIGenerateRequest
  ): Promise<void> {
    try {
      await db.aICallLog.create({
        data: {
          providerId,
          projectId,
          model: response.model,
          promptTemplateId: request.promptTemplateId ?? null,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          totalTokens: response.totalTokens,
          cost: response.cost,
          durationMs: response.durationMs,
          success: response.success,
          errorMessage: response.errorMessage ?? null,
          purpose: request.purpose ?? null,
        },
      });
    } catch (error) {
      // Logging failures should never break the main flow
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[ProviderManager] Failed to log AI call: ${msg}`);
    }
  }

  /**
   * Get aggregated token usage and cost for a project.
   *
   * @param projectId - The project to get usage for
   * @param days - Number of days to look back (default: 30)
   * @returns Usage summary with total tokens, cost, and call count
   */
  async getProjectUsage(
    projectId: string,
    days: number = 30
  ): Promise<{
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCost: number;
    avgDurationMs: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await db.aICallLog.findMany({
      where: {
        projectId,
        createdAt: { gte: since },
      },
      select: {
        success: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        cost: true,
        durationMs: true,
      },
    });

    const totalCalls = logs.length;
    const successfulCalls = logs.filter((l) => l.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const totalInputTokens = logs.reduce((sum, l) => sum + l.inputTokens, 0);
    const totalOutputTokens = logs.reduce((sum, l) => sum + l.outputTokens, 0);
    const totalTokens = logs.reduce((sum, l) => sum + l.totalTokens, 0);
    const totalCost = logs.reduce((sum, l) => sum + l.cost, 0);
    const avgDurationMs =
      totalCalls > 0
        ? Math.round(logs.reduce((sum, l) => sum + l.durationMs, 0) / totalCalls)
        : 0;

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCost,
      avgDurationMs,
    };
  }

  /**
   * Get all active providers for a project.
   *
   * @param projectId - The project to list providers for
   * @returns Array of provider configurations
   */
  async listProviders(projectId: string): Promise<AIProviderConfig[]> {
    const providers = await db.aIProvider.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      orderBy: [
        { isDefault: 'desc' },
        { type: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return providers.map(prismaToConfig);
  }
}

/**
 * Singleton ProviderManager instance for application-wide use.
 * Can be imported directly or instantiated separately for testing.
 */
export const providerManager = new ProviderManager();
