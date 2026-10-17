import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GROQ_BASE_URL, getAiModel, getAiProviderName, getAiProviderTargets, getAiVisionModel, getGroqClient } from './groq'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('AI provider selection', () => {
  it('always uses Groq provider', () => {
    vi.stubEnv('GROQ_API_KEY', undefined)
    vi.stubEnv('OPENAI_API_KEY', undefined)
    vi.stubEnv('OPENCODE_API_KEY', undefined)
    expect(getAiProviderName()).toBe('groq')
  })

  it('uses configured Groq model', () => {
    vi.stubEnv('GROQ_MODEL', 'groq-custom-model')
    expect(getAiModel()).toBe('groq-custom-model')
  })

  it('uses default Groq model when GROQ_MODEL is unset', () => {
    vi.stubEnv('GROQ_MODEL', undefined)
    expect(getAiProviderName()).toBe('groq')
    expect(getAiModel()).toBe('llama-3.3-70b-versatile')
  })

  it('uses configured Groq vision model', () => {
    vi.stubEnv('GROQ_VISION_MODEL', 'groq-vision-model')
    expect(getAiVisionModel()).toBe('groq-vision-model')
  })

  it('defaults to the current multimodal model when GROQ_VISION_MODEL is unset', () => {
    vi.stubEnv('GROQ_VISION_MODEL', undefined)
    expect(getAiVisionModel()).toBe('qwen/qwen3.8-27b')
  })

  it('migrates retired Llama 4 vision model IDs to the current model', () => {
    vi.stubEnv('GROQ_VISION_MODEL', 'llama-4-scout-17b-16e-instruct')
    expect(getAiVisionModel()).toBe('qwen/qwen3.8-27b')

    vi.stubEnv('GROQ_VISION_MODEL', 'meta-llama/llama-4-maverick-17b-128e-instruct')
    expect(getAiVisionModel()).toBe('qwen/qwen3.8-27b')
  })

  it('gives every configured provider target a vision model', () => {
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')
    vi.stubEnv('GROQ_VISION_MODEL', undefined)
    vi.stubEnv('OPENAI_API_KEY', undefined)
    vi.stubEnv('OPENCODE_API_KEY', undefined)

    const targets = getAiProviderTargets()
    expect(targets).toHaveLength(1)
    expect(targets[0]?.provider).toBe('groq')
    expect(targets[0]?.visionModel).toBe('qwen/qwen3.8-27b')
  })

  it('reports OpenCode as the provider when only OPENCODE_API_KEY is configured', () => {
    vi.stubEnv('GROQ_API_KEY', undefined)
    vi.stubEnv('OPENAI_API_KEY', undefined)
    vi.stubEnv('OPENCODE_API_KEY', 'test-opencode-key')

    expect(getAiProviderName()).toBe('opencode')
  })

  it('strips surrounding quotes from provider keys and models', () => {
    vi.stubEnv('GROQ_API_KEY', '"test-groq-key"')
    vi.stubEnv('GROQ_MODEL', "'custom-groq-model'")
    vi.stubEnv('OPENAI_API_KEY', undefined)
    vi.stubEnv('OPENCODE_API_KEY', undefined)

    expect(getAiProviderName()).toBe('groq')
    const targets = getAiProviderTargets()
    expect(targets).toHaveLength(1)
    expect(targets[0]?.model).toBe('custom-groq-model')
    expect(targets[0]?.client.apiKey).toBe('test-groq-key')
  })

  it('keeps a quoted OpenCode key usable as the provider credential', () => {
    vi.stubEnv('GROQ_API_KEY', undefined)
    vi.stubEnv('OPENAI_API_KEY', undefined)
    vi.stubEnv('OPENCODE_API_KEY', '"test-opencode-key"')

    expect(getAiProviderName()).toBe('opencode')
    expect(getAiProviderTargets()[0]?.client.apiKey).toBe('test-opencode-key')
  })

  it('adds an OpenCode target with the multimodal default model', () => {
    vi.stubEnv('GROQ_API_KEY', undefined)
    vi.stubEnv('OPENAI_API_KEY', undefined)
    vi.stubEnv('OPENCODE_API_KEY', 'test-opencode-key')

    const targets = getAiProviderTargets()
    expect(targets).toHaveLength(1)
    expect(targets[0]?.provider).toBe('opencode')
    expect(targets[0]?.model).toBe('glm-5.3-flash')
    expect(targets[0]?.visionModel).toBe('glm-5.3-flash')
    expect(targets[0]?.client.baseURL).toBe('https://opencode.ai/inference/openai/v1')
  })

  it('uses configured OpenCode models', () => {
    vi.stubEnv('GROQ_API_KEY', undefined)
    vi.stubEnv('OPENAI_API_KEY', undefined)
    vi.stubEnv('OPENCODE_API_KEY', 'test-opencode-key')
    vi.stubEnv('OPENCODE_MODEL', 'custom-text-model')
    vi.stubEnv('OPENCODE_VISION_MODEL', 'custom-vision-model')

    const targets = getAiProviderTargets()
    expect(targets[0]).toMatchObject({ model: 'custom-text-model', visionModel: 'custom-vision-model' })
  })

  it('orders the provider chain Groq, then OpenAI, then OpenCode', () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-key')
    vi.stubEnv('OPENAI_API_KEY', 'openai-key')
    vi.stubEnv('OPENCODE_API_KEY', 'opencode-key')

    expect(getAiProviderTargets().map((target) => target.provider)).toEqual(['groq', 'openai', 'opencode'])
  })

  it('configures getGroqClient with Groq base URL and apiKey', () => {
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')
    const client = getGroqClient()

    expect(client.apiKey).toBe('test-groq-key')
    expect(client.baseURL).toBe(GROQ_BASE_URL)
    expect(client.baseURL).toBe('https://api.groq.com/openai/v1')
  })

  it('throws when GROQ_API_KEY is missing in getGroqClient', () => {
    vi.stubEnv('GROQ_API_KEY', undefined)
    expect(() => getGroqClient()).toThrow('GROQ_API_KEY must be configured.')
  })
})

describe('getGroqClient().chat.completions.create', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('POSTs OpenAI-compatible chat.completions payload to Groq', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
    )

    const client = getGroqClient()
    const result = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
    })

    expect(result.choices[0]?.message.content).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${GROQ_BASE_URL}/chat/completions`)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-groq-key')
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    })
  })

  it('throws a descriptive error when Groq responds with a non-2xx status', async () => {
    fetchMock.mockResolvedValue(new Response('rate limited', { status: 429 }))

    const client = getGroqClient()
    await expect(
      client.chat.completions.create({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/Groq request failed \(429\)/)
  })

  it('does not retry non-retryable HTTP errors', async () => {
    fetchMock.mockResolvedValue(new Response('unauthorized', { status: 401 }))

    const client = getGroqClient()
    await expect(
      client.chat.completions.create({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/Groq request failed \(401\)/)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
