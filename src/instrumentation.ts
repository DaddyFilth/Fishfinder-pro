import { validateRuntimeEnvironment } from './lib/environment/startup.js'

export function register() {
  if (process.env.NODE_ENV === 'production') validateRuntimeEnvironment()
}
