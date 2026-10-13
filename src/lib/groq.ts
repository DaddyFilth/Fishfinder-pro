export type AiProvider = 'groq'

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const REQUEST_TIMEOUT_MS = 15_000

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
      throw new Error(`Groq request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`)
    }

    return (await response.json()) as GroqChatCompletionResult
  }

  return {
    apiKey,
    baseURL: GROQ_BASE_URL,
    chat: { completions: { create } },
  }
}
