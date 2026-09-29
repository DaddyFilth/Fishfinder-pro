import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAiModel, getAiProviderName, getAiVisionModel, getOllama } from './ollama'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('AI provider selection', () => {
  it('always uses Groq provider', () => {
    expect(getAiProviderName()).toBe('groq')
  })

  it('uses configured Groq model', () => {
    vi.stubEnv('GROQ_MODEL', 'groq-custom-model')
    expect(getAiModel()).toBe('groq-custom-model')
  })

  it('uses default Groq model when GROQ_MODEL is unset', () => {
    vi.stubEnv('GROQ_MODEL', undefined)
    expect(getAiModel()).toBe('llama-3.3-70b-versatile')
  })

  it('uses configured Groq vision model', () => {
    vi.stubEnv('GROQ_VISION_MODEL', 'groq-vision-model')
    expect(getAiVisionModel()).toBe('groq-vision-model')
  })

  it('throws when GROQ_VISION_MODEL is unset', () => {
    vi.stubEnv('GROQ_VISION_MODEL', undefined)
    expect(() => getAiVisionModel()).toThrow('GROQ_VISION_MODEL must be configured for image requests.')
  })

  it('configures getOllama with Groq base URL and apiKey', () => {
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')
    const client = getOllama()
    
    // @ts-expect-error - accessing private properties for validation
    expect(client.apiKey).toBe('test-groq-key')
    expect(client.baseURL).toBe('https://api.groq.com/openai/v1')
  })

  it('throws when GROQ_API_KEY is missing in getOllama', () => {
    vi.stubEnv('GROQ_API_KEY', undefined)
    expect(() => getOllama()).toThrow('GROQ_API_KEY must be configured.')
  })
})
