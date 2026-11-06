import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const REGISTRY_URL = 'https://registry.npmjs.org/create-omnicraft/latest'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * Semver-style comparison of x.y.z[-prerelease][+build] versions: numeric
 * per-segment comparison of the base, then semver prerelease precedence
 * (rule 11). A prerelease binds to its own base version and sorts BELOW it:
 * 1.0.5-beta.1 < 1.0.5 < 1.0.6-beta.1 — so a prerelease install like
 * 1.0.5-beta.1 still sees the 1.0.5 stable notice, while a prerelease of a
 * higher base (1.0.6-beta.1) still outranks the older stable 1.0.5. Build
 * metadata is ignored.
 */
export function compareVersions(a: string, b: string): number {
  const [baseA, preA] = splitCoreVersion(a)
  const [baseB, preB] = splitCoreVersion(b)
  const pa = baseA.split('.').map(Number)
  const pb = baseB.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  if (preA === undefined && preB === undefined) return 0
  if (preA === undefined) return 1 // stable outranks a prerelease of the same base
  if (preB === undefined) return -1
  return comparePrerelease(preA, preB)
}

/** Splits "x.y.z[-prerelease][+build]" into the numeric base and prerelease string. */
function splitCoreVersion(version: string): [string, string | undefined] {
  const plus = version.indexOf('+')
  const core = plus === -1 ? version : version.slice(0, plus)
  const dash = core.indexOf('-')
  return dash === -1 ? [core, undefined] : [core.slice(0, dash), core.slice(dash + 1)]
}

/** Semver rule 11: numeric identifiers compare numerically and rank below alphanumeric ones. */
function comparePrerelease(a: string, b: string): number {
  const idsA = a.split('.')
  const idsB = b.split('.')
  for (let i = 0; i < Math.max(idsA.length, idsB.length); i++) {
    const left = idsA[i]
    const right = idsB[i]
    if (left === undefined) return -1 // fewer identifiers sorts lower
    if (right === undefined) return 1
    const leftNumeric = /^\d+$/.test(left)
    const rightNumeric = /^\d+$/.test(right)
    if (leftNumeric && rightNumeric) {
      const diff = Number(left) - Number(right)
      if (diff !== 0) return diff < 0 ? -1 : 1
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1
    } else if (left !== right) {
      return left < right ? -1 : 1
    }
  }
  return 0
}

interface CacheShape {
  checkedAt: number
  latest: string
}

function readCache(cacheFile: string, now: number): string | null {
  try {
    const cache = JSON.parse(readFileSync(cacheFile, 'utf8')) as unknown
    if (typeof cache !== 'object' || cache === null || Array.isArray(cache)) return null

    const candidate = cache as Partial<CacheShape>
    if (
      typeof candidate.checkedAt !== 'number' ||
      !Number.isFinite(candidate.checkedAt) ||
      typeof candidate.latest !== 'string'
    ) {
      return null
    }
    if (candidate.checkedAt > now) return null
    if (now - candidate.checkedAt < CHECK_INTERVAL_MS) return candidate.latest
  } catch {
    // missing or corrupt cache — just re-check
  }
  return null
}

function writeCache(cacheFile: string, latest: string, now: number): void {
  try {
    mkdirSync(dirname(cacheFile), { recursive: true })
    writeFileSync(cacheFile, JSON.stringify({ checkedAt: now, latest } satisfies CacheShape))
  } catch {
    // cache is best-effort
  }
}

export interface CheckDeps {
  fetchFn?: typeof fetch
  now?: () => number
  cacheFile?: string
}

/** Update notices are interactive-only and can be disabled in CI or by env. */
export function shouldCheckForUpdate(
  isInteractive: boolean | undefined,
  env: Partial<Pick<NodeJS.ProcessEnv, 'NO_UPDATE_NOTIFIER' | 'CI'>> = process.env,
): boolean {
  return isInteractive === true && !env.NO_UPDATE_NOTIFIER && !env.CI
}

/**
 * Returns the newest published version when it is newer than `current`,
 * otherwise null. Cached for 24h and fails silently (never blocks or breaks
 * the CLI). Callers decide whether to skip the check (NO_UPDATE_NOTIFIER / CI).
 */
export async function checkForUpdate(current: string, deps: CheckDeps = {}): Promise<string | null> {
  const now = deps.now?.() ?? Date.now()
  const cacheFile = deps.cacheFile ?? join(tmpdir(), 'create-omnicraft-update-check.json')
  const cached = readCache(cacheFile, now)
  const latest =
    cached ??
    (await (async () => {
      try {
        const res = await (deps.fetchFn ?? fetch)(REGISTRY_URL, { signal: AbortSignal.timeout(2000) })
        if (!res.ok) return null
        const json = (await res.json()) as { version?: string }
        if (typeof json.version !== 'string') return null
        writeCache(cacheFile, json.version, now)
        return json.version
      } catch {
        return null
      }
    })())

  if (!latest) return null
  return compareVersions(latest, current) > 0 ? latest : null
}

/** Used by tests to simulate cache freshness without touching the clock. */
export function isCacheFresh(cacheFile: string, now = Date.now()): boolean {
  try {
    return now - statSync(cacheFile).mtimeMs < CHECK_INTERVAL_MS
  } catch {
    return false
  }
}
