import type { Instrumentation } from 'next'
import { validateRuntimeEnvironment } from './lib/environment/startup.js'

export function register() {
  if (process.env.NODE_ENV === 'production') validateRuntimeEnvironment()
}

/**
 * Server-error reporting hook. Auth, CSP and session handling all live in src/proxy.ts, so
 * `routeType: 'proxy'` is one of the most valuable signals this app can surface.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error)
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? String(error.digest)
      : undefined

  console.error('[request-error]', {
    message,
    digest,
    method: request.method,
    path: request.path,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  })
}