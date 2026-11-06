/**
 * Bounded retry around pinned official starter-kit retrieval (v1.0.7 polish C).
 *
 * php-livewire-auth-e2e and php-inertia-react-auth-e2e drive the production
 * CLI, whose Laravel Livewire path clones pinned commits with tiged and whose
 * Inertia React path runs `composer create-project` against pinned
 * `:dev-main#<commit>` refs. On 5 November 2026 a transient tiged/GitHub
 * fetch failure ("could not find commit hash for 75cf9e5…") failed one
 * retrieval and killed the whole hosted gate even though the pinned inputs
 * were fine. This helper gives both scripts the same bounded retry pattern as
 * scripts/lib/dwait.ts gives the Docker waiters: three attempts with a
 * 5s/15s backoff, retrying only failures that match the retrieval adapters'
 * own error text — deterministic assertion failures still throw on the first
 * attempt.
 */
import { setTimeout as delay } from 'node:timers/promises'

export const STARTER_RETRIEVAL_ATTEMPTS = 3
export const STARTER_RETRIEVAL_BACKOFF_MS: readonly number[] = [5_000, 15_000]

/**
 * Error fragments produced by the retrieval adapters themselves. `could not
 * find commit hash for` and `could not clone` come from tiged's own failure
 * output; `could not retrieve the pinned laravel` is the CLI's wrapper
 * message for both the Livewire and Inertia React starter-kit paths. Anything
 * else (flag rejections, manifest assertions, migration failures) rethrows
 * immediately.
 */
const RETRIEVAL_FAILURE_SIGNATURES = [
  'could not find commit hash for',
  'could not clone',
  'could not retrieve the pinned laravel',
] as const

export function isTransientStarterRetrievalFailure(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return RETRIEVAL_FAILURE_SIGNATURES.some((signature) => message.includes(signature))
}

/**
 * Runs `attempt` up to three times, waiting 5s then 15s between attempts, and
 * rethrows anything that does not look like a transient retrieval failure.
 * The `label` keeps the retry log line attributable to its scenario.
 */
export async function retryStarterKitRetrieval<T>(
  label: string,
  attempt: (attemptNumber: number) => T,
): Promise<T> {
  for (let attemptNumber = 1; attemptNumber <= STARTER_RETRIEVAL_ATTEMPTS; attemptNumber += 1) {
    try {
      return attempt(attemptNumber)
    } catch (error) {
      if (attemptNumber >= STARTER_RETRIEVAL_ATTEMPTS || !isTransientStarterRetrievalFailure(error)) {
        throw error
      }
      const backoffMs = STARTER_RETRIEVAL_BACKOFF_MS[attemptNumber - 1] ?? 15_000
      console.warn(
        `[${label}] transient starter-kit retrieval failure (attempt ${attemptNumber}/${STARTER_RETRIEVAL_ATTEMPTS}); retrying in ${Math.round(backoffMs / 1000)}s`,
      )
      await delay(backoffMs)
    }
  }
  /* The loop always returns or throws; this satisfies the type checker. */
  throw new Error('starter-kit retrieval retry loop exited unexpectedly')
}
