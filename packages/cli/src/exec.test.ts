import { describe, expect, it } from 'vitest'
import { runCommand, startCommand } from './exec.js'

describe('exec helpers', () => {
  it('captures a fixed command result and applies its timeout', () => {
    const result = runCommand('node', ['--version'], process.cwd(), { timeoutMs: 5_000 })

    expect(result.ok).toBe(true)
    expect(result.output).toMatch(/^v\d+\./)
    expect(result.exitCode).toBe(0)
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
