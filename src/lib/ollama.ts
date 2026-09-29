import OpenAI from 'openai'

export type AiProvider = 'groq'

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

/**
 * Creates a new OpenAI SDK client for Groq using the trimmed GROQ_API_KEY
 * and a 10-second request timeout. Client creation does not send a request.
 * @throws {Error} If GROQ_API_KEY is unset, empty, or whitespace-only.
 * Errors from SDK initialization also propagate to the caller.
 */
export function getOllama() {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('GROQ_API_KEY must be configured.')
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
    timeout: 10000,
  })
}
