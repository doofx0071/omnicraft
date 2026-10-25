import { runCommandVisible } from '../exec.js'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

/** Detects the package manager the user invoked the CLI with, defaulting to npm. */
export function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent ?? ''
  if (userAgent.startsWith('pnpm')) return 'pnpm'
  if (userAgent.startsWith('yarn')) return 'yarn'
  if (userAgent.startsWith('bun')) return 'bun'
  return 'npm'
}

/**
 * Installs workspace dependencies, streaming the package manager's live
 * output (progress bar, added-packages summary, warnings) to the terminal.
 */
export function installDependencies(cwd: string, pm: PackageManager): Promise<boolean> {
  return runCommandVisible(pm, ['install'], cwd)
}
