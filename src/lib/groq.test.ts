import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GROQ_BASE_URL, getAiModel, getAiProviderName, getAiVisionModel, getGroqClient } from './groq'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
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
    expect(getAiProviderName()).toBe('groq')
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
})
