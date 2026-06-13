# Task 9 — AI Provider Layer

## Agent
AI Provider Layer Agent

## Task
Build the AI Provider Layer for SEOCoach (Dutch market): types, adapters, provider manager, and prompt template system.

## Files Created

### 1. `/src/lib/ai/types.ts` — AI Provider Types
- `AIMessage` — Chat message with role/content
- `AIGenerateRequest` — Generation request with messages, model, temperature, maxTokens, purpose, promptTemplateId, jsonMode
- `AIGenerateResponse` — Response with content, model, token usage, cost, duration, provider info, success/error
- `AIProviderConfig` — Provider config mirroring Prisma AIProvider model (id, name, type, baseUrl, apiKey, defaultModel, maxTokens, temperature, timeout, retryAttempts, costPerToken, isActive, isDefault, privacySettings)
- `AIProviderAdapter` — Interface for adapters (generate, testConnection, listModels)
- `AIPrivacySettings` — Privacy controls for external provider usage
- `BuiltinPromptTemplate` — Internal representation of built-in templates

### 2. `/src/lib/ai/ollama-adapter.ts` — Ollama Adapter
- Implements `AIProviderAdapter` for local Ollama instances
- Connects to Ollama API (default: http://localhost:11434)
- `/api/chat` endpoint for chat completions
- `/api/tags` endpoint for model discovery
- Zero cost tracking (local provider, costPerToken always 0)
- Retry with exponential backoff (configurable attempts)
- Timeout handling via AbortController
- JSON mode support via Ollama `format: "json"`
- Graceful error handling — returns failed response instead of throwing

### 3. `/src/lib/ai/openai-adapter.ts` — OpenAI-Compatible Adapter
- Implements `AIProviderAdapter` for any OpenAI-compatible API
- Works with OpenAI, Together AI, Groq, Mistral, Anyscale, LiteLLM, etc.
- `/v1/chat/completions` endpoint for generation
- `/v1/models` endpoint for model discovery
- Bearer token authentication via Authorization header
- Cost tracking based on token usage × costPerToken
- Retry with exponential backoff (only on 429 and 5xx errors)
- Timeout handling via AbortController
- JSON mode support via `response_format: { type: "json_object" }`
- Warns if no API key configured

### 4. `/src/lib/ai/provider-manager.ts` — Provider Manager
- `getProvider(projectId, providerId?)` — Get specific or default provider adapter
- `getDefaultProvider(projectId)` — Local-first selection: default → Ollama → any active → auto-create
- `fallbackGenerate(projectId, request)` — Try providers in order, fallback on failure
- `testProvider(providerConfig)` — Test connectivity
- `logAICall(providerId, projectId, response, request)` — Log to AICallLog table
- `getProjectUsage(projectId, days)` — Aggregated token/cost analytics
- `listProviders(projectId)` — List all active providers for a project
- Privacy checks: respects project privacy settings before sending data to external providers
- Local-first approach: Ollama preferred unless external explicitly allowed
- Auto-creates default Ollama provider if none exist
- Singleton `providerManager` instance exported

### 5. `/src/lib/ai/prompt-templates.ts` — Prompt Template System
- 6 built-in templates in Dutch for SEOCoach:
  - `content-brief` — Generate a content brief
  - `content-draft` — Generate a content draft
  - `intent-classification` — Classify search intent (JSON mode)
  - `quality-analysis` — Analyze content quality (E-E-A-T)
  - `meta-description` — Generate meta descriptions
  - `title-suggestions` — Suggest SEO titles
- `renderTemplate(templateId, variables)` — Render with {{variable}} interpolation
- `renderTemplateAsMessages(templateId, variables)` — Render as AIMessage[] with system/user split
- `getBuiltinTemplate(templateId)` — Get built-in template by ID
- `listBuiltinTemplates()` — List all built-in template metadata
- `getTemplate(category, providerId)` — Get active template from database
- `seedBuiltinTemplates(providerId)` — Seed built-in templates to database
- `getTemplatesByCategory(providerId)` — Group templates by category

### 6. `/src/lib/ai/index.ts` — Barrel Export
- Re-exports all types, adapters, ProviderManager, and prompt template functions

## Key Design Decisions
- **Local-first**: Ollama is always preferred over external providers unless explicitly allowed
- **Graceful degradation**: Failed providers return error responses instead of throwing, enabling fallback
- **No API keys in logs**: All logging masks sensitive data
- **Database integration**: Uses existing Prisma client from `@/lib/db`
- **Privacy enforcement**: Project-level settings control what data can be sent to external providers
- **Auto-provisioning**: If no providers exist, a default Ollama provider is auto-created

## Lint Status
All 6 new files pass ESLint with zero errors. Pre-existing lint errors in `src/lib/rules/` are unrelated.

## Dependencies
- Uses `db` from `@/lib/db` (Prisma client)
- No new npm packages required
