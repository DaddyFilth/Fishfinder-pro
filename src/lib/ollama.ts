import OpenAI from 'openai'
import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'

export type AiProvider = 'groq' | 'gateway'

export type AiMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function generateGatewayText(messages: AiMessage[], options?: { maxTokens?: number; temperature?: number }) {
  const result = await generateText({
    model: gateway(process.env.AI_GATEWAY_MODEL?.trim() || 'openai/gpt-4o-mini'),
    messages,
    maxOutputTokens: options?.maxTokens,
    temperature: options?.temperature,
  })
  const text = result.text.trim()
  if (!text) throw new Error('AI Gateway returned no text')
  return text
}

export function hasGroqCredentials() {
  return Boolean(process.env.GROQ_API_KEY?.trim())
}

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
