// ============================================================================
// AI Provider Layer — Type Definitions
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================

/**
 * Represents a single message in an AI conversation.
 * Follows the standard chat completion message format.
 */
export interface AIMessage {
  /** The role of the message author */
  role: 'system' | 'user' | 'assistant';
  /** The text content of the message */
  content: string;
}

/**
 * Request payload for AI text generation.
 * Supports chat-style interactions with multiple messages,
 * optional model override, and generation parameters.
 */
export interface AIGenerateRequest {
  /** Ordered list of conversation messages */
  messages: AIMessage[];
  /** Override the provider's default model (e.g. "llama3.1", "gpt-4o") */
  model?: string;
  /** Sampling temperature (0.0 = deterministic, 1.0 = creative). Default: provider setting */
  temperature?: number;
  /** Maximum number of tokens to generate in the response */
  maxTokens?: number;
  /** Purpose categorization for logging and analytics (e.g. "brief", "draft", "quality") */
  purpose?: string;
  /** Optional prompt template ID to pre-fill the system/user messages */
  promptTemplateId?: string;
  /** Request JSON-structured output instead of plain text */
  jsonMode?: boolean;
}

/**
 * Response from an AI generation call, including usage metrics
 * and cost information for tracking and analytics.
 */
export interface AIGenerateResponse {
  /** The generated text content */
  content: string;
  /** The model that was actually used (may differ from request) */
  model: string;
  /** Number of tokens in the input/prompt */
  inputTokens: number;
  /** Number of tokens in the generated output */
  outputTokens: number;
  /** Total tokens consumed (input + output) */
  totalTokens: number;
  /** Calculated cost in USD based on costPerToken */
  cost: number;
  /** Wall-clock duration of the API call in milliseconds */
  durationMs: number;
  /** Database ID of the AI provider that handled the request */
  providerId: string;
  /** Human-readable name of the provider */
  providerName: string;
  /** Whether the call succeeded */
  success: boolean;
  /** Error message if the call failed */
  errorMessage?: string;
}

/**
 * Configuration for an AI provider, mirroring the Prisma AIProvider model.
 * Used to instantiate provider adapters and manage connections.
 */
export interface AIProviderConfig {
  /** Unique identifier (UUID) */
  id: string;
  /** Human-readable provider name */
  name: string;
  /** Provider type determining the API protocol to use */
  type: 'OLLAMA' | 'OPENAI_COMPATIBLE' | 'CUSTOM';
  /** Base URL for the provider API (e.g. "http://localhost:11434") */
  baseUrl: string;
  /** API key for authentication (optional for local providers like Ollama) */
  apiKey?: string;
  /** Default model to use when not specified in request */
  defaultModel: string;
  /** Maximum tokens the provider supports per request */
  maxTokens: number;
  /** Default sampling temperature */
  temperature: number;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Number of retry attempts on transient failures */
  retryAttempts: number;
  /** Cost per token in USD (0 for local/free providers) */
  costPerToken: number;
  /** Whether this provider is currently active */
  isActive: boolean;
  /** Whether this is the default provider for the project */
  isDefault: boolean;
  /** Project-scoped privacy settings as JSON string */
  privacySettings?: string;
}

/**
 * Abstract adapter interface for AI providers.
 * Each provider type (Ollama, OpenAI-compatible, etc.) implements this
 * interface to provide a uniform API for text generation, connection
 * testing, and model discovery.
 */
export interface AIProviderAdapter {
  /**
   * Generate a text completion using the provider's chat API.
   * @param request - The generation request with messages and parameters
   * @returns The generation response with content, usage, and cost data
   */
  generate(request: AIGenerateRequest): Promise<AIGenerateResponse>;

  /**
   * Test connectivity to the provider's API.
   * @returns true if the provider is reachable and responding
   */
  testConnection(): Promise<boolean>;

  /**
   * List available models on the provider.
   * @returns Array of model identifier strings
   */
  listModels(): Promise<string[]>;
}

/**
 * Privacy settings for a project's AI usage.
 * Controls what data can be sent to external providers.
 */
export interface AIPrivacySettings {
  /** Allow sending content data to external (non-local) AI providers */
  allowExternalContent: boolean;
  /** Allow sending keyword data to external providers */
  allowExternalKeywords: boolean;
  /** Allow sending website URL data to external providers */
  allowExternalUrls: boolean;
  /** Anonymize content before sending to external providers */
  anonymizeContent: boolean;
  /** Preferred provider type (falls back to local if external is disallowed) */
  preferredProviderType: 'OLLAMA' | 'OPENAI_COMPATIBLE' | 'CUSTOM';
}

/**
 * Internal representation of a built-in prompt template
 * before it is persisted to the database.
 */
export interface BuiltinPromptTemplate {
  /** Template identifier / key */
  id: string;
  /** Human-readable template name */
  name: string;
  /** Description of what this template generates */
  description: string;
  /** The prompt template with {{variable}} placeholders */
  template: string;
  /** Semantic category (e.g. "brief", "draft", "quality") */
  category: string;
  /** Template version string */
  version: string;
  /** List of variable names expected by the template */
  variables: string[];
  /** System message prefix for chat-style generation */
  systemMessage?: string;
}
