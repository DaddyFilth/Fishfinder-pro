import { validateRuntimeEnvironment } from './lib/environment/startup'

export function register() {
  validateRuntimeEnvironment()
}
