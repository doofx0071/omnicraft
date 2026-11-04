import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const IS_WIN = process.platform === 'win32'
const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024
const MAX_CAPTURED_OUTPUT = 1024 * 1024

/**
 * Characters cmd.exe treats as operators or expands on the win32 spawn path
 * (whitespace included — it separates argv tokens). A token containing any of
 * these must be double-quoted.
 */
const WIN32_META_RE = /[\s"&|<>^()!%]/

/**
 * Quotes one token of a win32 command string for cmd.exe: tokens containing
 * whitespace or cmd.exe metacharacters are double-quoted and embedded double
 * quotes are doubled (the CRT convention every child inherits through cmd).
 *
 * Callers still pass hardcoded literals only; this is defense-in-depth so
 * user-derived paths (a target dir under a spaced cwd like `John Doe`, or an
 * absolute generator target) cannot split into extra tokens or execute as
 * cmd.exe operators.
 */
export function quoteWin32Token(token: string): string {
  if (!WIN32_META_RE.test(token)) return token
  return `"${token.replaceAll('"', '""')}"`
}

/**
 * Joins a command and its args into the single string win32 spawns run
 * through cmd.exe (`spawn`/`spawnSync` with `shell: true` must not receive a
 * separate args array — Node 24 deprecates that combination, DEP0190, and
 * .cmd shims like npm.cmd cannot spawn without a shell anyway).
 */
export function joinWin32Command(command: string, args: string[]): string {
  return [command, ...args].map(quoteWin32Token).join(' ')
}

/**
 * npm 11 `npx` re-resolves its working directory to the nearest package.json
 * prefix, so an official generator can silently write its skeleton elsewhere
 * while still exiting 0. Every generator run must prove its output landed in
 * the target directory before OmniCraft overlays templates on top of it —
 * otherwise the overlay applies to an empty dir and the user gets a
 * half-generated project recorded as a success.
 */
export function assertGeneratorOutput(
  targetDir: string,
  marker: string,
  generator: string,
): void {
  if (!existsSync(join(targetDir, marker))) {
    throw new Error(
      `${generator} reported success but its output is missing from "${targetDir}". ` +
        `npm may have re-resolved the working directory — look for a stray skeleton next to the nearest package.json, remove it, and retry.`,
    )
  }
}

export interface ExecResult {
  ok: boolean
  output: string
  exitCode: number | null
}

export interface RunCommandOptions {
  env?: NodeJS.ProcessEnv
  maxBuffer?: number
  timeoutMs?: number
}

export interface StartCommandOptions {
  env?: NodeJS.ProcessEnv
  maxOutputBytes?: number
}

export interface StartedCommand {
  readonly output: string
  readonly exited: Promise<ExecResult>
  stop(timeoutMs?: number): Promise<void>
}

/**
 * Runs a fixed command synchronously and captures its output.
 *
 * On Windows the command is passed to cmd.exe as a single string without a
 * separate args array — Node 24 deprecates args arrays with shell:true
 * (DEP0190), and .cmd shims like npm.cmd cannot be spawned without a shell.
 * joinWin32Command quotes tokens so a spaced cwd or absolute target path
 * cannot split into extra tokens or run as cmd.exe operators.
 */
export function runCommand(
  command: string,
  args: string[],
  cwd: string,
  optionsOrMaxBuffer: RunCommandOptions | number = DEFAULT_MAX_BUFFER,
): ExecResult {
  const options =
    typeof optionsOrMaxBuffer === 'number' ? { maxBuffer: optionsOrMaxBuffer } : optionsOrMaxBuffer
  const result = IS_WIN
    ? spawnSync(joinWin32Command(command, args), {
        shell: true,
        cwd,
        env: options.env,
        timeout: options.timeoutMs,
        stdio: 'pipe',
        encoding: 'utf8',
        maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
      })
    : spawnSync(command, args, {
        cwd,
        env: options.env,
        timeout: options.timeoutMs,
        stdio: 'pipe',
        encoding: 'utf8',
        maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
      })
  return {
    ok: result.status === 0,
    output:
      `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}`.trim(),
    exitCode: result.status,
  }
}

/**
 * Starts a fixed command and captures a bounded output tail for readiness checks and failure reports.
 * On Windows, the joined command string follows the same .cmd-shim rule as runCommand.
 */
export function startCommand(
  command: string,
  args: string[],
  cwd: string,
  options: StartCommandOptions = {},
): StartedCommand {
  const child = IS_WIN
    ? spawn(joinWin32Command(command, args), {
        shell: true,
        cwd,
        env: options.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    : spawn(command, args, {
        cwd,
        detached: true,
        env: options.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

  const maxOutputBytes = options.maxOutputBytes ?? MAX_CAPTURED_OUTPUT
  let output = ''
  let closed = false
  let resolveExit!: (result: ExecResult) => void
  const exited = new Promise<ExecResult>((resolve) => {
    resolveExit = resolve
  })

  const appendOutput = (chunk: Buffer | string) => {
    output += chunk.toString()
    if (Buffer.byteLength(output) > maxOutputBytes) {
      output = Buffer.from(output).subarray(-maxOutputBytes).toString()
    }
  }

  child.stdout?.on('data', appendOutput)
  child.stderr?.on('data', appendOutput)
  child.once('error', (error) => {
    appendOutput(error.message)
    close(false, null)
  })
  child.once('close', (code) => close(code === 0, code))

  function close(ok: boolean, exitCode: number | null): void {
    if (closed) return
    closed = true
    resolveExit({ ok, output: output.trim(), exitCode })
  }

  return {
    get output() {
      return output.trim()
    },
    exited,
    async stop(timeoutMs = 5_000) {
      if (closed) return

      if (IS_WIN && child.pid) {
        // The command may have spawned npm/node grandchildren under cmd.exe.
        spawnSync('taskkill', ['/pid', `${child.pid}`, '/t', '/f'], {
          stdio: 'ignore',
        })
      } else if (child.pid) {
        try {
          process.kill(-child.pid, 'SIGTERM')
        } catch {
          child.kill('SIGTERM')
        }
      } else {
        child.kill('SIGTERM')
      }

      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, timeoutMs))])
      if (!closed) {
        if (IS_WIN && child.pid) {
          spawnSync('taskkill', ['/pid', `${child.pid}`, '/t', '/f'], {
            stdio: 'ignore',
          })
        } else if (child.pid) {
          try {
            process.kill(-child.pid, 'SIGKILL')
          } catch {
            child.kill('SIGKILL')
          }
        } else {
          child.kill('SIGKILL')
        }
        await exited
      }
    },
  }
}

/**
 * Runs a fixed command with its output streamed straight to the terminal —
 * used for dependency installs so the user watches the real progress
 * (package counts, warnings, the package manager's own progress bar).
 */
export function runCommandVisible(
  command: string,
  args: string[],
  cwd: string,
  options: Pick<RunCommandOptions, 'env'> = {},
): Promise<boolean> {
  return new Promise((resolveResult) => {
    const child = IS_WIN
      ? spawn(joinWin32Command(command, args), {
          shell: true,
          cwd,
          env: options.env,
          stdio: 'inherit',
        })
      : spawn(command, args, { cwd, env: options.env, stdio: 'inherit' })
    child.on('error', () => resolveResult(false))
    child.on('close', (code) => resolveResult(code === 0))
  })
}
