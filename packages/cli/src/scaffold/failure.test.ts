import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { formatScaffoldFailure } from './failure.js'

const targetDirs: string[] = []

afterEach(() => {
  for (const targetDir of targetDirs.splice(0)) {
    rmSync(targetDir, { recursive: true, force: true })
  }
})

describe('formatScaffoldFailure', () => {
  it('names an existing target directory and tells users to inspect partial output before retrying', () => {
    const targetDir = mkdtempSync(join(tmpdir(), 'omnicraft-scaffold-failure-'))
    targetDirs.push(targetDir)

    expect(formatScaffoldFailure(new Error('Composer failed'), targetDir)).toContain(
      `Partial scaffold may remain at "${targetDir}". Inspect it and remove incomplete files before retrying.`,
    )
  })

  it('does not claim partial scaffold output when the target is absent or not a directory', () => {
    const missingTarget = join(tmpdir(), `omnicraft-missing-${Date.now()}`)
    const fileTarget = join(mkdtempSync(join(tmpdir(), 'omnicraft-scaffold-file-')), 'target')
    targetDirs.push(fileTarget.slice(0, fileTarget.lastIndexOf('/')))
    writeFileSync(fileTarget, '')

    expect(formatScaffoldFailure(new Error('Generator failed'), missingTarget)).toBe(
      'Generator failed',
    )
    expect(formatScaffoldFailure(new Error('Generator failed'), fileTarget)).toBe(
      'Generator failed',
    )
  })
})
