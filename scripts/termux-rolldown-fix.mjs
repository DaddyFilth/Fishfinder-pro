// Environment repair for Termux/Android dev hosts.
//
// rolldown (vitest's transform engine) cannot load its linux/musl native
// bindings on Android: they need `libdl.so.2` (glibc) and call `bcmp` (musl),
// neither available under bionic. rolldown ships a working Android binding,
// but npm only auto-installs optional dependency bindings when the host OS
// matches, and its platform probe reports `linux` on Termux even though the
// runtime's process.platform is `android` — so the Android binding never
// lands by default. Skip everywhere else.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

try {
  if (process.platform !== 'android') process.exit(0)
  const require = createRequire(`${process.cwd()}/[no-op]/`)
  require('@rolldown/binding-android-arm64')
  process.exit(0)
} catch {
  // Binding missing — repair below.
}

try {
  const projectRoot = process.cwd()
  const rolldownPkg = path.join(projectRoot, 'node_modules', 'rolldown', 'package.json')
  if (!existsSync(rolldownPkg)) process.exit(0)
  const rolldownVersion = JSON.parse(readFileSync(rolldownPkg, 'utf8')).version

  console.log(`[termux-fix] installing @rolldown/binding-android-arm64@${rolldownVersion} (Termux environment)`)
  execFileSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['install', '--force', '--no-save', `@rolldown/binding-android-arm64@${rolldownVersion}`],
    { cwd: projectRoot, stdio: 'inherit' },
  )
} catch (error) {
  console.warn('[termux-fix] skipped:', error instanceof Error ? error.message : error)
}
