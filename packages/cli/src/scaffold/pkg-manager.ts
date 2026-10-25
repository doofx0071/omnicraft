import { spawnSync } from 'node:child_process'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

/** Detects the package manager the user invoked the CLI with, defaulting to npm. */
export function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent ?? ''
  if (userAgent.startsWith('pnpm')) return 'pnpm'
  if (userAgent.startsWith('yarn')) return 'yarn'
  if (userAgent.startsWith('bun')) return 'bun'
  return 'npm'
}

const SHELL = process.platform === 'win32'

export interface CommandResult {
  ok: boolean
  output: string
}

function run(cmd: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'pipe',
    shell: SHELL,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  return { ok: result.status === 0, output }
}

/** Installs workspace dependencies in the generated project. */
export function installDependencies(cwd: string, pm: PackageManager): CommandResult {
  return run(pm, ['install'], cwd)
}
