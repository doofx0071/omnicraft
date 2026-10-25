import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const REGISTRY_URL = 'https://registry.npmjs.org/create-omnicraft/latest'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

/** Numeric per-segment comparison of plain x.y.z versions; prereleases compare equal to their base. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('-')[0].split('.').map(Number)
  const pb = b.split('-')[0].split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

interface CacheShape {
  checkedAt: number
  latest: string
}

function readCache(cacheFile: string, now: number): string | null {
  try {
    const cache = JSON.parse(readFileSync(cacheFile, 'utf8')) as CacheShape
    if (now - cache.checkedAt < CHECK_INTERVAL_MS) return cache.latest
  } catch {
    // missing or corrupt cache — just re-check
  }
  return null
}

function writeCache(cacheFile: string, latest: string, now: number): void {
  try {
    mkdirSync(join(cacheFile, '..'), { recursive: true })
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
