export type AiProvider = 'groq' | 'openai' | 'opencode'

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
export const OPENAI_BASE_URL = 'https://api.openai.com/v1'
/** OpenCode Console exposes OpenAI-compatible chat completions, so one client shape covers all providers. */
export const OPENCODE_BASE_URL = 'https://opencode.ai/inference/openai/v1'

const REQUEST_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [250, 750] as const

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'
const DEFAULT_GROQ_VISION_MODEL = 'qwen/qwen3.8-27b'
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
/** GLM 5.3 Flash is OpenCode Console's cheapest multimodal model (text and image input). */
const DEFAULT_OPENCODE_MODEL = 'glm-5.3-flash'

/**
 * Groq retired the Llama 4 vision models. Stored configurations that still name
 * them are migrated to the current multimodal model instead of failing every
 * image request with a "model not found" error.
 */
const RETIRED_GROQ_VISION_MODELS = new Set([
  'llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
])

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

/**
 * Returns the primary provider name. Prefers Groq, then OpenAI, then OpenCode
 * Console, and falls back to 'groq' when no provider is configured so callers
 * always have a stable label.
 */
export function getAiProviderName(): AiProvider {
  if (process.env.GROQ_API_KEY?.trim()) return 'groq'
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai'
  if (opencodeApiKey()) return 'opencode'
  return 'groq'
}

/**
 * Returns the trimmed GROQ_MODEL, defaulting to 'llama-3.3-70b-versatile'
 * when unset, empty, or whitespace-only.
 */
export function getAiModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL
}

/**
 * Returns the Groq vision model for image requests: GROQ_VISION_MODEL when it
 * names a current model, otherwise the built-in multimodal default. Retired
 * Llama 4 IDs are migrated instead of being sent to the API.
 */
export function getAiVisionModel(): string {
  return getGroqVisionModel()
}

/** Returns the trimmed GROQ_VISION_MODEL, defaulting to 'qwen/qwen3.8-27b'. */
export function getGroqVisionModel(): string {
  const configured = process.env.GROQ_VISION_MODEL?.trim()
  if (!configured || RETIRED_GROQ_VISION_MODELS.has(configured.toLowerCase())) {
    return DEFAULT_GROQ_VISION_MODEL
  }
  return configured
}

/** Returns the trimmed OPENAI_MODEL, defaulting to the free-tier 'gpt-4o-mini'. */
export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL
}

/** Returns the OpenAI vision model, defaulting to the configured text model. */
export function getOpenAiVisionModel(): string {
  return process.env.OPENAI_VISION_MODEL?.trim() || getOpenAiModel()
}

/** Returns the trimmed OPENCODE_MODEL, defaulting to the multimodal 'glm-5.3-flash'. */
export function getOpenCodeModel(): string {
  return process.env.OPENCODE_MODEL?.trim() || DEFAULT_OPENCODE_MODEL
}

/** Returns the OpenCode vision model, defaulting to the configured text model (multimodal). */
export function getOpenCodeVisionModel(): string {
  return process.env.OPENCODE_VISION_MODEL?.trim() || getOpenCodeModel()
}

function opencodeApiKey(): string | undefined {
  return process.env.OPENCODE_API_KEY?.trim() || undefined
}

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<Record<string, unknown>>
}

export interface GroqChatCompletionParams {
  model: string
  messages: GroqChatMessage[]
  temperature?: number
  max_tokens?: number
  top_p?: number
  stream?: false
  response_format?: { type: 'json_object' }
}

export interface GroqChatCompletionResult {
  choices: Array<{ message: { content: string | null } }>
}

export interface GroqClient {
  apiKey: string
  baseURL: string
  chat: {
    completions: {
      create: (params: GroqChatCompletionParams) => Promise<GroqChatCompletionResult>
    }
  }
}

/**
 * Minimal OpenAI-compatible chat client, built on `fetch` so the app has no
 * runtime dependency on any provider SDK. Retries transient HTTP failures and
 * empty completions up to `MAX_ATTEMPTS`, then rejects with the last error.
 * Client creation does not send a request; only `chat.completions.create` does.
 */
function createOpenAiCompatibleClient(baseURL: string, apiKey: string, label: string): GroqClient {
  async function create(params: GroqChatCompletionParams): Promise<GroqChatCompletionResult> {
    let lastError: unknown

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      let response: Response
      try {
        response = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...params, stream: false }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          cache: 'no-store',
        })
      } catch (networkError) {
        lastError = networkError
        if (attempt < MAX_ATTEMPTS - 1) {
          await sleep(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1])
          continue
        }
        throw networkError instanceof Error ? networkError : new Error(`${label} request failed`)
      }

      if (response.ok) {
        const result = (await response.json().catch(() => null)) as GroqChatCompletionResult | null
        if (result?.choices?.[0]?.message?.content?.trim()) return result
        lastError = new Error(`${label} returned an empty response`)
      } else {
        const detail = await response.text().catch(() => '')
        const error = new Error(
          `${label} request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        )
        if (!isRetryableStatus(response.status)) throw error
        lastError = error
      }

      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1])
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`${label} request failed after retries`)
  }

  return {
    apiKey,
    baseURL,
    chat: { completions: { create } },
  }
}

/**
 * Groq client, kept as the primary provider entry point. Thin wrapper over the
 * shared OpenAI-compatible client.
 * @throws {Error} If GROQ_API_KEY is unset, empty, or whitespace-only.
 */
export function getGroqClient(): GroqClient {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('GROQ_API_KEY must be configured.')
  }
  return createOpenAiCompatibleClient(GROQ_BASE_URL, apiKey, 'Groq')
}

/** A configured provider plus the models the brain should use for it. */
export interface AiProviderTarget {
  provider: AiProvider
  model: string
  visionModel: string
  client: GroqClient
}

/**
 * The ordered provider fallback chain: Groq, then OpenAI, then OpenCode
 * Console. Providers whose API key is not configured are skipped. Returns an
 * empty array when no provider is configured, which callers surface as a
 * graceful, local reply.
 */
export function getAiProviderTargets(): AiProviderTarget[] {
  const targets: AiProviderTarget[] = []

  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (groqKey) {
    targets.push({
      provider: 'groq',
      model: getAiModel(),
      visionModel: getGroqVisionModel(),
      client: createOpenAiCompatibleClient(GROQ_BASE_URL, groqKey, 'Groq'),
    })
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (openaiKey) {
    targets.push({
      provider: 'openai',
      model: getOpenAiModel(),
      visionModel: getOpenAiVisionModel(),
      client: createOpenAiCompatibleClient(OPENAI_BASE_URL, openaiKey, 'OpenAI'),
    })
  }

  const opencodeKey = opencodeApiKey()
  if (opencodeKey) {
    targets.push({
      provider: 'opencode',
      model: getOpenCodeModel(),
      visionModel: getOpenCodeVisionModel(),
      client: createOpenAiCompatibleClient(OPENCODE_BASE_URL, opencodeKey, 'OpenCode'),
    })
  }

  return targets
}
