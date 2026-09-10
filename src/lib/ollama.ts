import OpenAI from 'openai';

const hasGroqKey = Boolean(process.env.GROQ_API_KEY?.trim());

export const OLLAMA_MODEL = hasGroqKey
  ? (process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b')
  : (process.env.OLLAMA_MODEL?.trim() || 'llama3.2');

export const OLLAMA_VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL?.trim() ||
  'llama3.2-vision';

export function getOllama() {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    return new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return new OpenAI({
      apiKey: openAiKey,
    });
  }

  const configuredBaseURL = process.env.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
  const cleanBase = configuredBaseURL.replace(/\/+$/, '').replace(/\/v1$/, '');
  const baseURL = cleanBase + '/v1';

  return new OpenAI({
    apiKey: process.env.OLLAMA_API_KEY?.trim() || 'ollama',
    baseURL,
    timeout: 10000,
  });
}
