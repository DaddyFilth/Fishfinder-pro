export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2_000) return false
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
}
