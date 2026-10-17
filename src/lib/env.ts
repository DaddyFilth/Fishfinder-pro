/**
 * Reads an environment value, trimming whitespace and stripping surrounding
 * quote characters. Deployment dashboards often store values with quotes
 * attached; sent verbatim they break URL parsing and API-key authentication,
 * which fails silently behind graceful fallbacks.
 */
export function envValue(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/^["']+/, '').replace(/["']+$/, '').trim() || undefined
}
