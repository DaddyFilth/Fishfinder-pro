import OpenAI from 'openai'

export type AiProvider = 'groq'

export function getAiProviderName(): AiProvider {
  return 'groq'
}

export function getAiModel(): string {
  return process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile'
}

export function getAiVisionModel(): string {
  const configured = process.env.GROQ_VISION_MODEL?.trim()
  if (configured) return configured
  throw new Error('GROQ_VISION_MODEL must be configured for image requests.')
}

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
