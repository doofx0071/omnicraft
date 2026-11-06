import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkProjectName, checkRawProjectName, findCollisions, slugify } from './validators.js'

describe('slugify', () => {
  it('lowercases and hyphenates free-text names', () => {
    expect(slugify('My Awesome App')).toBe('my-awesome-app')
    expect(slugify('  Omni_Craft 2026! ')).toBe('omni-craft-2026')
  })

  it('collapses duplicate dashes and trims edges', () => {
    expect(slugify('--weird---name--')).toBe('weird-name')
  })

  it('returns empty string for symbol-only input', () => {
    expect(slugify('!!!')).toBe('')
  })
})

describe('checkProjectName', () => {
  it('accepts normal names', () => {
    expect(checkProjectName('my-app').ok).toBe(true)
    expect(checkProjectName('omnicraft-demo2').ok).toBe(true)
  })

  it('rejects empty and invalid npm names', () => {
    expect(checkProjectName('').ok).toBe(false)
    expect(checkProjectName('.hidden').ok).toBe(false)
    expect(checkProjectName('node_modules').ok).toBe(false)
    expect(checkProjectName('-lead-dash').ok).toBe(false)
  })
})

describe('checkRawProjectName', () => {
  it('slugifies before validating and returns the slug', () => {
    const result = checkRawProjectName('My App!')
    expect(result.slug).toBe('my-app')
    expect(result.ok).toBe(true)
  })

  it('fails when nothing remains after slugifying', () => {
    expect(checkRawProjectName('###').ok).toBe(false)
  })
})

describe('findCollisions', () => {
  let target = ''

  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), 'omnicraft-collisions-'))
  })

  afterEach(() => {
    rmSync(target, { recursive: true, force: true, maxRetries: 5 })
  })

  function touch(relative: string): void {
    const absolute = join(target, relative)
    mkdirSync(join(absolute, '..'), { recursive: true })
    writeFileSync(absolute, 'existing\n')
  }

  it('lists layer files that already exist in the target', () => {
    touch('client/src/index.tsx')
    touch('server/src/index.ts')
    touch('package.json')

    const { collisions, protectedFiles } = findCollisions(target, ['.', 'client', 'server'])

    expect(collisions).toEqual(['client/src/index.tsx', 'package.json', 'server/src/index.ts'])
    expect(protectedFiles).toEqual([])
  })

  it('prunes known generated directories and previews hidden template directories', () => {
    touch('client/node_modules/vite/index.js')
    touch('client/dist/bundle.js')
    touch('client/.vite/deps/react.js')
    touch('client/.next/cache/index')
    touch('.git/HEAD')
    touch('.github/workflows/ci.yml')
    touch('.local-settings/config.json')
    touch('server/dist/index.js')
    touch('client/src/index.tsx')

    const { collisions, protectedFiles } = findCollisions(target, ['.', 'client', 'server'])

    expect(collisions).toEqual([
      '.github/workflows/ci.yml',
      '.local-settings/config.json',
      'client/src/index.tsx',
    ])
    expect(protectedFiles).toEqual([])
  })

  it('still collects dotfiles that live directly inside layer roots', () => {
    touch('.env')
    touch('client/.env.local')
    touch('client/src/index.tsx')

    const { collisions, protectedFiles } = findCollisions(target, ['.', 'client'])

    expect(collisions).toEqual(['client/src/index.tsx'])
    expect(protectedFiles).toEqual(['.env', 'client/.env.local'])
  })

  it('previews Next.js integrated collisions under the app directory', () => {
    touch('app/db/schema.ts')
    touch('app/page.tsx')
    touch('client/src/App.tsx')

    // The scaffold preview walks ['.', 'client', 'server'] — the root layer is
    // recursive, so the Next.js integrated db layer dest (app/db) is covered.
    const { collisions } = findCollisions(target, ['.', 'client', 'server'])
    expect(collisions).toEqual(['app/db/schema.ts', 'app/page.tsx', 'client/src/App.tsx'])

    // An explicit app layer root previews the same files.
    const explicit = findCollisions(target, ['app'])
    expect(explicit.collisions).toEqual(['app/db/schema.ts', 'app/page.tsx'])
  })
})
