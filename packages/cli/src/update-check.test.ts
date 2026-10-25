import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkForUpdate, compareVersions } from './update-check.js'

describe('compareVersions', () => {
  it('orders plain semver', () => {
    expect(compareVersions('0.2.0', '0.1.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0)
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0)
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0)
    expect(compareVersions('0.1.0', '0.2.0')).toBeLessThan(0)
  })

  it('ignores prerelease suffixes', () => {
    expect(compareVersions('0.2.0-rc.1', '0.2.0')).toBe(0)
  })
})

function freshCacheDir(): string {
  return mkdtempSync(join(tmpdir(), 'omnicraft-update-'))
}

describe('checkForUpdate', () => {
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
