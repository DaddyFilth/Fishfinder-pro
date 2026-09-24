import OpenAI from 'openai'

export type AiProvider = 'groq' | 'openai' | 'ollama'

export function getAiProviderName(): AiProvider {
  if (process.env.GROQ_API_KEY?.trim()) return 'groq'
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai'
  return 'ollama'
}

export function getAiModel(): string {
  const provider = getAiProviderName()
  if (provider === 'groq') return process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile'
  if (provider === 'openai') return process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
  return process.env.OLLAMA_MODEL?.trim() || 'llama3.2'
}

export function getAiVisionModel(): string {
  const provider = getAiProviderName()
  if (provider === 'groq') {
    const configured = process.env.GROQ_VISION_MODEL?.trim()
    if (configured) return configured
    throw new Error('GROQ_VISION_MODEL must be configured for image requests.')
  }
  if (provider === 'openai') return process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o-mini'
  return process.env.OLLAMA_VISION_MODEL?.trim() || 'llama3.2-vision'
}

export function getOllama() {
  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (groqKey) {
    return new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 10000,
    })
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  if (openAiKey) {
    return new OpenAI({
      apiKey: openAiKey,
      timeout: 10000,
    })
  }

  const configuredBaseURL = process.env.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434'
  const cleanBase = configuredBaseURL.replace(/\/+$/, '').replace(/\/v1$/, '')

  return new OpenAI({
    apiKey: process.env.OLLAMA_API_KEY?.trim() || 'ollama',
    baseURL: `${cleanBase}/v1`,
    timeout: 10000,
  })
}
