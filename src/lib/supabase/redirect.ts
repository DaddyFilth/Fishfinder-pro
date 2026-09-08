export function getSafeNextPath(value: string | null | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}
