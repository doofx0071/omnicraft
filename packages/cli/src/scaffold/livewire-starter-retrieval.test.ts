import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createLivewireStarterRetrievalError,
  isRetryableLivewireStarterRetrievalError,
  LIVEWIRE_STARTER_RETRIEVAL_ATTEMPTS,
  retryLivewireStarterRetrieval,
} from './livewire-starter-retrieval.js'

const targetDirs: string[] = []

function makeTargetDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'omnicraft-livewire-retrieval-'))
  targetDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of targetDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('retryLivewireStarterRetrieval', () => {
  it('retries tiged commit lookup failures wrapped by the production CLI and removes partial output', async () => {
    const targetDir = makeTargetDir()
    const attempts: number[] = []
    let calls = 0

    await expect(
      retryLivewireStarterRetrieval(
        targetDir,
        () => {
          calls += 1
          if (calls < 3) {
            const partialServer = join(targetDir, 'server')
            mkdirSync(partialServer, { recursive: true })
            writeFileSync(join(partialServer, 'partial.txt'), 'incomplete')
            throw createLivewireStarterRetrievalError(
              '! could not find commit hash for 75cf9e5cfbc18161027774fc025a1ead81eddcea',
            )
          }
          expect(existsSync(join(targetDir, 'server'))).toBe(false)
          mkdirSync(join(targetDir, 'server'), { recursive: true })
          writeFileSync(join(targetDir, 'server', 'composer.json'), '{}')
          return 'retrieved'
        },
        { retryDelayMs: 0, onRetry: (attempt) => attempts.push(attempt) },
      ),
    ).resolves.toBe('retrieved')

    expect(calls).toBe(3)
    expect(attempts).toEqual([2, 3])
    expect(readFileSync(join(targetDir, 'server', 'composer.json'), 'utf8')).toBe('{}')
  })

  it('matches transient error signatures while leaving deterministic errors unclassified', () => {
    expect(isRetryableLivewireStarterRetrievalError(new Error('ETIMEDOUT'))).toBe(true)
    expect(isRetryableLivewireStarterRetrievalError(new Error('HTTP 503 from GitHub'))).toBe(true)
    expect(isRetryableLivewireStarterRetrievalError(new Error('invalid starter-kit reference'))).toBe(
      false,
    )
  })

  it('backs off between failed transient attempts', async () => {
    const targetDir = makeTargetDir()
    const waits: number[] = []
    let calls = 0

    await expect(
      retryLivewireStarterRetrieval(
        targetDir,
        () => {
          calls += 1
          if (calls < LIVEWIRE_STARTER_RETRIEVAL_ATTEMPTS) {
            throw createLivewireStarterRetrievalError('could not find commit hash for pinned ref')
          }
          return 'retrieved'
        },
        {
          retryDelayMs: 250,
          wait: async (milliseconds) => {
            waits.push(milliseconds)
          },
        },
      ),
    ).resolves.toBe('retrieved')

    expect(calls).toBe(LIVEWIRE_STARTER_RETRIEVAL_ATTEMPTS)
    expect(waits).toEqual([250, 250])
  })

  it('recognizes the nested tiged failure text whether or not the CLI wrapper is present', () => {
    const tigedMessage = 'could not find commit hash for 75cf9e5'

    expect(isRetryableLivewireStarterRetrievalError(new Error(tigedMessage))).toBe(true)
    expect(
      isRetryableLivewireStarterRetrievalError(createLivewireStarterRetrievalError(tigedMessage)),
    ).toBe(true)
  })

  it('does not retry deterministic failures, but still removes newly-created partial output', async () => {
    const targetDir = makeTargetDir()
    let calls = 0
    const error = createLivewireStarterRetrievalError('invalid starter-kit reference')

    await expect(
      retryLivewireStarterRetrieval(
        targetDir,
        () => {
          calls += 1
          mkdirSync(join(targetDir, 'server'), { recursive: true })
          writeFileSync(join(targetDir, 'server', 'partial.txt'), 'incomplete')
          throw error
        },
        { retryDelayMs: 0 },
      ),
    ).rejects.toBe(error)

    expect(calls).toBe(1)
    expect(existsSync(join(targetDir, 'server'))).toBe(false)
  })

  it('stops after the bounded attempts and cleans the final partial target', async () => {
    const targetDir = makeTargetDir()
    let calls = 0

    await expect(
      retryLivewireStarterRetrieval(
        targetDir,
        () => {
          calls += 1
          mkdirSync(join(targetDir, 'server'), { recursive: true })
          writeFileSync(join(targetDir, 'server', 'partial.txt'), 'incomplete')
          throw createLivewireStarterRetrievalError('could not find commit hash for pinned ref')
        },
        { retryDelayMs: 0 },
      ),
    ).rejects.toThrow(/could not find commit hash/)

    expect(calls).toBe(LIVEWIRE_STARTER_RETRIEVAL_ATTEMPTS)
    expect(existsSync(join(targetDir, 'server'))).toBe(false)
  })

  it('does not remove or retry an existing server directory', async () => {
    const targetDir = makeTargetDir()
    const serverDir = join(targetDir, 'server')
    mkdirSync(serverDir)
    writeFileSync(join(serverDir, 'user-owned.txt'), 'keep')
    let calls = 0

    await expect(
      retryLivewireStarterRetrieval(
        targetDir,
        () => {
          calls += 1
          throw createLivewireStarterRetrievalError('could not find commit hash for pinned ref')
        },
        { retryDelayMs: 0 },
      ),
    ).rejects.toThrow(/could not find commit hash/)

    expect(calls).toBe(1)
    expect(readFileSync(join(serverDir, 'user-owned.txt'), 'utf8')).toBe('keep')
  })
})
