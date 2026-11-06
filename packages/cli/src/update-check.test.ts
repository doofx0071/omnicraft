import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkForUpdate, compareVersions, shouldCheckForUpdate } from './update-check.js'

describe('shouldCheckForUpdate', () => {
  it('skips non-interactive runs, CI, and an explicit opt-out', () => {
    expect(shouldCheckForUpdate(false, {})).toBe(false)
    expect(shouldCheckForUpdate(true, { CI: '1' })).toBe(false)
    expect(shouldCheckForUpdate(true, { NO_UPDATE_NOTIFIER: '1' })).toBe(false)
    expect(shouldCheckForUpdate(true, {})).toBe(true)
  })
})

describe('compareVersions', () => {
  it('orders plain semver', () => {
    expect(compareVersions('0.2.0', '0.1.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0)
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0)
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0)
    expect(compareVersions('0.1.0', '0.2.0')).toBeLessThan(0)
  })

  it('ranks a prerelease below its own base version (semver rule: prerelease < stable)', () => {
    expect(compareVersions('1.0.5-beta.1', '1.0.5')).toBeLessThan(0)
    expect(compareVersions('1.0.5', '1.0.5-beta.1')).toBeGreaterThan(0)
    expect(compareVersions('1.0.5', '1.0.5')).toBe(0)
  })

  it('ranks a prerelease of a higher base above the older stable (follows semver)', () => {
    // 1.0.6-beta.1 > 1.0.5: the numeric base wins before prerelease is considered.
    expect(compareVersions('1.0.6-beta.1', '1.0.5')).toBeGreaterThan(0)
    expect(compareVersions('1.0.5', '1.0.6-beta.1')).toBeLessThan(0)
  })

  it('orders prerelease identifiers per semver precedence', () => {
    expect(compareVersions('1.0.5-beta.1', '1.0.5-beta.2')).toBeLessThan(0)
    expect(compareVersions('1.0.5-alpha', '1.0.5-beta')).toBeLessThan(0)
    expect(compareVersions('1.0.5-beta', '1.0.5-beta.1')).toBeLessThan(0) // fewer identifiers sorts lower
    expect(compareVersions('1.0.5-1', '1.0.5-alpha')).toBeLessThan(0) // numeric < alphanumeric
    expect(compareVersions('1.0.5-beta.1', '1.0.5-beta.1')).toBe(0)
  })

  it('ignores build metadata', () => {
    expect(compareVersions('1.0.5+build.7', '1.0.5')).toBe(0)
    expect(compareVersions('1.0.5-beta.1+build.7', '1.0.5-beta.1')).toBe(0)
  })
})

function freshCacheDir(): string {
  return mkdtempSync(join(tmpdir(), 'omnicraft-update-'))
}

describe('checkForUpdate', () => {
  it('creates the cache in the cache file parent directory', async () => {
    const root = freshCacheDir()
    const nested = join(root, 'subdirectory')
    const cacheFile = join(nested, 'cache.json')
    const fetchFn = (async () => ({ ok: true, json: async () => ({ version: '9.9.9' }) })) as unknown as typeof fetch

    await checkForUpdate('0.1.0', { fetchFn, cacheFile })

    expect(existsSync(cacheFile)).toBe(true)
    rmSync(root, { recursive: true, force: true })
  })

  it('returns the newer version from the registry payload', async () => {
    const fetchFn = (async () =>
      ({ ok: true, json: async () => ({ version: '9.9.9' }) })) as unknown as typeof fetch
    const latest = await checkForUpdate('0.1.0', {
      fetchFn,
      cacheFile: join(freshCacheDir(), 'cache.json'),
    })
    expect(latest).toBe('9.9.9')
  })

  it('returns null when installed is up to date', async () => {
    const fetchFn = (async () =>
      ({ ok: true, json: async () => ({ version: '0.1.0' }) })) as unknown as typeof fetch
    const latest = await checkForUpdate('0.2.0', {
      fetchFn,
      cacheFile: join(freshCacheDir(), 'cache.json'),
    })
    expect(latest).toBeNull()
  })

  it('notifies a prerelease install when the stable base is published', async () => {
    const fetchFn = (async () =>
      ({ ok: true, json: async () => ({ version: '1.0.5' }) })) as unknown as typeof fetch
    const latest = await checkForUpdate('1.0.5-beta.1', {
      fetchFn,
      cacheFile: join(freshCacheDir(), 'cache.json'),
    })
    expect(latest).toBe('1.0.5')
  })

  it('fails silently on network errors', async () => {
    const fetchFn = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    const latest = await checkForUpdate('0.1.0', {
      fetchFn,
      cacheFile: join(freshCacheDir(), 'cache.json'),
    })
    expect(latest).toBeNull()
  })

  it('caches the result and skips fetching within the interval', async () => {
    const dir = freshCacheDir()
    const cacheFile = join(dir, 'cache.json')
    let calls = 0
    const fetchFn = (async () => {
      calls++
      return { ok: true, json: async () => ({ version: '9.9.9' }) } as unknown as Response
    }) as unknown as typeof fetch

    await checkForUpdate('0.1.0', { fetchFn, cacheFile })
    await checkForUpdate('0.1.0', { fetchFn, cacheFile })
    expect(calls).toBe(1)
    expect(existsSync(cacheFile)).toBe(true)
    expect(JSON.parse(readFileSync(cacheFile, 'utf8')).latest).toBe('9.9.9')
  })
})
