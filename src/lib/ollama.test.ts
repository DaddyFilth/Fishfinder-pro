import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAiModel, getAiProviderName, getAiVisionModel } from './ollama'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('AI provider selection', () => {
  it('prefers Groq when its key is configured', () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-key')
    vi.stubEnv('OPENAI_API_KEY', 'openai-key')
    vi.stubEnv('GROQ_MODEL', 'groq-model')
    vi.stubEnv('OPENAI_MODEL', 'openai-model')
    vi.stubEnv('GROQ_VISION_MODEL', 'groq-vision')

    expect(getAiProviderName()).toBe('groq')
    expect(getAiModel()).toBe('groq-model')
    expect(getAiVisionModel()).toBe('groq-vision')
  })

  it('uses OpenAI when Groq is not configured', () => {
    vi.stubEnv('GROQ_API_KEY', undefined)
    vi.stubEnv('OPENAI_API_KEY', 'openai-key')
    vi.stubEnv('OPENAI_MODEL', 'openai-model')
    vi.stubEnv('OPENAI_VISION_MODEL', 'openai-vision')

    expect(getAiProviderName()).toBe('openai')
    expect(getAiModel()).toBe('openai-model')
    expect(getAiVisionModel()).toBe('openai-vision')
  })

  it('falls back to Ollama models when no hosted provider is configured', () => {
    vi.stubEnv('GROQ_API_KEY', undefined)
    vi.stubEnv('OPENAI_API_KEY', undefined)
    vi.stubEnv('OLLAMA_MODEL', 'ollama-model')
    vi.stubEnv('OLLAMA_VISION_MODEL', 'ollama-vision')

    expect(getAiProviderName()).toBe('ollama')
    expect(getAiModel()).toBe('ollama-model')
    expect(getAiVisionModel()).toBe('ollama-vision')
  })

  it('requires an explicit vision model for Groq', () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-key')
    vi.stubEnv('GROQ_VISION_MODEL', undefined)

    expect(() => getAiVisionModel()).toThrow('GROQ_VISION_MODEL must be configured for image requests.')
  })
})
