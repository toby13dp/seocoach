// ============================================================================
// AI Provider Layer — Barrel Export
// SEOCoach: AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Re-exports all AI provider layer modules from a single entry point.
// Import from '@/lib/ai' to access the full AI provider functionality.
// ============================================================================

// Types
export type {
  AIMessage,
  AIGenerateRequest,
  AIGenerateResponse,
  AIProviderConfig,
  AIProviderAdapter,
  AIPrivacySettings,
  BuiltinPromptTemplate,
} from './types';

// Adapters
export { OllamaAdapter } from './ollama-adapter';
export { OpenAICompatibleAdapter } from './openai-adapter';

// Provider Manager
export { ProviderManager, providerManager } from './provider-manager';

// Prompt Templates
export {
  BUILTIN_TEMPLATES,
  renderTemplate,
  renderTemplateAsMessages,
  getBuiltinTemplate,
  listBuiltinTemplates,
  getTemplate,
  seedBuiltinTemplates,
  getTemplatesByCategory,
} from './prompt-templates';
