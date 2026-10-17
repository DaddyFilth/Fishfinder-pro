export type AiProvider = 'groq'

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const REQUEST_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [250, 750] as const

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

/** Returns 'groq' regardless of whether credentials are configured. */
export function getAiProviderName(): AiProvider {
  return 'groq'
}

/**
 * Returns the trimmed GROQ_MODEL, defaulting to 'llama-3.3-70b-versatile'
 * when unset, empty, or whitespace-only.
 */
export function getAiModel(): string {
  return process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile'
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
 * Minimal OpenAI-compatible chat client for Groq's REST API. Built on `fetch`
 * so the app has no runtime dependency on any OpenAI SDK. Client creation does
 * not send a request; only `chat.completions.create` does.
 * @throws {Error} If GROQ_API_KEY is unset, empty, or whitespace-only.
 */
export function getGroqClient(): GroqClient {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('GROQ_API_KEY must be configured.')
  }

  async function create(params: GroqChatCompletionParams): Promise<GroqChatCompletionResult> {
    let lastError: unknown

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...params, stream: false }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          cache: 'no-store',
        })

        if (!response.ok) {
          const detail = await response.text().catch(() => '')
          const error = new Error(`Groq request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`)
          if (!isRetryableStatus(response.status) || attempt === MAX_ATTEMPTS - 1) return Promise.reject(error)
          if (attempt === MAX_ATTEMPTS - 1) throw error
          lastError = error
        } else {
          const result = (await response.json()) as GroqChatCompletionResult
          if (result.choices?.[0]?.message?.content?.trim()) return result
          lastError = new Error('Groq returned an empty response')
          if (attempt === MAX_ATTEMPTS - 1) throw lastError
        }
      } catch (error) {
        lastError = error
        if (attempt === MAX_ATTEMPTS - 1) throw error
      }

      await sleep(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1])
    }

    throw lastError instanceof Error ? lastError : new Error('Groq request failed after retries')
  }

  return {
    apiKey,
    baseURL: GROQ_BASE_URL,
    chat: { completions: { create } },
  }
}
