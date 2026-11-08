import { describe, expect, it } from 'vitest'
import {
  GRADLE_DOWNLOAD_MAX_ATTEMPTS,
  isRetryableGradleDistributionDownloadError,
  runGradleBuildWithDownloadRetry,
} from './gradle-download-retry.js'

const BUILD_TIMEOUT_MS = 10_000
const distributionUrl = 'https://services.gradle.org/distributions/gradle-9.4.1-bin.zip'

function timeoutFailure(): Error {
  return new Error('Downloading from ' + distributionUrl + ' failed: timeout (10000ms)')
}

function gatewayFailure(attempt: number): Error {
  return new Error(
    'java.io.IOException: Server returned HTTP response code: 504 for URL: ' +
      distributionUrl +
      ' (attempt ' +
      attempt +
      ')',
  )
}

describe('runGradleBuildWithDownloadRetry', () => {
  it('retries an observed wrapper download timeout and succeeds on the next attempt', async () => {
    const waits: number[] = []
    const retryEvidence: string[] = []
    let calls = 0

    const result = await runGradleBuildWithDownloadRetry(
      async () => {
        calls += 1
        if (calls === 1) throw timeoutFailure()
        return 'apk built'
      },
      BUILD_TIMEOUT_MS,
      {
        wait: async (milliseconds) => {
          waits.push(milliseconds)
        },
        onRetry: (failedAttempt, delayMs, error) => {
          retryEvidence.push(failedAttempt + ':' + delayMs + ':' + String(error))
        },
      },
    )

    expect(result).toBe('apk built')
    expect(calls).toBe(2)
    expect(waits).toEqual([1_000])
    expect(retryEvidence).toHaveLength(1)
    expect(retryEvidence[0]).toContain(
      'Downloading from https://services.gradle.org/distributions/gradle-9.4.1-bin.zip failed: timeout',
    )
  })

  it(
    'stops at the bounded attempt count and preserves every wrapper-download diagnostic',
    async () => {
      const waits: number[] = []
      const failures: string[] = []
      let calls = 0
      let finalError: unknown

      try {
        await runGradleBuildWithDownloadRetry(
          async () => {
            calls += 1
            const error = gatewayFailure(calls)
            failures.push(error.message)
            throw error
          },
          BUILD_TIMEOUT_MS,
          {
            wait: async (milliseconds) => {
              waits.push(milliseconds)
            },
          },
        )
      } catch (error) {
        finalError = error
      }

      expect(finalError).toBeInstanceOf(Error)
      const finalMessage = finalError instanceof Error ? finalError.message : ''
      expect(finalMessage).toMatch(/Gradle distribution download failed after 3 attempts/)
      expect(GRADLE_DOWNLOAD_MAX_ATTEMPTS).toBe(3)
      expect(calls).toBe(GRADLE_DOWNLOAD_MAX_ATTEMPTS)
      expect(waits).toEqual([1_000, 2_000])
      for (const failure of failures) {
        expect(failure).toContain('HTTP response code: 504')
        expect(finalMessage).toContain(failure)
      }
    },
  )

  it('does not retry a compiler or Gradle task failure', async () => {
    const error = new Error(
      'Execution failed for task :app:compileDebugKotlin. Unresolved reference: MainActivity',
    )
    let calls = 0
    const waits: number[] = []

    await expect(
      runGradleBuildWithDownloadRetry(
        async () => {
          calls += 1
          throw error
        },
        BUILD_TIMEOUT_MS,
        { wait: async (milliseconds) => void waits.push(milliseconds) },
      ),
    ).rejects.toBe(error)

    expect(calls).toBe(1)
    expect(waits).toEqual([])
    expect(isRetryableGradleDistributionDownloadError(error)).toBe(false)
  })

  it('does not retry unrelated subprocess failures or non-transient HTTP errors', async () => {
    const error = new Error('spawn gradlew ENOENT')
    let calls = 0

    await expect(
      runGradleBuildWithDownloadRetry(
        async () => {
          calls += 1
          throw error
        },
        BUILD_TIMEOUT_MS,
        { wait: async () => undefined },
      ),
    ).rejects.toBe(error)

    expect(calls).toBe(1)
    expect(
      isRetryableGradleDistributionDownloadError(
        new Error('Server returned HTTP response code: 404 for URL: ' + distributionUrl),
      ),
    ).toBe(false)
    for (const status of [501, 505]) {
      expect(
        isRetryableGradleDistributionDownloadError(
          new Error(
            'Server returned HTTP response code: ' + status + ' for URL: ' + distributionUrl,
          ),
        ),
      ).toBe(false)
    }
    expect(
      isRetryableGradleDistributionDownloadError(
        new Error(
          'Server returned HTTP response code: 504 for URL: https://example.invalid/gradle.zip',
        ),
      ),
    ).toBe(false)
  })

  it('returns immediately when the build succeeds on its first attempt', async () => {
    const waits: number[] = []
    let calls = 0

    await expect(
      runGradleBuildWithDownloadRetry(
        async () => {
          calls += 1
          return 'apk built'
        },
        BUILD_TIMEOUT_MS,
        { wait: async (milliseconds) => void waits.push(milliseconds) },
      ),
    ).resolves.toBe('apk built')

    expect(calls).toBe(1)
    expect(waits).toEqual([])
  })

  it('shares one timeout budget across attempts instead of multiplying the build timeout', async () => {
    let now = 0
    const attemptTimeouts: number[] = []
    let calls = 0

    await expect(
      runGradleBuildWithDownloadRetry(
        async (remainingTimeoutMs) => {
          attemptTimeouts.push(remainingTimeoutMs)
          calls += 1
          if (calls === 1) {
            now += 4_000
            throw timeoutFailure()
          }
          return 'apk built'
        },
        BUILD_TIMEOUT_MS,
        {
          now: () => now,
          wait: async (milliseconds) => {
            now += milliseconds
          },
        },
      ),
    ).resolves.toBe('apk built')

    expect(attemptTimeouts).toEqual([10_000, 5_000])
    expect(calls).toBe(2)
  })
})
