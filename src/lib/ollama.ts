import OpenAI from 'openai';

export const OLLAMA_MODEL =
  process.env.GROQ_MODEL?.trim() ||
  process.env.OLLAMA_MODEL?.trim() ||
  'llama-3.3-70b-versatile';

export const OLLAMA_VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL?.trim() ||
  'llama-3.2-11b-vision-preview';

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
