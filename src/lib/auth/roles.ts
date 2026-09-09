export const APP_ROLES = ['angler', 'moderator', 'admin'] as const

export type AppRole = (typeof APP_ROLES)[number]

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole)
}

export function normalizeRole(value: unknown): AppRole {
  return isAppRole(value) ? value : 'angler'
}

export const ROLE_LABELS: Record<AppRole, string> = {
  angler: 'Angler',
  moderator: 'Moderator',
  admin: 'Administrator',
}
