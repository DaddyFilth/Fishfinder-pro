import { validateRuntimeEnvironment } from './lib/environment/startup.js'

export function register() {
  validateRuntimeEnvironment()
}
