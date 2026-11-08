import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'

const GRADLE_DOWNLOAD_BACKOFF_MS = [1_000, 2_000] as const
export const GRADLE_DOWNLOAD_MAX_ATTEMPTS = GRADLE_DOWNLOAD_BACKOFF_MS.length + 1
export const GRADLE_WRAPPER_NETWORK_TIMEOUT_MS = 60_000

const OFFICIAL_GRADLE_DISTRIBUTION_URL =
  /^https:\/\/services\.gradle\.org\/distributions\/gradle-[0-9]+(?:\.[0-9]+)+-(?:bin|all)\.zip$/

function propertyEntries(
  lines: string[],
  propertyName: string,
): Array<{ index: number; value: string }> {
  return lines.flatMap((line, index) => {
    const content = line.trimStart()
    if (!content || content.startsWith('#') || content.startsWith('!')) return []

    const property = content.match(/^([^\\\s:=]+)(?:\s*[:=]\s*|\s+)(.*)$/)
    if (property?.[1] === propertyName) return [{ index, value: property[2] }]

    const keyWithoutValue = content.match(/^([^\\\s:=]+)$/)?.[1]
    return keyWithoutValue === propertyName ? [{ index, value: '' }] : []
  })
}

/** Set a longer download timeout only for the official distribution in this CI fixture. */
export function withGradleWrapperNetworkTimeout(
  properties: string,
  timeoutMs = GRADLE_WRAPPER_NETWORK_TIMEOUT_MS,
): string {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('The Gradle Wrapper network timeout must be a positive integer.')
  }

  const lines = properties.split(/\r?\n/)
  const hasTrailingNewline = /(?:\r\n|\n)$/.test(properties)
  if (hasTrailingNewline) lines.pop()

  const distributionUrlEntries = propertyEntries(lines, 'distributionUrl')
  if (distributionUrlEntries.length !== 1) {
    throw new Error('The generated Gradle Wrapper must contain exactly one distributionUrl.')
  }
  const distributionUrl = distributionUrlEntries[0].value.replace(/\\:/g, ':')
  if (!distributionUrl || !OFFICIAL_GRADLE_DISTRIBUTION_URL.test(distributionUrl)) {
    throw new Error('The generated Gradle Wrapper does not use the official Gradle distribution URL.')
  }

  const lineEnding = properties.includes('\r\n') ? '\r\n' : '\n'
  const timeoutLines = propertyEntries(lines, 'networkTimeout').map(({ index }) => index)
  if (timeoutLines.length > 1) {
    throw new Error('The generated Gradle Wrapper properties contain duplicate networkTimeout values.')
  }

  const timeoutLine = `networkTimeout=${timeoutMs}`
  if (timeoutLines.length === 1) {
    lines[timeoutLines[0]] = timeoutLine
  } else {
    lines.push(timeoutLine)
  }

  return lines.join(lineEnding) + (hasTrailingNewline ? lineEnding : '')
}

/**
 * Expo generated Gradle 9.4.1 at the failing baseline. Wrapper-native retries
 * arrived in Gradle 9.5.0, so match only the observed official distribution errors here.
 */
const GRADLE_DISTRIBUTION_URL_PATTERN =
  'https://services\\.gradle\\.org/distributions/gradle-[0-9]+(?:\\.[0-9]+)+-(?:bin|all)\\.zip'

const RETRYABLE_GRADLE_DISTRIBUTION_TIMEOUT = new RegExp(
  'Downloading from ' +
    GRADLE_DISTRIBUTION_URL_PATTERN +
    ' failed: timeout \\([0-9]+ms\\)',
  'i',
)

const RETRYABLE_GRADLE_DISTRIBUTION_SERVER_ERROR = new RegExp(
  'Server returned HTTP response code:\\s*(?:500|502|503|504) for URL:\\s*' +
    GRADLE_DISTRIBUTION_URL_PATTERN,
  'i',
)

export interface GradleDownloadRetryOptions {
  /** Called with the failed attempt and its original, redacted subprocess diagnostic. */
  onRetry?: (failedAttempt: number, delayMs: number, error: unknown) => void
  /** Override the clock and wait in deterministic tests. */
  now?: () => number
  wait?: (milliseconds: number) => Promise<void>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Retries observed Gradle Wrapper download timeouts and transient HTTP 500/502/503/504 errors. */
export function isRetryableGradleDistributionDownloadError(error: unknown): boolean {
  const message = errorMessage(error)
  return (
    RETRYABLE_GRADLE_DISTRIBUTION_TIMEOUT.test(message) ||
    RETRYABLE_GRADLE_DISTRIBUTION_SERVER_ERROR.test(message)
  )
}

function formatFailures(failures: Array<{ attempt: number; message: string }>): string {
  return failures
    .map(({ attempt, message }) =>
      'Attempt ' + attempt + '/' + GRADLE_DOWNLOAD_MAX_ATTEMPTS + ':\n' + message,
    )
    .join('\n\n')
}

/**
 * Retries the Android Gradle build only when its official distribution download
 * failed transiently. All attempts share the build's original timeout budget.
 */
export async function runGradleBuildWithDownloadRetry<T>(
  runAttempt: (remainingTimeoutMs: number) => Promise<T>,
  timeoutMs: number,
  options: GradleDownloadRetryOptions = {},
): Promise<T> {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('The Gradle build timeout must be a positive integer.')
  }

  const now = options.now ?? (() => performance.now())
  const wait = options.wait ?? ((milliseconds: number) => delay(milliseconds))
  const deadline = now() + timeoutMs
  const failures: Array<{ attempt: number; message: string }> = []

  for (let attempt = 1; attempt <= GRADLE_DOWNLOAD_MAX_ATTEMPTS; attempt += 1) {
    const remainingTimeoutMs = deadline - now()
    if (remainingTimeoutMs <= 0) break

    try {
      return await runAttempt(remainingTimeoutMs)
    } catch (error) {
      if (!isRetryableGradleDistributionDownloadError(error)) {
        if (failures.length === 0) throw error
        throw new Error(
          'Gradle build failed after a transient distribution-download retry.\n' +
            'Previous wrapper-download failures:\n' +
            formatFailures(failures) +
            '\n\nFinal non-retryable build failure:\n' +
            errorMessage(error),
        )
      }

      failures.push({ attempt, message: errorMessage(error) })
      if (attempt === GRADLE_DOWNLOAD_MAX_ATTEMPTS) break

      const retryDelayMs = GRADLE_DOWNLOAD_BACKOFF_MS[attempt - 1]
      const remainingAfterFailureMs = deadline - now()
      if (remainingAfterFailureMs <= retryDelayMs) break

      options.onRetry?.(attempt, retryDelayMs, error)
      await wait(retryDelayMs)
    }
  }

  if (failures.length === 0) {
    throw new Error('The Gradle build timeout budget expired before the build could start.')
  }

  const retryStoppedForTimeout =
    failures.length < GRADLE_DOWNLOAD_MAX_ATTEMPTS
      ? ' Retry stopped because the remaining build-time budget could not ' +
        'accommodate another backoff and attempt.'
      : ''

  throw new Error(
    'Gradle distribution download failed after ' +
      failures.length +
      (failures.length === 1 ? ' attempt.' : ' attempts.') +
      retryStoppedForTimeout +
      '\n' +
      formatFailures(failures),
  )
}
