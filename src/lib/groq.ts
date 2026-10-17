export type AiProvider = 'groq' | 'openai' | 'gemini'

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
export const OPENAI_BASE_URL = 'https://api.openai.com/v1'
/** Google exposes an OpenAI-compatible surface for Gemini, so one client shape covers all providers. */
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'

const REQUEST_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [250, 750] as const

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

/**
 * Returns the primary provider name. Prefers Groq, then OpenAI, then Gemini,
 * and falls back to 'groq' when no provider is configured so callers always
 * have a stable label.
 */
export function getAiProviderName(): AiProvider {
  if (process.env.GROQ_API_KEY?.trim()) return 'groq'
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai'
  if (geminiApiKey()) return 'gemini'
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
 * Returns the trimmed GROQ_VISION_MODEL for image requests.
 * @throws {Error} If GROQ_VISION_MODEL is unset, empty, or whitespace-only.
 */
export function getAiVisionModel(): string {
  const configured = process.env.GROQ_VISION_MODEL?.trim()
  if (configured) return configured
  throw new Error('GROQ_VISION_MODEL must be configured for image requests.')
}

/** Returns the trimmed OPENAI_MODEL, defaulting to the free-tier 'gpt-4o-mini'. */
export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL
}

/** Returns the OpenAI vision model, defaulting to the configured text model. */
export function getOpenAiVisionModel(): string {
  return process.env.OPENAI_VISION_MODEL?.trim() || getOpenAiModel()
}

/** Returns the trimmed GEMINI_MODEL, defaulting to the free-tier 'gemini-2.0-flash'. */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || process.env.GOOGLE_MODEL?.trim() || DEFAULT_GEMINI_MODEL
}

/** Returns the Gemini vision model, defaulting to the configured text model. */
export function getGeminiVisionModel(): string {
  return process.env.GEMINI_VISION_MODEL?.trim() || process.env.GOOGLE_VISION_MODEL?.trim() || getGeminiModel()
}

function geminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || undefined
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
 * The ordered provider fallback chain: Groq, then OpenAI, then Gemini. Providers
 * whose API key is not configured are skipped. Returns an empty array when no
 * provider is configured, which callers surface as a graceful, local reply.
 */
export function getAiProviderTargets(): AiProviderTarget[] {
  const targets: AiProviderTarget[] = []

  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (groqKey) {
    targets.push({
      provider: 'groq',
      model: getAiModel(),
      visionModel: process.env.GROQ_VISION_MODEL?.trim() || getAiModel(),
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

  const geminiKey = geminiApiKey()
  if (geminiKey) {
    targets.push({
      provider: 'gemini',
      model: getGeminiModel(),
      visionModel: getGeminiVisionModel(),
      client: createOpenAiCompatibleClient(GEMINI_BASE_URL, geminiKey, 'Gemini'),
    })
  }

  return targets
}
