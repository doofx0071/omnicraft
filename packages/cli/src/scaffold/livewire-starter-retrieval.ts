import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export const LIVEWIRE_STARTER_RETRIEVAL_ATTEMPTS = 3
const RETRY_DELAY_MS = 1_000

const RETRYABLE_RETRIEVAL_ERROR =
  /could not find commit hash|\b(?:ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|ECONNREFUSED|ENOTFOUND)\b|socket hang up|fetch failed|temporarily unavailable|rate limit|too many requests|HTTP (?:408|429|5\d{2})/i

export interface LivewireStarterRetrievalOptions {
  /** Override the retry delay in tests; production uses a bounded one-second pause. */
  retryDelayMs?: number
  /** Called with the one-based attempt number that is about to start. */
  onRetry?: (attempt: number, error: unknown) => void
  /** Override the retry pause in tests; production uses a bounded one-second delay. */
  wait?: (milliseconds: number) => Promise<void>
}

/**
 * Keeps the production CLI's wrapper and the nested tiged output together so
 * transient retrieval failures can be classified from the Error the caller sees.
 */
export function createLivewireStarterRetrievalError(output: string): Error {
  return new Error(
    `Could not retrieve the pinned Laravel Livewire starter kit — check your connection and Node.js.\n${output.split('\n').slice(-10).join('\n')}`,
  )
}

/**
 * Tiged's "could not find commit hash" and common transport failures are
 * transient for the pinned upstream repository. The message alone is not
 * enough: a generic retrieval wrapper around a deterministic failure must not
 * be retried.
 */
export function isRetryableLivewireStarterRetrievalError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return RETRYABLE_RETRIEVAL_ERROR.test(message)
}

/**
 * Retries only the caller-supplied starter download operation. On failure, the
 * generated `server/` directory is removed only when it did not exist before
 * this operation; an existing directory is user-owned and is never deleted or
 * retried into. Composer installation and migrations belong after this helper.
 */
export async function retryLivewireStarterRetrieval<T>(
  targetDir: string,
  retrieve: () => T | Promise<T>,
  options: LivewireStarterRetrievalOptions = {},
): Promise<T> {
  const attempts = LIVEWIRE_STARTER_RETRIEVAL_ATTEMPTS
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0) {
    throw new RangeError('The Livewire starter retrieval retry delay must be a non-negative integer.')
  }

  const serverDir = join(targetDir, 'server')
  const preserveExistingServer = existsSync(serverDir)

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await retrieve()
    } catch (error) {
      if (!preserveExistingServer) {
        rmSync(serverDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
      }

      const shouldRetry =
        !preserveExistingServer &&
        attempt < attempts &&
        isRetryableLivewireStarterRetrievalError(error)
      if (!shouldRetry) throw error

      options.onRetry?.(attempt + 1, error)
      if (retryDelayMs > 0) {
        await (options.wait?.(retryDelayMs) ?? delay(retryDelayMs))
      }
    }
  }

  throw new Error('Livewire starter retrieval exhausted its retry attempts unexpectedly.')
}
