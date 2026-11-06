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
export function getNativePackageManager(
  platform: 'mobile' | 'desktop',
  invokedManager: PackageManager,
): PackageManager {
  // create-tauri-app is pinned to --manager npm; Expo detects the manager from its caller.
  return platform === 'desktop' ? 'npm' : invokedManager
}

export interface NativeInstallPlan {
  packageManager: PackageManager
  shouldInstall: boolean
}

/** Resolves the native install step without executing a generator or package manager. */
export function planNativeInstall(
  platform: 'mobile' | 'desktop',
  invokedManager: PackageManager,
  skipInstall: boolean,
): NativeInstallPlan {
  return {
    packageManager: getNativePackageManager(platform, invokedManager),
    shouldInstall: !skipInstall,
  }
}

export function formatInstallCommand(pm: PackageManager): string {
  return pm === 'yarn' ? 'yarn' : `${pm} install`
}

export function installDependencies(cwd: string, pm: PackageManager): Promise<boolean> {
  return runCommandVisible(pm, ['install'], cwd)
}
