import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  assertGeneratorOutput,
  GENERATOR_MAX_BUFFER,
  GENERATOR_TIMEOUT_MS,
  joinWin32Command,
  quoteWin32Token,
  runCommand,
  startCommand,
} from './exec.js'

vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>()
  return { ...original, spawnSync: vi.fn(original.spawnSync) }
})

describe('exec helpers', () => {
  it('captures a fixed command result and applies its timeout', () => {
    const result = runCommand('node', ['--version'], process.cwd(), { timeoutMs: 5_000 })

    expect(result.ok).toBe(true)
    expect(result.output).toMatch(/^v\d+\./)
    expect(result.exitCode).toBe(0)
  })

  it('passes the default timeout and output ceiling to captured commands when none is specified', () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      pid: 1,
      output: [],
      stdout: 'ok',
      stderr: '',
      status: 0,
      signal: null,
    })

    const result = runCommand('node', ['--version'], process.cwd())

    expect(result.ok).toBe(true)
    expect(spawnSync).toHaveBeenLastCalledWith(
      ...(process.platform === 'win32' ? [expect.any(String)] : ['node', ['--version']]),
      expect.objectContaining({ timeout: 300_000 }),
    )

    runCommand('node', ['--version'], process.cwd(), {
      maxBuffer: GENERATOR_MAX_BUFFER,
      timeoutMs: GENERATOR_TIMEOUT_MS,
    })
    expect(spawnSync).toHaveBeenLastCalledWith(
      ...(process.platform === 'win32' ? [expect.any(String)] : ['node', ['--version']]),
      expect.objectContaining({
        maxBuffer: 64 * 1024 * 1024,
        timeout: 600_000,
      }),
    )
  })

  it('stops a running command and exposes its captured output', async () => {
    const command = process.platform === 'win32' ? 'ping' : 'sleep'
    const args = process.platform === 'win32' ? ['-t', '127.0.0.1'] : ['30']
    const child = startCommand(command, args, process.cwd())

    await new Promise((resolve) => setTimeout(resolve, 50))
    await child.stop()

    const result = await child.exited
    expect(result.ok).toBe(false)
    expect(result.exitCode).not.toBe(0)
  })
})

describe('win32 command quoting', () => {
  const tempDirs: string[] = []
  function makeSpacedCwd(): string {
    const dir = join(mkdtempSync(join(tmpdir(), 'omnicraft-exec-')), 'John Doe')
    mkdirSync(dir, { recursive: true })
    tempDirs.push(dir)
    return dir
  }

  afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  })

  it('quotes tokens with whitespace or cmd.exe metacharacters', () => {
    expect(quoteWin32Token('plain')).toBe('plain')
    expect(quoteWin32Token('--skip-install')).toBe('--skip-install')
    expect(quoteWin32Token('John Doe')).toBe('"John Doe"')
    expect(quoteWin32Token('a&b')).toBe('"a&b"')
    expect(quoteWin32Token('say "hi"')).toBe('"say ""hi"""')
    expect(quoteWin32Token('C:\\Users\\John Doe\\my-app')).toBe('"C:\\Users\\John Doe\\my-app"')
  })

  it('joins a command into the single win32 shell string', () => {
    expect(
      joinWin32Command('npx', [
        '--yes',
        'create-expo-app@latest',
        'C:\\apps\\my app',
        '--no-install',
      ]),
    ).toBe('npx --yes create-expo-app@latest "C:\\apps\\my app" --no-install')
  })

  it('runs a command with spaced args from a spaced cwd like John Doe', () => {
    const result = runCommand(
      'node',
      ['-e', 'console.log(process.argv[1])', 'John Doe arg'],
      makeSpacedCwd(),
      { timeoutMs: 15_000 },
    )

    expect(result.ok).toBe(true)
    expect(result.output).toBe('John Doe arg')
  })

  it('passes cmd.exe metacharacters through as literal data', () => {
    const result = runCommand(
      'node',
      ['-e', 'console.log(process.argv[1])', 'a&b|c'],
      process.cwd(),
      { timeoutMs: 15_000 },
    )

    expect(result.ok).toBe(true)
    expect(result.output).toBe('a&b|c')
  })
})

describe('assertGeneratorOutput', () => {
  const tempDirs: string[] = []
  function makeTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'omnicraft-genout-'))
    tempDirs.push(dir)
    return dir
  }

  afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  })

  it('passes when the generator skeleton landed in the target', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'package.json'), '{}')

    expect(() => assertGeneratorOutput(dir, 'package.json', 'create-next-app')).not.toThrow()
  })

  it('fails with a clear error when the skeleton landed elsewhere', () => {
    const dir = makeTempDir()

    expect(() => assertGeneratorOutput(dir, 'package.json', 'create-next-app')).toThrow(
      /create-next-app reported success but its output is missing from/,
    )
    expect(() =>
      assertGeneratorOutput(dir, 'server/composer.json', 'composer create-project'),
    ).toThrow(/composer create-project reported success/)
  })
})
