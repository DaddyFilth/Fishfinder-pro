import OpenAI from 'openai'

export type AiProvider = 'groq'

function requireGroqKey() {
  const key = process.env.GROQ_API_KEY?.trim()
  if (!key) throw new Error('GROQ_API_KEY is not configured.')
  return key
}

export function getAiProviderName(): AiProvider {
  return 'groq'
}

export function getAiModel(): string {
  return process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile'
}

export function getAiVisionModel(): string {
  return process.env.GROQ_VISION_MODEL?.trim() || 'meta-llama/llama-4-scout-17b-16e-instruct'
}

export function getGroq() {
  return new OpenAI({
    apiKey: requireGroqKey(),
    baseURL: 'https://api.groq.com/openai/v1',
    timeout: 10000,
  })
}
