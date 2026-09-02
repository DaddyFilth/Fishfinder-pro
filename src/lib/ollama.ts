import OpenAI from 'openai';

/**
 * Ollama exposes an OpenAI-compatible Chat Completions API, so we reuse the
 * `openai` SDK but point it at a local Ollama server. This keeps every AI
 * route free of per-request API costs since inference runs locally/self-hosted
 * instead of calling a paid provider like OpenAI.
 */
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL?.trim() || 'llama3.1';
export const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL?.trim() || 'llama3.2-vision';

export function getOllama() {
  const configuredBaseURL = process.env.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
  const baseURL = `${configuredBaseURL.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1`;
  return new OpenAI({ apiKey: 'ollama', baseURL });
}
