import { spawnSync } from 'node:child_process'

const IS_WIN = process.platform === 'win32'

export interface ExecResult {
  ok: boolean
  output: string
}

/**
 * Runs a fixed command synchronously and captures its output.
 *
 * On Windows the command is passed to cmd.exe as a single string without a
 * separate args array — Node 24 deprecates args arrays with shell:true
 * (DEP0190), and .cmd shims like npm.cmd cannot be spawned without a shell.
 * Safe because every caller passes hardcoded literals, never user input.
 */
export function runCommand(
  command: string,
  args: string[],
  cwd: string,
  maxBuffer = 16 * 1024 * 1024,
): ExecResult {
  const result = IS_WIN
    ? spawnSync([command, ...args].join(' '), {
        shell: true,
        cwd,
        stdio: 'pipe',
        encoding: 'utf8',
        maxBuffer,
      })
    : spawnSync(command, args, {
        cwd,
        stdio: 'pipe',
        encoding: 'utf8',
        maxBuffer,
      })
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  }
}
