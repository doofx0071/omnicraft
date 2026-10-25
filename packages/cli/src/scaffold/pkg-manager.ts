import { runCommand } from '../exec.js'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

/** Detects the package manager the user invoked the CLI with, defaulting to npm. */
export function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent ?? ''
  if (userAgent.startsWith('pnpm')) return 'pnpm'
  if (userAgent.startsWith('yarn')) return 'yarn'
  if (userAgent.startsWith('bun')) return 'bun'
  return 'npm'
}

/** Installs workspace dependencies in the generated project. */
export function installDependencies(cwd: string, pm: PackageManager) {
  return runCommand(pm, ['install'], cwd)
}
