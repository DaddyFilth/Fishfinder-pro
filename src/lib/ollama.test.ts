import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAiModel, getAiProviderName, getAiVisionModel } from './ollama'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('AI provider selection', () => {
  it('prefers Groq when its key is configured', () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-key')
    vi.stubEnv('GROQ_MODEL', 'groq-model')
    vi.stubEnv('OPENAI_MODEL', 'openai-model')
    vi.stubEnv('GROQ_VISION_MODEL', 'groq-vision')

    expect(getAiProviderName()).toBe('groq')
    expect(getAiModel()).toBe('groq-model')
    expect(getAiVisionModel()).toBe('groq-vision')
  })

  it('uses the Groq defaults when models are not configured', () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-key')
    vi.stubEnv('GROQ_MODEL', undefined)
    vi.stubEnv('GROQ_VISION_MODEL', undefined)

    expect(getAiProviderName()).toBe('groq')
    expect(getAiModel()).toBe('llama-3.3-70b-versatile')
    expect(getAiVisionModel()).toBe('meta-llama/llama-4-scout-17b-16e-instruct')
  })

  it('requires Groq credentials before creating a client', async () => {
    vi.stubEnv('GROQ_API_KEY', undefined)
    const { getGroq } = await import('./ollama')

    expect(() => getGroq()).toThrow('GROQ_API_KEY is not configured.')
  })
})
